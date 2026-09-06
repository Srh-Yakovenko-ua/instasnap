import type { BookOrderStatisticsTopOrdersByCurrency } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { StatisticsTopOrders } from "./statistics-top-orders";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TOP_ORDERS: BookOrderStatisticsTopOrdersByCurrency = [
  {
    currency: "UAH",
    orders: [
      {
        booksCount: 3,
        currency: "UAH",
        derivedStatus: "received",
        id: "uah-1",
        orderDate: "2026-08-11",
        orderNumber: "ST-20260811-50",
        storeName: "Vivat",
        totalAmount: 3670,
      },
      {
        booksCount: 1,
        currency: "UAH",
        derivedStatus: "shipped",
        id: "uah-2",
        orderDate: null,
        orderNumber: null,
        storeName: "Комора",
        totalAmount: 1250,
      },
    ],
  },
  {
    currency: "EUR",
    orders: [
      {
        booksCount: 2,
        currency: "EUR",
        derivedStatus: "shipped",
        id: "eur-1",
        orderDate: "2026-07-03",
        orderNumber: "ST-20260703-45",
        storeName: "Book Depository",
        totalAmount: 52.9,
      },
    ],
  },
  { currency: "USD", orders: [] },
];

function renderTopOrders(currency: "EUR" | "UAH" | "USD" = "UAH") {
  return renderWithProviders(
    <StatisticsTopOrders
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      topOrdersByCurrency={TOP_ORDERS}
    />,
  );
}

describe("StatisticsTopOrders", () => {
  it("lists only the orders of the chosen currency", () => {
    renderTopOrders();

    expect(screen.getByText("ST-20260811-50")).toBeInTheDocument();
    expect(screen.queryByText("ST-20260703-45")).not.toBeInTheDocument();
  });

  it("shows the amount in the order's own currency", () => {
    renderTopOrders();

    expect(screen.getByText("3 670 UAH")).toBeInTheDocument();
  });

  it("shows the page currency as context rather than as its own control", () => {
    renderTopOrders("UAH");

    expect(screen.queryByRole("radio", { name: "EUR" })).not.toBeInTheDocument();
    expect(screen.getByText("UAH")).toBeInTheDocument();
  });

  it("says a currency is empty rather than showing another one's orders", () => {
    renderTopOrders("USD");

    expect(screen.getByText("У валюті USD немає замовлень.")).toBeInTheDocument();
  });

  it("opens the matching order by its identity rather than by searching its number", () => {
    renderTopOrders();

    expect(screen.getByRole("link", { name: /ST-20260811-50/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&orderId=uah-1",
    );
  });

  it("keeps an order without a number just as reachable as the rest", () => {
    renderTopOrders();

    expect(screen.getByText("Замовлення без номера")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Замовлення без номера/ })).toHaveAttribute(
      "href",
      expect.stringContaining("orderId="),
    );
  });
});

const MANY_ORDERS: BookOrderStatisticsTopOrdersByCurrency = [
  {
    currency: "UAH",
    orders: Array.from({ length: 8 }, (_, index) => ({
      booksCount: 1,
      currency: "UAH" as const,
      derivedStatus: "received" as const,
      id: `uah-${index}`,
      orderDate: "2026-08-11",
      orderNumber: `ORD-${index}`,
      storeName: "Vivat",
      totalAmount: 800 - index * 100,
    })),
  },
];

function renderManyOrders() {
  return renderWithProviders(
    <StatisticsTopOrders
      currency="UAH"
      drilldown={{
        currencyFilter: null,
        displayCurrency: "UAH",
        isStale: false,
        orderState: null,
        store: null,
      }}
      topOrdersByCurrency={MANY_ORDERS}
    />,
  );
}

describe("StatisticsTopOrders ranking", () => {
  it("marks only the first three places, and leaves the rest plain", () => {
    renderManyOrders();

    expect(screen.getAllByTestId("rank-sprig")).toHaveLength(3);
  });

  it("draws the priciest order full width and the others against it", () => {
    renderManyOrders();
    const bars = screen.getAllByTestId("top-order-bar");

    expect(bars.at(0)).toHaveStyle({ width: "100%" });
    expect(bars.at(1)).toHaveStyle({ width: "87.5%" });
  });

  it("shows five orders first and offers the rest", () => {
    renderManyOrders();

    expect(screen.getByText("ORD-4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Показати ще 3/ })).toBeInTheDocument();
  });

  it("reveals the rest and offers to fold them back", async () => {
    const user = userEvent.setup();
    renderManyOrders();

    await user.click(screen.getByRole("button", { name: /Показати ще 3/ }));

    expect(screen.getByRole("link", { name: /ORD-7/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Згорнути/ })).toBeInTheDocument();
  });

  it("leaves the fold control away when everything already fits", () => {
    renderTopOrders();

    expect(screen.queryByRole("button", { name: /Показати ще/ })).not.toBeInTheDocument();
  });
});

import type { BookOrderStatisticsStore } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeStatisticsStore } from "../../model/statistics.fixtures";
import { StatisticsStores } from "./statistics-stores";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const YAKABOO = makeStatisticsStore({
  averageBookPriceByCurrency: [{ average: 578.75, currency: "UAH" }],
  averageLandedBookCostByCurrency: [{ average: 582.69, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 841.67, currency: "UAH" }],
  booksCount: 13,
  booksCountByCurrency: [{ count: 13, currency: "UAH" }],
  drilldown: { targets: [{ booksCount: 13, destination: "history_received", ordersCount: 9 }] },
  ordersCount: 9,
  ordersCountByCurrency: [{ count: 9, currency: "UAH" }],
  store: "Yakaboo",
  totalsByCurrency: [{ currency: "UAH", total: 7575 }],
});

const VIVAT = makeStatisticsStore({
  booksCount: 6,
  booksCountByCurrency: [{ count: 6, currency: "UAH" }],
  drilldown: {
    targets: [
      { booksCount: 2, destination: "in_transit", ordersCount: 1 },
      { booksCount: 4, destination: "history_received", ordersCount: 3 },
    ],
  },
  ordersCount: 4,
  ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
  store: "Vivat",
  totalsByCurrency: [{ currency: "UAH", total: 4840 }],
});

function renderStores({
  currency = "UAH" as "EUR" | "UAH",
  highlightedStoreKey = null as null | string,
  onHighlight = vi.fn(),
  stores = [YAKABOO, VIVAT] as BookOrderStatisticsStore[],
} = {}) {
  return renderWithProviders(
    <StatisticsStores
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      highlightedStoreKey={highlightedStoreKey}
      onHighlight={onHighlight}
      stores={stores}
    />,
  );
}

describe("StatisticsStores", () => {
  it("ranks the stores by spend and names the currency it counted in", () => {
    renderStores();

    expect(screen.getByText("Рейтинг магазинів")).toBeInTheDocument();
    expect(screen.getByText("7 575 UAH")).toBeInTheDocument();
    expect(screen.getByText("UAH")).toBeInTheDocument();
  });

  it("shows the counts of the chosen currency next to the money", () => {
    renderStores();

    expect(screen.getByText("9 замовлень · 13 книг")).toBeInTheDocument();
  });

  it("says the actual per-book cost in words, not as a technical term", () => {
    renderStores();

    expect(screen.getByText("Фактично за книгу 582,69 UAH")).toBeInTheDocument();
    expect(screen.getByText("Середній чек 841,67 UAH")).toBeInTheDocument();
    expect(screen.queryByText(/реальна/)).toBe(null);
  });

  it("keeps the raw price out of the row and behind an explanation", () => {
    renderStores();

    expect(screen.queryByText(/578,75/)).toBe(null);
    expect(screen.getByRole("button", { name: "До знижок і доставки" })).toBeInTheDocument();
  });

  it("drops the money details once the metric stops being money", async () => {
    const user = userEvent.setup();
    renderStores();

    await user.click(screen.getByRole("radio", { name: "Замовлення" }));

    expect(screen.getByText("9 замовлень")).toBeInTheDocument();
    expect(screen.queryByText("Фактично за книгу 582,69 UAH")).toBe(null);
    expect(screen.queryByText("7 575 UAH")).toBe(null);
  });

  it("opens the only place a store's orders ended up", () => {
    renderStores();

    expect(screen.getByRole("link", { name: "Yakaboo" })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&store=Yakaboo&currency=UAH",
    );
  });

  it("offers a choice when a store's orders ended up in two places", async () => {
    const user = userEvent.setup();
    renderStores();

    await user.click(screen.getByRole("button", { name: "Vivat" }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toBeInTheDocument();
  });

  it("tells the paired card which store the reader is on", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    renderStores({ onHighlight });

    await user.hover(screen.getByText("Yakaboo"));

    expect(onHighlight).toHaveBeenCalledWith("yakaboo");
  });

  it("says a currency is empty rather than falling back to another one", () => {
    renderStores({ currency: "EUR" });

    expect(screen.getByText("Немає витрат у EUR за вибраний період.")).toBeInTheDocument();
    expect(screen.queryByText("7 575 UAH")).toBe(null);
  });
});

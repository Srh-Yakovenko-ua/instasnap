import type { BookOrderStatisticsRecords } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { StatisticsRecords } from "./statistics-records";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const RECORDS: BookOrderStatisticsRecords = {
  bestValueStoreByCurrency: [
    {
      averageLandedBookCost: 24.33,
      currency: "UAH",
      drilldown: { targets: [{ booksCount: 3, destination: "history_received", ordersCount: 2 }] },
      eligibleBooksCount: 3,
      store: "QA Test Книги",
      storeKey: "qa test книги",
    },
  ],
  largestOrderByCurrency: [
    {
      currency: "UAH",
      order: {
        booksCount: 1,
        currency: "UAH",
        derivedStatus: "received",
        id: "largest-order",
        orderDate: "2026-02-06",
        orderNumber: "ORD-20260206",
        storeName: "Астролябія",
        totalAmount: 4250,
      },
    },
  ],
  mostActiveStore: {
    byBooks: null,
    byOrders: {
      booksCount: 13,
      drilldown: {
        targets: [
          { booksCount: 4, destination: "in_transit", ordersCount: 3 },
          { booksCount: 9, destination: "history_received", ordersCount: 6 },
        ],
      },
      ordersCount: 9,
      store: "Yakaboo",
      storeKey: "yakaboo",
    },
  },
  mostBooksInOrder: {
    booksCount: 6,
    currency: "UAH",
    derivedStatus: "active",
    id: "fullest-order",
    orderDate: "2026-07-24",
    orderNumber: "ST-20260724-49",
    storeName: "Book24",
    totalAmount: 900,
  },
  recordMonthByCurrency: [
    {
      booksCount: 31,
      currency: "UAH",
      drilldown: {
        targets: [
          { booksCount: 10, destination: "in_transit", ordersCount: 5 },
          { booksCount: 21, destination: "history_received", ordersCount: 13 },
        ],
      },
      month: "2026-08",
      ordersCount: 18,
      total: 18263,
    },
  ],
  scope: {
    isPeriodFiltered: true,
    isTruncated: false,
    period: { from: "2026-01-01", to: "2026-08-22" },
  },
};

function renderRecords({
  currency = "UAH" as const,
  records = RECORDS,
}: {
  currency?: "EUR" | "UAH";
  records?: BookOrderStatisticsRecords;
} = {}) {
  return renderWithProviders(
    <StatisticsRecords
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      records={records}
    />,
  );
}

describe("StatisticsRecords", () => {
  it("keeps its name and says which orders it looked at", () => {
    renderRecords();

    expect(screen.getByText("Рекорди")).toBeInTheDocument();
    expect(
      screen.getByText("Рекорди серед замовлень, оформлених 1 січня – 22 серпня 2026 р."),
    ).toBeInTheDocument();
  });

  it("says so plainly when nothing bounds the records", () => {
    renderRecords({
      records: { ...RECORDS, scope: { ...RECORDS.scope, period: { from: null, to: null } } },
    });

    expect(screen.getByText("Рекорди за весь час.")).toBeInTheDocument();
  });

  it("splits the money records from the counting ones", () => {
    renderRecords();

    expect(screen.getByText("За витратами")).toBeInTheDocument();
    expect(screen.getByText("За кількістю")).toBeInTheDocument();
  });

  it("names each record by what it measures", () => {
    renderRecords();

    expect(screen.getByText("Найбільше витрат за місяць")).toBeInTheDocument();
    expect(screen.getByText("Найдорожче замовлення")).toBeInTheDocument();
    expect(screen.getByText("Найнижча фактична ціна книги")).toBeInTheDocument();
    expect(screen.getByText("Найбільше книг в одному замовленні")).toBeInTheDocument();
    expect(screen.getByText("Найбільше замовлень у магазині")).toBeInTheDocument();
  });

  it("shows enough of the winning order to recognise it", () => {
    renderRecords();

    expect(screen.getByText("4 250 UAH")).toBeInTheDocument();
    expect(
      screen.getByText(/Астролябія · ORD-20260206 · 1 книга · 6 лют. 2026 р./),
    ).toBeInTheDocument();
  });

  it("keeps a missing money record in place instead of dropping the row", () => {
    renderRecords({ currency: "EUR" });

    expect(screen.getByText("Найбільше витрат за місяць")).toBeInTheDocument();
    expect(screen.getByText("Немає витрат у EUR за вибраний період.")).toBeInTheDocument();
    expect(screen.getByText("Немає замовлень із визначеною сумою в EUR.")).toBeInTheDocument();
  });

  it("leaves the counting records untouched when the money currency has nothing", () => {
    renderRecords({ currency: "EUR" });

    expect(screen.getByText("6 книг")).toBeInTheDocument();
    expect(screen.getByText("Yakaboo — 9 замовлень")).toBeInTheDocument();
  });

  it("asks for more books rather than hiding the price record", () => {
    renderRecords({ records: { ...RECORDS, bestValueStoreByCurrency: [] } });

    expect(screen.getByText("Недостатньо даних")).toBeInTheDocument();
    expect(screen.getByText("Потрібно щонайменше 2 книги в одному магазині.")).toBeInTheDocument();
  });

  it("opens the priciest order by its identity", () => {
    renderRecords();

    expect(screen.getByRole("link", { name: "Найдорожче замовлення" })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&orderId=largest-order",
    );
  });

  it("opens the fullest order by its identity, wherever it now lives", () => {
    renderRecords();

    expect(
      screen.getByRole("link", { name: "Найбільше книг в одному замовленні" }),
    ).toHaveAttribute("href", "/delivery/in-transit?orderId=fullest-order");
  });

  it("offers both destinations of a record month, on its own month bounds", async () => {
    const user = userEvent.setup();
    renderRecords();

    await user.click(screen.getByRole("button", { name: "Найбільше витрат за місяць" }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?orderedFrom=2026-08-01&orderedTo=2026-08-31&currency=UAH",
    );
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&from=2026-08-01&to=2026-08-31&currency=UAH",
    );
  });

  it("keeps the display currency out of a record that only counts orders", async () => {
    const user = userEvent.setup();
    renderRecords();

    await user.click(screen.getByRole("button", { name: "Найбільше замовлень у магазині" }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?store=Yakaboo",
    );
  });

  it("offers the cheapest-book store as context, never as the very books it counted", () => {
    renderRecords();

    expect(
      screen.queryByRole("link", { name: "Найнижча фактична ціна книги" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Рекорд рахується лише за книгами з відомою фактичною ціною."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Переглянути замовлення магазину/ })).toHaveAttribute(
      "href",
      `/delivery/history?tab=received&store=${encodeURIComponent("QA Test Книги").replace(/%20/g, "+")}&currency=UAH`,
    );
  });

  it("warns that a cut-short source cannot hold an absolute record", () => {
    renderRecords({ records: { ...RECORDS, scope: { ...RECORDS.scope, isTruncated: true } } });

    expect(screen.getByText("Неповні дані")).toBeInTheDocument();
  });

  it("stops offering aggregate drill-downs once the source was cut short, but keeps exact orders", () => {
    renderRecords({ records: { ...RECORDS, scope: { ...RECORDS.scope, isTruncated: true } } });

    expect(
      screen.queryByRole("button", { name: "Найбільше витрат за місяць" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Найдорожче замовлення" })).toBeInTheDocument();
  });
});

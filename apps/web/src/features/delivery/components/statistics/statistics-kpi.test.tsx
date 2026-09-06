import type { BookOrderStatisticsSnapshot, BookOrderStatisticsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsKpi } from "./statistics-kpi";

const SNAPSHOT: BookOrderStatisticsSnapshot = {
  activeBooksCount: 46,
  activeMoneyCoverageByCurrency: [],
  activeOrdersCount: 38,
  activeShipmentsCount: 31,
  activeTotalsByCurrency: [
    { currency: "UAH", total: 22198 },
    { currency: "EUR", total: 83.4 },
  ],
};

const SUMMARY: BookOrderStatisticsView["summary"] = {
  activeBooksCount: 46,
  activeShipmentsCount: 31,
  activeTotalsByCurrency: SNAPSHOT.activeTotalsByCurrency,
  averageBookPriceByCurrency: [{ average: 725.06, currency: "UAH" }],
  averageBooksPerOrder: 1.4,
  averageOrderAmountByCurrency: [{ average: 1000.2, currency: "UAH" }],
  booksCount: 70,
  cancelledOrdersCount: 0,
  cancelledTotalsByCurrency: [],
  financialCoverageByCurrency: [],
  ordersCount: 51,
  priceCoverageByCurrency: [],
  receivedBooksCount: 25,
  receivedTotalsByCurrency: [],
  shipmentsCount: 51,
  totalsByCurrency: [
    { currency: "UAH", total: 40008 },
    { currency: "EUR", total: 170.4 },
  ],
};

function view(comparison: BookOrderStatisticsView["comparison"] = null): BookOrderStatisticsView {
  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison,
    costs: [],
    daily: [],
    dynamics: { buckets: [], granularity: "month" },
    insights: { books: [], orders: [], spendByCurrency: [] },
    landedCost: [],
    lifecycle: {
      books: {
        active: 0,
        cancelled: 0,
        partially_received: 0,
        partially_shipped: 0,
        received: 0,
        shipped: 0,
        total: 0,
      },
      comparison: null,
      orders: {
        active: 0,
        cancelled: 0,
        partially_received: 0,
        partially_shipped: 0,
        received: 0,
        shipped: 0,
        total: 0,
      },
    },
    meta: {
      activeSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
      comparisonPeriod: null,
      comparisonSource: null,
      currentPeriod: { from: "2026-01-01", to: "2026-08-21" },
      currentSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
    },
    monthly: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: { isPeriodFiltered: true, isTruncated: false, period: { from: null, to: null } },
    },
    snapshot: SNAPSHOT,
    summary: SUMMARY,
    topOrders: [],
    topOrdersByCurrency: [],
  };
}

const COMPARISON: BookOrderStatisticsView["comparison"] = {
  averageBookPriceByCurrency: [
    {
      absoluteDelta: 292.34,
      currency: "UAH",
      current: 725.06,
      percentDelta: 67.6,
      previous: 432.72,
    },
  ],
  averageBooksPerOrder: { absoluteDelta: null, current: 1.4, percentDelta: null, previous: null },
  averageOrderAmountByCurrency: [],
  booksCount: { absoluteDelta: 25, current: 70, percentDelta: 55.6, previous: 45 },
  ordersCount: { absoluteDelta: 29, current: 51, percentDelta: 131.8, previous: 22 },
  receivedBooksCount: { absoluteDelta: -20, current: 25, percentDelta: -44.4, previous: 45 },
  shipmentsCount: { absoluteDelta: 29, current: 51, percentDelta: 131.8, previous: 22 },
  totalsByCurrency: [
    { absoluteDelta: 24846, currency: "UAH", current: 40008, percentDelta: 163.9, previous: 15162 },
  ],
};

function renderKpi(comparison: BookOrderStatisticsView["comparison"] = null) {
  return renderWithProviders(
    <StatisticsKpi currency="UAH" snapshot={SNAPSHOT} view={view(comparison)} />,
  );
}

describe("StatisticsKpi", () => {
  it("shows the chosen currency as the headline and the rest as a footnote", () => {
    renderKpi();

    expect(screen.getByText("40 008 UAH")).toBeInTheDocument();
    expect(screen.getByText("Інші: 170,4 EUR")).toBeInTheDocument();
  });

  it("labels the other currencies instead of dropping them in bare", () => {
    renderKpi();

    expect(screen.getByText("Інші: 83,4 EUR")).toBeInTheDocument();
    expect(screen.queryByText("170,4 EUR")).not.toBeInTheDocument();
  });

  it("says the snapshot is current once, in the group heading and not in the card", () => {
    renderKpi();

    expect(screen.getAllByText("Станом на зараз")).toHaveLength(1);
    expect(
      screen.getByText("Гроші в дорозі").closest("[data-slot='stat-card']"),
    ).not.toHaveTextContent("Станом на зараз");
  });

  it("shows no comparison at all until one is asked for", () => {
    renderKpi();

    expect(screen.queryByText(/було/)).not.toBeInTheDocument();
  });

  it("puts the change and the previous value next to each metric", () => {
    renderKpi(COMPARISON);

    expect(screen.getByText("163,9%")).toBeInTheDocument();
    expect(screen.getByText("було 15 162 UAH")).toBeInTheDocument();
  });

  it("never compares the current snapshot against a past period", () => {
    renderKpi(COMPARISON);

    expect(screen.queryByText("було 22 198 UAH")).not.toBeInTheDocument();
  });

  it("keeps the compact metric row down to the change itself", () => {
    renderKpi(COMPARISON);

    expect(screen.getByText("55,6%")).toBeInTheDocument();
    expect(screen.queryByText("було 22")).not.toBeInTheDocument();
  });

  it("shows a dash instead of a zero when the currency has no value", () => {
    renderWithProviders(<StatisticsKpi currency="USD" snapshot={SNAPSHOT} view={view()} />);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("names the four approved metrics and drops the old money-in-transit wording", () => {
    renderKpi();

    expect(screen.getByText("Витрачено")).toBeInTheDocument();
    expect(screen.getByText("Середня ціна книги")).toBeInTheDocument();
    expect(screen.getByText("Середній чек")).toBeInTheDocument();
    expect(screen.getByText("Гроші в дорозі")).toBeInTheDocument();
    expect(screen.queryByText("В активних замовленнях")).not.toBeInTheDocument();
    expect(screen.queryByText("Середній чек замовлення")).not.toBeInTheDocument();
  });

  it("separates the period metrics from the current snapshot", () => {
    renderKpi();

    expect(screen.getAllByText("За вибраний період")).toHaveLength(1);
    expect(screen.getAllByText("Станом на зараз")).toHaveLength(1);
  });

  it("puts the books-per-order helper inside the average order card", () => {
    renderKpi();

    expect(
      screen.getByText("1,4 книги / замовлення").closest("[data-slot='stat-card']"),
    ).toHaveTextContent("Середній чек");
  });

  it("says the average book price is measured before discounts and delivery", () => {
    renderKpi();

    expect(screen.getByText("До знижок і доставки")).toBeInTheDocument();
  });

  it("keeps the snapshot free of a comparison even when one is asked for", () => {
    renderKpi(COMPARISON);

    expect(screen.queryByText("було 22 198 UAH")).not.toBeInTheDocument();
  });

  it("names the active orders next to the books and the parcels", () => {
    renderKpi();

    expect(screen.getByText("38 замовлень · 46 книг · 31 посилка")).toBeInTheDocument();
  });

  it("offers the approved chips and drops the promoted and received ones", () => {
    renderKpi();

    expect(screen.getByText("Замовлень")).toBeInTheDocument();
    expect(screen.getByText("Книг")).toBeInTheDocument();
    expect(screen.getByText("Посилок")).toBeInTheDocument();
    expect(screen.queryByText("Книг на замовлення")).not.toBeInTheDocument();
    expect(screen.queryByText("Отримано")).not.toBeInTheDocument();
  });

  it("says how many orders were left out of a partial spend", () => {
    renderWithProviders(
      <StatisticsKpi
        currency="UAH"
        snapshot={SNAPSHOT}
        view={{
          ...view(),
          summary: {
            ...SUMMARY,
            financialCoverageByCurrency: [
              { currency: "UAH", ordersInScope: 51, ordersWithResolvedAmount: 48 },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("3 замовлення без визначеної суми")).toBeInTheDocument();
  });

  it("says nothing about coverage once every order carries an amount", () => {
    renderWithProviders(
      <StatisticsKpi
        currency="UAH"
        snapshot={SNAPSHOT}
        view={{
          ...view(),
          summary: {
            ...SUMMARY,
            financialCoverageByCurrency: [
              { currency: "UAH", ordersInScope: 51, ordersWithResolvedAmount: 51 },
            ],
          },
        }}
      />,
    );

    expect(screen.queryByText(/без визначеної суми/)).not.toBeInTheDocument();
  });

  it("says a currency is missing rather than showing it as a zero", () => {
    renderWithProviders(<StatisticsKpi currency="USD" snapshot={SNAPSHOT} view={view()} />);

    expect(screen.getAllByText("Немає даних у USD").length).toBeGreaterThan(0);
  });
});

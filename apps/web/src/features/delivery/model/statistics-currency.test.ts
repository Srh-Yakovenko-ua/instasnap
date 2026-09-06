import type { BookOrderStatisticsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { statisticsCurrencies } from "./statistics-currency";

function view(overrides: Partial<BookOrderStatisticsView>): BookOrderStatisticsView {
  const emptySummary = {
    activeBooksCount: 0,
    activeShipmentsCount: 0,
    activeTotalsByCurrency: [],
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: null,
    averageOrderAmountByCurrency: [],
    booksCount: 0,
    cancelledOrdersCount: 0,
    cancelledTotalsByCurrency: [],
    financialCoverageByCurrency: [],
    ordersCount: 0,
    priceCoverageByCurrency: [],
    receivedBooksCount: 0,
    receivedTotalsByCurrency: [],
    shipmentsCount: 0,
    totalsByCurrency: [],
  };

  const emptyStages = {
    active: 0,
    cancelled: 0,
    partially_received: 0,
    partially_shipped: 0,
    received: 0,
    shipped: 0,
    total: 0,
  };

  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison: null,
    costs: [],
    daily: [],
    dynamics: { buckets: [], granularity: "month" },
    insights: { books: [], orders: [], spendByCurrency: [] },
    landedCost: [],
    lifecycle: { books: emptyStages, comparison: null, orders: emptyStages },
    meta: {
      activeSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
      comparisonPeriod: null,
      comparisonSource: null,
      currentPeriod: { from: null, to: null },
      currentSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
    },
    monthly: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: { isPeriodFiltered: false, isTruncated: false, period: { from: null, to: null } },
    },
    snapshot: {
      activeBooksCount: 0,
      activeMoneyCoverageByCurrency: [],
      activeOrdersCount: 0,
      activeShipmentsCount: 0,
      activeTotalsByCurrency: [],
    },
    summary: emptySummary,
    topOrders: [],
    topOrdersByCurrency: [],
    ...overrides,
  };
}

describe("statisticsCurrencies", () => {
  it("keeps the canonical order whatever order the data arrives in", () => {
    const currencies = statisticsCurrencies(
      view({
        summary: {
          ...view({}).summary,
          totalsByCurrency: [
            { currency: "USD", total: 10 },
            { currency: "UAH", total: 20 },
          ],
        },
      }),
    );

    expect(currencies).toEqual(["UAH", "USD"]);
  });

  it("counts a currency that only shows up in the monthly series", () => {
    expect(
      statisticsCurrencies(
        view({
          monthly: [
            {
              booksCount: 1,
              month: "2026-01",
              ordersCount: 1,
              totalsByCurrency: [{ currency: "EUR", total: 12 }],
            },
          ],
        }),
      ),
    ).toEqual(["EUR"]);
  });

  it("ignores a currency whose top-order list is empty", () => {
    expect(
      statisticsCurrencies(view({ topOrdersByCurrency: [{ currency: "USD", orders: [] }] })),
    ).toEqual([]);
  });
});

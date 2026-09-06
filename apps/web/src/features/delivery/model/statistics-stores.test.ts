import type { BookOrderStatisticsStore } from "@app/shared";

import { normalizeName } from "@app/shared";
import { describe, expect, it } from "vitest";

import { storeRows, storeScatter } from "./statistics-stores";

function store(overrides: Partial<BookOrderStatisticsStore> & { store: string }) {
  return {
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: null,
    averageLandedBookCostByCurrency: [],
    averageOrderAmountByCurrency: [],
    booksCount: 0,
    booksCountByCurrency: [],
    deliveryTotalByCurrency: [],
    discountTotalByCurrency: [],
    drilldown: { targets: [] },
    landedCoverageByCurrency: [],
    landedEligibleBooksCountByCurrency: [],
    ordersCount: 0,
    ordersCountByCurrency: [],
    storeKey: normalizeName(overrides.store),
    totalsByCurrency: [],
    ...overrides,
  } satisfies BookOrderStatisticsStore;
}

const YAKABOO = store({
  averageBookPriceByCurrency: [{ average: 578, currency: "UAH" }],
  averageLandedBookCostByCurrency: [{ average: 582, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 841, currency: "UAH" }],
  booksCount: 13,
  booksCountByCurrency: [{ count: 13, currency: "UAH" }],
  landedCoverageByCurrency: [
    { booksInScope: 13, booksWithLandedCost: 13, coveragePercent: 100, currency: "UAH" },
  ],
  landedEligibleBooksCountByCurrency: [{ count: 13, currency: "UAH" }],
  ordersCount: 9,
  ordersCountByCurrency: [{ count: 9, currency: "UAH" }],
  store: "Yakaboo",
  totalsByCurrency: [{ currency: "UAH", total: 7575 }],
});

const VIVAT = store({
  booksCount: 6,
  booksCountByCurrency: [{ count: 6, currency: "UAH" }],
  ordersCount: 4,
  ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
  store: "Vivat",
  totalsByCurrency: [{ currency: "UAH", total: 4840 }],
});

describe("storeRows", () => {
  it("ranks by the chosen metric and scales the bar against the leader", () => {
    const rows = storeRows({
      currency: "UAH",
      metric: "spend",
      stores: [VIVAT, YAKABOO],
    });

    expect(rows.map((row) => row.store)).toEqual(["Yakaboo", "Vivat"]);
    expect(rows[0]?.share).toBe(1);
    expect(rows[1]?.share).toBeCloseTo(4840 / 7575);
  });

  it("re-ranks when the metric switches to counts", () => {
    const rows = storeRows({
      currency: "UAH",
      metric: "orders",
      stores: [VIVAT, YAKABOO],
    });

    expect(rows.map((row) => row.value)).toEqual([9, 4]);
  });

  it("hides a store that has nothing in the chosen currency", () => {
    const rows = storeRows({
      currency: "EUR",
      metric: "spend",
      stores: [YAKABOO],
    });

    expect(rows).toEqual([]);
  });
});

describe("storeScatter", () => {
  it("plots a store that has enough landed data", () => {
    const { excluded, points } = storeScatter({ currency: "UAH", stores: [YAKABOO] });

    expect(points).toEqual([
      {
        averageLandedBookCost: 582,
        averageOrderAmount: 841,
        coveragePercent: 100,
        currencyBooksCount: 13,
        currencyOrdersCount: 9,
        landedEligibleBooksCount: 13,
        store: "Yakaboo",
        storeKey: "yakaboo",
      },
    ]);
    expect(excluded).toEqual([]);
  });

  it("lists rather than plots a store with no landed average", () => {
    const { excluded, points } = storeScatter({ currency: "UAH", stores: [VIVAT] });

    expect(points).toEqual([]);
    expect(excluded.map((entry) => entry.store)).toEqual(["Vivat"]);
  });

  it("keeps a single landed book out of the chart", () => {
    const thin = store({
      averageLandedBookCostByCurrency: [{ average: 400, currency: "UAH" }],
      averageOrderAmountByCurrency: [{ average: 400, currency: "UAH" }],
      landedCoverageByCurrency: [
        { booksInScope: 1, booksWithLandedCost: 1, coveragePercent: 100, currency: "UAH" },
      ],
      landedEligibleBooksCountByCurrency: [{ count: 1, currency: "UAH" }],
      ordersCount: 1,
      ordersCountByCurrency: [{ count: 1, currency: "UAH" }],
      store: "Комора",
    });

    const { excluded, points } = storeScatter({ currency: "UAH", stores: [thin] });

    expect(points).toEqual([]);
    expect(excluded.map((entry) => entry.store)).toEqual(["Комора"]);
  });
});

describe("storeRows currency-specific counts", () => {
  const MIXED = store({
    booksCount: 10,
    booksCountByCurrency: [
      { count: 8, currency: "UAH" },
      { count: 2, currency: "EUR" },
    ],
    ordersCount: 6,
    ordersCountByCurrency: [
      { count: 5, currency: "UAH" },
      { count: 1, currency: "EUR" },
    ],
    store: "Mixed",
    totalsByCurrency: [
      { currency: "UAH", total: 5000 },
      { currency: "EUR", total: 12 },
    ],
  });

  it("counts only the orders of the chosen currency in the spend ranking", () => {
    const [row] = storeRows({
      currency: "EUR",
      metric: "spend",
      stores: [MIXED],
    });

    expect({ books: row?.booksCount, orders: row?.ordersCount }).toEqual({ books: 2, orders: 1 });
  });

  it("counts every currency in the orders ranking, which is currency independent", () => {
    const [row] = storeRows({
      currency: "EUR",
      metric: "orders",
      stores: [MIXED],
    });

    expect({ books: row?.booksCount, orders: row?.ordersCount }).toEqual({ books: 10, orders: 6 });
  });

  it("works out books per order from the counts it actually showed", () => {
    const [row] = storeRows({
      currency: "UAH",
      metric: "spend",
      stores: [MIXED],
    });

    expect(row?.booksPerOrder).toBeCloseTo(1.6, 2);
  });
});

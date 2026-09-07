import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsRecords,
  BookOrderStatisticsTopOrder,
  Currency,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { PulseEntry } from "./statistics-pulse-selection";

import { PULSE_SELECTION, selectPulseEntries } from "./statistics-pulse-selection";

const SCOPE = {
  isPeriodFiltered: true,
  isTruncated: false,
  period: { from: "2026-01-01", to: "2026-08-26" },
};

const ALL_TIME_SCOPE = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

const SPEND_CHANGE: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 4000,
  code: "spend_change",
  currency: "UAH",
  current: 16000,
  percentDelta: 33,
  previous: 12000,
  tone: "neutral",
};

const PRICE_CHANGE: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 120,
  code: "avg_book_price_change",
  currency: "UAH",
  current: 620,
  percentDelta: 24,
  previous: 500,
  tone: "neutral",
};

const STORE_MOVEMENT: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 3000,
  code: "store_movement",
  currency: "UAH",
  current: 9000,
  percentDelta: 50,
  previous: 6000,
  store: "Yakaboo",
  tone: "neutral",
};

const DELIVERY_SHARE: BookOrderStatisticsPulseSignal = {
  code: "delivery_share",
  currency: "UAH",
  deliveryShareOfSpendPercent: 12,
  deliveryTotal: 1440,
  tone: "attention",
};

const DISCOUNT_SAVINGS: BookOrderStatisticsPulseSignal = {
  code: "discount_savings",
  currency: "UAH",
  discountShareOfRawSubtotalPercent: 9,
  discountTotal: 1000,
  tone: "positive",
};

const ORDERS_CHANGE: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 5,
  code: "orders_count_change",
  current: 26,
  percentDelta: 24,
  previous: 21,
  tone: "neutral",
};

const RECORD_MONTH_SIGNAL: BookOrderStatisticsPulseSignal = {
  booksCount: 20,
  code: "record_month",
  currency: "UAH",
  month: "2026-03",
  ordersCount: 9,
  scope: SCOPE,
  tone: "neutral",
  total: 12000,
};

const ORDERS_BUCKET: BookOrderStatisticsPulseSignal = {
  bucketKey: "2026-03",
  code: "record_orders_bucket",
  from: "2026-03-01",
  ordersCount: 9,
  scope: SCOPE,
  to: "2026-03-31",
  tone: "neutral",
};

const BOOKS_BUCKET: BookOrderStatisticsPulseSignal = {
  booksCount: 20,
  bucketKey: "2026-03",
  code: "record_books_bucket",
  from: "2026-03-01",
  scope: SCOPE,
  to: "2026-03-31",
  tone: "neutral",
};

function codesOf(entries: PulseEntry[]): string[] {
  return entries.map((entry) => (entry.source === "record" ? entry.fact.code : entry.signal.code));
}

function insightsOf({
  books = [] as BookOrderStatisticsPulseSignal[],
  orders = [] as BookOrderStatisticsPulseSignal[],
  spend = [] as BookOrderStatisticsPulseSignal[],
  spendCurrency = "UAH" as Currency,
} = {}): BookOrderStatisticsInsights {
  return { books, orders, spendByCurrency: [{ currency: spendCurrency, signals: spend }] };
}

function orderOf(id: string, overrides: Partial<BookOrderStatisticsTopOrder> = {}) {
  return {
    booksCount: 4,
    currency: "UAH" as Currency,
    derivedStatus: "received" as const,
    id,
    orderDate: "2026-03-03",
    orderNumber: "A-1",
    storeName: "Yakaboo",
    totalAmount: 5200,
    ...overrides,
  };
}

function recordsOf(
  overrides: Partial<BookOrderStatisticsRecords> = {},
): BookOrderStatisticsRecords {
  return {
    bestValueStoreByCurrency: [],
    largestOrderByCurrency: [],
    mostActiveStore: { byBooks: null, byOrders: null },
    mostBooksInOrder: null,
    recordMonthByCurrency: [],
    scope: SCOPE,
    ...overrides,
  };
}

function storeLeaderOf(store: string) {
  return {
    booksCount: 20,
    drilldown: { targets: [] },
    ordersCount: 9,
    store,
    storeKey: store.toLowerCase(),
  };
}

const FULL_RECORDS = recordsOf({
  bestValueStoreByCurrency: [
    {
      averageLandedBookCost: 620,
      currency: "UAH",
      drilldown: { targets: [] },
      eligibleBooksCount: 9,
      store: "Vivat",
      storeKey: "vivat",
    },
  ],
  largestOrderByCurrency: [{ currency: "UAH", order: orderOf("order-largest") }],
  mostActiveStore: { byBooks: storeLeaderOf("Yakaboo"), byOrders: storeLeaderOf("Yakaboo") },
  mostBooksInOrder: orderOf("order-most-books", { booksCount: 11 }),
  recordMonthByCurrency: [
    {
      booksCount: 20,
      currency: "UAH",
      drilldown: { targets: [] },
      month: "2026-03",
      ordersCount: 9,
      total: 12000,
    },
  ],
});

function select({
  currency = "UAH" as Currency,
  hasComparison = false,
  insights = insightsOf(),
  metric = "spend" as "books" | "orders" | "spend",
  records = FULL_RECORDS,
} = {}) {
  return selectPulseEntries({ currency, hasComparison, insights, metric, records });
}

describe("selectPulseEntries with a comparison period", () => {
  it("keeps only the insights that describe a change, in the order the backend ranked them", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ spend: [SPEND_CHANGE, PRICE_CHANGE, STORE_MOVEMENT] }),
    });

    expect(codesOf(entries)).toEqual(["spend_change", "avg_book_price_change", "store_movement"]);
  });

  it("drops a period fact that rode along with the changes", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ orders: [ORDERS_CHANGE, ORDERS_BUCKET] }),
      metric: "orders",
    });

    expect(codesOf(entries)).toEqual(["orders_count_change"]);
  });

  it("still reports delivery and discounts, which read as period context either way", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ spend: [SPEND_CHANGE, DELIVERY_SHARE, DISCOUNT_SAVINGS] }),
    });

    expect(codesOf(entries)).toEqual(["spend_change", "delivery_share", "discount_savings"]);
  });

  it("never fills a comparison card with records", () => {
    const entries = select({ hasComparison: true, insights: insightsOf() });

    expect(entries).toEqual([]);
  });

  it("stops at four rows", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({
        spend: [SPEND_CHANGE, PRICE_CHANGE, STORE_MOVEMENT, DELIVERY_SHARE, DISCOUNT_SAVINGS],
      }),
    });

    expect(entries).toHaveLength(PULSE_SELECTION.rowLimit.comparison);
    expect(codesOf(entries)).not.toContain("discount_savings");
  });
});

describe("selectPulseEntries when a comparison produced no change worth naming", () => {
  it("falls back to the period facts instead of leaving the card blank", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL] }),
    });

    expect(codesOf(entries)).toEqual(["record_month"]);
  });

  it("leaves a lone change alone rather than padding it with period facts", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ orders: [ORDERS_CHANGE, ORDERS_BUCKET] }),
      metric: "orders",
    });

    expect(entries).toHaveLength(1);
  });

  it("keeps the records out of the fallback the way it keeps them out of the changes", () => {
    const entries = select({
      hasComparison: true,
      insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL] }),
    });

    expect(entries.every((entry) => entry.source === "signal")).toBe(true);
  });

  it("stops the fallback at four rows and states each bucket once", () => {
    const bucketOf = (bucketKey: string) => ({ ...BOOKS_BUCKET, bucketKey });
    const entries = select({
      hasComparison: true,
      insights: insightsOf({
        books: ["2026-01", "2026-02", "2026-01", "2026-03", "2026-04", "2026-05"].map(bucketOf),
      }),
      metric: "books",
    });
    const keys = entries.map((entry) =>
      entry.source === "signal" && "bucketKey" in entry.signal ? entry.signal.bucketKey : null,
    );

    expect(entries).toHaveLength(PULSE_SELECTION.rowLimit.comparison);
    expect(keys).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("says nothing when neither a change nor a period fact survived", () => {
    expect(select({ hasComparison: true, insights: insightsOf() })).toEqual([]);
  });
});

describe("selectPulseEntries without a comparison period", () => {
  it("leads with the backend period facts and tops up from the records", () => {
    const entries = select({ insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL] }) });

    expect(codesOf(entries)).toEqual(["record_month", "largest_order", "best_value_store"]);
  });

  it("lets a backend delivery insight take the slot a record would have had", () => {
    const entries = select({
      insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL, DELIVERY_SHARE] }),
    });

    expect(codesOf(entries)).toEqual(["record_month", "delivery_share", "largest_order"]);
  });

  it("never states the same month twice when the insight already carried it", () => {
    const entries = select({ insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL] }) });

    expect(codesOf(entries).filter((code) => code === "record_month")).toHaveLength(1);
    expect(entries.at(0)?.source).toBe("signal");
  });

  it("falls through to the next fact when the record belongs to another currency", () => {
    const entries = select({
      currency: "EUR",
      records: recordsOf({
        largestOrderByCurrency: [{ currency: "EUR", order: orderOf("order-eur") }],
        recordMonthByCurrency: FULL_RECORDS.recordMonthByCurrency,
      }),
    });

    expect(codesOf(entries)).toEqual(["largest_order"]);
  });

  it("answers the book metric with book facts", () => {
    const entries = select({
      insights: insightsOf({ books: [BOOKS_BUCKET] }),
      metric: "books",
    });

    expect(codesOf(entries)).toEqual([
      "record_books_bucket",
      "most_books_in_order",
      "most_active_store_by_books",
    ]);
  });

  it("answers the order metric with order facts", () => {
    const entries = select({
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
    });

    expect(codesOf(entries)).toEqual([
      "record_orders_bucket",
      "most_active_store_by_orders",
      "largest_order",
    ]);
  });

  it("reads a store record and an order record as two different facts", () => {
    const entries = select({ metric: "orders" });

    expect(codesOf(entries)).toEqual(["most_active_store_by_orders", "largest_order"]);
  });

  it("stops at three rows", () => {
    const entries = select({
      insights: insightsOf({ spend: [RECORD_MONTH_SIGNAL, DELIVERY_SHARE, DISCOUNT_SAVINGS] }),
    });

    expect(entries).toHaveLength(PULSE_SELECTION.rowLimit.period);
  });

  it("says nothing rather than inventing a fact the payload never held", () => {
    expect(select({ records: recordsOf() })).toEqual([]);
  });

  it("carries the record scope so a row can refuse to claim an all-time record", () => {
    const filtered = select({ records: FULL_RECORDS }).at(0);
    const allTime = select({ records: { ...FULL_RECORDS, scope: ALL_TIME_SCOPE } }).at(0);

    expect(filtered?.source === "record" && filtered.scope.isPeriodFiltered).toBe(true);
    expect(allTime?.source === "record" && allTime.scope.isPeriodFiltered).toBe(false);
  });
});

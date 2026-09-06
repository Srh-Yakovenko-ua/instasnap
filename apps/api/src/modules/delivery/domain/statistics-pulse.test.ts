import type {
  BookOrderStatisticsComparison,
  BookOrderStatisticsCosts,
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulse,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecordScope,
  Currency,
  CurrencyDelta,
  CurrencyTotal,
  NumericDelta,
  StatisticsDynamics,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import { buildStatisticsInsights, PULSE_RULES } from "./statistics-pulse.js";

const QUIET_SCOPE: BookOrderStatisticsRecordScope = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

const NO_NUMERIC: NumericDelta = {
  absoluteDelta: null,
  current: null,
  percentDelta: null,
  previous: null,
};

function bucket({
  booksCount = 0,
  from,
  key,
  ordersCount = 0,
  to,
}: {
  booksCount?: number;
  from: string;
  key: string;
  ordersCount?: number;
  to: string;
}): StatisticsDynamics["buckets"][number] {
  return {
    comparison: null,
    current: { booksCount, booksPerOrder: null, from, ordersCount, to, totalsByCurrency: [] },
    drilldown: { targets: [] },
    key,
  };
}

function codesOf(signals: BookOrderStatisticsPulse): string[] {
  return signals.map((signal) => signal.code);
}

function comparisonOf(
  overrides: Partial<BookOrderStatisticsComparison> = {},
): BookOrderStatisticsComparison {
  return {
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: NO_NUMERIC,
    averageOrderAmountByCurrency: [],
    booksCount: NO_NUMERIC,
    ordersCount: NO_NUMERIC,
    receivedBooksCount: NO_NUMERIC,
    shipmentsCount: NO_NUMERIC,
    totalsByCurrency: [],
    ...overrides,
  };
}

function costsOf(
  overrides: Partial<BookOrderStatisticsCosts[number]> = {},
): BookOrderStatisticsCosts {
  return [
    {
      currency: "UAH",
      deliveryCostPerBook: 0,
      deliveryShareOfSpendPercent: 0,
      deliveryTotal: 0,
      discountShareOfRawSubtotalPercent: null,
      discountTotal: 0,
      ordersWithDeliveryCount: 0,
      ordersWithDiscountCount: 0,
      ...overrides,
    },
  ];
}

function currencyDelta(
  percentDelta: null | number,
  overrides: Partial<CurrencyDelta> = {},
): CurrencyDelta {
  return {
    absoluteDelta: 100,
    currency: "UAH",
    current: 1100,
    percentDelta,
    previous: 1000,
    ...overrides,
  };
}

function insightsOf({
  comparison = null,
  costs = costsOf(),
  dynamics = { buckets: [], granularity: "month" } as StatisticsDynamics,
  landedCostDeltas = [],
  landedCoverage = [],
  recordMonthByCurrency = [],
  storeMovement = [],
  totalsByCurrency = [{ currency: "UAH" as Currency, total: 10000 }],
}: {
  comparison?: BookOrderStatisticsComparison | null;
  costs?: BookOrderStatisticsCosts;
  dynamics?: StatisticsDynamics;
  landedCostDeltas?: CurrencyDelta[];
  landedCoverage?: { coveragePercent: number; currency: string }[];
  recordMonthByCurrency?: BookOrderStatisticsRecordMonth[];
  storeMovement?: (CurrencyDelta & { store: string })[];
  totalsByCurrency?: CurrencyTotal[];
} = {}): BookOrderStatisticsInsights {
  return buildStatisticsInsights({
    comparison,
    costs,
    dynamics,
    landedCostDeltas,
    landedCoverage,
    recordMonthByCurrency,
    scope: QUIET_SCOPE,
    storeMovement,
    totalsByCurrency,
  });
}

function numericDelta(percentDelta: null | number, overrides: Partial<NumericDelta> = {}) {
  return { absoluteDelta: 5, current: 55, percentDelta, previous: 50, ...overrides };
}

function recordMonthOf(currency: Currency, total: number): BookOrderStatisticsRecordMonth {
  return {
    booksCount: 10,
    currency,
    drilldown: { targets: [] },
    month: "2026-03",
    ordersCount: 4,
    total,
  };
}

function spendOf(
  insights: BookOrderStatisticsInsights,
  currency: Currency,
): BookOrderStatisticsPulse {
  return insights.spendByCurrency.find((group) => group.currency === currency)?.signals ?? [];
}

describe("statistics insights grouped by selected context", () => {
  it("keeps one currency's records out of another currency's group", () => {
    const insights = insightsOf({
      recordMonthByCurrency: [recordMonthOf("UAH", 5000), recordMonthOf("EUR", 90)],
      totalsByCurrency: [
        { currency: "UAH", total: 10000 },
        { currency: "EUR", total: 200 },
      ],
    });

    expect(spendOf(insights, "UAH")).toEqual([
      expect.objectContaining({ code: "record_month", currency: "UAH", total: 5000 }),
    ]);
    expect(spendOf(insights, "EUR")).toEqual([
      expect.objectContaining({ code: "record_month", currency: "EUR", total: 90 }),
    ]);
  });

  it("answers a USD context with USD facts alone", () => {
    const insights = insightsOf({
      recordMonthByCurrency: [recordMonthOf("USD", 300)],
      totalsByCurrency: [{ currency: "USD", total: 900 }],
    });

    expect(spendOf(insights, "USD")).toHaveLength(1);
    expect(spendOf(insights, "UAH")).toEqual([]);
  });

  it("gives the order metric its own insights instead of money ones", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ ordersCount: numericDelta(24) }),
      costs: costsOf({ deliveryShareOfSpendPercent: 40, deliveryTotal: 800 }),
    });

    expect(codesOf(insights.orders)).toEqual(["orders_count_change"]);
    expect(codesOf(insights.spendByCurrency[0]?.signals ?? [])).toContain("delivery_share");
  });

  it("gives the book metric its own change signal", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ booksCount: numericDelta(31) }),
    });

    expect(codesOf(insights.books)).toEqual(["books_count_change"]);
  });

  it("reports how the basket size moved for both count metrics", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        averageBooksPerOrder: numericDelta(18),
        booksCount: numericDelta(31),
        ordersCount: numericDelta(24),
      }),
    });

    expect(codesOf(insights.orders)).toEqual([
      "orders_count_change",
      "average_books_per_order_change",
    ]);
    expect(codesOf(insights.books)).toEqual([
      "books_count_change",
      "average_books_per_order_change",
    ]);
  });
});

describe("statistics insights priority and diversity", () => {
  it("leads with the change and follows the spec order across families", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        averageBookPriceByCurrency: [currencyDelta(20)],
        totalsByCurrency: [currencyDelta(30)],
      }),
      costs: costsOf({ deliveryShareOfSpendPercent: 40, deliveryTotal: 800 }),
      recordMonthByCurrency: [recordMonthOf("UAH", 5000)],
      storeMovement: [{ ...currencyDelta(50, { absoluteDelta: 4000 }), store: "Yakaboo" }],
    });

    expect(codesOf(spendOf(insights, "UAH"))).toEqual([
      "spend_change",
      "avg_book_price_change",
      "store_movement",
      "delivery_share",
    ]);
  });

  it("never returns two insights of the same family", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        averageBookPriceByCurrency: [currencyDelta(20)],
        totalsByCurrency: [currencyDelta(30)],
      }),
      landedCostDeltas: [currencyDelta(25)],
      landedCoverage: [{ coveragePercent: 90, currency: "UAH" }],
    });

    expect(codesOf(spendOf(insights, "UAH"))).toEqual(["spend_change", "avg_landed_cost_change"]);
  });

  it("prefers the actual cost of a book over its listed price", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ averageBookPriceByCurrency: [currencyDelta(20)] }),
      landedCostDeltas: [currencyDelta(25)],
      landedCoverage: [{ coveragePercent: 90, currency: "UAH" }],
    });

    expect(codesOf(spendOf(insights, "UAH"))).toEqual(["avg_landed_cost_change"]);
  });

  it("distrusts an actual cost built on too few books", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ averageBookPriceByCurrency: [currencyDelta(20)] }),
      landedCostDeltas: [currencyDelta(25)],
      landedCoverage: [{ coveragePercent: 10, currency: "UAH" }],
    });

    expect(codesOf(spendOf(insights, "UAH"))).toEqual(["avg_book_price_change"]);
  });

  it("promotes the record to the headline when there is nothing to compare against", () => {
    const insights = insightsOf({
      costs: costsOf({ deliveryShareOfSpendPercent: 40, deliveryTotal: 800 }),
      recordMonthByCurrency: [recordMonthOf("UAH", 5000)],
    });

    expect(codesOf(spendOf(insights, "UAH"))).toEqual(["record_month", "delivery_share"]);
  });

  it("names the busiest bucket when no comparison exists, and points at its column", () => {
    const insights = insightsOf({
      dynamics: {
        buckets: [
          bucket({
            booksCount: 4,
            from: "2026-01-01",
            key: "2026-01",
            ordersCount: 2,
            to: "2026-01-31",
          }),
          bucket({
            booksCount: 20,
            from: "2026-03-01",
            key: "2026-03",
            ordersCount: 9,
            to: "2026-03-31",
          }),
        ],
        granularity: "month",
      },
    });

    expect(insights.orders).toEqual([
      expect.objectContaining({
        bucketKey: "2026-03",
        code: "record_orders_bucket",
        ordersCount: 9,
      }),
    ]);
    expect(insights.books).toEqual([
      expect.objectContaining({
        booksCount: 20,
        bucketKey: "2026-03",
        code: "record_books_bucket",
      }),
    ]);
  });

  it("keeps the record as context once a real change owns the headline", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ ordersCount: numericDelta(24) }),
      dynamics: {
        buckets: [bucket({ from: "2026-03-01", key: "2026-03", ordersCount: 9, to: "2026-03-31" })],
        granularity: "month",
      },
    });

    expect(codesOf(insights.orders)).toEqual(["orders_count_change", "record_orders_bucket"]);
  });

  it("selects by business priority rather than by the order signals were generated in", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        averageBookPriceByCurrency: [currencyDelta(20)],
        totalsByCurrency: [currencyDelta(30)],
      }),
      costs: costsOf({
        deliveryShareOfSpendPercent: 40,
        deliveryTotal: 800,
        discountShareOfRawSubtotalPercent: 20,
        discountTotal: 500,
      }),
      recordMonthByCurrency: [recordMonthOf("UAH", 5000)],
      storeMovement: [{ ...currencyDelta(50, { absoluteDelta: 4000 }), store: "Yakaboo" }],
    });

    const signals = spendOf(insights, "UAH");
    expect(signals).toHaveLength(FAMILY_COUNT);
    expect(codesOf(signals)).not.toContain("discount_savings");
    expect(codesOf(signals)).not.toContain("record_month");
  });
});

describe("statistics insights thresholds", () => {
  it("stays silent about a change too small to matter", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        totalsByCurrency: [currencyDelta(PULSE_RULES.spendChangePercent - 1)],
      }),
    });

    expect(spendOf(insights, "UAH")).toEqual([]);
  });

  it("cannot rank a change whose share of the period is unknown", () => {
    const insights = insightsOf({
      comparison: comparisonOf({ totalsByCurrency: [currencyDelta(null)] }),
    });

    expect(spendOf(insights, "UAH")).toEqual([]);
  });

  it("shows a store that grew and a store that fell alike", () => {
    const grew = insightsOf({
      storeMovement: [{ ...currencyDelta(50, { absoluteDelta: 4000 }), store: "Yakaboo" }],
    });
    const fell = insightsOf({
      storeMovement: [{ ...currencyDelta(-50, { absoluteDelta: -4000 }), store: "Vivat" }],
    });

    expect(spendOf(grew, "UAH")).toEqual([
      expect.objectContaining({ absoluteDelta: 4000, code: "store_movement", store: "Yakaboo" }),
    ]);
    expect(spendOf(fell, "UAH")).toEqual([
      expect.objectContaining({ absoluteDelta: -4000, code: "store_movement", store: "Vivat" }),
    ]);
  });

  it("refuses a huge percentage built on a tiny slice of the period", () => {
    const insights = insightsOf({
      storeMovement: [
        { ...currencyDelta(900, { absoluteDelta: 90, current: 100, previous: 10 }), store: "Мала" },
      ],
      totalsByCurrency: [{ currency: "UAH", total: 10000 }],
    });

    expect(spendOf(insights, "UAH")).toEqual([]);
  });

  it("says nothing at all rather than padding the group with noise", () => {
    expect(insightsOf()).toEqual({ books: [], orders: [], spendByCurrency: [] });
  });
});

describe("statistics insights tone", () => {
  it("keeps every directional change neutral instead of judging it", () => {
    const insights = insightsOf({
      comparison: comparisonOf({
        averageBookPriceByCurrency: [currencyDelta(-20)],
        booksCount: numericDelta(-31),
        ordersCount: numericDelta(-24),
        totalsByCurrency: [currencyDelta(-30)],
      }),
      landedCostDeltas: [currencyDelta(-25)],
      landedCoverage: [{ coveragePercent: 90, currency: "UAH" }],
      storeMovement: [{ ...currencyDelta(-50, { absoluteDelta: -4000 }), store: "Vivat" }],
    });

    const tones = [...spendOf(insights, "UAH"), ...insights.orders, ...insights.books].map(
      (signal) => signal.tone,
    );
    expect(new Set(tones)).toEqual(new Set(["neutral"]));
  });

  it("flags an unusually heavy delivery and praises a real saving", () => {
    const delivery = insightsOf({
      costs: costsOf({ deliveryShareOfSpendPercent: 40, deliveryTotal: 800 }),
    });
    const discount = insightsOf({
      costs: costsOf({ discountShareOfRawSubtotalPercent: 20, discountTotal: 500 }),
    });

    expect(spendOf(delivery, "UAH")).toEqual([
      expect.objectContaining({ code: "delivery_share", tone: "attention" }),
    ]);
    expect(spendOf(discount, "UAH")).toEqual([
      expect.objectContaining({ code: "discount_savings", tone: "positive" }),
    ]);
  });
});

const FAMILY_COUNT = 4;

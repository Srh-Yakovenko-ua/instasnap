import type { BookOrderStatisticsInsights, BookOrderStatisticsPulseSignal } from "@app/shared";

import { describe, expect, it } from "vitest";

import { pulseBucketKey, pulseDirection, pulseSignalsFor, signedPercent } from "./statistics-pulse";

const SPEND_UAH: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 400,
  code: "spend_change",
  currency: "UAH",
  current: 1400,
  percentDelta: 40,
  previous: 1000,
  tone: "neutral",
};

const SPEND_EUR: BookOrderStatisticsPulseSignal = {
  absoluteDelta: -20,
  code: "spend_change",
  currency: "EUR",
  current: 80,
  percentDelta: -20,
  previous: 100,
  tone: "neutral",
};

const ORDERS_CHANGE: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 3,
  code: "orders_count_change",
  current: 15,
  percentDelta: 25,
  previous: 12,
  tone: "neutral",
};

const BOOKS_BUCKET: BookOrderStatisticsPulseSignal = {
  booksCount: 31,
  bucketKey: "2026-08",
  code: "record_books_bucket",
  from: "2026-08-01",
  scope: { isPeriodFiltered: true, isTruncated: false, period: { from: null, to: null } },
  to: "2026-08-31",
  tone: "neutral",
};

const INSIGHTS: BookOrderStatisticsInsights = {
  books: [BOOKS_BUCKET],
  orders: [ORDERS_CHANGE],
  spendByCurrency: [
    { currency: "UAH", signals: [SPEND_UAH] },
    { currency: "EUR", signals: [SPEND_EUR] },
  ],
};

describe("pulseSignalsFor", () => {
  it("hands back the group of the selected currency, never another one's", () => {
    expect(pulseSignalsFor({ currency: "UAH", insights: INSIGHTS, metric: "spend" })).toEqual([
      SPEND_UAH,
    ]);
    expect(pulseSignalsFor({ currency: "EUR", insights: INSIGHTS, metric: "spend" })).toEqual([
      SPEND_EUR,
    ]);
  });

  it("says nothing rather than borrowing another currency's insights", () => {
    expect(pulseSignalsFor({ currency: "USD", insights: INSIGHTS, metric: "spend" })).toEqual([]);
  });

  it("switches the whole group when the chart switches metric", () => {
    expect(pulseSignalsFor({ currency: "UAH", insights: INSIGHTS, metric: "orders" })).toEqual([
      ORDERS_CHANGE,
    ]);
    expect(pulseSignalsFor({ currency: "UAH", insights: INSIGHTS, metric: "books" })).toEqual([
      BOOKS_BUCKET,
    ]);
  });

  it("takes the group exactly as the backend ranked it, without re-cutting it", () => {
    const many = Array.from({ length: 6 }, () => SPEND_UAH);

    expect(
      pulseSignalsFor({
        currency: "UAH",
        insights: { ...INSIGHTS, spendByCurrency: [{ currency: "UAH", signals: many }] },
        metric: "spend",
      }),
    ).toHaveLength(many.length);
  });
});

describe("pulseBucketKey", () => {
  it("points a bucket insight at the column it is about", () => {
    expect(pulseBucketKey(BOOKS_BUCKET)).toBe("2026-08");
  });

  it("leaves an insight that belongs to no column unlinked", () => {
    expect(pulseBucketKey(SPEND_UAH)).toBeNull();
    expect(pulseBucketKey(ORDERS_CHANGE)).toBeNull();
  });
});

describe("pulseDirection and signedPercent", () => {
  it("reads a missing or zero movement as flat rather than as a fall", () => {
    expect(pulseDirection(null)).toBe("flat");
    expect(pulseDirection(0)).toBe("flat");
  });

  it("keeps the sign apart from the magnitude", () => {
    expect(signedPercent(SPEND_UAH)).toEqual({ direction: "up", magnitude: 40 });
    expect(signedPercent(SPEND_EUR)).toEqual({ direction: "down", magnitude: 20 });
  });

  it("refuses a percentage the backend could not compute", () => {
    expect(signedPercent({ absoluteDelta: 100, percentDelta: null })).toBeNull();
  });
});

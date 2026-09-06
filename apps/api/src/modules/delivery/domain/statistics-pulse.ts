import type {
  BookOrderStatisticsComparison,
  BookOrderStatisticsCosts,
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulse,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecordScope,
  Currency,
  CurrencyDelta,
  CurrencyTotal,
  Nullable,
  NumericDelta,
  StatisticsDynamics,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

export const PULSE_RULES = {
  avgBookPriceChangePercent: 8,
  avgLandedCostChangePercent: 8,
  booksCountChangePercent: 10,
  booksPerOrderChangePercent: 10,
  deliverySharePercent: 10,
  discountShareOfSpendPercent: 5,
  minLandedCoveragePercent: 50,
  ordersCountChangePercent: 10,
  spendChangePercent: 10,
  storeMovementShareOfSpendPercent: 5,
} as const;

const FAMILY_ORDER = ["change", "rate", "store", "detail"] as const;

const RECORD_CODES = ["record_month", "record_orders_bucket", "record_books_bucket"] as const;

type InsightCandidate = {
  family: InsightFamily;
  priority: number;
  signal: BookOrderStatisticsPulseSignal;
};

type InsightFamily = (typeof FAMILY_ORDER)[number];

type LandedCoverage = {
  coveragePercent: number;
  currency: string;
};

export function buildStatisticsInsights({
  comparison,
  costs,
  dynamics,
  landedCostDeltas,
  landedCoverage,
  recordMonthByCurrency,
  scope,
  storeMovement,
  totalsByCurrency,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  costs: BookOrderStatisticsCosts;
  dynamics: StatisticsDynamics;
  landedCostDeltas: readonly CurrencyDelta[];
  landedCoverage: readonly LandedCoverage[];
  recordMonthByCurrency: readonly BookOrderStatisticsRecordMonth[];
  scope: BookOrderStatisticsRecordScope;
  storeMovement: readonly (CurrencyDelta & { store: string })[];
  totalsByCurrency: readonly CurrencyTotal[];
}): BookOrderStatisticsInsights {
  return {
    books: selectInsights(booksCandidates({ comparison, dynamics, scope })),
    orders: selectInsights(ordersCandidates({ comparison, dynamics, scope })),
    spendByCurrency: CurrencySchema.options.flatMap((currency) => {
      const signals = selectInsights(
        spendCandidates({
          comparison,
          costs,
          currency,
          landedCostDeltas,
          landedCoverage,
          recordMonthByCurrency,
          scope,
          storeMovement,
          totalsByCurrency,
        }),
      );
      return signals.length === 0 ? [] : [{ currency, signals }];
    }),
  };
}

function booksCandidates({
  comparison,
  dynamics,
  scope,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  dynamics: StatisticsDynamics;
  scope: BookOrderStatisticsRecordScope;
}): InsightCandidate[] {
  const busiest = busiestBucket({ dynamics, unit: "booksCount" });

  return [
    ...whenSignificant({
      delta: comparison?.booksCount ?? null,
      threshold: PULSE_RULES.booksCountChangePercent,
    }).map((delta): InsightCandidate => ({
      family: "change",
      priority: 0,
      signal: { ...delta, code: "books_count_change", tone: "neutral" },
    })),
    ...booksPerOrderCandidate(comparison),
    ...(busiest === null
      ? []
      : [
          {
            family: "detail" as const,
            priority: 2,
            signal: {
              booksCount: busiest.bucket.current.booksCount,
              bucketKey: busiest.bucket.key,
              code: "record_books_bucket" as const,
              from: busiest.bucket.current.from,
              scope,
              to: busiest.bucket.current.to,
              tone: "neutral" as const,
            },
          },
        ]),
  ];
}

function booksPerOrderCandidate(
  comparison: Nullable<BookOrderStatisticsComparison>,
): InsightCandidate[] {
  return whenSignificant({
    delta: comparison?.averageBooksPerOrder ?? null,
    threshold: PULSE_RULES.booksPerOrderChangePercent,
  }).map((delta) => ({
    family: "rate",
    priority: 0,
    signal: { ...delta, code: "average_books_per_order_change", tone: "neutral" },
  }));
}

function busiestBucket({
  dynamics,
  unit,
}: {
  dynamics: StatisticsDynamics;
  unit: "booksCount" | "ordersCount";
}): Nullable<{ bucket: StatisticsDynamics["buckets"][number] }> {
  const busiest = [...dynamics.buckets]
    .filter((bucket) => bucket.current[unit] > 0)
    .sort((left, right) => right.current[unit] - left.current[unit])
    .at(0);

  return busiest === undefined ? null : { bucket: busiest };
}

function deliveryCandidate({
  costs,
  currency,
}: {
  costs: BookOrderStatisticsCosts;
  currency: Currency;
}): InsightCandidate[] {
  const row = costs.find((entry) => entry.currency === currency);
  if (
    row === undefined ||
    row.deliveryShareOfSpendPercent === null ||
    row.deliveryShareOfSpendPercent < PULSE_RULES.deliverySharePercent
  ) {
    return [];
  }

  return [
    {
      family: "detail",
      priority: 0,
      signal: {
        code: "delivery_share",
        currency,
        deliveryShareOfSpendPercent: row.deliveryShareOfSpendPercent,
        deliveryTotal: row.deliveryTotal,
        tone: "attention",
      },
    },
  ];
}

function discountCandidate({
  costs,
  currency,
}: {
  costs: BookOrderStatisticsCosts;
  currency: Currency;
}): InsightCandidate[] {
  const row = costs.find((entry) => entry.currency === currency);
  if (row === undefined || row.discountTotal <= 0) {
    return [];
  }
  if (
    row.discountShareOfRawSubtotalPercent !== null &&
    row.discountShareOfRawSubtotalPercent < PULSE_RULES.discountShareOfSpendPercent
  ) {
    return [];
  }

  return [
    {
      family: "detail",
      priority: 1,
      signal: {
        code: "discount_savings",
        currency,
        discountShareOfRawSubtotalPercent: row.discountShareOfRawSubtotalPercent,
        discountTotal: row.discountTotal,
        tone: "positive",
      },
    },
  ];
}

function isRecordSignal(signal: BookOrderStatisticsPulseSignal): boolean {
  return RECORD_CODES.some((code) => code === signal.code);
}

function ordersCandidates({
  comparison,
  dynamics,
  scope,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  dynamics: StatisticsDynamics;
  scope: BookOrderStatisticsRecordScope;
}): InsightCandidate[] {
  const busiest = busiestBucket({ dynamics, unit: "ordersCount" });

  return [
    ...whenSignificant({
      delta: comparison?.ordersCount ?? null,
      threshold: PULSE_RULES.ordersCountChangePercent,
    }).map((delta): InsightCandidate => ({
      family: "change",
      priority: 0,
      signal: { ...delta, code: "orders_count_change", tone: "neutral" },
    })),
    ...booksPerOrderCandidate(comparison),
    ...(busiest === null
      ? []
      : [
          {
            family: "detail" as const,
            priority: 2,
            signal: {
              bucketKey: busiest.bucket.key,
              code: "record_orders_bucket" as const,
              from: busiest.bucket.current.from,
              ordersCount: busiest.bucket.current.ordersCount,
              scope,
              to: busiest.bucket.current.to,
              tone: "neutral" as const,
            },
          },
        ]),
  ];
}

function priceCandidates({
  comparison,
  currency,
  landedCostDeltas,
  landedCoverage,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  currency: Currency;
  landedCostDeltas: readonly CurrencyDelta[];
  landedCoverage: readonly LandedCoverage[];
}): InsightCandidate[] {
  const coverage = landedCoverage.find((row) => row.currency === currency);
  const landed = landedCostDeltas.find((delta) => delta.currency === currency);
  const isLandedTrustworthy =
    coverage !== undefined && coverage.coveragePercent >= PULSE_RULES.minLandedCoveragePercent;

  const landedCandidates =
    landed === undefined || !isLandedTrustworthy
      ? []
      : whenSignificant({
          delta: landed,
          threshold: PULSE_RULES.avgLandedCostChangePercent,
        }).map((delta): InsightCandidate => ({
          family: "rate",
          priority: 0,
          signal: { ...delta, code: "avg_landed_cost_change", currency, tone: "neutral" },
        }));

  const rawPrice = comparison?.averageBookPriceByCurrency.find(
    (delta) => delta.currency === currency,
  );
  const rawCandidates =
    rawPrice === undefined
      ? []
      : whenSignificant({
          delta: rawPrice,
          threshold: PULSE_RULES.avgBookPriceChangePercent,
        }).map((delta): InsightCandidate => ({
          family: "rate",
          priority: 1,
          signal: { ...delta, code: "avg_book_price_change", currency, tone: "neutral" },
        }));

  return [...landedCandidates, ...rawCandidates];
}

function recordMonthCandidate({
  currency,
  recordMonthByCurrency,
  scope,
}: {
  currency: Currency;
  recordMonthByCurrency: readonly BookOrderStatisticsRecordMonth[];
  scope: BookOrderStatisticsRecordScope;
}): InsightCandidate[] {
  const record = recordMonthByCurrency.find((entry) => entry.currency === currency);
  if (record === undefined) {
    return [];
  }

  return [
    {
      family: "detail",
      priority: 2,
      signal: {
        booksCount: record.booksCount,
        code: "record_month",
        currency,
        month: record.month,
        ordersCount: record.ordersCount,
        scope,
        tone: "neutral",
        total: record.total,
      },
    },
  ];
}

function selectInsights(candidates: readonly InsightCandidate[]): BookOrderStatisticsPulse {
  const hasChange = candidates.some((candidate) => candidate.family === "change");
  const ranked = hasChange
    ? candidates
    : candidates.map((candidate) =>
        isRecordSignal(candidate.signal)
          ? { ...candidate, family: "change" as const, priority: 0 }
          : candidate,
      );

  return FAMILY_ORDER.flatMap((family) => {
    const best = ranked
      .filter((candidate) => candidate.family === family)
      .sort((left, right) => left.priority - right.priority)
      .at(0);
    return best === undefined ? [] : [best.signal];
  });
}

function spendCandidates({
  comparison,
  costs,
  currency,
  landedCostDeltas,
  landedCoverage,
  recordMonthByCurrency,
  scope,
  storeMovement,
  totalsByCurrency,
}: {
  comparison: Nullable<BookOrderStatisticsComparison>;
  costs: BookOrderStatisticsCosts;
  currency: Currency;
  landedCostDeltas: readonly CurrencyDelta[];
  landedCoverage: readonly LandedCoverage[];
  recordMonthByCurrency: readonly BookOrderStatisticsRecordMonth[];
  scope: BookOrderStatisticsRecordScope;
  storeMovement: readonly (CurrencyDelta & { store: string })[];
  totalsByCurrency: readonly CurrencyTotal[];
}): InsightCandidate[] {
  const spend = comparison?.totalsByCurrency.find((delta) => delta.currency === currency);

  return [
    ...(spend === undefined
      ? []
      : whenSignificant({ delta: spend, threshold: PULSE_RULES.spendChangePercent }).map(
          (delta): InsightCandidate => ({
            family: "change",
            priority: 0,
            signal: { ...delta, code: "spend_change", currency, tone: "neutral" },
          }),
        )),
    ...priceCandidates({ comparison, currency, landedCostDeltas, landedCoverage }),
    ...storeMovementCandidate({ currency, storeMovement, totalsByCurrency }),
    ...deliveryCandidate({ costs, currency }),
    ...discountCandidate({ costs, currency }),
    ...recordMonthCandidate({ currency, recordMonthByCurrency, scope }),
  ];
}

function storeMovementCandidate({
  currency,
  storeMovement,
  totalsByCurrency,
}: {
  currency: Currency;
  storeMovement: readonly (CurrencyDelta & { store: string })[];
  totalsByCurrency: readonly CurrencyTotal[];
}): InsightCandidate[] {
  const periodTotal = totalsByCurrency.find((row) => row.currency === currency)?.total ?? 0;
  if (periodTotal <= 0) {
    return [];
  }

  const floor = (periodTotal * PULSE_RULES.storeMovementShareOfSpendPercent) / 100;
  const movement = storeMovement.find(
    (delta) =>
      delta.currency === currency &&
      delta.absoluteDelta !== null &&
      Math.abs(delta.absoluteDelta) >= floor,
  );

  return movement === undefined
    ? []
    : [
        {
          family: "store",
          priority: 0,
          signal: { ...movement, code: "store_movement", tone: "neutral" },
        },
      ];
}

function whenSignificant({
  delta,
  threshold,
}: {
  delta: Nullable<NumericDelta>;
  threshold: number;
}): NumericDelta[] {
  if (delta === null || delta.percentDelta === null || Math.abs(delta.percentDelta) < threshold) {
    return [];
  }
  return [delta];
}

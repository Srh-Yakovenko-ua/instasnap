import type {
  BookOrderStatisticsLanded,
  BookOrderStatisticsLandedCost,
  Currency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { ClassifiedOrder, OrderStatisticsItemRecord } from "./statistics-scope.js";

import { distributeMinorUnits, fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

const FULL_COVERAGE_PERCENT = 100;
const EMPTY_COVERAGE_PERCENT = 0;

export type LandedCostAllocation = {
  adjustmentShare: number;
  deliveryShare: number;
  discountShare: number;
  itemId: string;
  rawPrice: number;
  realCost: number;
};

export type LandedCostResult =
  { allocations: LandedCostAllocation[]; status: "allocated" } | { status: "unavailable" };

type CurrencyLandedBucket = {
  adjustmentMinorUnits: number;
  booksInScope: number;
  booksWithLandedCost: number;
  deliveryMinorUnits: number;
  discountMinorUnits: number;
  eligibleRawPriceMinorUnits: number;
  landedMinorUnits: number;
};

export function allocateLandedCost({
  countedItems,
  deliveryPrice,
  discount,
  effectiveTotalAmount,
}: {
  countedItems: readonly OrderStatisticsItemRecord[];
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  effectiveTotalAmount: Nullable<number>;
}): LandedCostResult {
  if (effectiveTotalAmount === null || countedItems.length === 0) {
    return { status: "unavailable" };
  }

  const items = [...countedItems].sort((left, right) => left.id.localeCompare(right.id));
  const totalMinorUnits = toMinorUnits(effectiveTotalAmount);
  const deliveryMinorUnits = toMinorUnits(deliveryPrice ?? 0);
  const discountMinorUnits = toMinorUnits(discount ?? 0);

  if (items.some((item) => item.price === null)) {
    return { status: "unavailable" };
  }

  const rawPrices = items.map((item) => toMinorUnits(item.price ?? 0));
  const subtotalMinorUnits = rawPrices.reduce((sum, price) => sum + price, 0);
  const expectedMinorUnits = subtotalMinorUnits + deliveryMinorUnits - discountMinorUnits;

  const discountShares = distributeMinorUnits({
    totalMinorUnits: discountMinorUnits,
    weights: rawPrices,
  });
  const deliveryShares = distributeMinorUnits({
    totalMinorUnits: deliveryMinorUnits,
    weights: rawPrices.map(() => 1),
  });
  const adjustmentShares = distributeMinorUnits({
    totalMinorUnits: totalMinorUnits - expectedMinorUnits,
    weights: rawPrices,
  });

  return {
    allocations: items.map((item, index) => {
      const adjustmentShare = adjustmentShares[index] ?? 0;
      const deliveryShare = deliveryShares[index] ?? 0;
      const discountShare = discountShares[index] ?? 0;
      const rawPrice = rawPrices[index] ?? 0;

      return {
        adjustmentShare,
        deliveryShare,
        discountShare,
        itemId: item.id,
        rawPrice,
        realCost: rawPrice - discountShare + deliveryShare + adjustmentShare,
      };
    }),
    status: "allocated",
  };
}

export function buildLandedCostSummary(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsLanded {
  const buckets = new Map<Currency, CurrencyLandedBucket>();

  for (const order of orders) {
    const bucket = buckets.get(order.currency) ?? emptyBucket();
    bucket.booksInScope += order.countedItems.length;

    const landed = allocateLandedCost({
      countedItems: order.countedItems,
      deliveryPrice: order.record.deliveryPrice,
      discount: order.record.discount,
      effectiveTotalAmount: order.amount,
    });

    if (landed.status === "allocated") {
      for (const allocation of landed.allocations) {
        bucket.adjustmentMinorUnits += allocation.adjustmentShare;
        bucket.deliveryMinorUnits += allocation.deliveryShare;
        bucket.discountMinorUnits += allocation.discountShare;
        bucket.eligibleRawPriceMinorUnits += allocation.rawPrice;
        bucket.landedMinorUnits += allocation.realCost;
        bucket.booksWithLandedCost += 1;
      }
    }

    buckets.set(order.currency, bucket);
  }

  return CurrencySchema.options.flatMap((currency) => {
    const bucket = buckets.get(currency);
    return bucket === undefined ? [] : [toLandedCostRow({ bucket, currency })];
  });
}

function emptyBucket(): CurrencyLandedBucket {
  return {
    adjustmentMinorUnits: 0,
    booksInScope: 0,
    booksWithLandedCost: 0,
    deliveryMinorUnits: 0,
    discountMinorUnits: 0,
    eligibleRawPriceMinorUnits: 0,
    landedMinorUnits: 0,
  };
}

function toCoveragePercent(bucket: CurrencyLandedBucket): number {
  if (bucket.booksInScope === 0) {
    return EMPTY_COVERAGE_PERCENT;
  }
  return Math.min(
    FULL_COVERAGE_PERCENT,
    (bucket.booksWithLandedCost / bucket.booksInScope) * FULL_COVERAGE_PERCENT,
  );
}

function toLandedCostRow({
  bucket,
  currency,
}: {
  bucket: CurrencyLandedBucket;
  currency: Currency;
}): BookOrderStatisticsLandedCost {
  const perEligibleBook = (minorUnits: number) =>
    bucket.booksWithLandedCost === 0
      ? null
      : fromMinorUnits(minorUnits / bucket.booksWithLandedCost);
  const averageLandedBookCost = perEligibleBook(bucket.landedMinorUnits);
  const averageEligibleRawBookPrice = perEligibleBook(bucket.eligibleRawPriceMinorUnits);

  return {
    averageAdjustmentShare: perEligibleBook(bucket.adjustmentMinorUnits),
    averageDeliveryShare: perEligibleBook(bucket.deliveryMinorUnits),
    averageDiscountShare: perEligibleBook(bucket.discountMinorUnits),
    averageEligibleRawBookPrice,
    averageLandedBookCost,
    booksInScope: bucket.booksInScope,
    booksWithLandedCost: bucket.booksWithLandedCost,
    coveragePercent: toCoveragePercent(bucket),
    currency,
    deltaFromEligibleRawPrice:
      averageLandedBookCost === null || averageEligibleRawBookPrice === null
        ? null
        : fromMinorUnits(
            toMinorUnits(averageLandedBookCost) - toMinorUnits(averageEligibleRawBookPrice),
          ),
  };
}

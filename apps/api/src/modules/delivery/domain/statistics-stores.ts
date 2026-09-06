import type {
  BookOrderStatisticsBestValueStore,
  BookOrderStatisticsBestValueStoreByCurrency,
  BookOrderStatisticsStore,
  Currency,
  CurrencyCount,
  CurrencyDelta,
  CurrencyTotal,
} from "@app/shared";

import {
  BOOK_ORDER_BEST_VALUE_STORE_RULES,
  collapseSpaces,
  CurrencySchema,
  normalizeName,
} from "@app/shared";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { buildLandedCostSummary } from "./landed-cost.js";
import { computeStatisticsCosts } from "./statistics-costs.js";
import { toCurrencyDeltas } from "./statistics-delta.js";
import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import {
  addItemPrices,
  addOrderAmount,
  averagesFromAmounts,
  totalsFromAmounts,
} from "./statistics-scope.js";

type CurrencyCountAccumulator = Map<Currency, { books: number; orders: number }>;

type StoreGroup = {
  orders: ClassifiedOrder[];
  store: string;
  storeKey: string;
};

export function buildBestValueStoreByCurrency(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsBestValueStoreByCurrency {
  const groups = groupOrdersByStore(orders);

  return CurrencySchema.options.flatMap((currency) => {
    const candidates = groups.flatMap((group) => toBestValueCandidate({ currency, group }));
    const winner = [...candidates].sort(compareBestValueCandidates).at(0);
    return winner === undefined ? [] : [winner];
  });
}

export function buildStoreScorecards(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsStore[] {
  return groupOrdersByStore(orders)
    .map(toStoreScorecard)
    .sort(
      (left, right) =>
        right.ordersCount - left.ordersCount ||
        UKRAINIAN_COLLATION.compare(left.store, right.store),
    );
}

export function buildStoreSpendMovement({
  current,
  previous,
}: {
  current: readonly ClassifiedOrder[];
  previous: readonly ClassifiedOrder[];
}): (CurrencyDelta & { store: string })[] {
  const previousLookup = new Map(
    groupOrdersByStore(previous).map((group) => [group.storeKey, group]),
  );

  return groupOrdersByStore(current)
    .flatMap((group) => {
      const before = previousLookup.get(group.storeKey);
      const deltas = toCurrencyDeltas({
        current: totalsOf(group.orders),
        previous: before === undefined ? [] : totalsOf(before.orders),
      });
      return deltas.map((delta) => ({ ...delta, store: group.store }));
    })
    .filter((delta) => delta.absoluteDelta !== null && delta.absoluteDelta !== 0)
    .sort(
      (left, right) =>
        Math.abs(right.absoluteDelta ?? 0) - Math.abs(left.absoluteDelta ?? 0) ||
        UKRAINIAN_COLLATION.compare(left.store, right.store),
    );
}

function compareBestValueCandidates(
  left: BookOrderStatisticsBestValueStore,
  right: BookOrderStatisticsBestValueStore,
): number {
  return (
    left.averageLandedBookCost - right.averageLandedBookCost ||
    right.eligibleBooksCount - left.eligibleBooksCount ||
    UKRAINIAN_COLLATION.compare(left.store, right.store)
  );
}

function countsByCurrency(orders: readonly ClassifiedOrder[]): CurrencyCountAccumulator {
  const counts: CurrencyCountAccumulator = new Map();

  for (const order of orders) {
    const bucket = counts.get(order.currency) ?? { books: 0, orders: 0 };
    bucket.books += order.countedItems.length;
    bucket.orders += 1;
    counts.set(order.currency, bucket);
  }

  return counts;
}

function groupOrdersByStore(orders: readonly ClassifiedOrder[]): StoreGroup[] {
  const groups = new Map<string, StoreGroup>();

  for (const order of orders) {
    const store = collapseSpaces(order.record.storeName);
    if (store.length === 0) {
      continue;
    }
    const storeKey = normalizeName(store);
    const group = groups.get(storeKey) ?? { orders: [], store, storeKey };
    group.orders.push(order);
    groups.set(storeKey, group);
  }

  return [...groups.values()];
}

function toBestValueCandidate({
  currency,
  group,
}: {
  currency: Currency;
  group: StoreGroup;
}): BookOrderStatisticsBestValueStore[] {
  const landed = buildLandedCostSummary(group.orders).find((row) => row.currency === currency);
  if (
    landed === undefined ||
    landed.averageLandedBookCost === null ||
    landed.booksWithLandedCost < BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks
  ) {
    return [];
  }

  return [
    {
      averageLandedBookCost: landed.averageLandedBookCost,
      currency,
      drilldown: buildDrilldownBreakdown(
        group.orders.filter((order) => order.currency === currency),
      ),
      eligibleBooksCount: landed.booksWithLandedCost,
      store: group.store,
      storeKey: group.storeKey,
    },
  ];
}

function toCurrencyCounts({
  counts,
  unit,
}: {
  counts: CurrencyCountAccumulator;
  unit: "books" | "orders";
}): CurrencyCount[] {
  return CurrencySchema.options.flatMap((currency) => {
    const bucket = counts.get(currency);
    return bucket === undefined ? [] : [{ count: bucket[unit], currency }];
  });
}

function toStoreScorecard(group: StoreGroup): BookOrderStatisticsStore {
  const orderAmounts: AmountAccumulator = new Map();
  const itemPrices: AmountAccumulator = new Map();
  let booksCount = 0;

  for (const order of group.orders) {
    booksCount += order.countedItems.length;
    addOrderAmount({ accumulator: orderAmounts, order });
    addItemPrices({ accumulator: itemPrices, order });
  }

  const landed = buildLandedCostSummary(group.orders);
  const costs = computeStatisticsCosts(group.orders);
  const ordersCount = group.orders.length;
  const perCurrency = countsByCurrency(group.orders);

  return {
    averageBookPriceByCurrency: averagesFromAmounts(itemPrices),
    averageBooksPerOrder: ordersCount === 0 ? null : booksCount / ordersCount,
    averageLandedBookCostByCurrency: landed.flatMap((row) =>
      row.averageLandedBookCost === null
        ? []
        : [{ average: row.averageLandedBookCost, currency: row.currency }],
    ),
    averageOrderAmountByCurrency: averagesFromAmounts(orderAmounts),
    booksCount,
    booksCountByCurrency: toCurrencyCounts({ counts: perCurrency, unit: "books" }),
    deliveryTotalByCurrency: costs.map((row) => ({
      currency: row.currency,
      total: row.deliveryTotal,
    })),
    discountTotalByCurrency: costs.map((row) => ({
      currency: row.currency,
      total: row.discountTotal,
    })),
    drilldown: buildDrilldownBreakdown(group.orders),
    landedCoverageByCurrency: landed.map((row) => ({
      booksInScope: row.booksInScope,
      booksWithLandedCost: row.booksWithLandedCost,
      coveragePercent: row.coveragePercent,
      currency: row.currency,
    })),
    landedEligibleBooksCountByCurrency: landed.map((row) => ({
      count: row.booksWithLandedCost,
      currency: row.currency,
    })),
    ordersCount,
    ordersCountByCurrency: toCurrencyCounts({ counts: perCurrency, unit: "orders" }),
    store: group.store,
    storeKey: group.storeKey,
    totalsByCurrency: totalsFromAmounts(orderAmounts),
  };
}

function totalsOf(orders: readonly ClassifiedOrder[]): CurrencyTotal[] {
  const accumulator: AmountAccumulator = new Map();
  for (const order of orders) {
    addOrderAmount({ accumulator, order });
  }
  return totalsFromAmounts(accumulator);
}

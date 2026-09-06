import type {
  BookOrderStatisticsStore,
  Currency,
  Nullable,
  StatisticsDrilldownBreakdown,
} from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES } from "@app/shared";

import { currencyAverageOf, currencyTotalOf } from "./statistics-currency";

export const STORE_METRICS = ["spend", "orders", "books"] as const;

export type StoreExclusion = {
  eligibleBooksCount: number;
  store: string;
  storeKey: string;
};

export type StoreMetric = (typeof STORE_METRICS)[number];

export type StoreRow = {
  averageBookPrice: Nullable<number>;
  averageLandedBookCost: Nullable<number>;
  averageOrderAmount: Nullable<number>;
  booksCount: number;
  booksPerOrder: Nullable<number>;
  drilldown: StatisticsDrilldownBreakdown;
  ordersCount: number;
  share: number;
  store: string;
  storeKey: string;
  value: number;
};

export type StoreScatter = {
  excluded: StoreExclusion[];
  points: StoreScatterPoint[];
};

export type StoreScatterPoint = {
  averageLandedBookCost: number;
  averageOrderAmount: number;
  coveragePercent: number;
  currencyBooksCount: number;
  currencyOrdersCount: number;
  landedEligibleBooksCount: number;
  store: string;
  storeKey: string;
};

export function isMoneyStoreMetric(metric: StoreMetric): boolean {
  return metric === "spend";
}

export function storeRows({
  currency,
  metric,
  stores,
}: {
  currency: Currency;
  metric: StoreMetric;
  stores: readonly BookOrderStatisticsStore[];
}): StoreRow[] {
  const isMoney = isMoneyStoreMetric(metric);

  const rows = stores
    .map((store) => {
      const value = storeMetricValue({ currency, metric, store });
      const ordersCount = isMoney
        ? countOf({ currency, rows: store.ordersCountByCurrency })
        : store.ordersCount;
      const booksCount = isMoney
        ? countOf({ currency, rows: store.booksCountByCurrency })
        : store.booksCount;

      return {
        averageBookPrice: currencyAverageOf(store.averageBookPriceByCurrency, currency),
        averageLandedBookCost: currencyAverageOf(store.averageLandedBookCostByCurrency, currency),
        averageOrderAmount: currencyAverageOf(store.averageOrderAmountByCurrency, currency),
        booksCount,
        booksPerOrder: ordersCount === 0 ? null : booksCount / ordersCount,
        drilldown: store.drilldown,
        ordersCount,
        share: 0,
        store: store.store,
        storeKey: store.storeKey,
        value,
      };
    })
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);

  const peak = rows[0]?.value ?? 0;
  return rows.map((row) => ({ ...row, share: peak === 0 ? 0 : row.value / peak }));
}

export function storeScatter({
  currency,
  stores,
}: {
  currency: Currency;
  stores: readonly BookOrderStatisticsStore[];
}): StoreScatter {
  const points: StoreScatterPoint[] = [];
  const excluded: StoreExclusion[] = [];

  for (const store of stores) {
    const averageLandedBookCost = currencyAverageOf(
      store.averageLandedBookCostByCurrency,
      currency,
    );
    const averageOrderAmount = currencyAverageOf(store.averageOrderAmountByCurrency, currency);
    const coverage = store.landedCoverageByCurrency.find((entry) => entry.currency === currency);
    const landedEligibleBooksCount = countOf({
      currency,
      rows: store.landedEligibleBooksCountByCurrency,
    });
    const currencyOrdersCount = countOf({ currency, rows: store.ordersCountByCurrency });

    if (
      averageLandedBookCost === null ||
      averageOrderAmount === null ||
      coverage === undefined ||
      landedEligibleBooksCount < BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks
    ) {
      if (currencyOrdersCount > 0) {
        excluded.push({
          eligibleBooksCount: landedEligibleBooksCount,
          store: store.store,
          storeKey: store.storeKey,
        });
      }
      continue;
    }

    points.push({
      averageLandedBookCost,
      averageOrderAmount,
      coveragePercent: coverage.coveragePercent,
      currencyBooksCount: coverage.booksInScope,
      currencyOrdersCount,
      landedEligibleBooksCount,
      store: store.store,
      storeKey: store.storeKey,
    });
  }

  return { excluded, points };
}

function countOf({
  currency,
  rows,
}: {
  currency: Currency;
  rows: readonly { count: number; currency: Currency }[];
}): number {
  return rows.find((entry) => entry.currency === currency)?.count ?? 0;
}

function storeMetricValue({
  currency,
  metric,
  store,
}: {
  currency: Currency;
  metric: StoreMetric;
  store: BookOrderStatisticsStore;
}): number {
  if (metric === "books") return store.booksCount;
  if (metric === "orders") return store.ordersCount;
  return currencyTotalOf(store.totalsByCurrency, currency) ?? 0;
}

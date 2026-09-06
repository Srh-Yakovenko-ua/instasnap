import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsComparison,
  BookOrderStatisticsLanded,
  BookOrderStatisticsMonth,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsSnapshot,
  BookOrderStatisticsSummary,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
  BookOrderStatisticsView,
  Currency,
  CurrencyAverage,
  CurrencyDelta,
  CurrencyTotal,
  Nullable,
  StatisticsPeriod,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type {
  AmountAccumulator,
  ClassifiedOrder,
  CoverageAccumulator,
  OrderStatisticsRecord,
} from "./statistics-scope.js";

import { assertNever } from "../../../core/assert-never.js";
import { toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { buildLandedCostSummary } from "./landed-cost.js";
import { buildOrderDaily } from "./statistics-calendar.js";
import { computeStatisticsCosts } from "./statistics-costs.js";
import { toCurrencyDeltas, toNumericDelta } from "./statistics-delta.js";
import { buildStatisticsDynamics } from "./statistics-dynamics.js";
import { computeBookOrderLifecycle } from "./statistics-lifecycle.js";
import { buildStatisticsInsights } from "./statistics-pulse.js";
import { buildPurchaseRecords } from "./statistics-records.js";
import {
  addCoverage,
  addItemPrices,
  addOrderAmount,
  averagesFromAmounts,
  classifyOrder,
  countActiveShipments,
  countItems,
  coverageRows,
  isActiveItem,
  isReceivedItem,
  ORDER_ENUMS,
  totalsFromAmounts,
} from "./statistics-scope.js";
import { buildStoreScorecards, buildStoreSpendMovement } from "./statistics-stores.js";

export const ORDER_STATISTICS_TOP_LIMIT = 10;

const MONTH_KEY_LENGTH = 7;

type BookOrderStatisticsAggregates = Omit<BookOrderStatisticsView, "meta">;

type MonthBucket = {
  booksCount: number;
  orderAmounts: AmountAccumulator;
  ordersCount: number;
};

type PricedOrder = {
  order: ClassifiedOrder;
  totalAmount: number;
};

export function computeBookOrderStatistics({
  activeRecords,
  comparisonPeriod,
  includeCancelled,
  previousRecords,
  records,
  scope,
  topLimit,
}: {
  activeRecords: OrderStatisticsRecord[];
  comparisonPeriod: Nullable<StatisticsPeriod>;
  includeCancelled: boolean;
  previousRecords: Nullable<OrderStatisticsRecord[]>;
  records: OrderStatisticsRecord[];
  scope: BookOrderStatisticsRecordScope;
  topLimit: number;
}): BookOrderStatisticsAggregates {
  const orders = records.map((record) => classifyOrder({ includeCancelled, record }));
  const includedOrders = orders.filter((order) => order.isIncluded);
  const activeOrders = activeRecords
    .map((record) => classifyOrder({ includeCancelled, record }))
    .filter((order) => order.isIncluded);
  const previousOrders =
    previousRecords === null
      ? null
      : previousRecords.map((record) => classifyOrder({ includeCancelled, record }));
  const previousIncludedOrders =
    previousOrders === null ? [] : previousOrders.filter((order) => order.isIncluded);
  const summary = buildOrderSummary({ includedOrders, orders });
  const monthly = buildOrderMonthly(includedOrders);
  const byStore = buildStoreScorecards(includedOrders);
  const costs = computeStatisticsCosts(includedOrders);
  const landedCost = buildLandedCostSummary(includedOrders);
  const topOrdersByCurrency = buildTopBookOrdersByCurrency({ includedOrders, topLimit });
  const comparison = buildComparison({ previousIncludedOrders, previousOrders, summary });
  const dynamics = buildStatisticsDynamics({
    comparisonOrders: previousOrders === null ? null : previousIncludedOrders,
    comparisonPeriod,
    currentPeriod: scope.period,
    orders: includedOrders,
  });
  const purchaseRecords = buildPurchaseRecords({
    byStore,
    includedOrders,
    scope,
    topOrdersByCurrency,
  });

  return {
    bestValueStoreByCurrency: purchaseRecords.bestValueStoreByCurrency,
    byStore,
    comparison,
    costs,
    daily: buildOrderDaily(includedOrders),
    dynamics,
    insights: buildStatisticsInsights({
      comparison,
      costs,
      dynamics,
      landedCostDeltas: comparisonLandedDeltas({
        landedCost,
        previousIncludedOrders,
        previousOrders,
      }),
      landedCoverage: landedCost,
      recordMonthByCurrency: purchaseRecords.recordMonthByCurrency,
      scope,
      storeMovement:
        previousOrders === null
          ? []
          : buildStoreSpendMovement({ current: includedOrders, previous: previousIncludedOrders }),
      totalsByCurrency: summary.totalsByCurrency,
    }),
    landedCost,
    lifecycle: computeBookOrderLifecycle({ includeCancelled, orders, previousOrders }),
    monthly,
    records: purchaseRecords,
    snapshot: buildSnapshot(activeOrders),
    summary,
    topOrders: topOrdersByCurrency.flatMap((group) => group.orders),
    topOrdersByCurrency,
  };
}

function amountsForDerivedStatus({
  active,
  cancelled,
  received,
  status,
}: {
  active: AmountAccumulator;
  cancelled: AmountAccumulator;
  received: AmountAccumulator;
  status: BookOrderDerivedStatus;
}): AmountAccumulator {
  switch (status) {
    case ORDER_ENUMS.derivedStatus.active:
    case ORDER_ENUMS.derivedStatus.partially_received:
    case ORDER_ENUMS.derivedStatus.partially_shipped:
    case ORDER_ENUMS.derivedStatus.shipped:
      return active;
    case ORDER_ENUMS.derivedStatus.cancelled:
      return cancelled;
    case ORDER_ENUMS.derivedStatus.received:
      return received;
    default:
      return assertNever(status);
  }
}

function averageBooksPerOrder(includedOrders: ClassifiedOrder[]): Nullable<number> {
  if (includedOrders.length === 0) {
    return null;
  }
  const books = includedOrders.reduce((count, order) => count + order.countedItems.length, 0);
  return books / includedOrders.length;
}

function buildComparison({
  previousIncludedOrders,
  previousOrders,
  summary,
}: {
  previousIncludedOrders: ClassifiedOrder[];
  previousOrders: Nullable<ClassifiedOrder[]>;
  summary: BookOrderStatisticsSummary;
}): Nullable<BookOrderStatisticsComparison> {
  if (previousOrders === null) {
    return null;
  }

  const previous = buildOrderSummary({
    includedOrders: previousIncludedOrders,
    orders: previousOrders,
  });

  return {
    averageBookPriceByCurrency: toCurrencyDeltas({
      current: toTotals(summary.averageBookPriceByCurrency),
      previous: toTotals(previous.averageBookPriceByCurrency),
    }),
    averageBooksPerOrder: toNumericDelta({
      current: summary.averageBooksPerOrder,
      previous: previous.averageBooksPerOrder,
    }),
    averageOrderAmountByCurrency: toCurrencyDeltas({
      current: toTotals(summary.averageOrderAmountByCurrency),
      previous: toTotals(previous.averageOrderAmountByCurrency),
    }),
    booksCount: toNumericDelta({ current: summary.booksCount, previous: previous.booksCount }),
    ordersCount: toNumericDelta({ current: summary.ordersCount, previous: previous.ordersCount }),
    receivedBooksCount: toNumericDelta({
      current: summary.receivedBooksCount,
      previous: previous.receivedBooksCount,
    }),
    shipmentsCount: toNumericDelta({
      current: summary.shipmentsCount,
      previous: previous.shipmentsCount,
    }),
    totalsByCurrency: toCurrencyDeltas({
      current: summary.totalsByCurrency,
      previous: previous.totalsByCurrency,
    }),
  };
}

function buildOrderMonthly(orders: ClassifiedOrder[]): BookOrderStatisticsMonth[] {
  const buckets = new Map<string, MonthBucket>();
  for (const order of orders) {
    const { orderDate } = order.record;
    if (orderDate === null) {
      continue;
    }
    const month = toIsoDate(orderDate).slice(0, MONTH_KEY_LENGTH);
    const bucket = buckets.get(month) ?? {
      booksCount: 0,
      orderAmounts: new Map(),
      ordersCount: 0,
    };
    bucket.booksCount += order.countedItems.length;
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, bucket]) => ({
      booksCount: bucket.booksCount,
      month,
      ordersCount: bucket.ordersCount,
      totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
    }));
}

function buildOrderSummary({
  includedOrders,
  orders,
}: {
  includedOrders: ClassifiedOrder[];
  orders: ClassifiedOrder[];
}): BookOrderStatisticsSummary {
  const orderAmounts: AmountAccumulator = new Map();
  const bookPrices: AmountAccumulator = new Map();
  const active: AmountAccumulator = new Map();
  const cancelled: AmountAccumulator = new Map();
  const received: AmountAccumulator = new Map();
  const financialCoverage: CoverageAccumulator = new Map();
  const priceCoverage: CoverageAccumulator = new Map();
  for (const order of includedOrders) {
    addOrderAmount({ accumulator: orderAmounts, order });
    addItemPrices({ accumulator: bookPrices, order });
    addCoverage({
      accumulator: financialCoverage,
      currency: order.currency,
      isCovered: order.amount !== null,
    });
    for (const item of order.countedItems) {
      addCoverage({
        accumulator: priceCoverage,
        currency: order.currency,
        isCovered: item.price !== null,
      });
    }
    addOrderAmount({
      accumulator: amountsForDerivedStatus({
        active,
        cancelled,
        received,
        status: order.derivedStatus,
      }),
      order,
    });
  }

  return {
    activeBooksCount: countItems({ orders: includedOrders, predicate: isActiveItem }),
    activeShipmentsCount: countActiveShipments(includedOrders),
    activeTotalsByCurrency: totalsFromAmounts(active),
    averageBookPriceByCurrency: averagesFromAmounts(bookPrices),
    averageBooksPerOrder: averageBooksPerOrder(includedOrders),
    averageOrderAmountByCurrency: averagesFromAmounts(orderAmounts),
    booksCount: includedOrders.reduce((count, order) => count + order.countedItems.length, 0),
    cancelledOrdersCount: orders.filter(
      (order) => order.derivedStatus === ORDER_ENUMS.derivedStatus.cancelled,
    ).length,
    cancelledTotalsByCurrency: totalsFromAmounts(cancelled),
    financialCoverageByCurrency: coverageRows(financialCoverage).map((row) => ({
      currency: row.currency,
      ordersInScope: row.total,
      ordersWithResolvedAmount: row.covered,
    })),
    ordersCount: includedOrders.length,
    priceCoverageByCurrency: coverageRows(priceCoverage).map((row) => ({
      booksInScope: row.total,
      booksWithPrice: row.covered,
      currency: row.currency,
    })),
    receivedBooksCount: countItems({ orders: includedOrders, predicate: isReceivedItem }),
    receivedTotalsByCurrency: totalsFromAmounts(received),
    shipmentsCount: includedOrders.reduce(
      (count, order) => count + order.record.shipments.length,
      0,
    ),
    totalsByCurrency: totalsFromAmounts(orderAmounts),
  };
}

function buildSnapshot(activeOrders: ClassifiedOrder[]): BookOrderStatisticsSnapshot {
  const activeAmounts: AmountAccumulator = new Map();
  const activeCoverage: CoverageAccumulator = new Map();
  const ordersCarryingActiveItems = activeOrders.filter((order) =>
    order.countedItems.some((item) => isActiveItem(item)),
  );
  for (const order of ordersCarryingActiveItems) {
    addOrderAmount({ accumulator: activeAmounts, order });
    addCoverage({
      accumulator: activeCoverage,
      currency: order.currency,
      isCovered: order.amount !== null,
    });
  }

  return {
    activeBooksCount: countItems({ orders: activeOrders, predicate: isActiveItem }),
    activeMoneyCoverageByCurrency: coverageRows(activeCoverage).map((row) => ({
      currency: row.currency,
      ordersInScope: row.total,
      ordersWithResolvedAmount: row.covered,
    })),
    activeOrdersCount: ordersCarryingActiveItems.length,
    activeShipmentsCount: countActiveShipments(activeOrders),
    activeTotalsByCurrency: totalsFromAmounts(activeAmounts),
  };
}

function buildTopBookOrdersByCurrency({
  includedOrders,
  topLimit,
}: {
  includedOrders: ClassifiedOrder[];
  topLimit: number;
}): BookOrderStatisticsTopOrdersByCurrency {
  const buckets = new Map<Currency, PricedOrder[]>();
  for (const order of includedOrders) {
    if (order.amount === null) {
      continue;
    }
    const bucket = buckets.get(order.currency) ?? [];
    bucket.push({ order, totalAmount: order.amount });
    buckets.set(order.currency, bucket);
  }

  return CurrencySchema.options.flatMap((currency) => {
    const bucket = buckets.get(currency);
    if (bucket === undefined) {
      return [];
    }
    return [
      {
        currency,
        orders: bucket.sort(compareTopBookOrders).slice(0, topLimit).map(toTopBookOrder),
      },
    ];
  });
}

function compareTopBookOrders(left: PricedOrder, right: PricedOrder): number {
  if (right.totalAmount !== left.totalAmount) {
    return right.totalAmount - left.totalAmount;
  }
  const leftDate = toNullableIsoDate(left.order.record.orderDate) ?? "";
  const rightDate = toNullableIsoDate(right.order.record.orderDate) ?? "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }
  return left.order.record.id.localeCompare(right.order.record.id);
}

function comparisonLandedDeltas({
  landedCost,
  previousIncludedOrders,
  previousOrders,
}: {
  landedCost: BookOrderStatisticsLanded;
  previousIncludedOrders: ClassifiedOrder[];
  previousOrders: Nullable<ClassifiedOrder[]>;
}): CurrencyDelta[] {
  if (previousOrders === null) {
    return [];
  }

  const previous = buildLandedCostSummary(previousIncludedOrders);

  return toCurrencyDeltas({
    current: toLandedTotals(landedCost),
    previous: toLandedTotals(previous),
  });
}

function toLandedTotals(landed: BookOrderStatisticsLanded): CurrencyTotal[] {
  return landed.flatMap((row) =>
    row.averageLandedBookCost === null
      ? []
      : [{ currency: row.currency, total: row.averageLandedBookCost }],
  );
}

function toTopBookOrder({ order, totalAmount }: PricedOrder): BookOrderStatisticsTopOrder {
  return {
    booksCount: order.countedItems.length,
    currency: order.currency,
    derivedStatus: order.derivedStatus,
    id: order.record.id,
    orderDate: toNullableIsoDate(order.record.orderDate),
    orderNumber: order.record.orderNumber,
    storeName: order.record.storeName,
    totalAmount,
  };
}

function toTotals(averages: readonly CurrencyAverage[]): CurrencyTotal[] {
  return averages.map((row) => ({ currency: row.currency, total: row.average }));
}

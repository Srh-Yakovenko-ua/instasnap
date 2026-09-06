import type {
  BookOrderStatisticsMostActiveStore,
  BookOrderStatisticsOrderIdentity,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsStore,
  BookOrderStatisticsStoreLeader,
  BookOrderStatisticsTopOrdersByCurrency,
  Currency,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import { addOrderAmount, totalsFromAmounts } from "./statistics-scope.js";
import { buildBestValueStoreByCurrency } from "./statistics-stores.js";

const MONTH_KEY_LENGTH = 7;

type MonthCurrencyBucket = {
  booksCount: number;
  currency: Currency;
  month: string;
  orderAmounts: AmountAccumulator;
  orders: ClassifiedOrder[];
  ordersCount: number;
};

export function buildPurchaseRecords({
  byStore,
  includedOrders,
  scope,
  topOrdersByCurrency,
}: {
  byStore: readonly BookOrderStatisticsStore[];
  includedOrders: readonly ClassifiedOrder[];
  scope: BookOrderStatisticsRecordScope;
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency;
}): BookOrderStatisticsRecords {
  return {
    bestValueStoreByCurrency: buildBestValueStoreByCurrency(includedOrders),
    largestOrderByCurrency: topOrdersByCurrency.flatMap((group) => {
      const largest = group.orders.at(0);
      return largest === undefined ? [] : [{ currency: group.currency, order: largest }];
    }),
    mostActiveStore: buildMostActiveStore(byStore),
    mostBooksInOrder: buildMostBooksInOrder(includedOrders),
    recordMonthByCurrency: buildRecordMonthByCurrency(includedOrders),
    scope,
  };
}

function buildMostActiveStore(
  byStore: readonly BookOrderStatisticsStore[],
): BookOrderStatisticsMostActiveStore {
  return {
    byBooks: pickStoreLeader({ byStore, metric: "booksCount" }),
    byOrders: pickStoreLeader({ byStore, metric: "ordersCount" }),
  };
}

function buildMostBooksInOrder(
  orders: readonly ClassifiedOrder[],
): Nullable<BookOrderStatisticsOrderIdentity> {
  const winner = [...orders].sort(compareByBooksCount).at(0);

  return winner === undefined || winner.countedItems.length === 0 ? null : toOrderIdentity(winner);
}

function buildRecordMonthByCurrency(
  orders: readonly ClassifiedOrder[],
): BookOrderStatisticsRecordMonth[] {
  const buckets = new Map<string, MonthCurrencyBucket>();

  for (const order of orders) {
    const month = monthOf(order);
    if (month === null) {
      continue;
    }
    const key = `${month}:${order.currency}`;
    const bucket = buckets.get(key) ?? emptyMonthBucket({ currency: order.currency, month });
    bucket.booksCount += order.countedItems.length;
    bucket.orders.push(order);
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(key, bucket);
  }

  const best = new Map<Currency, BookOrderStatisticsRecordMonth>();
  for (const bucket of buckets.values()) {
    const candidate = toRecordMonth(bucket);
    if (candidate === null) {
      continue;
    }
    const current = best.get(bucket.currency);
    if (current === undefined || isBetterRecordMonth({ candidate, current })) {
      best.set(bucket.currency, candidate);
    }
  }

  return CurrencySchema.options.flatMap((currency) => {
    const record = best.get(currency);
    return record === undefined ? [] : [record];
  });
}

function compareByBooksCount(left: ClassifiedOrder, right: ClassifiedOrder): number {
  return (
    right.countedItems.length - left.countedItems.length ||
    (toNullableIsoDate(right.record.orderDate) ?? "").localeCompare(
      toNullableIsoDate(left.record.orderDate) ?? "",
    ) ||
    left.record.id.localeCompare(right.record.id)
  );
}

function emptyMonthBucket({
  currency,
  month,
}: {
  currency: Currency;
  month: string;
}): MonthCurrencyBucket {
  return { booksCount: 0, currency, month, orderAmounts: new Map(), orders: [], ordersCount: 0 };
}

function isBetterRecordMonth({
  candidate,
  current,
}: {
  candidate: BookOrderStatisticsRecordMonth;
  current: BookOrderStatisticsRecordMonth;
}): boolean {
  if (candidate.total !== current.total) {
    return candidate.total > current.total;
  }
  return candidate.month.localeCompare(current.month) > 0;
}

function monthOf(order: ClassifiedOrder): Nullable<string> {
  const orderedOn = toNullableIsoDate(order.record.orderDate);
  return orderedOn === null ? null : orderedOn.slice(0, MONTH_KEY_LENGTH);
}

function pickStoreLeader({
  byStore,
  metric,
}: {
  byStore: readonly BookOrderStatisticsStore[];
  metric: "booksCount" | "ordersCount";
}): Nullable<BookOrderStatisticsStoreLeader> {
  const leader = [...byStore].sort(
    (left, right) =>
      right[metric] - left[metric] || UKRAINIAN_COLLATION.compare(left.store, right.store),
  )[0];

  if (leader === undefined || leader[metric] === 0) {
    return null;
  }

  return {
    booksCount: leader.booksCount,
    drilldown: leader.drilldown,
    ordersCount: leader.ordersCount,
    store: leader.store,
    storeKey: leader.storeKey,
  };
}

function toOrderIdentity(order: ClassifiedOrder): BookOrderStatisticsOrderIdentity {
  return {
    booksCount: order.countedItems.length,
    currency: order.record.currency,
    derivedStatus: order.derivedStatus,
    id: order.record.id,
    orderDate: toNullableIsoDate(order.record.orderDate),
    orderNumber: order.record.orderNumber,
    storeName: order.record.storeName,
    totalAmount: order.amount,
  };
}

function toRecordMonth(bucket: MonthCurrencyBucket): Nullable<BookOrderStatisticsRecordMonth> {
  const total = totalsFromAmounts(bucket.orderAmounts).find(
    (row) => row.currency === bucket.currency,
  );

  return total === undefined
    ? null
    : {
        booksCount: bucket.booksCount,
        currency: bucket.currency,
        drilldown: buildDrilldownBreakdown(bucket.orders),
        month: bucket.month,
        ordersCount: bucket.ordersCount,
        total: total.total,
      };
}

import type { BookOrderStatisticsDaily } from "@app/shared";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { toIsoDate } from "../../../core/iso-date.js";
import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import { addOrderAmount, totalsFromAmounts } from "./statistics-scope.js";

type DayBucket = {
  booksCount: number;
  orderAmounts: AmountAccumulator;
  orders: ClassifiedOrder[];
  ordersCount: number;
};

export function buildOrderDaily(orders: ClassifiedOrder[]): BookOrderStatisticsDaily {
  const buckets = new Map<string, DayBucket>();
  for (const order of orders) {
    const { orderDate } = order.record;
    if (orderDate === null) {
      continue;
    }
    const date = toIsoDate(orderDate);
    const bucket = buckets.get(date) ?? emptyDayBucket();
    bucket.booksCount += order.countedItems.length;
    bucket.orders.push(order);
    bucket.ordersCount += 1;
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(date, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, bucket]) => ({
      booksCount: bucket.booksCount,
      date,
      drilldown: buildDrilldownBreakdown(bucket.orders),
      ordersCount: bucket.ordersCount,
      totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
    }));
}

function emptyDayBucket(): DayBucket {
  return { booksCount: 0, orderAmounts: new Map(), orders: [], ordersCount: 0 };
}

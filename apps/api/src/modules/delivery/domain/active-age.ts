import type {
  ActiveMoneyAgeBucket,
  ActiveMoneyAgeBucketRow,
  ActiveMoneyAgeResponse,
} from "@app/shared";

import {
  ACTIVE_MONEY_AGE_BUCKET_DAYS,
  ActiveMoneyAgeBucketSchema,
  isActiveShipmentStatus,
} from "@app/shared";
import { differenceInCalendarDays } from "date-fns";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { addOrderAmount, isActiveItem, totalsFromAmounts } from "./statistics-scope.js";

const AGE_BUCKET_ORDER: readonly ActiveMoneyAgeBucket[] = ActiveMoneyAgeBucketSchema.options;

const DATED_AGE_BUCKETS = Object.entries(ACTIVE_MONEY_AGE_BUCKET_DAYS) as [
  Exclude<ActiveMoneyAgeBucket, "unknown_date">,
  (typeof ACTIVE_MONEY_AGE_BUCKET_DAYS)[Exclude<ActiveMoneyAgeBucket, "unknown_date">],
][];

type AgeBucketAccumulator = {
  booksCount: number;
  orderAmounts: AmountAccumulator;
  ordersCount: number;
  shipmentsCount: number;
};

export function buildActiveMoneyAge({
  now,
  orders,
}: {
  now: Date;
  orders: readonly ClassifiedOrder[];
}): Omit<ActiveMoneyAgeResponse, "source"> {
  const buckets = new Map<ActiveMoneyAgeBucket, AgeBucketAccumulator>();

  for (const order of orders) {
    const activeItems = order.countedItems.filter(isActiveItem);
    if (activeItems.length === 0) {
      continue;
    }

    const key = ageBucketOf({ now, orderDate: order.record.orderDate });
    const bucket = buckets.get(key) ?? emptyAccumulator();
    bucket.booksCount += activeItems.length;
    bucket.ordersCount += 1;
    bucket.shipmentsCount += countActiveShipmentsCarryingActiveItems(order);
    addOrderAmount({ accumulator: bucket.orderAmounts, order });
    buckets.set(key, bucket);
  }

  return {
    asOf: now.toISOString(),
    buckets: AGE_BUCKET_ORDER.flatMap((key) => {
      const bucket = buckets.get(key);
      return bucket === undefined ? [] : [toBucketRow({ bucket, key })];
    }),
  };
}

function ageBucketOf({
  now,
  orderDate,
}: {
  now: Date;
  orderDate: ClassifiedOrder["record"]["orderDate"];
}): ActiveMoneyAgeBucket {
  if (orderDate === null) {
    return ActiveMoneyAgeBucketSchema.enum.unknown_date;
  }

  const ageInDays = Math.max(
    0,
    differenceInCalendarDays(startOfUtcDay(now), startOfUtcDay(orderDate)),
  );
  const matched = DATED_AGE_BUCKETS.find(
    ([, bounds]) =>
      ageInDays >= bounds.minDays && (bounds.maxDays === null || ageInDays <= bounds.maxDays),
  );

  return matched === undefined ? ActiveMoneyAgeBucketSchema.enum.unknown_date : matched[0];
}

function countActiveShipmentsCarryingActiveItems(order: ClassifiedOrder): number {
  return order.record.shipments.filter(
    (shipment) =>
      isActiveShipmentStatus(shipment.status) &&
      order.record.items.some((item) => item.shipmentId === shipment.id && isActiveItem(item)),
  ).length;
}

function emptyAccumulator(): AgeBucketAccumulator {
  return { booksCount: 0, orderAmounts: new Map(), ordersCount: 0, shipmentsCount: 0 };
}

function toBucketRow({
  bucket,
  key,
}: {
  bucket: AgeBucketAccumulator;
  key: ActiveMoneyAgeBucket;
}): ActiveMoneyAgeBucketRow {
  return {
    booksCount: bucket.booksCount,
    key,
    ordersCount: bucket.ordersCount,
    shipmentsCount: bucket.shipmentsCount,
    totalsByCurrency: totalsFromAmounts(bucket.orderAmounts),
  };
}

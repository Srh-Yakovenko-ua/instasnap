import type {
  Nullable,
  StatisticsDynamics,
  StatisticsDynamicsBucket,
  StatisticsDynamicsFacts,
  StatisticsDynamicsGranularity,
  StatisticsPeriod,
} from "@app/shared";

import { STATISTICS_DYNAMICS_RULES, StatisticsDynamicsGranularitySchema } from "@app/shared";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { AmountAccumulator, ClassifiedOrder } from "./statistics-scope.js";

import { toIsoDate } from "../../../core/iso-date.js";
import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import { addOrderAmount, totalsFromAmounts } from "./statistics-scope.js";

const GRANULARITY = StatisticsDynamicsGranularitySchema.enum;

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

const DAYS_PER_WEEK = 7;

const ISO_DAY_FORMAT = "yyyy-MM-dd";

type BucketBounds = {
  from: string;
  to: string;
};

type BucketFacts = {
  facts: StatisticsDynamicsFacts;
  orders: ClassifiedOrder[];
};

type DatedOrder = {
  order: ClassifiedOrder;
  orderedOn: string;
};

export function buildStatisticsDynamics({
  comparisonOrders,
  comparisonPeriod,
  currentPeriod,
  orders,
}: {
  comparisonOrders: Nullable<readonly ClassifiedOrder[]>;
  comparisonPeriod: Nullable<StatisticsPeriod>;
  currentPeriod: StatisticsPeriod;
  orders: readonly ClassifiedOrder[];
}): StatisticsDynamics {
  const current = datedOrders(orders);
  const bounds = periodBounds({ dated: current, period: currentPeriod });
  if (bounds === null) {
    return { buckets: [], granularity: GRANULARITY.month };
  }

  const granularity = granularityFor(bounds);
  const comparisonDated = comparisonOrders === null ? null : datedOrders(comparisonOrders);
  const comparisonBounds =
    comparisonDated === null || comparisonPeriod === null
      ? []
      : bucketBoundsOfPeriod({ dated: comparisonDated, granularity, period: comparisonPeriod });

  return {
    buckets: bucketBounds({ bounds, granularity }).map((slot, index) =>
      toBucket({
        comparison: comparisonBounds[index] ?? null,
        comparisonDated,
        current: slot,
        orders: current,
      }),
    ),
    granularity,
  };
}

function bucketBounds({
  bounds,
  granularity,
}: {
  bounds: BucketBounds;
  granularity: StatisticsDynamicsGranularity;
}): BucketBounds[] {
  const slots: BucketBounds[] = [];
  let cursor = startOfBucket({ granularity, isoDay: bounds.from });

  while (cursor <= bounds.to) {
    const slotEnd = endOfBucket({ granularity, start: cursor });
    slots.push({
      from: cursor < bounds.from ? bounds.from : cursor,
      to: slotEnd > bounds.to ? bounds.to : slotEnd,
    });
    cursor = nextIsoDay(slotEnd);
  }

  return slots;
}

function bucketBoundsOfPeriod({
  dated,
  granularity,
  period,
}: {
  dated: DatedOrder[];
  granularity: StatisticsDynamicsGranularity;
  period: StatisticsPeriod;
}): BucketBounds[] {
  const bounds = periodBounds({ dated, period });
  return bounds === null ? [] : bucketBounds({ bounds, granularity });
}

function datedOrders(orders: readonly ClassifiedOrder[]): DatedOrder[] {
  return orders.flatMap((order) =>
    order.record.orderDate === null
      ? []
      : [{ order, orderedOn: toIsoDate(order.record.orderDate) }],
  );
}

function endOfBucket({
  granularity,
  start,
}: {
  granularity: StatisticsDynamicsGranularity;
  start: string;
}): string {
  const startDate = parseISO(start);

  return granularity === GRANULARITY.week
    ? format(addDays(startDate, DAYS_PER_WEEK - 1), ISO_DAY_FORMAT)
    : format(endOfMonth(startDate), ISO_DAY_FORMAT);
}

function factsOf({ bounds, orders }: { bounds: BucketBounds; orders: DatedOrder[] }): BucketFacts {
  const amounts: AmountAccumulator = new Map();
  const inBucket = orders.filter(
    ({ orderedOn }) => orderedOn >= bounds.from && orderedOn <= bounds.to,
  );
  let booksCount = 0;

  for (const { order } of inBucket) {
    booksCount += order.countedItems.length;
    addOrderAmount({ accumulator: amounts, order });
  }

  return {
    facts: {
      booksCount,
      booksPerOrder: inBucket.length === 0 ? null : booksCount / inBucket.length,
      from: bounds.from,
      ordersCount: inBucket.length,
      to: bounds.to,
      totalsByCurrency: totalsFromAmounts(amounts),
    },
    orders: inBucket.map(({ order }) => order),
  };
}

function granularityFor({ from, to }: BucketBounds): StatisticsDynamicsGranularity {
  const inclusiveDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;

  return inclusiveDays <= STATISTICS_DYNAMICS_RULES.weeklyMaxDays
    ? GRANULARITY.week
    : GRANULARITY.month;
}

function nextIsoDay(isoDay: string): string {
  return format(addDays(parseISO(isoDay), 1), ISO_DAY_FORMAT);
}

function periodBounds({
  dated,
  period,
}: {
  dated: DatedOrder[];
  period: StatisticsPeriod;
}): Nullable<BucketBounds> {
  const ordered = dated.map(({ orderedOn }) => orderedOn).sort();
  const from = period.from ?? ordered.at(0) ?? null;
  const to = period.to ?? ordered.at(-1) ?? null;

  if (from === null || to === null || from > to) {
    return null;
  }

  return { from, to };
}

function startOfBucket({
  granularity,
  isoDay,
}: {
  granularity: StatisticsDynamicsGranularity;
  isoDay: string;
}): string {
  const date = parseISO(isoDay);
  const start =
    granularity === GRANULARITY.week ? startOfWeek(date, WEEK_OPTIONS) : startOfMonth(date);

  return format(start, ISO_DAY_FORMAT);
}

function toBucket({
  comparison,
  comparisonDated,
  current,
  orders,
}: {
  comparison: Nullable<BucketBounds>;
  comparisonDated: Nullable<DatedOrder[]>;
  current: BucketBounds;
  orders: DatedOrder[];
}): StatisticsDynamicsBucket {
  const currentFacts = factsOf({ bounds: current, orders });
  const comparisonFacts =
    comparison === null || comparisonDated === null
      ? null
      : factsOf({ bounds: comparison, orders: comparisonDated }).facts;

  return {
    comparison: comparisonFacts,
    current: currentFacts.facts,
    drilldown: buildDrilldownBreakdown(currentFacts.orders),
    key: currentFacts.facts.from,
  };
}

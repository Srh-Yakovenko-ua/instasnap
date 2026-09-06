import type {
  StatisticsDrilldownBreakdown,
  StatisticsDrilldownDestination,
  StatisticsDrilldownTarget,
} from "@app/shared";

import {
  statisticsDrilldownDestinationOf,
  StatisticsDrilldownDestinationSchema,
} from "@app/shared";

import type { ClassifiedOrder } from "./statistics-scope.js";

const DESTINATION_ORDER: readonly StatisticsDrilldownDestination[] =
  StatisticsDrilldownDestinationSchema.options;

type TargetAccumulator = {
  booksCount: number;
  ordersCount: number;
};

export function buildDrilldownBreakdown(
  orders: readonly ClassifiedOrder[],
): StatisticsDrilldownBreakdown {
  const targets = new Map<StatisticsDrilldownDestination, TargetAccumulator>();

  for (const order of orders) {
    const destination = statisticsDrilldownDestinationOf(order.derivedStatus);
    const target = targets.get(destination) ?? { booksCount: 0, ordersCount: 0 };
    target.booksCount += order.countedItems.length;
    target.ordersCount += 1;
    targets.set(destination, target);
  }

  return {
    targets: DESTINATION_ORDER.flatMap((destination) => toTarget({ destination, targets })),
  };
}

function toTarget({
  destination,
  targets,
}: {
  destination: StatisticsDrilldownDestination;
  targets: Map<StatisticsDrilldownDestination, TargetAccumulator>;
}): StatisticsDrilldownTarget[] {
  const target = targets.get(destination);
  if (target === undefined || target.ordersCount === 0) {
    return [];
  }

  return [{ booksCount: target.booksCount, destination, ordersCount: target.ordersCount }];
}

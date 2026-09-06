import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsOrderIdentity,
  Currency,
  Nullable,
  StatisticsDrilldownBreakdown,
  StatisticsDrilldownDestination,
  StatisticsDrilldownScope,
  StatisticsDrilldownTarget,
  StatisticsMetricKind,
} from "@app/shared";

import {
  resolveStatisticsDrilldownCurrency,
  STATISTICS_METRIC_KIND,
  statisticsDrilldownDestinationOf,
  StatisticsDrilldownDestinationSchema,
} from "@app/shared";

export const DELIVERY_ROUTES = {
  history: "/delivery/history",
  inTransit: "/delivery/in-transit",
} as const;

const DESTINATION = StatisticsDrilldownDestinationSchema.enum;

const IN_TRANSIT_SORT = "oldest_orders";

const DESTINATION_LIST_PARAMS = {
  encodedSeparator: "%2C",
  keys: ["currency", "store"],
  separator: ",",
} as const;

export type StatisticsDrilldownContext = {
  currencyFilter: Nullable<Currency>;
  displayCurrency: Nullable<Currency>;
  isStale: boolean;
  orderState: Nullable<BookOrderDerivedStatus>;
  store: Nullable<string>;
};

export type StatisticsDrilldownLink = StatisticsDrilldownTarget & {
  href: string;
};

export type StatisticsDrilldownRequest = {
  context: StatisticsDrilldownContext;
  destination: StatisticsDrilldownDestination;
  metricKind: StatisticsMetricKind;
  scope: StatisticsDrilldownScope;
};

export function buildStatisticsDrilldown({
  context,
  destination,
  metricKind,
  scope,
}: StatisticsDrilldownRequest): Nullable<string> {
  if (context.isStale) {
    return null;
  }

  const params: Record<string, string> = {
    ...destinationParams(destination),
    ...scopeParams({ destination, scope }),
    ...contextParams({ context, scope }),
    ...(scope.kind === "order" ? {} : currencyParams({ context, metricKind })),
  };

  return withParams(routeOf(destination), params);
}

export function orderDrilldownLink({
  context,
  order,
}: {
  context: StatisticsDrilldownContext;
  order: BookOrderStatisticsOrderIdentity;
}): Nullable<StatisticsDrilldownLink> {
  const destination = statisticsDrilldownDestinationOf(order.derivedStatus);
  const href = buildStatisticsDrilldown({
    context,
    destination,
    metricKind: STATISTICS_METRIC_KIND.countOrStatus,
    scope: { kind: "order", orderId: order.id },
  });

  if (href === null) {
    return null;
  }

  return { booksCount: order.booksCount, destination, href, ordersCount: 1 };
}

export function statisticsDrilldownLinks({
  breakdown,
  context,
  metricKind,
  scope,
}: Omit<StatisticsDrilldownRequest, "destination"> & {
  breakdown: StatisticsDrilldownBreakdown;
}): StatisticsDrilldownLink[] {
  return breakdown.targets
    .filter((target) => target.ordersCount > 0)
    .flatMap((target) => {
      const href = buildStatisticsDrilldown({
        context,
        destination: target.destination,
        metricKind,
        scope,
      });
      return href === null ? [] : [{ ...target, href }];
    });
}

function contextParams({
  context,
  scope,
}: {
  context: StatisticsDrilldownContext;
  scope: StatisticsDrilldownScope;
}): Record<string, string> {
  if (scope.kind === "order") {
    return {};
  }

  return {
    ...(context.orderState === null ? {} : { orderState: context.orderState }),
    ...(scope.kind === "store" || scope.kind === "store_and_period" || context.store === null
      ? {}
      : { store: context.store }),
  };
}

function currencyParams({
  context,
  metricKind,
}: {
  context: StatisticsDrilldownContext;
  metricKind: StatisticsMetricKind;
}): Record<string, string> {
  const currency = resolveStatisticsDrilldownCurrency({
    currencyFilter: context.currencyFilter,
    displayCurrency: context.displayCurrency,
    metricKind,
  });

  return currency === null ? {} : { currency };
}

function dateParams({
  destination,
  from,
  to,
}: {
  destination: StatisticsDrilldownDestination;
  from: Nullable<string>;
  to: Nullable<string>;
}): Record<string, string> {
  const names =
    destination === DESTINATION.in_transit
      ? { from: "orderedFrom", to: "orderedTo" }
      : { from: "from", to: "to" };

  return {
    ...(from === null ? {} : { [names.from]: from }),
    ...(to === null ? {} : { [names.to]: to }),
  };
}

function destinationParams(destination: StatisticsDrilldownDestination): Record<string, string> {
  switch (destination) {
    case DESTINATION.history_cancelled:
      return { tab: "cancelled" };
    case DESTINATION.history_received:
      return { tab: "received" };
    default:
      return {};
  }
}

function routeOf(destination: StatisticsDrilldownDestination): string {
  return destination === DESTINATION.in_transit
    ? DELIVERY_ROUTES.inTransit
    : DELIVERY_ROUTES.history;
}

function scopeParams({
  destination,
  scope,
}: {
  destination: StatisticsDrilldownDestination;
  scope: StatisticsDrilldownScope;
}): Record<string, string> {
  switch (scope.kind) {
    case "age_bucket":
      return { ageBucket: scope.ageBucket, sort: IN_TRANSIT_SORT };
    case "order":
      return { orderId: scope.orderId };
    case "order_date_range":
      return dateParams({ destination, from: scope.from, to: scope.to });
    case "store":
      return { store: scope.store };
    default:
      return {
        store: scope.store,
        ...dateParams({ destination, from: scope.from, to: scope.to }),
      };
  }
}

function toDestinationValue([key, value]: [string, string]): [string, string] {
  const isList = DESTINATION_LIST_PARAMS.keys.some((listKey) => listKey === key);
  return [
    key,
    isList
      ? value.replaceAll(
          DESTINATION_LIST_PARAMS.separator,
          DESTINATION_LIST_PARAMS.encodedSeparator,
        )
      : value,
  ];
}

function withParams(route: string, params: Record<string, string>): string {
  const search = new URLSearchParams(Object.entries(params).map(toDestinationValue)).toString();
  return search === "" ? route : `${route}?${search}`;
}

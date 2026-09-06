import type {
  ActiveMoneyAgeBucket,
  BookOrderDerivedStatus,
  Currency,
  InTransitDeliveryStructure,
  InTransitFilter,
  InTransitSort,
  Nullable,
} from "@app/shared";

import {
  ACTIVE_MONEY_AGE_BUCKET_DAYS,
  DEFAULT_CURRENCY,
  IN_TRANSIT_EXPECTED_DATE_ORDER,
  SHIPMENT_ACTIVE_STATUSES,
  ShipmentStatusSchema,
} from "@app/shared";

import type { DeliveryDateBounds } from "../domain/delivery-ui-status.js";

import { assertNever } from "../../../core/assert-never.js";
import { ilikeContains } from "../../../core/database/like-pattern.js";
import { addDaysToIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { orderStateSql } from "./order-state-sql.js";

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

const AWAITING_ARRIVAL_SHIPMENT_STATUSES = [
  SHIPMENT_STATUS.ordered,
  SHIPMENT_STATUS.in_transit,
] as const;

const AWAITING_ARRIVAL_SQL = Prisma.sql`shipment.status = ANY(${[
  ...AWAITING_ARRIVAL_SHIPMENT_STATUSES,
]}::text[])`;

export const ORDER_PLACED_ON_SQL = Prisma.sql`
  COALESCE(book_order.order_date, (book_order.created_at AT TIME ZONE 'UTC')::date)
`;

const DISPATCHED_SHIPMENT_STATUSES = [
  SHIPMENT_STATUS.in_transit,
  SHIPMENT_STATUS.ready_for_pickup,
  SHIPMENT_STATUS.received,
] as const;

const ORDER_HAS_UNCANCELLED_SHIPMENT_SQL = Prisma.sql`
  EXISTS (
    SELECT 1
    FROM shipments uncancelled_shipment
    WHERE uncancelled_shipment.order_id = book_order.id
      AND uncancelled_shipment.status <> ${SHIPMENT_STATUS.cancelled}
  )
`;

const ORDER_HAS_DISPATCHED_SHIPMENT_SQL = Prisma.sql`
  EXISTS (
    SELECT 1
    FROM shipments dispatched_shipment
    WHERE dispatched_shipment.order_id = book_order.id
      AND dispatched_shipment.status = ANY(${[...DISPATCHED_SHIPMENT_STATUSES]}::text[])
  )
`;

export const ACTIVE_ITEM_SQL = Prisma.sql`
  book.deleted_at IS NULL
  AND item.cancelled_at IS NULL
  AND item.received_at IS NULL
`;

export const IN_TRANSIT_ITEM_SOURCE = Prisma.sql`
  FROM book_order_items item
  JOIN book_orders book_order ON book_order.id = item.order_id
  JOIN books book ON book.id = item.book_id
  LEFT JOIN shipments shipment ON shipment.id = item.shipment_id
`;

const ORDER_LIVE_ITEMS_SQL = Prisma.sql`
  FROM book_order_items order_item
  JOIN books order_book ON order_book.id = order_item.book_id
  WHERE order_item.order_id = book_order.id
    AND order_book.deleted_at IS NULL
`;

const ORDER_ACTIVE_ITEMS_COUNT_SQL = Prisma.sql`(
  SELECT count(*)
  ${ORDER_LIVE_ITEMS_SQL}
    AND order_item.cancelled_at IS NULL
    AND order_item.received_at IS NULL
)`;

const ORDER_UNCANCELLED_SHIPMENTS_COUNT_SQL = Prisma.sql`(
  SELECT count(*)
  FROM shipments structure_shipment
  WHERE structure_shipment.order_id = book_order.id
    AND structure_shipment.status <> ${SHIPMENT_STATUS.cancelled}
)`;

export const ORDER_EFFECTIVE_TOTAL_SQL = Prisma.sql`(CASE
  WHEN book_order.is_free THEN 0
  ELSE COALESCE(
    (
      SELECT sum(order_item.price)
        + COALESCE(book_order.delivery_price, 0)
        - COALESCE(book_order.discount, 0)
      ${ORDER_LIVE_ITEMS_SQL}
      HAVING count(*) > 0 AND count(*) FILTER (WHERE order_item.price IS NULL) = 0
    ),
    book_order.total_amount
  )
END)`;

const DELIVERY_STRUCTURE_SQL: Record<InTransitDeliveryStructure, Prisma.Sql> = {
  multiple_shipments: Prisma.sql`${ORDER_UNCANCELLED_SHIPMENTS_COUNT_SQL} > 1`,
  no_shipment: Prisma.sql`${ORDER_UNCANCELLED_SHIPMENTS_COUNT_SQL} = 0`,
  single_shipment: Prisma.sql`${ORDER_UNCANCELLED_SHIPMENTS_COUNT_SQL} = 1`,
};

export type InTransitAdvancedFilter = {
  booksMax: number | undefined;
  booksMin: number | undefined;
  currency: Currency[] | undefined;
  expectedFrom: string | undefined;
  expectedTo: string | undefined;
  orderedFrom: string | undefined;
  orderedTo: string | undefined;
  orderId: string | undefined;
  orderState: BookOrderDerivedStatus | undefined;
  priceCurrency: Currency | undefined;
  priceMax: number | undefined;
  priceMin: number | undefined;
  service: string[] | undefined;
  store: string[] | undefined;
  structure: InTransitDeliveryStructure[] | undefined;
};

export type InTransitCategorySql = OrderScopedCategorySql & ShipmentScopedCategorySql;

export type InTransitFilterInput = InTransitAdvancedFilter & {
  ageBucket: ActiveMoneyAgeBucket | undefined;
  bounds: DeliveryDateBounds;
  filter: InTransitFilter;
  search: string | undefined;
  userId: string;
};

export type IsoDateBounds = {
  dispatchCutoffIso: string;
  pickupDeadlineIso: string;
  soonEndIso: string;
  todayIso: string;
  weekEndIso: string;
};

export type ShipmentScopedCategorySql = {
  arrivingSoon: Prisma.Sql;
  delayed: Prisma.Sql;
  hasTrackingNumber: Prisma.Sql;
  hasTrackingUrl: Prisma.Sql;
  inTransit: Prisma.Sql;
  ordered: Prisma.Sql;
  pickupExpiring: Prisma.Sql;
  readyForPickup: Prisma.Sql;
  thisWeek: Prisma.Sql;
  withoutExpectedDate: Prisma.Sql;
  withoutTrackingNumber: Prisma.Sql;
  withoutTrackingUrl: Prisma.Sql;
};

type ExpectedDateSort = keyof typeof IN_TRANSIT_EXPECTED_DATE_ORDER;

type OrderScopedCategorySql = {
  awaitingDispatch: Prisma.Sql;
  hasPrice: Prisma.Sql;
  unassigned: Prisma.Sql;
  withoutPrice: Prisma.Sql;
};

const IN_TRANSIT_ORDER_SQL: Record<Exclude<InTransitSort, ExpectedDateSort>, Prisma.Sql> = {
  author: Prisma.sql`book.first_author_name ASC`,
  newest_orders: Prisma.sql`book_order.order_date DESC NULLS LAST`,
  oldest_orders: Prisma.sql`book_order.order_date ASC NULLS LAST`,
  price: Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} ASC NULLS LAST, book_order.id ASC`,
  service: Prisma.sql`shipment.delivery_service_name ASC NULLS LAST`,
  store: Prisma.sql`book_order.store_name ASC`,
  title: Prisma.sql`book.title ASC`,
};

const EXPECTED_DATE_ORDER_SQL: Record<ExpectedDateSort, (todayIso: string) => Prisma.Sql> = {
  closest_delivery: (todayIso) => Prisma.sql`
    CASE
      WHEN shipment.expected_delivery_date IS NULL THEN 2
      WHEN shipment.expected_delivery_date >= ${todayIso}::date THEN 0
      ELSE 1
    END ASC,
    CASE
      WHEN shipment.expected_delivery_date >= ${todayIso}::date THEN shipment.expected_delivery_date
    END ASC NULLS LAST,
    shipment.expected_delivery_date DESC NULLS LAST
  `,
  delayed_first: () => Prisma.sql`shipment.expected_delivery_date ASC NULLS LAST`,
};

const IN_TRANSIT_SEARCH_COLUMNS: Prisma.Sql[] = [
  Prisma.sql`book.title`,
  Prisma.sql`book.original_title`,
  Prisma.sql`book.first_author_name`,
  Prisma.sql`book_order.store_name`,
  Prisma.sql`book_order.order_number`,
  Prisma.sql`book_order.note`,
  Prisma.sql`shipment.tracking_number`,
  Prisma.sql`shipment.delivery_service_name`,
  Prisma.sql`shipment.note`,
];

type AgeBucketOrderDateBounds = {
  newestOrderDateIso: string;
  oldestOrderDateIso: Nullable<string>;
};

type DatedActiveMoneyAgeBucket = keyof typeof ACTIVE_MONEY_AGE_BUCKET_DAYS;

export function buildInTransitConditions({
  ageBucket,
  bounds,
  filter,
  search,
  userId,
  ...advanced
}: InTransitFilterInput): Prisma.Sql {
  const isoBounds = toIsoBounds(bounds);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`book_order.user_id = ${userId}::uuid`,
    ACTIVE_ITEM_SQL,
    ...advancedInTransitConditions(advanced),
  ];

  if (ageBucket !== undefined) {
    conditions.push(ageBucketSql({ ageBucket, todayIso: isoBounds.todayIso }));
  }

  const filterCondition = inTransitFilterSql({
    categories: inTransitCategorySql(isoBounds),
    filter,
  });
  if (filterCondition !== null) {
    conditions.push(filterCondition);
  }

  if (search !== undefined) {
    conditions.push(searchSql(search));
  }

  return Prisma.join(conditions, " AND ");
}

export function currencySql(currency: Currency): Prisma.Sql {
  if (currency !== DEFAULT_CURRENCY) {
    return Prisma.sql`book_order.currency = ${currency}`;
  }
  return Prisma.sql`(
    book_order.currency = ${currency}
    OR (book_order.currency IS NULL AND item.price IS NOT NULL)
  )`;
}

export function inTransitCategorySql(bounds: IsoDateBounds): InTransitCategorySql {
  return { ...orderScopedCategorySql(bounds), ...shipmentScopedCategorySql(bounds) };
}

export function inTransitOrderSql({
  sort,
  todayIso,
}: {
  sort: InTransitSort;
  todayIso: string;
}): Prisma.Sql {
  const order = isExpectedDateSort(sort)
    ? EXPECTED_DATE_ORDER_SQL[sort](todayIso)
    : plainInTransitOrderSql(sort);
  return Prisma.sql`${order}, item.id ASC`;
}

export function ordersWithActiveItemsSource({
  extraConditions,
  userId,
}: {
  extraConditions: Prisma.Sql[];
  userId: string;
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`book_order.user_id = ${userId}::uuid`,
    Prisma.sql`EXISTS (
      SELECT 1
      FROM book_order_items item
      JOIN books book ON book.id = item.book_id
      WHERE item.order_id = book_order.id AND ${ACTIVE_ITEM_SQL}
    )`,
    ...extraConditions,
  ];

  return Prisma.sql`
    FROM book_orders book_order
    WHERE ${Prisma.join(conditions, " AND ")}
  `;
}

export function shipmentScopedCategorySql({
  pickupDeadlineIso,
  soonEndIso,
  todayIso,
  weekEndIso,
}: IsoDateBounds): ShipmentScopedCategorySql {
  return {
    arrivingSoon: Prisma.sql`shipment.expected_delivery_date BETWEEN ${todayIso}::date AND ${soonEndIso}::date`,
    delayed: Prisma.sql`(
      ${AWAITING_ARRIVAL_SQL}
      AND shipment.expected_delivery_date < ${todayIso}::date
    )`,
    hasTrackingNumber: Prisma.sql`shipment.tracking_number IS NOT NULL`,
    hasTrackingUrl: Prisma.sql`shipment.tracking_url IS NOT NULL`,
    inTransit: Prisma.sql`shipment.status = ${SHIPMENT_STATUS.in_transit}`,
    ordered: Prisma.sql`COALESCE(shipment.status, ${SHIPMENT_STATUS.ordered}) = ${SHIPMENT_STATUS.ordered}`,
    pickupExpiring: Prisma.sql`(
      shipment.status = ${SHIPMENT_STATUS.ready_for_pickup}
      AND shipment.pickup_until IS NOT NULL
      AND shipment.pickup_until <= ${pickupDeadlineIso}::date
    )`,
    readyForPickup: Prisma.sql`shipment.status = ${SHIPMENT_STATUS.ready_for_pickup}`,
    thisWeek: Prisma.sql`(
      shipment.expected_delivery_date BETWEEN ${todayIso}::date AND ${weekEndIso}::date
      AND ${AWAITING_ARRIVAL_SQL}
    )`,
    withoutExpectedDate: Prisma.sql`(
      ${AWAITING_ARRIVAL_SQL}
      AND shipment.expected_delivery_date IS NULL
    )`,
    withoutTrackingNumber: Prisma.sql`(
      shipment.status = ${SHIPMENT_STATUS.in_transit}
      AND shipment.tracking_number IS NULL
    )`,
    withoutTrackingUrl: Prisma.sql`shipment.tracking_url IS NULL`,
  };
}

export function toIsoBounds({
  dispatchCutoff,
  pickupDeadline,
  soonEnd,
  today,
  weekEnd,
}: DeliveryDateBounds): IsoDateBounds {
  return {
    dispatchCutoffIso: toIsoDate(dispatchCutoff),
    pickupDeadlineIso: toIsoDate(pickupDeadline),
    soonEndIso: toIsoDate(soonEnd),
    todayIso: toIsoDate(today),
    weekEndIso: toIsoDate(weekEnd),
  };
}

function advancedInTransitConditions({
  booksMax,
  booksMin,
  currency,
  expectedFrom,
  expectedTo,
  orderedFrom,
  orderedTo,
  orderId,
  orderState,
  priceCurrency,
  priceMax,
  priceMin,
  service,
  store,
  structure,
}: InTransitAdvancedFilter): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (orderId !== undefined) {
    conditions.push(Prisma.sql`book_order.id = ${orderId}::uuid`);
  }

  if (orderState !== undefined) {
    conditions.push(orderStateSql(orderState));
  }

  if (store !== undefined) {
    conditions.push(Prisma.sql`lower(book_order.store_name) = ANY(${lowered(store)}::text[])`);
  }

  if (currency !== undefined) {
    conditions.push(anyOf(currency.map(currencySql)));
  }

  if (service !== undefined) {
    conditions.push(orderHasActiveShipmentWithServiceSql(service));
  }

  if (orderedFrom !== undefined) {
    conditions.push(Prisma.sql`${ORDER_PLACED_ON_SQL} >= ${orderedFrom}::date`);
  }

  if (orderedTo !== undefined) {
    conditions.push(Prisma.sql`${ORDER_PLACED_ON_SQL} <= ${orderedTo}::date`);
  }

  if (booksMin !== undefined) {
    conditions.push(Prisma.sql`${ORDER_ACTIVE_ITEMS_COUNT_SQL} >= ${booksMin}::int`);
  }

  if (booksMax !== undefined) {
    conditions.push(Prisma.sql`${ORDER_ACTIVE_ITEMS_COUNT_SQL} <= ${booksMax}::int`);
  }

  if (expectedFrom !== undefined || expectedTo !== undefined) {
    conditions.push(orderHasAwaitedShipmentInRangeSql({ from: expectedFrom, to: expectedTo }));
  }

  if (structure !== undefined) {
    conditions.push(anyOf(structure.map((option) => DELIVERY_STRUCTURE_SQL[option])));
  }

  if (priceCurrency !== undefined) {
    conditions.push(currencySql(priceCurrency));

    if (priceMin !== undefined) {
      conditions.push(Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} >= ${priceMin}`);
    }

    if (priceMax !== undefined) {
      conditions.push(Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} <= ${priceMax}`);
    }
  }

  return conditions;
}

function ageBucketOrderDateBounds({
  ageBucket,
  todayIso,
}: {
  ageBucket: DatedActiveMoneyAgeBucket;
  todayIso: string;
}): AgeBucketOrderDateBounds {
  const { maxDays, minDays } = ACTIVE_MONEY_AGE_BUCKET_DAYS[ageBucket];

  return {
    newestOrderDateIso: isoDateDaysAgo({ days: minDays, todayIso }),
    oldestOrderDateIso: maxDays === null ? null : isoDateDaysAgo({ days: maxDays, todayIso }),
  };
}

function ageBucketSql({
  ageBucket,
  todayIso,
}: {
  ageBucket: ActiveMoneyAgeBucket;
  todayIso: string;
}): Prisma.Sql {
  if (!isDatedAgeBucket(ageBucket)) {
    return Prisma.sql`book_order.order_date IS NULL`;
  }

  const { newestOrderDateIso, oldestOrderDateIso } = ageBucketOrderDateBounds({
    ageBucket,
    todayIso,
  });

  if (oldestOrderDateIso === null) {
    return Prisma.sql`book_order.order_date <= ${newestOrderDateIso}::date`;
  }

  return Prisma.sql`book_order.order_date BETWEEN ${oldestOrderDateIso}::date AND ${newestOrderDateIso}::date`;
}

function anyOf(options: Prisma.Sql[]): Prisma.Sql {
  if (options.length === 0) {
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`(${Prisma.join(options, " OR ")})`;
}

function inTransitFilterSql({
  categories,
  filter,
}: {
  categories: InTransitCategorySql;
  filter: InTransitFilter;
}): Nullable<Prisma.Sql> {
  switch (filter) {
    case "all":
      return null;
    case "arriving_soon":
      return categories.arrivingSoon;
    case "awaiting_dispatch":
      return categories.awaitingDispatch;
    case "delayed":
      return categories.delayed;
    case "has_price":
      return categories.hasPrice;
    case "has_tracking_number":
      return categories.hasTrackingNumber;
    case "has_tracking_url":
      return categories.hasTrackingUrl;
    case "in_transit":
      return categories.inTransit;
    case "no_delivery_date":
      return categories.withoutExpectedDate;
    case "ordered":
      return categories.ordered;
    case "pickup_expiring":
      return categories.pickupExpiring;
    case "ready_for_pickup":
      return categories.readyForPickup;
    case "this_week":
      return categories.thisWeek;
    case "unassigned":
      return categories.unassigned;
    case "without_price":
      return categories.withoutPrice;
    case "without_tracking_number":
      return categories.withoutTrackingNumber;
    case "without_tracking_url":
      return categories.withoutTrackingUrl;
    default:
      return assertNever(filter);
  }
}

function isDatedAgeBucket(bucket: ActiveMoneyAgeBucket): bucket is DatedActiveMoneyAgeBucket {
  return bucket in ACTIVE_MONEY_AGE_BUCKET_DAYS;
}

function isExpectedDateSort(sort: InTransitSort): sort is ExpectedDateSort {
  return Object.hasOwn(IN_TRANSIT_EXPECTED_DATE_ORDER, sort);
}

function isoDateDaysAgo({ days, todayIso }: { days: number; todayIso: string }): string {
  return addDaysToIsoDate(todayIso, -days);
}

function lowered(values: string[]): string[] {
  return values.map((value) => value.toLowerCase());
}

function orderHasActiveShipmentWithServiceSql(services: string[]): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM shipments service_shipment
    WHERE service_shipment.order_id = book_order.id
      AND service_shipment.status = ANY(${[...SHIPMENT_ACTIVE_STATUSES]}::text[])
      AND lower(service_shipment.delivery_service_name) = ANY(${lowered(services)}::text[])
  )`;
}

function orderHasAwaitedShipmentInRangeSql({
  from,
  to,
}: {
  from: string | undefined;
  to: string | undefined;
}): Prisma.Sql {
  const bounds: Prisma.Sql[] = [];
  if (from !== undefined) {
    bounds.push(Prisma.sql`AND expected_shipment.expected_delivery_date >= ${from}::date`);
  }
  if (to !== undefined) {
    bounds.push(Prisma.sql`AND expected_shipment.expected_delivery_date <= ${to}::date`);
  }

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM shipments expected_shipment
    WHERE expected_shipment.order_id = book_order.id
      AND expected_shipment.status = ANY(${[...AWAITING_ARRIVAL_SHIPMENT_STATUSES]}::text[])
      AND expected_shipment.expected_delivery_date IS NOT NULL
      ${Prisma.join(bounds, " ")}
  )`;
}

function orderScopedCategorySql({ dispatchCutoffIso }: IsoDateBounds): OrderScopedCategorySql {
  return {
    awaitingDispatch: Prisma.sql`(
      ${ORDER_PLACED_ON_SQL} <= ${dispatchCutoffIso}::date
      AND NOT ${ORDER_HAS_DISPATCHED_SHIPMENT_SQL}
    )`,
    hasPrice: Prisma.sql`item.price IS NOT NULL`,
    unassigned: Prisma.sql`(item.shipment_id IS NULL AND ${ORDER_HAS_UNCANCELLED_SHIPMENT_SQL})`,
    withoutPrice: Prisma.sql`item.price IS NULL`,
  };
}

function plainInTransitOrderSql(sort: Exclude<InTransitSort, ExpectedDateSort>): Prisma.Sql {
  if (!Object.hasOwn(IN_TRANSIT_ORDER_SQL, sort)) {
    throw new Error(`Unsupported in-transit sort: ${String(sort)}`);
  }
  return IN_TRANSIT_ORDER_SQL[sort];
}

function searchSql(search: string): Prisma.Sql {
  const matches = IN_TRANSIT_SEARCH_COLUMNS.map((column) => ilikeContains({ column, search }));
  return Prisma.sql`(${Prisma.join(matches, " OR ")})`;
}

import type { BookOrderDerivedStatus } from "@app/shared";

import { BookOrderDerivedStatusSchema, ShipmentStatusSchema } from "@app/shared";

import { Prisma } from "../../../generated/prisma/client.js";

const DERIVED_STATUS = BookOrderDerivedStatusSchema.enum;
const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

const DISPATCHED_SHIPMENT_STATUSES = [
  SHIPMENT_STATUS.in_transit,
  SHIPMENT_STATUS.ready_for_pickup,
  SHIPMENT_STATUS.received,
] as const;

const LIVE_ITEMS_SOURCE = Prisma.sql`
  FROM book_order_items state_item
  JOIN books state_book ON state_book.id = state_item.book_id
  WHERE state_item.order_id = book_order.id
    AND state_book.deleted_at IS NULL
`;

const ITEMS_COUNT = Prisma.sql`(SELECT count(*) ${LIVE_ITEMS_SOURCE})`;

const UNCANCELLED_ITEMS_COUNT = Prisma.sql`(
  SELECT count(*) ${LIVE_ITEMS_SOURCE} AND state_item.cancelled_at IS NULL
)`;

const RECEIVED_ITEMS_COUNT = Prisma.sql`(
  SELECT count(*) ${LIVE_ITEMS_SOURCE}
    AND state_item.cancelled_at IS NULL
    AND state_item.received_at IS NOT NULL
)`;

const DISPATCHED_ITEMS_COUNT = Prisma.sql`(
  SELECT count(*) ${LIVE_ITEMS_SOURCE}
    AND state_item.cancelled_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM shipments state_shipment
      WHERE state_shipment.id = state_item.shipment_id
        AND state_shipment.status = ANY(${[...DISPATCHED_SHIPMENT_STATUSES]}::text[])
    )
)`;

export const ORDER_STATE_SQL = Prisma.sql`(CASE
  WHEN ${ITEMS_COUNT} = 0 THEN ${DERIVED_STATUS.active}
  WHEN ${UNCANCELLED_ITEMS_COUNT} = 0 THEN ${DERIVED_STATUS.cancelled}
  WHEN ${RECEIVED_ITEMS_COUNT} = ${UNCANCELLED_ITEMS_COUNT} THEN ${DERIVED_STATUS.received}
  WHEN ${RECEIVED_ITEMS_COUNT} > 0 THEN ${DERIVED_STATUS.partially_received}
  WHEN ${DISPATCHED_ITEMS_COUNT} = ${UNCANCELLED_ITEMS_COUNT} THEN ${DERIVED_STATUS.shipped}
  WHEN ${DISPATCHED_ITEMS_COUNT} > 0 THEN ${DERIVED_STATUS.partially_shipped}
  ELSE ${DERIVED_STATUS.active}
END)`;

export function orderStateSql(state: BookOrderDerivedStatus): Prisma.Sql {
  return Prisma.sql`${ORDER_STATE_SQL} = ${state}`;
}

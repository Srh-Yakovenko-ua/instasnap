import type { BookOrderDerivedStatus, Currency } from "@app/shared";

import { DEFAULT_CURRENCY } from "@app/shared";

import { Prisma } from "../../../generated/prisma/client.js";
import { orderStateSql } from "./order-state-sql.js";

export type ActiveStatisticsScope = {
  currency: Currency | undefined;
  orderState: BookOrderDerivedStatus | undefined;
  store: string | undefined;
  userId: string;
};

export type StatisticsScope = ActiveStatisticsScope & {
  from: string | undefined;
  to: string | undefined;
};

const LIVE_ITEM_SOURCE = Prisma.sql`
  FROM book_order_items scope_item
  JOIN books scope_book ON scope_book.id = scope_item.book_id
  WHERE scope_item.order_id = book_order.id
    AND scope_book.deleted_at IS NULL
`;

const CARRIES_LIVE_BOOK = Prisma.sql`EXISTS (SELECT 1 ${LIVE_ITEM_SOURCE})`;

const CARRIES_ACTIVE_BOOK = Prisma.sql`EXISTS (
  SELECT 1 ${LIVE_ITEM_SOURCE}
    AND scope_item.cancelled_at IS NULL
    AND scope_item.received_at IS NULL
)`;

export function activeStatisticsScopeSql(scope: ActiveStatisticsScope): Prisma.Sql {
  return Prisma.join([CARRIES_ACTIVE_BOOK, ...sharedConditions(scope)], " AND ");
}

export function statisticsScopeSql({ from, to, ...scope }: StatisticsScope): Prisma.Sql {
  const conditions: Prisma.Sql[] = [CARRIES_LIVE_BOOK, ...sharedConditions(scope)];

  if (from !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date >= ${from}::date`);
  }

  if (to !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date <= ${to}::date`);
  }

  return Prisma.join(conditions, " AND ");
}

function scopeCurrencySql(currency: Currency): Prisma.Sql {
  if (currency !== DEFAULT_CURRENCY) {
    return Prisma.sql`book_order.currency = ${currency}`;
  }

  return Prisma.sql`(
    book_order.currency = ${currency}
    OR (book_order.currency IS NULL AND book_order.is_free)
    OR (book_order.currency IS NULL AND book_order.total_amount IS NOT NULL)
  )`;
}

function sharedConditions({
  currency,
  orderState,
  store,
  userId,
}: ActiveStatisticsScope): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`book_order.user_id = ${userId}::uuid`];

  if (store !== undefined) {
    conditions.push(Prisma.sql`lower(book_order.store_name) = lower(${store})`);
  }

  if (currency !== undefined) {
    conditions.push(scopeCurrencySql(currency));
  }

  if (orderState !== undefined) {
    conditions.push(orderStateSql(orderState));
  }

  return conditions;
}

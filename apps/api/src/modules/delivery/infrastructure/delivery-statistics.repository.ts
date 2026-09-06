import type { BookOrderDerivedStatus, Currency } from "@app/shared";

import { CurrencySchema, ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { OrderStatisticsRecordsPage } from "../domain/order-statistics-page.js";
import type { OrderStatisticsRecord } from "../domain/statistics-scope.js";
import type { ActiveStatisticsScope, StatisticsScope } from "./statistics-scope-sql.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { capOrderStatisticsIds, ORDER_STATISTICS_FETCH } from "../domain/order-statistics-page.js";
import { activeStatisticsScopeSql, statisticsScopeSql } from "./statistics-scope-sql.js";

const log = createLogger("delivery-statistics.repository");

const SHIPMENT_WITH_LIVE_BOOKS = {
  items: { some: { book: SOFT_DELETE_SCOPE.active } },
} satisfies Prisma.ShipmentWhereInput;

const orderStatisticsSelect = {
  select: {
    currency: true,
    deliveryPrice: true,
    discount: true,
    id: true,
    isFree: true,
    items: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        book: { select: { title: true } },
        bookId: true,
        cancelledAt: true,
        id: true,
        price: true,
        receivedAt: true,
        shipmentId: true,
      },
      where: { book: SOFT_DELETE_SCOPE.active },
    },
    orderDate: true,
    orderNumber: true,
    shipments: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { cancelledAt: true, id: true, receivedAt: true, status: true },
      where: SHIPMENT_WITH_LIVE_BOOKS,
    },
    storeName: true,
    totalAmount: true,
  },
} satisfies Prisma.BookOrderDefaultArgs;

export type ActiveOrderFilterInput = {
  currency: Currency | undefined;
  orderState: BookOrderDerivedStatus | undefined;
  store: string | undefined;
  userId: string;
};

export type BookOrderStatisticsFilterInput = ActiveOrderFilterInput & {
  from: string | undefined;
  to: string | undefined;
};

type OrderIdRow = { id: string };

type OrderStatisticsRow = Prisma.BookOrderGetPayload<typeof orderStatisticsSelect>;

@Injectable()
export class DeliveryStatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveOrderRecords(
    filter: ActiveOrderFilterInput,
  ): Promise<OrderStatisticsRecordsPage> {
    return this.loadScopedRecords({
      conditions: activeStatisticsScopeSql(toActiveScope(filter)),
      source: "active orders",
      userId: filter.userId,
    });
  }

  async listOrderRecords(
    filter: BookOrderStatisticsFilterInput,
  ): Promise<OrderStatisticsRecordsPage> {
    return this.loadScopedRecords({
      conditions: statisticsScopeSql(toScope(filter)),
      source: "period orders",
      userId: filter.userId,
    });
  }

  private async loadScopedRecords({
    conditions,
    source,
    userId,
  }: {
    conditions: Prisma.Sql;
    source: string;
    userId: string;
  }): Promise<OrderStatisticsRecordsPage> {
    const fetched = await this.prisma.$queryRaw<OrderIdRow[]>`
      SELECT book_order.id
      FROM book_orders book_order
      WHERE ${conditions}
      ORDER BY book_order.id ASC
      LIMIT ${ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows}
    `;
    const { ids, ...quality } = capOrderStatisticsIds(fetched.map((row) => row.id));

    if (quality.isTruncated) {
      log.warn(
        { cap: quality.maxOrders, source, userId },
        "book order statistics truncated at the safety cap",
      );
    }

    const rows = await this.prisma.bookOrder.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: ids } },
      ...orderStatisticsSelect,
    });

    return { ...quality, records: rows.map(toOrderStatisticsRecord) };
  }
}

function toActiveScope({
  currency,
  orderState,
  store,
  userId,
}: ActiveOrderFilterInput): ActiveStatisticsScope {
  return { currency, orderState, store, userId };
}

function toOrderStatisticsRecord(row: OrderStatisticsRow): OrderStatisticsRecord {
  return {
    currency: row.currency === null ? null : CurrencySchema.parse(row.currency),
    deliveryPrice: row.deliveryPrice === null ? null : row.deliveryPrice.toNumber(),
    discount: row.discount === null ? null : row.discount.toNumber(),
    id: row.id,
    isFree: row.isFree,
    items: row.items.map((item) => ({
      bookId: item.bookId,
      bookTitle: item.book.title,
      cancelledAt: item.cancelledAt,
      id: item.id,
      price: item.price === null ? null : item.price.toNumber(),
      receivedAt: item.receivedAt,
      shipmentId: item.shipmentId,
    })),
    orderDate: row.orderDate,
    orderNumber: row.orderNumber,
    shipments: row.shipments.map((shipment) => ({
      cancelledAt: shipment.cancelledAt,
      id: shipment.id,
      receivedAt: shipment.receivedAt,
      status: ShipmentStatusSchema.parse(shipment.status),
    })),
    storeName: row.storeName,
    totalAmount: row.totalAmount === null ? null : row.totalAmount.toNumber(),
  };
}

function toScope({ from, to, ...rest }: BookOrderStatisticsFilterInput): StatisticsScope {
  return { ...toActiveScope(rest), from, to };
}

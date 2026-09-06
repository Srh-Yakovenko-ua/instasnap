import type { BookOrderDerivedStatus } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { computeBookOrderDerivedStatus } from "../domain/order-derived-status.js";
import { ORDER_STATE_SQL, orderStateSql } from "./order-state-sql.js";

type ItemPlan = {
  cancelled?: boolean;
  dispatched?: boolean;
  received?: boolean;
};

type OrderPlan = {
  items: ItemPlan[];
  name: string;
};

const AT = new Date("2026-03-10T00:00:00.000Z");

const ORDER_PLANS: OrderPlan[] = [
  { items: [], name: "no books at all" },
  { items: [{}], name: "waiting to be dispatched" },
  { items: [{ dispatched: true }, {}], name: "partly dispatched" },
  { items: [{ dispatched: true }, { dispatched: true }], name: "fully dispatched" },
  { items: [{ dispatched: true, received: true }, { dispatched: true }], name: "partly received" },
  {
    items: [
      { dispatched: true, received: true },
      { dispatched: true, received: true },
    ],
    name: "fully received",
  },
  { items: [{ cancelled: true }, { cancelled: true }], name: "fully cancelled" },
  { items: [{ cancelled: true }, { received: true }], name: "cancelled except one received" },
  { items: [{ cancelled: true }, {}], name: "cancelled except one waiting" },
];

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  context.reset();
  reader = await context.registerVerifyAndLogin();
  await seedOrders();
});

afterEach(() => {
  context.reset();
});

afterAll(async () => {
  await truncateAllTables(app);
  await context.close();
});

async function derivedStatesInJs(): Promise<Map<string, BookOrderDerivedStatus>> {
  const orders = await prisma.bookOrder.findMany({
    select: {
      id: true,
      items: { select: { cancelledAt: true, receivedAt: true, shipmentId: true } },
      shipments: { select: { id: true, status: true } },
    },
    where: { userId: reader.userId },
  });

  return new Map(
    orders.map((order) => [
      order.id,
      computeBookOrderDerivedStatus({
        items: order.items,
        shipments: order.shipments.map((shipment) => ({
          id: shipment.id,
          status: shipment.status === "in_transit" ? "in_transit" : "ordered",
        })),
      }),
    ]),
  );
}

async function derivedStatesInSql(): Promise<Map<string, BookOrderDerivedStatus>> {
  const rows = await prisma.$queryRaw<{ id: string; state: BookOrderDerivedStatus }[]>`
    SELECT book_order.id, ${ORDER_STATE_SQL} AS state
    FROM book_orders book_order
    WHERE book_order.user_id = ${reader.userId}::uuid
  `;

  return new Map(rows.map((row) => [row.id, row.state]));
}

async function seedOrders(): Promise<void> {
  for (const plan of ORDER_PLANS) {
    const order = await prisma.bookOrder.create({
      data: { orderDate: AT, storeName: plan.name, userId: reader.userId },
    });
    const needsShipment = plan.items.some((item) => item.dispatched === true);
    const shipment = needsShipment
      ? await prisma.shipment.create({ data: { orderId: order.id, status: "in_transit" } })
      : null;

    for (const [index, item] of plan.items.entries()) {
      const book = await prisma.book.create({
        data: { title: `${plan.name} ${index}`, userId: reader.userId },
      });
      await prisma.bookOrderItem.create({
        data: {
          bookId: book.id,
          cancelledAt: item.cancelled === true ? AT : null,
          orderId: order.id,
          receivedAt: item.received === true ? AT : null,
          shipmentId: item.dispatched === true ? (shipment?.id ?? null) : null,
        },
      });
    }
  }
}

describe("ORDER_STATE_SQL", () => {
  it("classifies every stored order exactly as the domain function does", async () => {
    const [inSql, inJs] = await Promise.all([derivedStatesInSql(), derivedStatesInJs()]);

    expect(Object.fromEntries(inSql)).toEqual(Object.fromEntries(inJs));
  });

  it("covers every derived state the plans were written for", async () => {
    const states = new Set((await derivedStatesInSql()).values());

    expect([...states].sort()).toEqual([
      "active",
      "cancelled",
      "partially_received",
      "partially_shipped",
      "received",
      "shipped",
    ]);
  });
});

describe("orderStateSql", () => {
  it("keeps only the orders sitting in the asked-for state", async () => {
    const rows = await prisma.$queryRaw<{ store_name: string }[]>`
      SELECT book_order.store_name
      FROM book_orders book_order
      WHERE book_order.user_id = ${reader.userId}::uuid
        AND ${orderStateSql("received")}
    `;

    expect(rows.map((row) => row.store_name).sort()).toEqual([
      "cancelled except one received",
      "fully received",
    ]);
  });
});

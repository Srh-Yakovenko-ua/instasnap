import type { OrderHistoryGroupView, PaginatedOrderHistoryGroups } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { PaginatedOrderHistoryGroupsSchema } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  createBook,
  createBooks,
  createOrder,
  getJson,
  isoDay,
  ORDER_ROUTES,
  postJson,
  shipmentOf,
} from "./book-order.fixtures.js";

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function booksOf(group: OrderHistoryGroupView | undefined): string[] {
  return (group?.shipments ?? [])
    .flatMap((shipmentGroup) => shipmentGroup.books.map((entry) => entry.book.title))
    .sort();
}

async function history(query: string): Promise<PaginatedOrderHistoryGroups> {
  const res = await requestHistory(query);
  expect(res.status).toBe(200);
  return PaginatedOrderHistoryGroupsSchema.parse(res.body);
}

function idAt(ids: string[], index: number): string {
  const id = ids[index];
  if (id === undefined) throw new Error(`no seeded id at index ${index}`);
  return id;
}

function requestHistory(query: string) {
  return getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.history}?${query}`,
  });
}

async function seedSplitOrder() {
  const accessToken = reader.accessToken;
  const bookIds = await createBooks({
    accessToken,
    app,
    titles: ["Dune", "Messiah", "Children", "Emperor"],
  });
  const first = idAt(bookIds, 0);
  const second = idAt(bookIds, 1);
  const third = idAt(bookIds, 2);
  const fourth = idAt(bookIds, 3);

  const order = await createOrder({
    accessToken,
    app,
    input: {
      items: bookIds.map((bookId) => ({ bookId, price: 100 })),
      orderDate: isoDay(-20),
      shipments: [
        {
          bookIds: [first, second],
          deliveryService: "Nova Poshta",
          trackingNumber: "TRK-1",
        },
        { bookIds: [third], deliveryService: "Ukrposhta" },
      ],
      storeName: "Book24",
      totalAmount: 400,
    },
  });

  const firstShipment = shipmentOf({ bookId: first, view: order });
  const secondShipment = shipmentOf({ bookId: third, view: order });

  await postJson({
    accessToken,
    app,
    body: { receivedAt: isoDay(-3) },
    path: ORDER_ROUTES.receiveShipment(firstShipment.id),
  });
  await postJson({
    accessToken,
    app,
    body: { cancelReason: "Out of stock", keepAsWantToBuy: true },
    path: ORDER_ROUTES.cancelShipment(secondShipment.id),
  });

  const unshippedItem = order.items.find((item) => item.bookId === fourth);
  if (unshippedItem === undefined) throw new Error("the fourth book has no order item");
  await postJson({
    accessToken,
    app,
    body: { cancelReason: "Found it cheaper", keepAsWantToBuy: true },
    path: ORDER_ROUTES.cancelItem(unshippedItem.id),
  });

  return order;
}

async function seedStaggeredParcel() {
  const accessToken = reader.accessToken;
  const bookIds = await createBooks({
    accessToken,
    app,
    titles: ["Early", "Late", "Latest"],
  });
  const early = idAt(bookIds, 0);

  const order = await createOrder({
    accessToken,
    app,
    input: {
      items: bookIds.map((bookId) => ({ bookId, price: 100 })),
      orderDate: isoDay(-30),
      shipments: [{ bookIds, deliveryService: "Nova Poshta" }],
      storeName: "Yakaboo",
      totalAmount: 300,
    },
  });

  await postJson({
    accessToken,
    app,
    body: { bookIds: [early], receivedAt: isoDay(-10) },
    path: ORDER_ROUTES.receiveBooks,
  });
  await postJson({
    accessToken,
    app,
    body: { receivedAt: isoDay(-2) },
    path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId: early, view: order }).id),
  });

  return order;
}

describe("GET /api/delivery/books/history", () => {
  it("returns an empty page when nothing has finished yet", async () => {
    const page = await history("tab=received");

    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
    expect(page.totalBooksCount).toBe(0);
  });

  it("paginates orders and counts books in their own field", async () => {
    await seedSplitOrder();

    const page = await history("tab=received");

    expect(page.totalCount).toBe(1);
    expect(page.totalBooksCount).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  it("gives the received tab only the received books of the order", async () => {
    await seedSplitOrder();

    const page = await history("tab=received");
    const group = page.items[0];

    expect(booksOf(group)).toEqual(["Dune", "Messiah"]);
    expect(group?.booksCount).toBe(2);
  });

  it("gives the cancelled tab only the cancelled books of the same order", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled");
    const group = page.items[0];

    expect(booksOf(group)).toEqual(["Children", "Emperor"]);
    expect(group?.booksCount).toBe(2);
  });

  it("keeps the canonical order total in the header of both tabs", async () => {
    await seedSplitOrder();

    const [received, cancelled] = await Promise.all([
      history("tab=received"),
      history("tab=cancelled"),
    ]);

    expect(received.items[0]?.order.effectiveTotalAmount).toBe(400);
    expect(cancelled.items[0]?.order.effectiveTotalAmount).toBe(400);
  });

  it("carries the terminal state of each parcel", async () => {
    await seedSplitOrder();

    const received = await history("tab=received");
    const cancelled = await history("tab=cancelled");
    const receivedParcel = received.items[0]?.shipments[0]?.shipment;
    const cancelledParcel = cancelled.items[0]?.shipments.find(
      (group) => group.shipment?.status === "cancelled",
    )?.shipment;

    expect(receivedParcel?.status).toBe("received");
    expect(receivedParcel?.receivedAt).not.toBeNull();
    expect(receivedParcel?.trackingNumber).toBe("TRK-1");
    expect(cancelledParcel?.cancelReason).toBe("Out of stock");
    expect(cancelledParcel?.cancelledAt).not.toBeNull();
  });

  it("keeps a book cancelled before dispatch in a group without a parcel", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled");
    const loose = page.items[0]?.shipments.find((group) => group.shipment === null);

    expect(loose?.books.map((entry) => entry.book.title)).toEqual(["Emperor"]);
    expect(loose?.books[0]?.cancelReason).toBe("Found it cheaper");
  });

  it("narrows the parcels of a card to the delivery service that was filtered on", async () => {
    await seedSplitOrder();

    const page = await history("tab=cancelled&service=Ukrposhta");
    const group = page.items[0];

    expect(group?.shipments).toHaveLength(1);
    expect(group?.shipments[0]?.shipment?.deliveryService?.name).toBe("Ukrposhta");
    expect(group?.booksCount).toBe(1);
    expect(page.totalBooksCount).toBe(1);
  });

  it("lets a search hit on one book still render the whole tab of its order", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&search=Messiah");

    expect(page.totalCount).toBe(1);
    expect(booksOf(page.items[0])).toEqual(["Dune", "Messiah"]);
  });

  it("finds an order by its store name without emptying the card", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&search=Book24");

    expect(page.items[0]?.booksCount).toBe(2);
  });

  it("orders the page by the canonical total once a currency narrows the selection", async () => {
    const accessToken = reader.accessToken;
    const priced = await createBooks({ accessToken, app, titles: ["Cheap", "Pricey"] });
    const plan = [
      { bookId: idAt(priced, 0), price: 50, storeName: "Small" },
      { bookId: idAt(priced, 1), price: 900, storeName: "Big" },
    ];

    for (const { bookId, price, storeName } of plan) {
      const order = await createOrder({
        accessToken,
        app,
        input: {
          items: [{ bookId, price }],
          shipments: [{ bookIds: [bookId] }],
          storeName,
          totalAmount: price,
        },
      });
      await postJson({
        accessToken,
        app,
        body: {},
        path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId, view: order }).id),
      });
    }

    const ascending = await history("tab=received&currency=UAH&sort=price_asc");
    const descending = await history("tab=received&currency=UAH&sort=price_desc");

    expect(ascending.items.map((group) => group.order.storeName)).toEqual(["Small", "Big"]);
    expect(descending.items.map((group) => group.order.storeName)).toEqual(["Big", "Small"]);
  });

  it("falls back to the default sort when a price sort names no currency", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&sort=price_desc");

    expect(page.totalCount).toBe(1);
  });
  it("keeps only the books received inside the range, parcel and all", async () => {
    await seedStaggeredParcel();

    const page = await history(`tab=received&receivedFrom=${isoDay(-12)}&receivedTo=${isoDay(-8)}`);

    expect(booksOf(page.items[0])).toEqual(["Early"]);
    expect(page.totalBooksCount).toBe(1);
  });

  it("drops the order entirely when no book was received inside the range", async () => {
    await seedStaggeredParcel();

    const page = await history(
      `tab=received&receivedFrom=${isoDay(-60)}&receivedTo=${isoDay(-40)}`,
    );

    expect(page.totalCount).toBe(0);
    expect(page.totalBooksCount).toBe(0);
  });

  it("reads the receipt date off the book, not off the parcel that closed later", async () => {
    await seedStaggeredParcel();

    const page = await history(`tab=received&receivedFrom=${isoDay(-3)}`);

    expect(booksOf(page.items[0])).toEqual(["Late", "Latest"]);
  });

  it("narrows the cancelled tab to the books cancelled inside the range", async () => {
    await seedSplitOrder();

    const page = await history(`tab=cancelled&cancelledFrom=${isoDay(-1)}`);

    expect(booksOf(page.items[0])).toEqual(["Children", "Emperor"]);
  });

  it("refuses a receipt range on the cancelled tab", async () => {
    const res = await requestHistory(`tab=cancelled&receivedFrom=${isoDay(-5)}`);

    expect(res.status).toBe(400);
  });

  it("refuses a cancellation range on the received tab", async () => {
    const res = await requestHistory(`tab=received&cancelledTo=${isoDay(-5)}`);

    expect(res.status).toBe(400);
  });

  it("counts the books that survived the content filters, not the whole tab", async () => {
    await seedSplitOrder();

    const wide = await history("tab=received&booksMin=2");
    const narrow = await history("tab=received&booksMin=2&service=Nova%20Poshta");
    const tooNarrow = await history("tab=received&booksMin=3");

    expect(wide.totalCount).toBe(1);
    expect(narrow.totalCount).toBe(1);
    expect(tooNarrow.totalCount).toBe(0);
  });

  it("counts only what the delivery service left in the card", async () => {
    await seedSplitOrder();
    await seedStaggeredParcel();

    const page = await history("tab=received&service=Nova%20Poshta&booksMin=3");

    expect(page.items.map((group) => group.order.storeName)).toEqual(["Yakaboo"]);
  });

  it("takes any of the named stores and any of the named services", async () => {
    await seedSplitOrder();
    await seedStaggeredParcel();

    const page = await history("tab=received&store=Book24&store=Yakaboo");

    expect(page.totalCount).toBe(2);
    expect(page.totalBooksCount).toBe(5);
  });

  it("keeps an order without an explicit order date inside the order-date range", async () => {
    const accessToken = reader.accessToken;
    const bookId = await createBook({ accessToken, app, title: "Undated" });
    const order = await createOrder({
      accessToken,
      app,
      input: {
        items: [{ bookId, price: 20 }],
        shipments: [{ bookIds: [bookId] }],
        storeName: "Undated Store",
        totalAmount: 20,
      },
    });
    await postJson({
      accessToken,
      app,
      body: {},
      path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId, view: order }).id),
    });

    const page = await history(`tab=received&from=${isoDay(-1)}&to=${isoDay(0)}`);

    expect(page.items.map((group) => group.order.storeName)).toEqual(["Undated Store"]);
  });

  it("refuses an order total range that names no currency", async () => {
    const res = await requestHistory("tab=received&priceMin=100");

    expect(res.status).toBe(400);
  });

  it("refuses an order total range while several currencies are selected", async () => {
    const res = await requestHistory(
      "tab=received&currency=UAH&currency=EUR&priceCurrency=UAH&priceMin=100",
    );

    expect(res.status).toBe(400);
  });

  it("filters by the canonical order total once a single currency gates it", async () => {
    await seedSplitOrder();

    const inside = await history("tab=received&currency=UAH&priceCurrency=UAH&priceMin=300");
    const outside = await history("tab=received&currency=UAH&priceCurrency=UAH&priceMin=500");

    expect(inside.totalCount).toBe(1);
    expect(outside.totalCount).toBe(0);
  });

  it("ignores the retired tracking params instead of failing on them", async () => {
    await seedSplitOrder();

    const page = await history("tab=received&hasTrackingNumber=false&hasTrackingUrl=true");

    expect(page.totalCount).toBe(1);
  });
});

describe("history exact order navigation", () => {
  it("opens exactly one order by its identity", async () => {
    const wanted = await seedStaggeredParcel();
    await seedSplitOrder();

    const page = await history(`tab=all&orderId=${wanted.id}`);

    expect(page.items.map((group) => group.order.id)).toEqual([wanted.id]);
  });

  it("returns an empty page for an order that belongs to somebody else", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const bookId = await createBook({ accessToken: stranger.accessToken, app, title: "Theirs" });
    const foreign = await createOrder({
      accessToken: stranger.accessToken,
      app,
      input: { items: [{ bookId, price: 100 }], storeName: "Yakaboo" },
    });

    const page = await history(`tab=all&orderId=${foreign.id}`);

    expect(page.items).toEqual([]);
  });

  it("keeps only the orders sitting in the asked-for derived state", async () => {
    await seedStaggeredParcel();
    await seedSplitOrder();
    const all = await history("tab=all");
    const received = all.items.filter((group) => group.order.derivedStatus === "received");

    const page = await history("tab=all&orderState=received");

    expect(page.items.map((group) => group.order.id)).toEqual(
      received.map((group) => group.order.id),
    );
    expect(page.items.length).toBeGreaterThan(0);
  });

  it("returns an empty page rather than everything for a state no order holds", async () => {
    await seedStaggeredParcel();

    const page = await history("tab=all&orderState=cancelled");

    expect(page.items).toEqual([]);
  });
});

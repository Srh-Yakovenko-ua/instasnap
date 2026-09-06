import type {
  BookOrderItemRowView,
  BookOrderStatisticsView,
  BookOrderView,
  InTransitSummaryView,
  Paginator,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

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
  isoDayOfPreviousMonth,
  isoSundayOfThisWeek,
  ORDER_ROUTES,
  postJson,
  previousMonthKey,
  shipmentOf,
} from "./book-order.fixtures.js";

type InTransitTestQuery = {
  ageBucket?: string;
  currency?: string;
  filter?: string;
  search?: string;
  sort?: string;
  store?: string;
};

const AGE_BOOKS = {
  depotTen: "Age Depot Ten",
  eight: "Age Eight",
  fifteen: "Age Fifteen",
  fourteen: "Age Fourteen",
  seven: "Age Seven",
  thirty: "Age Thirty",
  thirtyOne: "Age ThirtyOne",
  today: "Age Today",
  unknown: "Age Unknown",
} as const;

const LIST_BOOKS = {
  noDate: "No Date",
  notDispatched: "Not Dispatched",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
} as const;

const ATTENTION_BOOKS = {
  loose: "Loose",
  onItsOwn: "On Its Own",
  packed: "Packed",
  waiting: "Waiting",
} as const;

const WEEK_BOOKS = {
  arrived: "Arrived",
  dueToday: "Due Today",
  slippedBy: "Slipped By",
  waitingAtPickup: "Waiting At Pickup",
} as const;

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

async function inTransitPage(
  query: InTransitTestQuery = {},
): Promise<Paginator<BookOrderItemRowView>> {
  const params = new URLSearchParams(
    Object.entries(query).flatMap<[string, string]>(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  );
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.inTransit}?${params.toString()}`,
  });
  if (res.status !== 200) {
    throw new Error(`in-transit read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function inTransitSummary(): Promise<InTransitSummaryView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.inTransitSummary,
  });
  return res.body;
}

async function inTransitTitles(query: InTransitTestQuery = {}): Promise<string[]> {
  const page = await inTransitPage(query);
  return page.items.map((row) => row.book.title);
}

async function inTransitTitlesSorted(query: InTransitTestQuery = {}): Promise<string[]> {
  return (await inTransitTitles(query)).sort();
}

async function seedAgeFixture(): Promise<void> {
  const authed = { accessToken: reader.accessToken, app };
  const dated: { ageInDays: null | number; title: string }[] = [
    { ageInDays: 0, title: AGE_BOOKS.today },
    { ageInDays: 7, title: AGE_BOOKS.seven },
    { ageInDays: 8, title: AGE_BOOKS.eight },
    { ageInDays: 14, title: AGE_BOOKS.fourteen },
    { ageInDays: 15, title: AGE_BOOKS.fifteen },
    { ageInDays: 30, title: AGE_BOOKS.thirty },
    { ageInDays: 31, title: AGE_BOOKS.thirtyOne },
    { ageInDays: null, title: AGE_BOOKS.unknown },
  ];

  for (const { ageInDays, title } of dated) {
    const bookId = await createBook({ ...authed, title });
    await createOrder({
      ...authed,
      input: {
        currency: "UAH",
        items: [{ bookId, price: 100 }],
        ...(ageInDays === null ? {} : { orderDate: isoDay(-ageInDays) }),
        shipments: [{ bookIds: [bookId] }],
        storeName: "Yakaboo",
      },
    });
  }

  const depotBookId = await createBook({ ...authed, title: AGE_BOOKS.depotTen });
  await createOrder({
    ...authed,
    input: {
      currency: "USD",
      items: [{ bookId: depotBookId, price: 40 }],
      orderDate: isoDay(-10),
      shipments: [{ bookIds: [depotBookId] }],
      storeName: "Book Depot",
    },
  });
}

async function seedAttentionFixture(): Promise<BookOrderView> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: [ATTENTION_BOOKS.waiting, ATTENTION_BOOKS.packed, ATTENTION_BOOKS.loose],
  });
  const [waiting, packed, loose] = bookIds;

  await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      items: [{ bookId: waiting ?? "" }],
      orderDate: isoDay(-3),
      shipments: [{ bookIds: [waiting ?? ""], pickupUntil: isoDay(1), status: "ready_for_pickup" }],
      storeName: "Yakaboo",
      totalAmount: 500,
    },
  });

  return createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      items: [{ bookId: packed ?? "" }, { bookId: loose ?? "" }],
      orderDate: isoDay(-3),
      shipments: [{ bookIds: [packed ?? ""], expectedDeliveryDate: isoDay(3) }],
      storeName: "Bookva",
      totalAmount: 500,
    },
  });
}

async function seedListFixture(): Promise<BookOrderView> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: [LIST_BOOKS.overdue, LIST_BOOKS.today, LIST_BOOKS.upcoming, LIST_BOOKS.noDate],
  });
  const [overdue, today, upcoming, noDate] = bookIds;

  return createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [
        { bookId: overdue ?? "", price: 100 },
        { bookId: today ?? "", price: 200 },
        { bookId: upcoming ?? "", price: 300 },
        { bookId: noDate ?? "" },
      ],
      orderDate: isoDay(-30),
      shipments: [
        {
          bookIds: [overdue ?? ""],
          expectedDeliveryDate: isoDay(-10),
          trackingNumber: "NP-OVERDUE",
        },
        { bookIds: [today ?? ""], expectedDeliveryDate: isoDay(0), trackingNumber: "NP-TODAY" },
        {
          bookIds: [upcoming ?? ""],
          expectedDeliveryDate: isoDay(5),
          trackingNumber: "NP-UPCOMING",
        },
        { bookIds: [noDate ?? ""] },
      ],
      storeName: "Yakaboo",
      totalAmount: 800,
    },
  });
}

async function seedWeekWindowFixture(): Promise<void> {
  const bookIds = await createBooks({
    accessToken: reader.accessToken,
    app,
    titles: [
      WEEK_BOOKS.arrived,
      WEEK_BOOKS.dueToday,
      WEEK_BOOKS.waitingAtPickup,
      WEEK_BOOKS.slippedBy,
    ],
  });
  const [arrived, dueToday, waitingAtPickup, slippedBy] = bookIds;

  const splitOrder = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [
        { bookId: arrived ?? "", price: 100 },
        { bookId: dueToday ?? "", price: 150 },
      ],
      orderDate: isoDay(-20),
      shipments: [
        {
          bookIds: [arrived ?? ""],
          expectedDeliveryDate: isoDay(-2),
          trackingNumber: "NP-ARRIVED",
        },
        {
          bookIds: [dueToday ?? ""],
          expectedDeliveryDate: isoDay(0),
          trackingNumber: "NP-DUE-TODAY",
        },
      ],
      storeName: "Yakaboo",
    },
  });
  await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId: arrived ?? "", view: splitOrder }).id),
  });
  await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.markInTransit(shipmentOf({ bookId: dueToday ?? "", view: splitOrder }).id),
  });

  const freeOrder = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      isFree: true,
      items: [{ bookId: waitingAtPickup ?? "" }],
      orderDate: isoDay(-10),
      shipments: [
        {
          bookIds: [waitingAtPickup ?? ""],
          expectedDeliveryDate: isoSundayOfThisWeek(),
          trackingNumber: "NP-WAITING",
        },
      ],
      storeName: "Knygarnia",
    },
  });
  await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.markReadyForPickup(
      shipmentOf({ bookId: waitingAtPickup ?? "", view: freeOrder }).id,
    ),
  });

  await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [{ bookId: slippedBy ?? "", price: 90 }],
      orderDate: isoDay(-30),
      shipments: [
        {
          bookIds: [slippedBy ?? ""],
          expectedDeliveryDate: isoDay(-1),
          trackingNumber: "NP-SLIPPED",
        },
      ],
      storeName: "Bookva",
    },
  });
}

async function statistics(): Promise<BookOrderStatisticsView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.statistics,
  });
  if (res.status !== 200) {
    throw new Error(`statistics read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

describe("GET /api/delivery/books/in-transit filters", () => {
  it("returns only the parcel waiting at the pickup point", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 200)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markReadyForPickup(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "ready_for_pickup" })).resolves.toEqual([
      LIST_BOOKS.today,
    ]);
  });

  it("returns only the book whose date has already passed", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "delayed" })).resolves.toEqual([LIST_BOOKS.overdue]);
  });

  it("returns only the book with no expected date", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "no_delivery_date" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("returns only the book whose travelling parcel carries no tracking number", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === null)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markInTransit(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "without_tracking_number" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("says nothing is untracked while every parcel is still waiting to be dispatched", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "without_tracking_number" })).resolves.toEqual([]);
  });

  it("stops calling a parcel late once it is waiting at a pickup point", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 100)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markReadyForPickup(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "delayed" })).resolves.toEqual([]);
  });

  it("leaves out a book that has not been dispatched at all", async () => {
    await seedListFixture();
    const notDispatched = await createBook({
      accessToken: reader.accessToken,
      app,
      title: LIST_BOOKS.notDispatched,
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { items: [{ bookId: notDispatched }], storeName: "Yakaboo", totalAmount: 500 },
    });

    await expect(inTransitTitles({ filter: "no_delivery_date" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
    await expect(inTransitTitles({ filter: "without_tracking_number" })).resolves.toEqual([]);
    await expect(inTransitTitles({ filter: "ordered" })).resolves.toContain(
      LIST_BOOKS.notDispatched,
    );
  });

  it("returns the parcel whose pickup deadline is about to pass", async () => {
    await seedAttentionFixture();

    await expect(inTransitTitles({ filter: "pickup_expiring" })).resolves.toEqual([
      ATTENTION_BOOKS.waiting,
    ]);
  });

  it("leaves out a parcel whose pickup deadline is still comfortably ahead", async () => {
    const bookId = await createBook({
      accessToken: reader.accessToken,
      app,
      title: ATTENTION_BOOKS.waiting,
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId }],
        orderDate: isoDay(-3),
        shipments: [{ bookIds: [bookId], pickupUntil: isoDay(5), status: "ready_for_pickup" }],
        storeName: "Yakaboo",
        totalAmount: 500,
      },
    });

    await expect(inTransitTitles({ filter: "pickup_expiring" })).resolves.toEqual([]);
  });

  it("returns every book of an order that has been waiting a week to be dispatched", async () => {
    await seedListFixture();
    const freshBookId = await createBook({
      accessToken: reader.accessToken,
      app,
      title: LIST_BOOKS.notDispatched,
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId: freshBookId }],
        orderDate: isoDay(-1),
        storeName: "Yakaboo",
        totalAmount: 500,
      },
    });

    const titles = await inTransitTitles({ filter: "awaiting_dispatch" });

    expect([...titles].sort()).toEqual(
      [LIST_BOOKS.noDate, LIST_BOOKS.overdue, LIST_BOOKS.today, LIST_BOOKS.upcoming].sort(),
    );
  });

  it("stops calling a whole order undispatched once one of its parcels sets off", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 300)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markInTransit(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "awaiting_dispatch" })).resolves.toEqual([]);
  });

  it("returns the book left out of a parcel while the rest of its order travels", async () => {
    await seedAttentionFixture();
    const onItsOwn = await createBook({
      accessToken: reader.accessToken,
      app,
      title: ATTENTION_BOOKS.onItsOwn,
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId: onItsOwn }],
        orderDate: isoDay(-3),
        storeName: "Knygarnia",
        totalAmount: 500,
      },
    });

    await expect(inTransitTitles({ filter: "unassigned" })).resolves.toEqual([
      ATTENTION_BOOKS.loose,
    ]);
  });

  it("returns only the book with no price", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ filter: "without_price" })).resolves.toEqual([
      LIST_BOOKS.noDate,
    ]);
  });

  it("drops a book out of the list once its parcel arrives", async () => {
    const order = await seedListFixture();
    const bookId = order.items.find((item) => item.price === 100)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(shipmentOf({ bookId, view: order }).id),
    });

    await expect(inTransitTitles({ filter: "delayed" })).resolves.toEqual([]);
  });
});

describe("GET /api/delivery/books/in-transit sorting", () => {
  it("puts the soonest arrival first and the late one last", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ sort: "closest_delivery" })).resolves.toEqual([
      LIST_BOOKS.today,
      LIST_BOOKS.upcoming,
      LIST_BOOKS.overdue,
      LIST_BOOKS.noDate,
    ]);
  });

  it("puts the late one first on the very same books", async () => {
    await seedListFixture();

    await expect(inTransitTitles({ sort: "delayed_first" })).resolves.toEqual([
      LIST_BOOKS.overdue,
      LIST_BOOKS.today,
      LIST_BOOKS.upcoming,
      LIST_BOOKS.noDate,
    ]);
  });
});

describe("GET /api/delivery/books/in-transit/summary", () => {
  it("keeps the book counters while reporting each attention case in its own unit", async () => {
    await seedListFixture();

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({
      activeBooksCount: 4,
      activeOrdersCount: 1,
      activeShipmentsCount: 4,
      arrivingSoonCount: 2,
      delayedCount: 1,
      withoutExpectedDateCount: 1,
      withoutPriceCount: 1,
      withoutTrackingCount: 0,
    });
    expect(summary.attention).toEqual([
      { count: 1, maxDelayDays: 10, reason: "delayed" },
      { count: 1, maxWaitingDays: 30, reason: "awaiting_dispatch" },
      { count: 1, reason: "without_expected_date" },
    ]);
  });

  it("points at the single order holding the loose book and at the nearest pickup deadline", async () => {
    const looseOrder = await seedAttentionFixture();

    const summary = await inTransitSummary();

    expect(summary.attention).toEqual([
      { count: 1, expiredCount: 0, nearestPickupUntil: isoDay(1), reason: "pickup_expiring" },
      { count: 1, ordersCount: 1, reason: "unassigned_books", revealOrderId: looseOrder.id },
    ]);
  });

  it("never calls an order undispatched while one of its parcels is already travelling", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: [ATTENTION_BOOKS.packed, ATTENTION_BOOKS.loose],
    });
    const [packed, loose] = bookIds;
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId: packed ?? "" }, { bookId: loose ?? "" }],
        orderDate: isoDay(-30),
        shipments: [
          {
            bookIds: [packed ?? ""],
            expectedDeliveryDate: isoDay(2),
            status: "in_transit",
            trackingNumber: "T-1",
          },
        ],
        storeName: "Bookva",
        totalAmount: 500,
      },
    });

    const summary = await inTransitSummary();

    expect(summary.attention).toEqual([
      { count: 1, ordersCount: 1, reason: "unassigned_books", revealOrderId: order.id },
    ]);
    await expect(inTransitTitles({ filter: "awaiting_dispatch" })).resolves.toEqual([]);
  });

  it("reports a pickup deadline that has already passed and offers no next deadline", async () => {
    const bookId = await createBook({
      accessToken: reader.accessToken,
      app,
      title: ATTENTION_BOOKS.waiting,
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId }],
        orderDate: isoDay(-3),
        shipments: [{ bookIds: [bookId], pickupUntil: isoDay(-1), status: "ready_for_pickup" }],
        storeName: "Yakaboo",
        totalAmount: 500,
      },
    });

    const summary = await inTransitSummary();

    expect(summary.attention).toEqual([
      { count: 1, expiredCount: 1, nearestPickupUntil: null, reason: "pickup_expiring" },
    ]);
  });

  it("says nothing needs attention while every parcel is fresh, dated and tracked", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Calm" });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId, price: 100 }],
        orderDate: isoDay(-1),
        shipments: [
          { bookIds: [bookId], expectedDeliveryDate: isoDay(3), trackingNumber: "NP-CALM" },
        ],
        storeName: "Yakaboo",
      },
    });

    const summary = await inTransitSummary();

    expect(summary.attention).toEqual([]);
  });

  it("reports the pickup and transit counts of the parcels behind the books", async () => {
    const order = await seedListFixture();
    const readyBookId = order.items.find((item) => item.price === 200)?.bookId ?? "";
    const transitBookId = order.items.find((item) => item.price === 300)?.bookId ?? "";
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markReadyForPickup(shipmentOf({ bookId: readyBookId, view: order }).id),
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.markInTransit(shipmentOf({ bookId: transitBookId, view: order }).id),
    });

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({
      inTransitCount: 1,
      orderedCount: 2,
      readyForPickupCount: 1,
      uniqueStoresCount: 1,
    });
  });

  it("expects this week only the parcels still travelling towards a day that has not passed", async () => {
    await seedWeekWindowFixture();

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({
      expectedThisWeekCount: 1,
      nextExpectedThisWeek: isoDay(0),
    });
  });

  it("keeps calling an order split once one of its two parcels has already arrived", async () => {
    await seedWeekWindowFixture();

    const summary = await inTransitSummary();

    expect(summary).toMatchObject({ activeOrdersCount: 3, splitOrdersCount: 1 });
  });

  it("counts a free order into the average at its canonical total of zero", async () => {
    await seedWeekWindowFixture();

    const summary = await inTransitSummary();

    expect(summary.activeOrdersTotalByCurrency).toEqual([{ currency: "UAH", total: 340 }]);
    expect(summary.activeOrdersAverageByCurrency).toEqual([{ average: 340 / 3, currency: "UAH" }]);
  });
});

describe("GET /api/delivery/orders/statistics", () => {
  it("counts three books of one parcel as one order and one shipment", async () => {
    const bookIds = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["One", "Two", "Three"],
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: bookIds.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDay(-3),
        shipments: [{ bookIds, expectedDeliveryDate: isoDay(4) }],
        storeName: "Yakaboo",
        totalAmount: 300,
      },
    });

    const { summary } = await statistics();

    expect(summary).toMatchObject({
      activeBooksCount: 3,
      activeShipmentsCount: 1,
      booksCount: 3,
      ordersCount: 1,
      shipmentsCount: 1,
    });
  });

  it("averages the order amount and the book price inside each store", async () => {
    const yakabooBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["Y One", "Y Two", "Y Three"],
    });
    const depotBookId = await createBook({
      accessToken: reader.accessToken,
      app,
      title: "D One",
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 60,
        items: yakabooBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDay(-6),
        storeName: "Yakaboo",
        totalAmount: 360,
      },
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        deliveryPrice: 40,
        items: [{ bookId: depotBookId, price: 500 }],
        orderDate: isoDay(-5),
        storeName: "Book Depot",
        totalAmount: 540,
      },
    });

    const { byStore } = await statistics();

    expect(byStore).toEqual([
      {
        averageBookPriceByCurrency: [{ average: 500, currency: "UAH" }],
        averageBooksPerOrder: 1,
        averageLandedBookCostByCurrency: [{ average: 540, currency: "UAH" }],
        averageOrderAmountByCurrency: [{ average: 540, currency: "UAH" }],
        booksCount: 1,
        booksCountByCurrency: [{ count: 1, currency: "UAH" }],
        deliveryTotalByCurrency: [{ currency: "UAH", total: 40 }],
        discountTotalByCurrency: [{ currency: "UAH", total: 0 }],
        drilldown: { targets: [{ booksCount: 1, destination: "in_transit", ordersCount: 1 }] },
        landedCoverageByCurrency: [
          { booksInScope: 1, booksWithLandedCost: 1, coveragePercent: 100, currency: "UAH" },
        ],
        landedEligibleBooksCountByCurrency: [{ count: 1, currency: "UAH" }],
        ordersCount: 1,
        ordersCountByCurrency: [{ count: 1, currency: "UAH" }],
        store: "Book Depot",
        storeKey: "book depot",
        totalsByCurrency: [{ currency: "UAH", total: 540 }],
      },
      {
        averageBookPriceByCurrency: [{ average: 100, currency: "UAH" }],
        averageBooksPerOrder: 3,
        averageLandedBookCostByCurrency: [{ average: 120, currency: "UAH" }],
        averageOrderAmountByCurrency: [{ average: 360, currency: "UAH" }],
        booksCount: 3,
        booksCountByCurrency: [{ count: 3, currency: "UAH" }],
        deliveryTotalByCurrency: [{ currency: "UAH", total: 60 }],
        discountTotalByCurrency: [{ currency: "UAH", total: 0 }],
        drilldown: { targets: [{ booksCount: 3, destination: "in_transit", ordersCount: 1 }] },
        landedCoverageByCurrency: [
          { booksInScope: 3, booksWithLandedCost: 3, coveragePercent: 100, currency: "UAH" },
        ],
        landedEligibleBooksCountByCurrency: [{ count: 3, currency: "UAH" }],
        ordersCount: 1,
        ordersCountByCurrency: [{ count: 1, currency: "UAH" }],
        store: "Yakaboo",
        storeKey: "yakaboo",
        totalsByCurrency: [{ currency: "UAH", total: 360 }],
      },
    ]);
  });

  it("counts two orders of one month as two orders carrying five books", async () => {
    const firstOrderBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["M One", "M Two", "M Three"],
    });
    const secondOrderBooks = await createBooks({
      accessToken: reader.accessToken,
      app,
      titles: ["M Four", "M Five"],
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: firstOrderBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDayOfPreviousMonth(0),
        storeName: "Yakaboo",
        totalAmount: 300,
      },
    });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        currency: "UAH",
        items: secondOrderBooks.map((bookId) => ({ bookId, price: 100 })),
        orderDate: isoDayOfPreviousMonth(1),
        storeName: "Yakaboo",
        totalAmount: 200,
      },
    });

    const { monthly } = await statistics();

    expect(monthly).toEqual([
      {
        booksCount: 5,
        month: previousMonthKey(),
        ordersCount: 2,
        totalsByCurrency: [{ currency: "UAH", total: 500 }],
      },
    ]);
  });

  it("keeps another reader's orders out of the numbers", async () => {
    const stranger = await context.registerVerifyAndLogin();
    const strangerBookId = await createBook({
      accessToken: stranger.accessToken,
      app,
      title: "Theirs",
    });
    await createOrder({
      accessToken: stranger.accessToken,
      app,
      input: {
        currency: "UAH",
        items: [{ bookId: strangerBookId, price: 900 }],
        orderDate: isoDay(-2),
        storeName: "Yakaboo",
        totalAmount: 900,
      },
    });

    const { summary } = await statistics();

    expect(summary).toMatchObject({ booksCount: 0, ordersCount: 0, shipmentsCount: 0 });
  });
});

describe("GET /api/delivery/books/in-transit ageBucket", () => {
  it("keeps a week-old order in the first bucket and pushes the next day out of it", async () => {
    await seedAgeFixture();

    await expect(inTransitTitlesSorted({ ageBucket: "0_7" })).resolves.toEqual([
      AGE_BOOKS.seven,
      AGE_BOOKS.today,
    ]);
  });

  it("opens the second bucket exactly one day after the first one closes", async () => {
    await seedAgeFixture();

    await expect(inTransitTitlesSorted({ ageBucket: "8_14" })).resolves.toEqual([
      AGE_BOOKS.depotTen,
      AGE_BOOKS.eight,
      AGE_BOOKS.fourteen,
    ]);
  });

  it("hands the fifteenth day to the third bucket and keeps the thirtieth there", async () => {
    await seedAgeFixture();

    await expect(inTransitTitlesSorted({ ageBucket: "15_30" })).resolves.toEqual([
      AGE_BOOKS.fifteen,
      AGE_BOOKS.thirty,
    ]);
  });

  it("leaves the last bucket open ended from the thirty-first day on", async () => {
    await seedAgeFixture();

    await expect(inTransitTitles({ ageBucket: "31_plus" })).resolves.toEqual([AGE_BOOKS.thirtyOne]);
  });

  it("collects the orders that never got a date into their own bucket", async () => {
    await seedAgeFixture();

    await expect(inTransitTitles({ ageBucket: "unknown_date" })).resolves.toEqual([
      AGE_BOOKS.unknown,
    ]);
  });

  it("returns every waiting book when no bucket is asked for", async () => {
    await seedAgeFixture();

    await expect(inTransitTitles()).resolves.toHaveLength(Object.keys(AGE_BOOKS).length);
  });

  it("narrows a bucket down to the intersection with store, currency and search", async () => {
    await seedAgeFixture();

    await expect(
      inTransitTitles({ ageBucket: "8_14", currency: "USD", search: "Depot", store: "Book Depot" }),
    ).resolves.toEqual([AGE_BOOKS.depotTen]);
  });

  it("finds nothing when the bucket and the store point at different books", async () => {
    await seedAgeFixture();

    await expect(inTransitTitles({ ageBucket: "0_7", store: "Book Depot" })).resolves.toEqual([]);
  });

  it("orders a bucket by the oldest order first when asked to", async () => {
    await seedAgeFixture();

    await expect(inTransitTitles({ ageBucket: "15_30", sort: "oldest_orders" })).resolves.toEqual([
      AGE_BOOKS.thirty,
      AGE_BOOKS.fifteen,
    ]);
  });

  it("counts the page against the bucket, not against the whole list", async () => {
    await seedAgeFixture();

    const bucket = await inTransitPage({ ageBucket: "8_14" });
    const everything = await inTransitPage();

    expect({ bucket: bucket.totalCount, everything: everything.totalCount }).toEqual({
      bucket: 3,
      everything: Object.keys(AGE_BOOKS).length,
    });
  });

  it("refuses a bucket name that is not one of the five", async () => {
    const res = await getJson({
      accessToken: reader.accessToken,
      app,
      path: `${ORDER_ROUTES.inTransit}?ageBucket=last_year`,
    });

    expect(res.status).toBe(400);
  });
});

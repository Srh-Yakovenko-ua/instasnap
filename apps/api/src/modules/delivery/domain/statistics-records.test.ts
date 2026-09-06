import type {
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
  Currency,
  Nullable,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ClassifiedOrder, OrderStatisticsRecord } from "./statistics-scope.js";

import { buildPurchaseRecords } from "./statistics-records.js";
import { classifyOrder } from "./statistics-scope.js";
import { buildStoreScorecards } from "./statistics-stores.js";

const UNFILTERED_SCOPE: BookOrderStatisticsRecordScope = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

function orderOf({
  currency = "UAH",
  id,
  orderedOn = "2026-03-04",
  prices,
  storeName = "Yakaboo",
  totalAmount = null,
}: {
  currency?: Nullable<Currency>;
  id: string;
  orderedOn?: Nullable<string>;
  prices: Nullable<number>[];
  storeName?: string;
  totalAmount?: Nullable<number>;
}): ClassifiedOrder {
  const record: OrderStatisticsRecord = {
    currency,
    deliveryPrice: null,
    discount: null,
    id,
    isFree: false,
    items: prices.map((price, index) => ({
      bookId: `${id}-book-${index}`,
      bookTitle: "Book",
      cancelledAt: null,
      id: `${id}-item-${index}`,
      price,
      receivedAt: null,
      shipmentId: null,
    })),
    orderDate: orderedOn === null ? null : new Date(`${orderedOn}T00:00:00.000Z`),
    orderNumber: null,
    shipments: [],
    storeName,
    totalAmount,
  };

  return classifyOrder({ includeCancelled: false, record });
}

function recordsOf({
  byStore = [],
  includedOrders = [],
  scope = UNFILTERED_SCOPE,
  topOrdersByCurrency = [],
}: {
  byStore?: ReturnType<typeof buildStoreScorecards>;
  includedOrders?: ClassifiedOrder[];
  scope?: BookOrderStatisticsRecordScope;
  topOrdersByCurrency?: BookOrderStatisticsTopOrdersByCurrency;
}) {
  return buildPurchaseRecords({ byStore, includedOrders, scope, topOrdersByCurrency });
}

function storesOf(entries: { prices: number[]; storeName: string }[]) {
  return buildStoreScorecards(
    entries.map((entry, index) =>
      orderOf({ id: `order-${index}`, prices: entry.prices, storeName: entry.storeName }),
    ),
  );
}

function topOrder(
  overrides: Partial<BookOrderStatisticsTopOrder> = {},
): BookOrderStatisticsTopOrder {
  return {
    booksCount: 1,
    currency: "UAH",
    derivedStatus: "active",
    id: "order-1",
    orderDate: "2026-03-04",
    orderNumber: null,
    storeName: "Yakaboo",
    totalAmount: 100,
    ...overrides,
  };
}

describe("buildPurchaseRecords record month", () => {
  it("finds the priciest month of each currency without ever comparing the two", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "march-uah", prices: [900], totalAmount: 900 }),
        orderOf({ currency: "USD", id: "march-usd", prices: [20], totalAmount: 20 }),
        orderOf({ id: "april-uah", orderedOn: "2026-04-11", prices: [400], totalAmount: 400 }),
        orderOf({
          currency: "USD",
          id: "april-usd",
          orderedOn: "2026-04-11",
          prices: [50],
          totalAmount: 50,
        }),
      ],
    });

    expect(
      records.recordMonthByCurrency.map((record) => ({
        currency: record.currency,
        month: record.month,
        total: record.total,
      })),
    ).toEqual([
      { currency: "UAH", month: "2026-03", total: 900 },
      { currency: "USD", month: "2026-04", total: 50 },
    ]);
  });

  it("counts the orders and books of a record month inside its own currency", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "uah-one", prices: [400, 100], totalAmount: 500 }),
        orderOf({ currency: "EUR", id: "eur-one", prices: [30, 30, 30], totalAmount: 90 }),
      ],
    });

    expect(
      records.recordMonthByCurrency.map((record) => ({
        booksCount: record.booksCount,
        currency: record.currency,
        ordersCount: record.ordersCount,
      })),
    ).toEqual([
      { booksCount: 2, currency: "UAH", ordersCount: 1 },
      { booksCount: 3, currency: "EUR", ordersCount: 1 },
    ]);
  });

  it("settles a tie between two months on the later one, not on iteration order", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "march", prices: [500], totalAmount: 500 }),
        orderOf({ id: "april", orderedOn: "2026-04-11", prices: [500], totalAmount: 500 }),
      ],
    });

    expect(records.recordMonthByCurrency.map((record) => record.month)).toEqual(["2026-04"]);
  });

  it("carries the destinations of the very orders that made the month", () => {
    const records = recordsOf({
      includedOrders: [orderOf({ id: "march", prices: [500], totalAmount: 500 })],
    });

    expect(records.recordMonthByCurrency.at(0)?.drilldown).toEqual({
      targets: [{ booksCount: 1, destination: "in_transit", ordersCount: 1 }],
    });
  });

  it("leaves an undated order out of every record month", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "undated", orderedOn: null, prices: [700], totalAmount: 700 }),
      ],
    });

    expect(records.recordMonthByCurrency).toEqual([]);
  });
});

describe("buildPurchaseRecords order records", () => {
  it("takes the largest order of each currency straight off the ranked list", () => {
    const records = recordsOf({
      topOrdersByCurrency: [
        {
          currency: "UAH",
          orders: [
            topOrder({ id: "uah-big", totalAmount: 9000 }),
            topOrder({ id: "uah-small", totalAmount: 100 }),
          ],
        },
        { currency: "USD", orders: [topOrder({ currency: "USD", id: "usd", totalAmount: 40 })] },
      ],
    });

    expect(
      records.largestOrderByCurrency.map((entry) => ({
        currency: entry.currency,
        id: entry.order.id,
      })),
    ).toEqual([
      { currency: "UAH", id: "uah-big" },
      { currency: "USD", id: "usd" },
    ]);
  });

  it("crowns the fullest order from every included order, not from the priciest few", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "expensive", prices: [9000], totalAmount: 9000 }),
        orderOf({ id: "full", prices: [10, 10, 10, 10], totalAmount: 40 }),
      ],
      topOrdersByCurrency: [
        { currency: "UAH", orders: [topOrder({ id: "expensive", totalAmount: 9000 })] },
      ],
    });

    expect(records.mostBooksInOrder?.id).toBe("full");
  });

  it("lets an order that carries no price at all win the book count", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "priced", prices: [500, 500], totalAmount: 1000 }),
        orderOf({ id: "priceless", prices: [null, null, null] }),
      ],
    });

    expect(records.mostBooksInOrder).toMatchObject({ booksCount: 3, id: "priceless" });
  });

  it("reports the amount of a most-books order as missing rather than as zero", () => {
    const records = recordsOf({
      includedOrders: [orderOf({ id: "priceless", prices: [null, null] })],
    });

    expect(records.mostBooksInOrder?.totalAmount).toBeNull();
  });

  it("settles a most-books tie on the later order, then on a stable id", () => {
    const records = recordsOf({
      includedOrders: [
        orderOf({ id: "b-older", orderedOn: "2026-03-01", prices: [10, 10] }),
        orderOf({ id: "a-newer", orderedOn: "2026-03-09", prices: [10, 10] }),
        orderOf({ id: "c-newer", orderedOn: "2026-03-09", prices: [10, 10] }),
      ],
    });

    expect(records.mostBooksInOrder?.id).toBe("a-newer");
  });

  it("has no fullest order to report when nothing was bought", () => {
    expect(recordsOf({}).mostBooksInOrder).toBeNull();
  });
});

describe("buildPurchaseRecords store records", () => {
  it("reports the busiest store by orders and by books as two separate answers", () => {
    const records = recordsOf({
      byStore: storesOf([
        { prices: [100, 100, 100, 100, 100], storeName: "Bulk Buyer" },
        { prices: [100], storeName: "Frequent" },
        { prices: [100], storeName: "Frequent" },
      ]),
    });

    expect({
      byBooks: records.mostActiveStore.byBooks?.store,
      byOrders: records.mostActiveStore.byOrders?.store,
    }).toEqual({ byBooks: "Bulk Buyer", byOrders: "Frequent" });
  });

  it("names the busiest store by a stable key rather than by its display name", () => {
    const records = recordsOf({
      byStore: storesOf([{ prices: [100], storeName: "Книгарня Є" }]),
    });

    expect(records.mostActiveStore.byOrders?.storeKey).toBe("книгарня є");
  });

  it("has no busiest store to report when nothing was bought", () => {
    const records = recordsOf({});

    expect(records.mostActiveStore).toEqual({ byBooks: null, byOrders: null });
  });

  it("names no best-value store while no book has a landed cost", () => {
    expect(recordsOf({}).bestValueStoreByCurrency).toEqual([]);
  });

  it("carries the truncation and filter scope so nothing can be called an all-time record", () => {
    const scope: BookOrderStatisticsRecordScope = {
      isPeriodFiltered: true,
      isTruncated: true,
      period: { from: "2026-03-01", to: "2026-03-31" },
    };

    expect(recordsOf({ scope }).scope).toEqual(scope);
  });
});

import type { BookOrderDerivedStatus } from "@app/shared";

import { statisticsDrilldownDestinationOf } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ClassifiedOrder, OrderStatisticsRecord } from "./statistics-scope.js";

import { buildDrilldownBreakdown } from "./statistics-drilldown.js";
import { classifyOrder } from "./statistics-scope.js";

const DISPATCHED_AT = new Date("2026-03-10T00:00:00.000Z");

function orderOf({
  books = 1,
  cancelled = false,
  id,
  received = 0,
  shipped = false,
}: {
  books?: number;
  cancelled?: boolean;
  id: string;
  received?: number;
  shipped?: boolean;
}): ClassifiedOrder {
  const record: OrderStatisticsRecord = {
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id,
    isFree: false,
    items: Array.from({ length: books }, (_unused, index) => ({
      bookId: `${id}-book-${index}`,
      bookTitle: "Book",
      cancelledAt: cancelled ? DISPATCHED_AT : null,
      id: `${id}-item-${index}`,
      price: 100,
      receivedAt: index < received ? DISPATCHED_AT : null,
      shipmentId: shipped ? `${id}-shipment` : null,
    })),
    orderDate: new Date("2026-03-04T00:00:00.000Z"),
    orderNumber: null,
    shipments: shipped
      ? [{ cancelledAt: null, id: `${id}-shipment`, receivedAt: null, status: "in_transit" }]
      : [],
    storeName: "Yakaboo",
    totalAmount: null,
  };

  return classifyOrder({ includeCancelled: true, record });
}

describe("statisticsDrilldownDestinationOf", () => {
  const DESTINATIONS: [BookOrderDerivedStatus, string][] = [
    ["active", "in_transit"],
    ["partially_shipped", "in_transit"],
    ["shipped", "in_transit"],
    ["partially_received", "in_transit"],
    ["received", "history_received"],
    ["cancelled", "history_cancelled"],
  ];

  it.each(DESTINATIONS)("sends %s to %s", (state, destination) => {
    expect(statisticsDrilldownDestinationOf(state)).toBe(destination);
  });
});

describe("buildDrilldownBreakdown", () => {
  it("splits the same subset across the pages that now hold it", () => {
    const breakdown = buildDrilldownBreakdown([
      orderOf({ id: "moving" }),
      orderOf({ id: "home", received: 1 }),
      orderOf({ cancelled: true, id: "dropped" }),
    ]);

    expect(breakdown.targets).toEqual([
      { booksCount: 1, destination: "in_transit", ordersCount: 1 },
      { booksCount: 1, destination: "history_received", ordersCount: 1 },
      { booksCount: 1, destination: "history_cancelled", ordersCount: 1 },
    ]);
  });

  it("counts both units so a block can switch between orders and books", () => {
    const breakdown = buildDrilldownBreakdown([
      orderOf({ books: 3, id: "first" }),
      orderOf({ books: 4, id: "second" }),
    ]);

    expect(breakdown.targets).toEqual([
      { booksCount: 7, destination: "in_transit", ordersCount: 2 },
    ]);
  });

  it("folds a partly shipped order into the page that still holds it", () => {
    const breakdown = buildDrilldownBreakdown([
      orderOf({ books: 2, id: "half-received", received: 1 }),
    ]);

    expect(breakdown.targets).toEqual([
      { booksCount: 2, destination: "in_transit", ordersCount: 1 },
    ]);
  });

  it("lists no destination at all for an empty subset", () => {
    expect(buildDrilldownBreakdown([]).targets).toEqual([]);
  });

  it("leaves out a destination that holds nothing rather than sending a zero", () => {
    const breakdown = buildDrilldownBreakdown([orderOf({ id: "moving" })]);

    expect(breakdown.targets.map((target) => target.destination)).toEqual(["in_transit"]);
  });
});

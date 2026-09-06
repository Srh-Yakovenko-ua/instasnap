import { describe, expect, it } from "vitest";

import type { LandedCostResult } from "./landed-cost.js";
import type { ClassifiedOrder, OrderStatisticsItemRecord } from "./statistics-scope.js";

import { allocateLandedCost, buildLandedCostSummary } from "./landed-cost.js";
import { toMinorUnits } from "./money-minor-units.js";
import { classifyOrder } from "./statistics-scope.js";

const ORDER_DATE = new Date("2026-03-04T00:00:00.000Z");

function expectReconciles({
  effectiveTotalAmount,
  result,
}: {
  effectiveTotalAmount: number;
  result: LandedCostResult;
}): void {
  if (result.status !== "allocated") {
    throw new Error("expected an allocated landed cost result");
  }
  const allocated = result.allocations.reduce((sum, allocation) => sum + allocation.realCost, 0);
  expect(allocated).toBe(toMinorUnits(effectiveTotalAmount));
}

function makeItem(overrides: Partial<OrderStatisticsItemRecord> = {}): OrderStatisticsItemRecord {
  const bookId = overrides.bookId ?? "book-1";
  return {
    bookId,
    bookTitle: "Book",
    cancelledAt: null,
    id: `item-${bookId}`,
    price: null,
    receivedAt: null,
    shipmentId: null,
    ...overrides,
  };
}

function orderOf({
  currency = "UAH",
  deliveryPrice = null,
  discount = null,
  id = "order-1",
  includeCancelled = false,
  items,
  totalAmount = null,
}: {
  currency?: "EUR" | "UAH" | "USD";
  deliveryPrice?: null | number;
  discount?: null | number;
  id?: string;
  includeCancelled?: boolean;
  items: OrderStatisticsItemRecord[];
  totalAmount?: null | number;
}): ClassifiedOrder {
  return classifyOrder({
    includeCancelled,
    record: {
      currency,
      deliveryPrice,
      discount,
      id,
      isFree: false,
      items,
      orderDate: ORDER_DATE,
      orderNumber: null,
      shipments: [],
      storeName: "Yakaboo",
      totalAmount,
    },
  });
}

describe("allocateLandedCost", () => {
  it("splits the worked example so delivery lands equally and the discount lands proportionally", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      deliveryPrice: 100,
      discount: 80,
      effectiveTotalAmount: 820,
    });

    expect(result).toEqual({
      allocations: [
        {
          adjustmentShare: 0,
          deliveryShare: 5000,
          discountShare: 3000,
          itemId: "item-a",
          rawPrice: 30000,
          realCost: 32000,
        },
        {
          adjustmentShare: 0,
          deliveryShare: 5000,
          discountShare: 5000,
          itemId: "item-b",
          rawPrice: 50000,
          realCost: 50000,
        },
      ],
      status: "allocated",
    });
    expectReconciles({ effectiveTotalAmount: 820, result });
  });

  it("pushes the gap of a manual total into the adjustment share rather than rewriting prices", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      deliveryPrice: 100,
      discount: 80,
      effectiveTotalAmount: 900,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.adjustmentShare)).toEqual([
      3000, 5000,
    ]);
    expect(result.allocations.map((allocation) => allocation.rawPrice)).toEqual([30000, 50000]);
    expectReconciles({ effectiveTotalAmount: 900, result });
  });

  it("hands every leftover cent to one book instead of losing it", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 10 }), makeItem({ bookId: "b", price: 20 })],
      deliveryPrice: null,
      discount: 1,
      effectiveTotalAmount: 29,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.discountShare)).toEqual([33, 67]);
    expectReconciles({ effectiveTotalAmount: 29, result });
  });

  it("reconciles across three books", () => {
    const result = allocateLandedCost({
      countedItems: [
        makeItem({ bookId: "a", price: 100 }),
        makeItem({ bookId: "b", price: 200 }),
        makeItem({ bookId: "c", price: 300 }),
      ],
      deliveryPrice: 50,
      discount: 25,
      effectiveTotalAmount: 625,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.deliveryShare)).toEqual([
      1667, 1667, 1666,
    ]);
    expect(result.allocations.map((allocation) => allocation.realCost)).toEqual([
      11250, 20834, 30416,
    ]);
    expectReconciles({ effectiveTotalAmount: 625, result });
  });

  it("spreads a total evenly when every raw price is zero", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 0 }), makeItem({ bookId: "b", price: 0 })],
      deliveryPrice: 90,
      discount: null,
      effectiveTotalAmount: 90,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.realCost)).toEqual([4500, 4500]);
    expectReconciles({ effectiveTotalAmount: 90, result });
  });

  it("refuses to invent a landed cost when one of several books has no price", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b" })],
      deliveryPrice: 100,
      discount: null,
      effectiveTotalAmount: 500,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("refuses a lone book whose price was never entered rather than calling it free", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a" })],
      deliveryPrice: 40,
      discount: 10,
      effectiveTotalAmount: 500,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("has nothing to allocate when the effective total is unknown", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 300 })],
      deliveryPrice: null,
      discount: null,
      effectiveTotalAmount: null,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("allocates nothing at all to the books of a free order", () => {
    const result = allocateLandedCost({
      countedItems: [makeItem({ bookId: "a", price: 0 }), makeItem({ bookId: "b", price: 0 })],
      deliveryPrice: null,
      discount: null,
      effectiveTotalAmount: 0,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.realCost)).toEqual([0, 0]);
    expectReconciles({ effectiveTotalAmount: 0, result });
  });

  it("keeps a single cent whole across three books instead of rounding it away", () => {
    const result = allocateLandedCost({
      countedItems: [
        makeItem({ bookId: "a", price: 1 }),
        makeItem({ bookId: "b", price: 1 }),
        makeItem({ bookId: "c", price: 1 }),
      ],
      deliveryPrice: null,
      discount: null,
      effectiveTotalAmount: 0.01,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.realCost)).toEqual([1, 0, 0]);
    expectReconciles({ effectiveTotalAmount: 0.01, result });
  });

  it("charges the whole cost of the order to the books that were not cancelled", () => {
    const order = orderOf({
      deliveryPrice: 100,
      items: [
        makeItem({ bookId: "a", price: 300 }),
        makeItem({ bookId: "b", cancelledAt: ORDER_DATE, price: 500 }),
      ],
    });
    const result = allocateLandedCost({
      countedItems: order.countedItems,
      deliveryPrice: order.record.deliveryPrice,
      discount: order.record.discount,
      effectiveTotalAmount: order.amount,
    });

    if (result.status !== "allocated") {
      throw new Error("expected an allocated landed cost result");
    }
    expect(result.allocations.map((allocation) => allocation.itemId)).toEqual(["item-a"]);
    expectReconciles({ effectiveTotalAmount: 900, result });
  });
});

describe("buildLandedCostSummary", () => {
  it("averages only the books that actually received an allocation", () => {
    const summary = buildLandedCostSummary([
      orderOf({
        deliveryPrice: 100,
        discount: 80,
        id: "order-priced",
        items: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      }),
      orderOf({
        id: "order-partly-priced",
        items: [makeItem({ bookId: "c", price: 300 }), makeItem({ bookId: "d" })],
        totalAmount: 700,
      }),
    ]);

    expect(summary).toEqual([
      {
        averageAdjustmentShare: 0,
        averageDeliveryShare: 50,
        averageDiscountShare: 40,
        averageEligibleRawBookPrice: 400,
        averageLandedBookCost: 410,
        booksInScope: 4,
        booksWithLandedCost: 2,
        coveragePercent: 50,
        currency: "UAH",
        deltaFromEligibleRawPrice: 10,
      },
    ]);
  });

  it("reports zero coverage rather than a null percent when no book is counted", () => {
    const summary = buildLandedCostSummary([orderOf({ items: [], totalAmount: 400 })]);

    expect(summary).toEqual([
      {
        averageAdjustmentShare: null,
        averageDeliveryShare: null,
        averageDiscountShare: null,
        averageEligibleRawBookPrice: null,
        averageLandedBookCost: null,
        booksInScope: 0,
        booksWithLandedCost: 0,
        coveragePercent: 0,
        currency: "UAH",
        deltaFromEligibleRawPrice: null,
      },
    ]);
  });

  it("keeps each currency on its own scale and never averages across them", () => {
    const summary = buildLandedCostSummary([
      orderOf({ id: "uah", items: [makeItem({ bookId: "a", price: 900 })] }),
      orderOf({ currency: "USD", id: "usd", items: [makeItem({ bookId: "b", price: 30 })] }),
    ]);

    expect(
      summary.map((row) => ({ average: row.averageLandedBookCost, currency: row.currency })),
    ).toEqual([
      { average: 900, currency: "UAH" },
      { average: 30, currency: "USD" },
    ]);
  });
});

describe("buildLandedCostSummary price bridge", () => {
  it("reconciles the bridge stages back to the landed cost of the same books", () => {
    const [row] = buildLandedCostSummary([
      orderOf({
        deliveryPrice: 100,
        discount: 80,
        id: "order-bridge",
        items: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      }),
    ]);

    const bridged =
      (row?.averageEligibleRawBookPrice ?? 0) -
      (row?.averageDiscountShare ?? 0) +
      (row?.averageDeliveryShare ?? 0) +
      (row?.averageAdjustmentShare ?? 0);

    expect(bridged).toBeCloseTo(row?.averageLandedBookCost ?? 0, 2);
  });

  it("keeps a book the allocation skipped out of the starting price it compares against", () => {
    const [row] = buildLandedCostSummary([
      orderOf({
        id: "order-allocated",
        items: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      }),
      orderOf({
        id: "order-unallocatable",
        items: [makeItem({ bookId: "c", price: 30 }), makeItem({ bookId: "d" })],
        totalAmount: 700,
      }),
    ]);

    expect(row?.averageEligibleRawBookPrice).toBe(400);
  });

  it("leaves no adjustment once every book of an order carries a price", () => {
    const [row] = buildLandedCostSummary([
      orderOf({
        id: "order-fully-priced",
        items: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
        totalAmount: 600,
      }),
    ]);

    expect(row?.averageAdjustmentShare).toBe(0);
  });

  it("keeps an unpriced book out of the starting price instead of entering it as zero", () => {
    const [row] = buildLandedCostSummary([
      orderOf({ id: "order-unpriced", items: [makeItem({ bookId: "a" })], totalAmount: 700 }),
    ]);

    expect({
      counted: row?.booksInScope,
      eligible: row?.booksWithLandedCost,
      raw: row?.averageEligibleRawBookPrice,
    }).toEqual({ counted: 1, eligible: 0, raw: null });
  });

  it("lets an unpriced book pull the coverage down instead of the average price", () => {
    const [row] = buildLandedCostSummary([
      orderOf({
        id: "order-priced",
        items: [makeItem({ bookId: "a", price: 300 }), makeItem({ bookId: "b", price: 500 })],
      }),
      orderOf({ id: "order-unpriced", items: [makeItem({ bookId: "c" })], totalAmount: 700 }),
    ]);

    expect({
      coverage: row?.coveragePercent,
      raw: row?.averageEligibleRawBookPrice,
    }).toEqual({ coverage: (2 / 3) * 100, raw: 400 });
  });
});

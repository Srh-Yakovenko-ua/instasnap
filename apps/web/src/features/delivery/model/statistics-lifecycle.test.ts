import type { BookOrderStatisticsLifecycle } from "@app/shared";

import { describe, expect, it } from "vitest";

import { lifecycleBreakdown } from "./statistics-lifecycle";

const ORDERS = {
  active: 14,
  cancelled: 11,
  partially_received: 1,
  partially_shipped: 1,
  received: 20,
  shipped: 15,
  total: 62,
};

const BOOKS = { ...ORDERS, active: 30, received: 44, total: 100 };

const LIFECYCLE: BookOrderStatisticsLifecycle = {
  books: BOOKS,
  comparison: null,
  orders: ORDERS,
};

describe("lifecycleBreakdown", () => {
  it("keeps the canonical stage order instead of sorting by size", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "orders").stages.map((row) => row.stage)).toEqual([
      "active",
      "partially_shipped",
      "shipped",
      "partially_received",
      "received",
    ]);
  });

  it("scales the bars against the busiest stage, not the total", () => {
    const { stages } = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(stages.find((row) => row.stage === "received")?.share).toBe(1);
    expect(stages.find((row) => row.stage === "active")?.share).toBeCloseTo(14 / 20);
  });

  it("never mixes the two units in one view", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "books").stages[0]?.count).toBe(30);
    expect(lifecycleBreakdown(LIFECYCLE, "orders").stages[0]?.count).toBe(14);
  });

  it("keeps cancelled out of the main path", () => {
    const breakdown = lifecycleBreakdown(LIFECYCLE, "orders");

    expect(breakdown.stages.some((row) => row.stage === "cancelled")).toBe(false);
    expect(breakdown.cancelled.count).toBe(11);
  });

  it("has no deltas until a comparison is requested", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "orders").stages[0]?.delta).toBeNull();
  });

  it("passes the per-stage delta through, sign and all", () => {
    const withComparison: BookOrderStatisticsLifecycle = {
      ...LIFECYCLE,
      comparison: {
        books: {
          delta: { ...ORDERS, active: 0, received: 0, total: 0 },
          previous: BOOKS,
        },
        orders: {
          delta: {
            active: 14,
            cancelled: 0,
            partially_received: 1,
            partially_shipped: 1,
            received: -2,
            shipped: 15,
            total: 29,
          },
          previous: { ...ORDERS, active: 0, received: 22, total: 33 },
        },
      },
    };

    const { stages } = lifecycleBreakdown(withComparison, "orders");

    expect(stages.find((row) => row.stage === "received")?.delta).toBe(-2);
    expect(stages.find((row) => row.stage === "active")?.delta).toBe(14);
  });

  it("drops the unreachable partial stages from the books view", () => {
    expect(lifecycleBreakdown(LIFECYCLE, "books").stages.map((row) => row.stage)).toEqual([
      "active",
      "shipped",
      "received",
    ]);
  });

  it("reports the real share of the total next to the peak-based bar", () => {
    const { stages } = lifecycleBreakdown(LIFECYCLE, "orders");
    const received = stages.find((row) => row.stage === "received");

    expect({ share: received?.share, totalShare: received?.totalShare }).toEqual({
      share: 1,
      totalShare: 20 / 62,
    });
  });
});

import type { StatisticsDynamics, StatisticsDynamicsFacts } from "@app/shared";

import { describe, expect, it } from "vitest";

import { dynamicsPoints, percentChange } from "./statistics-dynamics";

const LOCALE = "uk";

function dynamics(buckets: StatisticsDynamics["buckets"]): StatisticsDynamics {
  return { buckets, granularity: "month" };
}

function facts(overrides: Partial<StatisticsDynamicsFacts> = {}): StatisticsDynamicsFacts {
  return {
    booksCount: 0,
    booksPerOrder: null,
    from: "2026-03-01",
    ordersCount: 0,
    to: "2026-03-31",
    totalsByCurrency: [],
    ...overrides,
  };
}

describe("dynamicsPoints", () => {
  it("takes the series straight from the backend without rebuilding it", () => {
    const points = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([
        {
          comparison: null,
          current: facts({ from: "2026-01-01", to: "2026-01-31" }),
          drilldown: { targets: [] },
          key: "2026-01-01",
        },
        {
          comparison: null,
          current: facts({ from: "2026-02-01", to: "2026-02-28" }),
          drilldown: { targets: [] },
          key: "2026-02-01",
        },
      ]),
      locale: LOCALE,
      metric: "orders",
    });

    expect(points.map((point) => point.key)).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("reads the chosen currency and never mixes another one in", () => {
    const [point] = dynamicsPoints({
      currency: "EUR",
      dynamics: dynamics([
        {
          comparison: null,
          current: facts({
            totalsByCurrency: [
              { currency: "UAH", total: 900 },
              { currency: "EUR", total: 40 },
            ],
          }),
          drilldown: { targets: [] },
          key: "2026-03-01",
        },
      ]),
      locale: LOCALE,
      metric: "spend",
    });

    expect(point?.value).toBe(40);
  });

  it("switches to counts for the non-money metrics", () => {
    const bucket = {
      comparison: null,
      current: facts({ booksCount: 12, ordersCount: 7, totalsByCurrency: [] }),
      drilldown: { targets: [] },
      key: "2026-03-01",
    };

    const orders = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([bucket]),
      locale: LOCALE,
      metric: "orders",
    });
    const books = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([bucket]),
      locale: LOCALE,
      metric: "books",
    });

    expect({ books: books.at(0)?.value, orders: orders.at(0)?.value }).toEqual({
      books: 12,
      orders: 7,
    });
  });

  it("keeps a bucket that saw nothing rather than dropping it", () => {
    const points = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([
        {
          comparison: null,
          current: facts({ from: "2026-01-01", ordersCount: 0, to: "2026-01-31" }),
          drilldown: { targets: [] },
          key: "2026-01-01",
        },
      ]),
      locale: LOCALE,
      metric: "orders",
    });

    expect(points).toHaveLength(1);
    expect(points.at(0)?.value).toBe(0);
  });

  it("reads the comparison the backend paired rather than guessing by position", () => {
    const [point] = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([
        {
          comparison: facts({ from: "2025-03-01", ordersCount: 4, to: "2025-03-31" }),
          current: facts({ ordersCount: 9 }),
          drilldown: { targets: [] },
          key: "2026-03-01",
        },
      ]),
      locale: LOCALE,
      metric: "orders",
    });

    expect({ comparison: point?.comparisonValue, current: point?.value }).toEqual({
      comparison: 4,
      current: 9,
    });
  });

  it("leaves the comparison empty when the backend paired nothing", () => {
    const [point] = dynamicsPoints({
      currency: "UAH",
      dynamics: dynamics([
        {
          comparison: null,
          current: facts({ ordersCount: 9 }),
          drilldown: { targets: [] },
          key: "2026-03-01",
        },
      ]),
      locale: LOCALE,
      metric: "orders",
    });

    expect(point?.comparisonValue).toBeNull();
  });
});

describe("percentChange", () => {
  it("reports the change against a real previous value", () => {
    expect(percentChange({ current: 150, previous: 100 })).toBe(50);
  });

  it("reports no percent at all when the previous value was zero", () => {
    expect(percentChange({ current: 150, previous: 0 })).toBeNull();
  });

  it("reports no percent when there is nothing to compare against", () => {
    expect(percentChange({ current: 150, previous: null })).toBeNull();
  });

  it("reports a full drop when the current value fell to zero", () => {
    expect(percentChange({ current: 0, previous: 100 })).toBe(-100);
  });
});

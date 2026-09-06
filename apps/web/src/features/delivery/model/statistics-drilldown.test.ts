import type { BookOrderStatisticsOrderIdentity } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { StatisticsDrilldownContext } from "./statistics-drilldown";

import {
  buildStatisticsDrilldown,
  orderDrilldownLink,
  statisticsDrilldownLinks,
} from "./statistics-drilldown";

const EMPTY_CONTEXT: StatisticsDrilldownContext = {
  currencyFilter: null,
  displayCurrency: null,
  isStale: false,
  orderState: null,
  store: null,
};

function hrefOf(request: Parameters<typeof buildStatisticsDrilldown>[0]): string {
  const href = buildStatisticsDrilldown(request);
  if (href === null) throw new Error("expected a drilldown href");
  return href;
}

function order(
  overrides: Partial<BookOrderStatisticsOrderIdentity> = {},
): BookOrderStatisticsOrderIdentity {
  return {
    booksCount: 1,
    currency: "UAH",
    derivedStatus: "active",
    id: "0f7c2f0a-4f7a-4d8f-9a3d-2a9f7f5a1b2c",
    orderDate: "2026-03-04",
    orderNumber: null,
    storeName: "Yakaboo",
    totalAmount: 100,
    ...overrides,
  };
}

function orderHrefOf(request: Parameters<typeof orderDrilldownLink>[0]): string {
  const link = orderDrilldownLink(request);
  if (link === null) throw new Error("expected an order drilldown link");
  return link.href;
}

function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.slice(href.indexOf("?") + 1));
}

describe("buildStatisticsDrilldown destination routing", () => {
  it("maps an in-transit date range onto the order-date bounds that page reads", () => {
    const href = hrefOf({
      context: EMPTY_CONTEXT,
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });

    expect(href.startsWith("/delivery/in-transit")).toBe(true);
    expect(Object.fromEntries(paramsOf(href))).toEqual({
      orderedFrom: "2026-03-01",
      orderedTo: "2026-03-31",
    });
  });

  it("maps a history date range onto the plain bounds that page reads", () => {
    const href = hrefOf({
      context: EMPTY_CONTEXT,
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });

    expect(href.startsWith("/delivery/history")).toBe(true);
    expect(Object.fromEntries(paramsOf(href))).toEqual({
      from: "2026-03-01",
      tab: "received",
      to: "2026-03-31",
    });
  });

  it("opens the cancelled tab for a cancelled destination", () => {
    const href = hrefOf({
      context: EMPTY_CONTEXT,
      destination: "history_cancelled",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Yakaboo" },
    });

    expect(paramsOf(href).get("tab")).toBe("cancelled");
  });

  it("keeps an age bucket as a bucket rather than turning it into dates", () => {
    const href = hrefOf({
      context: EMPTY_CONTEXT,
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { ageBucket: "15_30", kind: "age_bucket" },
    });
    const params = paramsOf(href);

    expect(params.get("ageBucket")).toBe("15_30");
    expect(params.has("orderedFrom")).toBe(false);
  });
});

describe("buildStatisticsDrilldown currency semantics", () => {
  it("carries the display currency for a currency-specific money metric", () => {
    const href = hrefOf({
      context: { ...EMPTY_CONTEXT, displayCurrency: "EUR" },
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
      scope: { kind: "store", store: "Amazon" },
    });

    expect(paramsOf(href).get("currency")).toBe("EUR");
  });

  it("leaves the display currency out of a count metric", () => {
    const href = hrefOf({
      context: { ...EMPTY_CONTEXT, displayCurrency: "EUR" },
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Amazon" },
    });

    expect(paramsOf(href).has("currency")).toBe(false);
  });

  it("still carries a dataset currency filter for a count metric", () => {
    const href = hrefOf({
      context: { ...EMPTY_CONTEXT, currencyFilter: "USD", displayCurrency: "USD" },
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Amazon" },
    });

    expect(paramsOf(href).get("currency")).toBe("USD");
  });
});

describe("buildStatisticsDrilldown source predicates", () => {
  it("carries the order state and store the page was filtered by", () => {
    const href = hrefOf({
      context: { ...EMPTY_CONTEXT, orderState: "shipped", store: "Yakaboo" },
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });
    const params = paramsOf(href);

    expect({ orderState: params.get("orderState"), store: params.get("store") }).toEqual({
      orderState: "shipped",
      store: "Yakaboo",
    });
  });

  it("lets the scope's own store win over the page filter", () => {
    const href = hrefOf({
      context: { ...EMPTY_CONTEXT, store: "Yakaboo" },
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Amazon" },
    });

    expect(paramsOf(href).getAll("store")).toEqual(["Amazon"]);
  });
});

describe("orderDrilldownLink", () => {
  it("opens an order by identity rather than by searching its number", () => {
    const href = orderHrefOf({ context: EMPTY_CONTEXT, order: order() });
    const params = paramsOf(href);

    expect(href.startsWith("/delivery/in-transit")).toBe(true);
    expect(params.get("orderId")).toBe(order().id);
    expect(params.has("q")).toBe(false);
  });

  it("keeps an order without a number just as reachable", () => {
    const href = orderHrefOf({
      context: EMPTY_CONTEXT,
      order: order({ orderNumber: null }),
    });

    expect(paramsOf(href).get("orderId")).toBe(order().id);
  });

  it("sends a received order to the received tab of the history", () => {
    const href = orderHrefOf({
      context: EMPTY_CONTEXT,
      order: order({ derivedStatus: "received" }),
    });

    expect(href.startsWith("/delivery/history")).toBe(true);
    expect(paramsOf(href).get("tab")).toBe("received");
  });

  it("sends a cancelled order to the cancelled tab of the history", () => {
    const href = orderHrefOf({
      context: EMPTY_CONTEXT,
      order: order({ derivedStatus: "cancelled" }),
    });

    expect(paramsOf(href).get("tab")).toBe("cancelled");
  });

  it("carries no page filter into an order opened by identity", () => {
    const href = orderHrefOf({
      context: {
        currencyFilter: "EUR",
        displayCurrency: "EUR",
        isStale: false,
        orderState: "shipped",
        store: "X",
      },
      order: order(),
    });
    const params = paramsOf(href);

    expect({
      currency: params.has("currency"),
      orderState: params.has("orderState"),
      store: params.has("store"),
    }).toEqual({ currency: false, orderState: false, store: false });
  });
});

describe("statisticsDrilldownLinks", () => {
  it("turns every non-zero destination of a breakdown into its own link", () => {
    const links = statisticsDrilldownLinks({
      breakdown: {
        targets: [
          { booksCount: 3, destination: "in_transit", ordersCount: 2 },
          { booksCount: 5, destination: "history_received", ordersCount: 4 },
        ],
      },
      context: EMPTY_CONTEXT,
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-04", kind: "order_date_range", to: "2026-03-04" },
    });

    expect(links.map((link) => link.destination)).toEqual(["in_transit", "history_received"]);
    expect(links.at(0)?.href.startsWith("/delivery/in-transit")).toBe(true);
    expect(links.at(1)?.href.startsWith("/delivery/history")).toBe(true);
  });

  it("returns no link at all for a breakdown with nowhere to go", () => {
    expect(
      statisticsDrilldownLinks({
        breakdown: { targets: [] },
        context: EMPTY_CONTEXT,
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { from: "2026-03-04", kind: "order_date_range", to: "2026-03-04" },
      }),
    ).toEqual([]);
  });
});

describe("stale statistics", () => {
  const STALE_CONTEXT: StatisticsDrilldownContext = { ...EMPTY_CONTEXT, isStale: true };

  it("builds no destination href while the numbers on screen belong to older filters", () => {
    expect(
      buildStatisticsDrilldown({
        context: STALE_CONTEXT,
        destination: "in_transit",
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
      }),
    ).toBeNull();
  });

  it("drops every aggregate target instead of pointing at a subset that no longer matches", () => {
    expect(
      statisticsDrilldownLinks({
        breakdown: {
          targets: [
            { booksCount: 2, destination: "in_transit", ordersCount: 1 },
            { booksCount: 3, destination: "history_received", ordersCount: 2 },
          ],
        },
        context: STALE_CONTEXT,
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
      }),
    ).toEqual([]);
  });

  it("withholds the exact order link too, since its destination filters come from the new context", () => {
    expect(orderDrilldownLink({ context: STALE_CONTEXT, order: order() })).toBeNull();
  });
});

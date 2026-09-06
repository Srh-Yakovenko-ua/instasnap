import type { Currency } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { describe, expect, it } from "vitest";

import type {
  StatisticsDrilldownContext,
  StatisticsDrilldownRequest,
} from "./statistics-drilldown";

import { deliveryHistoryParsers } from "./history-params";
import { deliveryQueryParsers } from "./in-transit-params";
import { buildStatisticsDrilldown } from "./statistics-drilldown";

type Parsers = Record<
  string,
  { parseServerSide: (value: string | string[] | undefined) => unknown }
>;

const NO_FILTERS: StatisticsDrilldownContext = {
  currencyFilter: null,
  displayCurrency: null,
  isStale: false,
  orderState: null,
  store: null,
};

function contextWith(overrides: Partial<StatisticsDrilldownContext>): StatisticsDrilldownContext {
  return { ...NO_FILTERS, ...overrides };
}

function historyStateOf(request: StatisticsDrilldownRequest) {
  return stateOf({ parsers: deliveryHistoryParsers, request });
}

function inTransitStateOf(request: StatisticsDrilldownRequest) {
  return stateOf({ parsers: deliveryQueryParsers, request });
}

function stateOf({
  parsers,
  request,
}: {
  parsers: Parsers;
  request: StatisticsDrilldownRequest;
}): Record<string, unknown> {
  const href = buildStatisticsDrilldown(request);
  if (href === null) throw new Error("drill-down produced no href");

  const search = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  return Object.fromEntries(
    Object.entries(parsers).map(([key, parser]) => [
      key,
      parser.parseServerSide(search.get(key) ?? undefined),
    ]),
  );
}

describe("a statistics drill-down lands on a destination that understands it", () => {
  it("opens the in-transit list on the very order dates the bucket covered", () => {
    const state = inTransitStateOf({
      context: NO_FILTERS,
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });

    expect(state.orderedFrom).toBe("2026-03-01");
    expect(state.orderedTo).toBe("2026-03-31");
  });

  it("opens the received tab of the history on the same dates", () => {
    const state = historyStateOf({
      context: NO_FILTERS,
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });

    expect(state.tab).toBe("received");
    expect(state.from).toBe("2026-03-01");
    expect(state.to).toBe("2026-03-31");
  });

  it("opens the cancelled tab rather than guessing the reader wanted the received one", () => {
    const state = historyStateOf({
      context: NO_FILTERS,
      destination: "history_cancelled",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Yakaboo" },
    });

    expect(state.tab).toBe("cancelled");
  });

  it("hands one exact order to a list that filters by that identity", () => {
    const inTransit = inTransitStateOf({
      context: NO_FILTERS,
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "order", orderId: "order-1" },
    });
    const history = historyStateOf({
      context: NO_FILTERS,
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "order", orderId: "order-1" },
    });

    expect(inTransit.orderId).toBe("order-1");
    expect(history.orderId).toBe("order-1");
  });

  it("reaches an age bucket the in-transit list actually offers, oldest first", () => {
    const state = inTransitStateOf({
      context: NO_FILTERS,
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { ageBucket: "31_plus", kind: "age_bucket" },
    });

    expect(state.ageBucket).toBe("31_plus");
    expect(state.sort).toBe("oldest_orders");
  });

  it("turns a single money currency into the multi-select the destination expects", () => {
    const currency: Currency = "EUR";
    const state = historyStateOf({
      context: contextWith({ currencyFilter: currency, displayCurrency: currency }),
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
      scope: { kind: "store", store: "Yakaboo" },
    });

    expect(state.currency).toEqual(["EUR"]);
    expect(state.store).toEqual(["Yakaboo"]);
  });

  it("carries the order state as a value the destination can select", () => {
    const state = inTransitStateOf({
      context: contextWith({ orderState: "partially_shipped" }),
      destination: "in_transit",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { from: "2026-03-01", kind: "order_date_range", to: "2026-03-31" },
    });

    expect(state.orderState).toBe("partially_shipped");
  });

  it("leaves an exact order untouched by the page filters that surrounded it", () => {
    const state = historyStateOf({
      context: contextWith({
        currencyFilter: "UAH",
        displayCurrency: "UAH",
        orderState: "received",
        store: "Yakaboo",
      }),
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "order", orderId: "order-1" },
    });

    expect(state).toMatchObject({
      currency: [],
      orderId: "order-1",
      orderState: null,
      store: [],
    });
  });

  it("keeps a store whose name holds a comma as one store, not two", () => {
    const state = historyStateOf({
      context: NO_FILTERS,
      destination: "history_received",
      metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      scope: { kind: "store", store: "Книгарня «Є», Львів" },
    });

    expect(state.store).toEqual(["Книгарня «Є», Львів"]);
  });
});

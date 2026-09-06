import { describe, expect, it } from "vitest";

import type { DeliveryStatisticsQueryState } from "./statistics-params";

import { statisticsFilterCount, toDeliveryStatisticsParams } from "./statistics-params";

const TODAY = "2026-08-21";

const BASE: DeliveryStatisticsQueryState = {
  budgetCurrency: null,
  compare: null,
  currency: null,
  from: "",
  includeCancelled: false,
  money: null,
  orderState: null,
  period: "this_year",
  store: "",
  to: "",
};

function params(state: Partial<DeliveryStatisticsQueryState>) {
  return toDeliveryStatisticsParams({ ...BASE, ...state }, TODAY);
}

describe("toDeliveryStatisticsParams", () => {
  it("materialises the preset into the dates the API expects", () => {
    expect(params({ period: "this_month" })).toEqual({
      from: "2026-08-01",
      includeCancelled: "false",
      to: TODAY,
    });
  });

  it("asks for no date bounds at all for all time, so undated orders stay in", () => {
    expect(params({ period: "all_time" })).toEqual({ includeCancelled: "false" });
  });

  it("sends the comparison mode once the period can carry one", () => {
    expect(params({ compare: "previous_period", period: "last_month" })).toMatchObject({
      compare: "previous_period",
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("withholds the comparison when the period has no lower bound", () => {
    expect(params({ compare: "previous_period", period: "all_time" })).not.toHaveProperty(
      "compare",
    );
  });

  it("passes the filters through and trims the store name", () => {
    expect(params({ currency: "EUR", orderState: "received", store: "  Yakaboo  " })).toMatchObject(
      {
        currency: "EUR",
        orderState: "received",
        store: "Yakaboo",
      },
    );
  });

  it("keeps the display currency out of the request", () => {
    expect(params({ money: "USD" })).not.toHaveProperty("currency");
  });

  it("keeps the budget currency out of the request", () => {
    expect(params({ budgetCurrency: "USD" })).not.toHaveProperty("currency");
  });

  it("drops an empty store instead of filtering on blank text", () => {
    expect(params({ store: "   " })).not.toHaveProperty("store");
  });
});

describe("statisticsFilterCount", () => {
  it("counts only the real filters, not the period", () => {
    expect(statisticsFilterCount({ ...BASE, period: "last_month" })).toBe(0);
    expect(statisticsFilterCount({ ...BASE, currency: "UAH", store: "Vivat" })).toBe(2);
  });
});

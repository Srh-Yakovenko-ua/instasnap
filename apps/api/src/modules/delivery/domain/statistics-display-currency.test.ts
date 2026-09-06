import type { Currency } from "@app/shared";

import {
  resolveStatisticsDisplayCurrency,
  resolveStatisticsDrilldownCurrency,
  STATISTICS_METRIC_KIND,
  StatisticsDrilldownBreakdownSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

const ALL_CURRENCIES: readonly Currency[] = ["UAH", "EUR", "USD"];

describe("resolveStatisticsDisplayCurrency", () => {
  it("pins the display currency to the dataset filter", () => {
    expect(
      resolveStatisticsDisplayCurrency({
        available: ALL_CURRENCIES,
        currencyFilter: "EUR",
        requested: "UAH",
      }),
    ).toBe("EUR");
  });

  it("keeps a requested currency the dataset still carries", () => {
    expect(
      resolveStatisticsDisplayCurrency({
        available: ALL_CURRENCIES,
        currencyFilter: null,
        requested: "EUR",
      }),
    ).toBe("EUR");
  });

  it("drops a requested currency the dataset no longer carries", () => {
    expect(
      resolveStatisticsDisplayCurrency({
        available: ["UAH", "USD"],
        currencyFilter: null,
        requested: "EUR",
      }),
    ).toBe("UAH");
  });

  it("falls back to the first available currency when none was requested", () => {
    expect(
      resolveStatisticsDisplayCurrency({
        available: ["EUR", "USD"],
        currencyFilter: null,
        requested: null,
      }),
    ).toBe("EUR");
  });

  it("returns no currency when the dataset carries no monetary data", () => {
    expect(
      resolveStatisticsDisplayCurrency({ available: [], currencyFilter: null, requested: "UAH" }),
    ).toBeNull();
  });

  it("honours a filter the dataset has no monetary rows for", () => {
    expect(
      resolveStatisticsDisplayCurrency({ available: [], currencyFilter: "EUR", requested: null }),
    ).toBe("EUR");
  });
});

describe("resolveStatisticsDrilldownCurrency", () => {
  it("sends the display currency for a currency-specific money metric", () => {
    expect(
      resolveStatisticsDrilldownCurrency({
        currencyFilter: null,
        displayCurrency: "EUR",
        metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
      }),
    ).toBe("EUR");
  });

  it("sends only the dataset filter for a count metric", () => {
    expect(
      resolveStatisticsDrilldownCurrency({
        currencyFilter: "USD",
        displayCurrency: "EUR",
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      }),
    ).toBe("USD");
  });

  it("sends no currency for a count metric outside a dataset filter", () => {
    expect(
      resolveStatisticsDrilldownCurrency({
        currencyFilter: null,
        displayCurrency: "EUR",
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
      }),
    ).toBeNull();
  });
});

describe("StatisticsDrilldownBreakdownSchema", () => {
  it("accepts a breakdown carrying both units per destination", () => {
    expect(
      StatisticsDrilldownBreakdownSchema.parse({
        targets: [{ booksCount: 7, destination: "in_transit", ordersCount: 3 }],
      }).targets,
    ).toHaveLength(1);
  });

  it("rejects a negative count", () => {
    expect(
      StatisticsDrilldownBreakdownSchema.safeParse({
        targets: [{ booksCount: -1, destination: "in_transit", ordersCount: 3 }],
      }).success,
    ).toBe(false);
  });
});

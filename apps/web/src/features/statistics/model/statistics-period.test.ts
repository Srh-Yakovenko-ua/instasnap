import { describe, expect, it } from "vitest";

import {
  canCompareStatisticsPeriod,
  customRangeIssue,
  defaultStatisticsCompareMode,
  selectableYearBounds,
  toOverviewParams,
} from "./statistics-period";

const TODAY = "2026-03-31";

const BASE_STATE = {
  compare: null,
  from: "",
  period: "year",
  to: "",
  year: null,
} as const;

describe("customRangeIssue", () => {
  it("accepts a one-day range", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "2026-03-02", today: TODAY })).toBeNull();
  });

  it("reports a reversed range instead of swapping it", () => {
    expect(customRangeIssue({ from: "2026-03-10", to: "2026-03-02", today: TODAY })).toBe(
      "reversed",
    );
  });

  it("reports a future bound instead of clamping it", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "2026-12-31", today: TODAY })).toBe("future");
  });

  it("reports an incomplete range", () => {
    expect(customRangeIssue({ from: "2026-03-02", to: "", today: TODAY })).toBe("incomplete");
  });

  it("reports a malformed date", () => {
    expect(customRangeIssue({ from: "2026-13-40", to: "2026-03-02", today: TODAY })).toBe(
      "invalid",
    );
  });
});

describe("canCompareStatisticsPeriod", () => {
  it("allows comparison for every period except all time", () => {
    expect(canCompareStatisticsPeriod("year")).toBe(true);
    expect(canCompareStatisticsPeriod("last_12_months")).toBe(true);
    expect(canCompareStatisticsPeriod("custom")).toBe(true);
    expect(canCompareStatisticsPeriod("all_time")).toBe(false);
  });

  it("defaults a calendar year to the same period last year", () => {
    expect(defaultStatisticsCompareMode("year")).toBe("same_period_last_year");
    expect(defaultStatisticsCompareMode("custom")).toBe("previous_period");
  });
});

describe("toOverviewParams", () => {
  it("sends the current year when no year was picked", () => {
    expect(toOverviewParams({ ...BASE_STATE }, TODAY)).toEqual({ period: "year", year: 2026 });
  });

  it("sends the picked year", () => {
    expect(toOverviewParams({ ...BASE_STATE, year: 2024 }, TODAY)).toEqual({
      period: "year",
      year: 2024,
    });
  });

  it("sends both custom bounds and no year", () => {
    expect(
      toOverviewParams(
        { ...BASE_STATE, from: "2026-01-05", period: "custom", to: "2026-02-05" },
        TODAY,
      ),
    ).toEqual({ from: "2026-01-05", period: "custom", to: "2026-02-05" });
  });

  it("drops a comparison that all time cannot support", () => {
    expect(
      toOverviewParams({ ...BASE_STATE, compare: "previous_period", period: "all_time" }, TODAY),
    ).toEqual({ period: "all_time" });
  });

  it("keeps a supported comparison", () => {
    expect(toOverviewParams({ ...BASE_STATE, compare: "same_period_last_year" }, TODAY)).toEqual({
      compare: "same_period_last_year",
      period: "year",
      year: 2026,
    });
  });
});

describe("selectableYearBounds", () => {
  it("never offers a future year", () => {
    const bounds = selectableYearBounds(TODAY);

    expect(bounds.max).toBe(2026);
    expect(bounds.min).toBeLessThan(bounds.max);
  });
});

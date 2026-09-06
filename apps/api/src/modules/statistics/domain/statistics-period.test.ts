import type { ReadingStatisticsOverviewQuery } from "@app/shared";

import { describe, expect, it } from "vitest";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { inclusiveDays, normalizeReadingStatisticsPeriod } from "./statistics-period.js";

const TODAY = "2026-09-02";

function normalize(query: Partial<ReadingStatisticsOverviewQuery>, today = TODAY) {
  return normalizeReadingStatisticsPeriod({
    query: { period: "year", ...query } as ReadingStatisticsOverviewQuery,
    today,
  });
}

describe("inclusiveDays", () => {
  it("counts a single day as one", () => {
    expect(inclusiveDays({ from: "2026-08-18", to: "2026-08-18" })).toBe(1);
  });

  it("counts two adjacent days as two", () => {
    expect(inclusiveDays({ from: "2026-08-18", to: "2026-08-19" })).toBe(2);
  });

  it("counts a leap day", () => {
    expect(inclusiveDays({ from: "2024-02-28", to: "2024-03-01" })).toBe(3);
  });
});

describe("normalizeReadingStatisticsPeriod period bounds", () => {
  it("ends the running year at today", () => {
    expect(normalize({ period: "year", year: 2026 }).period).toEqual({
      from: "2026-01-01",
      granularity: "month",
      kind: "year",
      to: TODAY,
    });
  });

  it("covers a past year end to end", () => {
    expect(normalize({ period: "year", year: 2025 }).period.to).toBe("2025-12-31");
  });

  it("rejects a year that has not started", () => {
    expect(() => normalize({ period: "year", year: 2027 })).toThrow(BadRequestError);
  });

  it("rolls twelve months back from today and starts the next day", () => {
    expect(normalize({ period: "last_12_months" }).period.from).toBe("2025-09-03");
  });

  it("accepts a one day custom range", () => {
    const { period } = normalize({ from: TODAY, period: "custom", to: TODAY });
    expect(period).toEqual({ from: TODAY, granularity: "day", kind: "custom", to: TODAY });
  });

  it("rejects a reversed custom range instead of swapping it", () => {
    expect(() => normalize({ from: "2026-08-10", period: "custom", to: "2026-08-01" })).toThrow(
      BadRequestError,
    );
  });

  it("rejects a custom range that reaches into the future", () => {
    expect(() => normalize({ from: "2026-09-01", period: "custom", to: "2026-12-01" })).toThrow(
      BadRequestError,
    );
  });

  it("rejects a custom range missing one bound", () => {
    expect(() => normalize({ from: "2026-09-01", period: "custom" })).toThrow(BadRequestError);
  });

  it("rejects a custom range wider than five years", () => {
    expect(() => normalize({ from: "2018-01-01", period: "custom", to: TODAY })).toThrow(
      BadRequestError,
    );
  });

  it("rejects a custom range that starts before reading history could exist", () => {
    expect(() => normalize({ from: "0001-01-01", period: "custom", to: "0001-01-02" })).toThrow(
      BadRequestError,
    );
  });

  it("leaves all time without a lower bound", () => {
    expect(normalize({ period: "all_time" }).period).toEqual({
      from: null,
      granularity: "year",
      kind: "all_time",
      to: TODAY,
    });
  });
});

describe("normalizeReadingStatisticsPeriod granularity", () => {
  it("stays daily at thirty one days", () => {
    expect(
      normalize({ from: "2026-08-03", period: "custom", to: "2026-09-02" }).period.granularity,
    ).toBe("day");
  });

  it("switches to weekly at thirty two days", () => {
    expect(
      normalize({ from: "2026-08-02", period: "custom", to: "2026-09-02" }).period.granularity,
    ).toBe("week");
  });

  it("stays weekly at one hundred and eighty days", () => {
    expect(
      normalize({ from: "2026-03-07", period: "custom", to: "2026-09-02" }).period.granularity,
    ).toBe("week");
  });

  it("switches to monthly at one hundred and eighty one days", () => {
    expect(
      normalize({ from: "2026-03-06", period: "custom", to: "2026-09-02" }).period.granularity,
    ).toBe("month");
  });
});

describe("normalizeReadingStatisticsPeriod comparison", () => {
  it("returns nothing when no comparison was asked for", () => {
    expect(normalize({ period: "year", year: 2026 }).comparison).toBeNull();
  });

  it("compares the running year with the same days last year", () => {
    expect(
      normalize({ compare: "same_period_last_year", period: "year", year: 2026 }).comparison,
    ).toEqual({ from: "2025-01-01", mode: "same_period_last_year", to: "2025-09-02" });
  });

  it("compares a finished year with the whole previous year", () => {
    expect(
      normalize({ compare: "previous_period", period: "year", year: 2025 }).comparison,
    ).toEqual({ from: "2024-01-01", mode: "previous_period", to: "2024-12-31" });
  });

  it("compares a custom range with the interval right before it", () => {
    expect(
      normalize({
        compare: "previous_period",
        from: "2026-08-01",
        period: "custom",
        to: "2026-08-10",
      }).comparison,
    ).toEqual({ from: "2026-07-22", mode: "previous_period", to: "2026-07-31" });
  });

  it("compares a single day with the day before", () => {
    expect(
      normalize({ compare: "previous_period", from: TODAY, period: "custom", to: TODAY })
        .comparison,
    ).toEqual({ from: "2026-09-01", mode: "previous_period", to: "2026-09-01" });
  });

  it("clamps a leap day back to the last day of February", () => {
    expect(
      normalize(
        {
          compare: "same_period_last_year",
          from: "2024-02-29",
          period: "custom",
          to: "2024-02-29",
        },
        "2024-03-01",
      ).comparison,
    ).toEqual({ from: "2023-02-28", mode: "same_period_last_year", to: "2023-02-28" });
  });

  it("refuses to compare all time with anything", () => {
    expect(() => normalize({ compare: "previous_period", period: "all_time" })).toThrow(
      BadRequestError,
    );
  });
});

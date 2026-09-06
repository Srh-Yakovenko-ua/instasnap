import { describe, expect, it } from "vitest";

import { buildStatisticsBuckets } from "./statistics-buckets.js";

describe("buildStatisticsBuckets", () => {
  it("makes one bucket per day", () => {
    expect(
      buildStatisticsBuckets({
        from: "2026-08-01",
        granularity: "day",
        to: "2026-08-03",
        weekStartDay: "monday",
      }),
    ).toEqual([
      { end: "2026-08-01", start: "2026-08-01" },
      { end: "2026-08-02", start: "2026-08-02" },
      { end: "2026-08-03", start: "2026-08-03" },
    ]);
  });

  it("starts weeks on Monday when that is the user setting", () => {
    const buckets = buildStatisticsBuckets({
      from: "2026-08-05",
      granularity: "week",
      to: "2026-08-18",
      weekStartDay: "monday",
    });

    expect(buckets[0]).toEqual({ end: "2026-08-09", start: "2026-08-05" });
    expect(buckets[1]?.start).toBe("2026-08-10");
  });

  it("starts weeks on Sunday when that is the user setting", () => {
    const buckets = buildStatisticsBuckets({
      from: "2026-08-05",
      granularity: "week",
      to: "2026-08-18",
      weekStartDay: "sunday",
    });

    expect(buckets[0]).toEqual({ end: "2026-08-08", start: "2026-08-05" });
    expect(buckets[1]?.start).toBe("2026-08-09");
  });

  it("clips the first and last bucket to the period", () => {
    const buckets = buildStatisticsBuckets({
      from: "2026-08-15",
      granularity: "month",
      to: "2026-09-10",
      weekStartDay: "monday",
    });

    expect(buckets).toEqual([
      { end: "2026-08-31", start: "2026-08-15" },
      { end: "2026-09-10", start: "2026-09-01" },
    ]);
  });

  it("makes one bucket per year for all time", () => {
    const buckets = buildStatisticsBuckets({
      from: "2025-06-01",
      granularity: "year",
      to: "2026-03-01",
      weekStartDay: "monday",
    });

    expect(buckets).toEqual([
      { end: "2025-12-31", start: "2025-06-01" },
      { end: "2026-03-01", start: "2026-01-01" },
    ]);
  });
});

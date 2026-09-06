import { describe, expect, it } from "vitest";

import { findCurrentStreak, findLongestStreak } from "./reading-streak.js";

const TODAY = "2026-09-02";

const RELIABLE_FROM = "2026-01-01";

describe("findLongestStreak", () => {
  it("finds nothing in an empty period", () => {
    expect(findLongestStreak([])).toEqual({ days: 0, endDate: null, startDate: null });
  });

  it("takes the longest run of consecutive days", () => {
    expect(
      findLongestStreak(["2026-08-01", "2026-08-02", "2026-08-05", "2026-08-06", "2026-08-07"]),
    ).toEqual({ days: 3, endDate: "2026-08-07", startDate: "2026-08-05" });
  });

  it("keeps the earliest run when two runs tie", () => {
    expect(findLongestStreak(["2026-08-06", "2026-08-07", "2026-08-01", "2026-08-02"])).toEqual({
      days: 2,
      endDate: "2026-08-02",
      startDate: "2026-08-01",
    });
  });

  it("ignores a repeated day", () => {
    expect(findLongestStreak(["2026-08-01", "2026-08-01", "2026-08-02"])).toEqual({
      days: 2,
      endDate: "2026-08-02",
      startDate: "2026-08-01",
    });
  });
});

describe("findCurrentStreak", () => {
  it("keeps the streak alive when yesterday was the last active day", () => {
    expect(
      findCurrentStreak({
        activeBeforeRange: false,
        activeDays: ["2026-08-31", "2026-09-01"],
        rangeFrom: "2026-01-01",
        reliableFrom: RELIABLE_FROM,
        today: TODAY,
      }),
    ).toEqual({
      continuesBeforeRange: false,
      continuesBeforeReliableHistory: false,
      days: 2,
      endDate: "2026-09-01",
      startDate: "2026-08-31",
    });
  });

  it("reports zero when neither today nor yesterday was active", () => {
    expect(
      findCurrentStreak({
        activeBeforeRange: false,
        activeDays: ["2026-08-20"],
        rangeFrom: "2026-01-01",
        reliableFrom: RELIABLE_FROM,
        today: TODAY,
      }).days,
    ).toBe(0);
  });

  it("clips at the range start and says the run began earlier", () => {
    expect(
      findCurrentStreak({
        activeBeforeRange: true,
        activeDays: ["2026-09-01", "2026-09-02"],
        rangeFrom: "2026-09-01",
        reliableFrom: RELIABLE_FROM,
        today: TODAY,
      }),
    ).toEqual({
      continuesBeforeRange: true,
      continuesBeforeReliableHistory: false,
      days: 2,
      endDate: TODAY,
      startDate: "2026-09-01",
    });
  });

  it("flags a run that reaches back into unreliable history", () => {
    expect(
      findCurrentStreak({
        activeBeforeRange: false,
        activeDays: ["2026-09-01", "2026-09-02"],
        rangeFrom: "2026-01-01",
        reliableFrom: "2026-09-02",
        today: TODAY,
      }).continuesBeforeReliableHistory,
    ).toBe(true);
  });
});

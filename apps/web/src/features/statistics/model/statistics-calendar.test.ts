import { describe, expect, it } from "vitest";

import {
  buildHeatmapWeeks,
  buildMonthGrid,
  listCalendarMonths,
  weekdayOrder,
} from "./statistics-calendar";
import { calendarDayFixture } from "./statistics.fixtures";

const MARCH_2026 = [
  "2026-03-01",
  "2026-03-02",
  "2026-03-03",
  "2026-03-04",
  "2026-03-05",
  "2026-03-06",
  "2026-03-07",
].map((date) => calendarDayFixture({ date, drilldown: { date, kind: "reading_day" } }));

describe("weekdayOrder", () => {
  it("starts on Monday for a Monday week start", () => {
    expect(weekdayOrder("monday")).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("starts on Sunday for a Sunday week start", () => {
    expect(weekdayOrder("sunday")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("buildHeatmapWeeks", () => {
  it("pads the first column so Sunday 2026-03-01 lands last in a Monday-first week", () => {
    const weeks = buildHeatmapWeeks({ days: MARCH_2026, weekStartDay: "monday" });

    expect(weeks[0]?.slice(0, 6).every((cell) => cell === null)).toBe(true);
    expect(weeks[0]?.[6]?.date).toBe("2026-03-01");
    expect(weeks[1]?.[0]?.date).toBe("2026-03-02");
  });

  it("keeps every day in its weekday column even if a day is missing", () => {
    const withGap = MARCH_2026.filter((day) => day.date !== "2026-03-04");
    const weeks = buildHeatmapWeeks({ days: withGap, weekStartDay: "monday" });

    expect(weeks[1]?.[1]?.date).toBe("2026-03-03");
    expect(weeks[1]?.[2]).toBeNull();
    expect(weeks[1]?.[3]?.date).toBe("2026-03-05");
  });

  it("puts the same day first under a Sunday week start", () => {
    const weeks = buildHeatmapWeeks({ days: MARCH_2026, weekStartDay: "sunday" });

    expect(weeks[0]?.[0]?.date).toBe("2026-03-01");
    expect(weeks[0]?.[1]?.date).toBe("2026-03-02");
  });

  it("keeps the backend day order", () => {
    const weeks = buildHeatmapWeeks({ days: MARCH_2026, weekStartDay: "monday" });
    const dates = weeks.flat().flatMap((day) => (day === null ? [] : [day.date]));

    expect(dates).toEqual(MARCH_2026.map((day) => day.date));
  });
});

describe("buildMonthGrid", () => {
  it("lays March 2026 out with a leading pad under a Monday week start", () => {
    const weeks = buildMonthGrid({ days: MARCH_2026, monthKey: "2026-03", weekStartDay: "monday" });

    expect(weeks[0]?.filter((cell) => cell === null)).toHaveLength(6);
    expect(weeks[0]?.[6]?.date).toBe("2026-03-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("renders every day of the month, including days without activity", () => {
    const weeks = buildMonthGrid({ days: MARCH_2026, monthKey: "2026-03", weekStartDay: "sunday" });
    const cells = weeks.flat();

    expect(cells).toHaveLength(35);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(7);
  });
});

describe("listCalendarMonths", () => {
  it("lists every month the display range touches", () => {
    expect(listCalendarMonths({ from: "2025-11-14", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns a single month for a range inside one month", () => {
    expect(listCalendarMonths({ from: "2026-03-01", to: "2026-03-31" })).toEqual(["2026-03"]);
  });
});

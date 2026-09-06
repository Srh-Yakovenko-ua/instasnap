import { describe, expect, it } from "vitest";

import type { DayBookActivity } from "./reading-calendar.js";

import {
  buildCalendarDays,
  countEligibleDays,
  findMostActiveWeekday,
  toActiveDays,
} from "./reading-calendar.js";

const RELIABLE_FROM = "2026-08-01";

function preview(overrides: Partial<DayBookActivity>): DayBookActivity {
  return {
    bookId: "book-a",
    coverThumbUrl: null,
    date: "2026-08-02",
    pagesRead: 10,
    title: "A",
    ...overrides,
  };
}

describe("buildCalendarDays", () => {
  it("fills every day of the display range, including the empty ones", () => {
    const days = buildCalendarDays({
      activity: [{ booksCount: 1, date: "2026-08-02", pagesRead: 40 }],
      bookActivity: [preview({})],
      displayRange: { from: "2026-08-01", to: "2026-08-03" },
      reliableFrom: RELIABLE_FROM,
    });

    expect(days.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(days[0]?.pagesRead).toBe(0);
    expect(days[0]?.intensity).toBe(0);
  });

  it("orders the preview by pages read and then by book id", () => {
    const days = buildCalendarDays({
      activity: [{ booksCount: 3, date: "2026-08-02", pagesRead: 60 }],
      bookActivity: [
        preview({ bookId: "book-c", pagesRead: 10 }),
        preview({ bookId: "book-a", pagesRead: 10 }),
        preview({ bookId: "book-b", pagesRead: 40 }),
      ],
      displayRange: { from: "2026-08-02", to: "2026-08-02" },
      reliableFrom: RELIABLE_FROM,
    });

    expect(days[0]?.booksPreview.map((book) => book.bookId)).toEqual([
      "book-b",
      "book-a",
      "book-c",
    ]);
  });

  it("counts the books that did not fit into the preview", () => {
    const bookActivity = Array.from({ length: 6 }, (_unused, index) =>
      preview({ bookId: `book-${String(index)}`, pagesRead: 10 - index }),
    );

    const days = buildCalendarDays({
      activity: [{ booksCount: 6, date: "2026-08-02", pagesRead: 45 }],
      bookActivity,
      displayRange: { from: "2026-08-02", to: "2026-08-02" },
      reliableFrom: RELIABLE_FROM,
    });

    expect(days[0]?.booksPreview).toHaveLength(3);
    expect(days[0]?.remainingBooksCount).toBe(3);
  });

  it("leaves out a book that read no pages that day", () => {
    const days = buildCalendarDays({
      activity: [{ booksCount: 1, date: "2026-08-02", pagesRead: 10 }],
      bookActivity: [preview({}), preview({ bookId: "book-z", pagesRead: 0 })],
      displayRange: { from: "2026-08-02", to: "2026-08-02" },
      reliableFrom: RELIABLE_FROM,
    });

    expect(days[0]?.booksPreview.map((book) => book.bookId)).toEqual(["book-a"]);
  });

  it("marks days before the reliability boundary as observed only", () => {
    const days = buildCalendarDays({
      activity: [],
      bookActivity: [],
      displayRange: { from: "2026-07-31", to: "2026-08-01" },
      reliableFrom: RELIABLE_FROM,
    });

    expect(days.map((day) => day.historyQuality)).toEqual(["legacy_observed_only", "exact"]);
  });
});

describe("countEligibleDays", () => {
  it("counts both boundaries", () => {
    expect(countEligibleDays({ from: "2026-08-01", to: "2026-08-03" })).toBe(3);
  });
});

describe("findMostActiveWeekday", () => {
  it("picks the weekday with the most pages", () => {
    const weekday = findMostActiveWeekday([
      { booksCount: 1, date: "2026-08-03", pagesRead: 10 },
      { booksCount: 1, date: "2026-08-10", pagesRead: 30 },
      { booksCount: 1, date: "2026-08-04", pagesRead: 35 },
    ]);

    expect(weekday).toEqual({ activeDays: 2, pagesRead: 40, weekday: 1 });
  });

  it("finds nothing when no day had pages", () => {
    expect(findMostActiveWeekday([{ booksCount: 0, date: "2026-08-03", pagesRead: 0 }])).toBeNull();
  });
});

describe("toActiveDays", () => {
  it("keeps only the days with pages", () => {
    expect(
      toActiveDays([
        { booksCount: 1, date: "2026-08-01", pagesRead: 5 },
        { booksCount: 0, date: "2026-08-02", pagesRead: 0 },
      ]),
    ).toEqual(["2026-08-01"]);
  });
});

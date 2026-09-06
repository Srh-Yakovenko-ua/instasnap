import { describe, expect, it } from "vitest";

import type { CompletedRead, CompletedReadSeries } from "./completed-read.js";

import {
  collectSeriesActivity,
  compareSeriesActivity,
  countSeriesReads,
  findLongestMarathon,
  resolveSeriesLifecycle,
} from "./reading-series.js";

function read(overrides: Partial<CompletedRead>): CompletedRead {
  return {
    authors: [],
    bookId: "book-a",
    bookState: "active",
    coverThumbUrl: null,
    finishedAt: "2026-08-01",
    genres: [],
    isProvenFirstCompletion: true,
    language: null,
    pagesCount: null,
    publisher: null,
    rating: null,
    readingCycleId: "cycle-a",
    series: null,
    startedAt: null,
    title: "A",
    ...overrides,
  };
}

function series(overrides: Partial<CompletedReadSeries> = {}): CompletedReadSeries {
  return {
    knownBooksCount: 3,
    name: "Saga",
    partNumber: 1,
    seriesId: "series-a",
    status: "ongoing",
    totalBooks: null,
    ...overrides,
  };
}

describe("collectSeriesActivity", () => {
  it("counts every completed read cycle, including a reread", () => {
    const activity = collectSeriesActivity({
      pagesByBookId: new Map([["book-a", 100]]),
      reads: [
        read({ finishedAt: "2026-03-01", readingCycleId: "cycle-1", series: series() }),
        read({ finishedAt: "2026-08-01", readingCycleId: "cycle-2", series: series() }),
      ],
    });

    expect(activity[0]).toMatchObject({
      completedReadCycles: 2,
      latestFinishedAt: "2026-08-01",
      seriesId: "series-a",
    });
  });
});

describe("compareSeriesActivity", () => {
  it("breaks a tie by pages, then by latest finish, then by series id", () => {
    const base = {
      attributablePagesRead: 10,
      completedReadCycles: 2,
      latestFinishedAt: "2026-08-01",
      name: "S",
      seriesId: "series-b",
    };
    const sorted = [
      { ...base, seriesId: "series-c" },
      { ...base, attributablePagesRead: 20, seriesId: "series-a" },
      { ...base, latestFinishedAt: "2026-09-01", seriesId: "series-d" },
    ].sort(compareSeriesActivity);

    expect(sorted.map((entry) => entry.seriesId)).toEqual(["series-a", "series-d", "series-c"]);
  });
});

describe("findLongestMarathon", () => {
  it("finds the longest uninterrupted run inside one series", () => {
    const marathon = findLongestMarathon([
      read({ finishedAt: "2026-01-01", readingCycleId: "c1", series: series() }),
      read({ finishedAt: "2026-01-02", readingCycleId: "c2", series: series() }),
      read({ finishedAt: "2026-01-03", readingCycleId: "c3" }),
      read({ finishedAt: "2026-01-04", readingCycleId: "c4", series: series() }),
    ]);

    expect(marathon).toMatchObject({ length: 2, startReadingCycleId: "c1" });
  });

  it("ignores a run of one", () => {
    expect(findLongestMarathon([read({ readingCycleId: "c1", series: series() })])).toBeNull();
  });

  it("breaks the run when another series comes between", () => {
    const marathon = findLongestMarathon([
      read({ finishedAt: "2026-01-01", readingCycleId: "c1", series: series() }),
      read({
        finishedAt: "2026-01-02",
        readingCycleId: "c2",
        series: series({ seriesId: "series-b" }),
      }),
      read({ finishedAt: "2026-01-03", readingCycleId: "c3", series: series() }),
    ]);

    expect(marathon).toBeNull();
  });
});

describe("countSeriesReads", () => {
  it("counts only the reads that belonged to a series", () => {
    expect(countSeriesReads([read({ series: series() }), read({})])).toBe(1);
  });
});

describe("resolveSeriesLifecycle", () => {
  it("counts a series as started when nothing was completed before", () => {
    expect(
      resolveSeriesLifecycle({
        firstCompletionsBeforePeriod: new Map(),
        periodReads: [read({ series: series() })],
      }),
    ).toMatchObject({ continued: 0, started: 1 });
  });

  it("counts a series as continued when a part was completed earlier", () => {
    expect(
      resolveSeriesLifecycle({
        firstCompletionsBeforePeriod: new Map([["series-a", 1]]),
        periodReads: [read({ series: series() })],
      }),
    ).toMatchObject({ continued: 1, started: 0 });
  });

  it("counts a finished series as completed once every declared book is read", () => {
    expect(
      resolveSeriesLifecycle({
        firstCompletionsBeforePeriod: new Map([["series-a", 2]]),
        periodReads: [read({ series: series({ totalBooks: 3 }) })],
      }).completed,
    ).toBe(1);
  });

  it("counts an ongoing series as caught up once every known book is read", () => {
    expect(
      resolveSeriesLifecycle({
        firstCompletionsBeforePeriod: new Map([["series-a", 2]]),
        periodReads: [read({ series: series({ knownBooksCount: 3 }) })],
      }).caughtUp,
    ).toBe(1);
  });

  it("ignores a reread because it advances nothing", () => {
    expect(
      resolveSeriesLifecycle({
        firstCompletionsBeforePeriod: new Map(),
        periodReads: [read({ isProvenFirstCompletion: false, series: series() })],
      }),
    ).toEqual({ caughtUp: 0, completed: 0, continued: 0, started: 0 });
  });
});

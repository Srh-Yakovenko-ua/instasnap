import { describe, expect, it } from "vitest";

import type { CompletedRead } from "./completed-read.js";

import { compareByDuration, elapsedDaysOf, toDurationSamples } from "./reading-duration.js";

function read(overrides: Partial<CompletedRead>): CompletedRead {
  return {
    authors: [],
    bookId: "book-a",
    bookState: "active",
    coverThumbUrl: null,
    finishedAt: "2026-09-02",
    genres: [],
    isProvenFirstCompletion: true,
    language: null,
    pagesCount: null,
    publisher: null,
    rating: null,
    readingCycleId: "cycle-a",
    series: null,
    startedAt: "2026-09-02",
    title: "A",
    ...overrides,
  };
}

describe("elapsedDaysOf", () => {
  it("counts a same day read as one day", () => {
    expect(elapsedDaysOf(read({}))).toBe(1);
  });

  it("counts two adjacent days as two", () => {
    expect(elapsedDaysOf(read({ finishedAt: "2026-09-02", startedAt: "2026-09-01" }))).toBe(2);
  });

  it("counts across a leap day", () => {
    expect(elapsedDaysOf(read({ finishedAt: "2024-03-01", startedAt: "2024-02-28" }))).toBe(3);
  });

  it("has no duration without a start date", () => {
    expect(elapsedDaysOf(read({ startedAt: null }))).toBeNull();
  });

  it("refuses to guess when the finish came before the start", () => {
    expect(elapsedDaysOf(read({ finishedAt: "2026-09-01", startedAt: "2026-09-02" }))).toBeNull();
  });
});

describe("toDurationSamples", () => {
  it("keeps the reads whose duration is known", () => {
    const samples = toDurationSamples([read({}), read({ startedAt: null })]);
    expect(samples).toHaveLength(1);
  });
});

describe("compareByDuration", () => {
  it("breaks a tie by latest finish and then by cycle id", () => {
    const sorted = [
      { elapsedDays: 1, read: read({ readingCycleId: "cycle-b" }) },
      { elapsedDays: 1, read: read({ readingCycleId: "cycle-a" }) },
      { elapsedDays: 1, read: read({ finishedAt: "2026-09-03", readingCycleId: "cycle-z" }) },
    ].sort(compareByDuration);

    expect(sorted.map((sample) => sample.read.readingCycleId)).toEqual([
      "cycle-z",
      "cycle-a",
      "cycle-b",
    ]);
  });
});

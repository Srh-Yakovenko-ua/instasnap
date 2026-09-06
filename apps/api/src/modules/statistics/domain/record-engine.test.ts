import { describe, expect, it } from "vitest";

import type { CompletedRead } from "./completed-read.js";
import type { RecordEngineInput } from "./record-engine.js";

import { buildReadingRecords } from "./record-engine.js";

function input(overrides: Partial<RecordEngineInput> = {}): RecordEngineInput {
  return {
    activity: [],
    marathon: null,
    monthlyBuckets: [],
    periodScope: { from: "2026-01-01", to: "2026-12-31" },
    reads: [],
    streak: { days: 0, endDate: null, startDate: null },
    ...overrides,
  };
}

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
    pagesCount: 300,
    publisher: null,
    rating: null,
    readingCycleId: "cycle-a",
    series: null,
    startedAt: "2026-07-25",
    title: "A",
    ...overrides,
  };
}

describe("buildReadingRecords", () => {
  it("returns nothing when there is nothing to celebrate", () => {
    expect(buildReadingRecords(input())).toEqual([]);
  });

  it("keeps at most four records in the approved order", () => {
    const records = buildReadingRecords(
      input({
        activity: [{ booksCount: 1, date: "2026-08-01", pagesRead: 200 }],
        marathon: {
          endFinishedAt: "2026-08-10",
          length: 3,
          name: "Saga",
          seriesId: "series-a",
          startReadingCycleId: "cycle-x",
        },
        reads: [read({}), read({ pagesCount: 100, readingCycleId: "cycle-b" })],
        streak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
      }),
    );

    expect(records.map((record) => record.type)).toEqual([
      "longest_completed_book",
      "most_pages_in_day",
      "fastest_completed_read",
      "longest_series_marathon",
    ]);
  });

  it("picks the longest book by its length at completion time", () => {
    const [record] = buildReadingRecords(
      input({
        reads: [
          read({ pagesCount: 300, readingCycleId: "cycle-a" }),
          read({ pagesCount: 900, readingCycleId: "cycle-b" }),
        ],
      }),
    );

    expect(record).toMatchObject({ data: { pagesCount: 900 }, type: "longest_completed_book" });
  });

  it("breaks a length tie by latest finish and then by cycle id", () => {
    const [record] = buildReadingRecords(
      input({
        reads: [
          read({ finishedAt: "2026-08-01", readingCycleId: "cycle-b" }),
          read({ finishedAt: "2026-08-01", readingCycleId: "cycle-a" }),
        ],
      }),
    );

    expect(record?.data).toMatchObject({ readingCycleId: "cycle-a" });
  });

  it("lets a same day read win the fastest record", () => {
    const records = buildReadingRecords(
      input({
        reads: [
          read({ finishedAt: "2026-08-01", readingCycleId: "cycle-a", startedAt: "2026-07-01" }),
          read({ finishedAt: "2026-08-02", readingCycleId: "cycle-b", startedAt: "2026-08-02" }),
        ],
      }),
    );

    const fastest = records.find((record) => record.type === "fastest_completed_read");
    expect(fastest?.data).toMatchObject({ elapsedDays: 1, readingCycleId: "cycle-b" });
  });

  it("skips the peak month until there are at least two months to compare", () => {
    const records = buildReadingRecords(
      input({
        monthlyBuckets: [
          {
            completedReads: 4,
            drilldown: { date: "2026-08-01", kind: "reading_day" },
            end: "2026-08-31",
            pagesRead: 100,
            start: "2026-08-01",
            uniqueBooksCompleted: 4,
          },
        ],
      }),
    );

    expect(records.some((record) => record.type === "peak_month")).toBe(false);
  });
});

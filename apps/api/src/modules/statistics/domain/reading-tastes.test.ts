import { describe, expect, it } from "vitest";

import type { CompletedRead } from "./completed-read.js";

import {
  compareByFrequency,
  compareByRating,
  comparePublishers,
  eligiblePublisherRating,
  groupByAuthor,
  groupByGenre,
  groupByLanguage,
  groupByPublisher,
} from "./reading-tastes.js";

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

describe("groupByGenre", () => {
  it("counts a book once for each of its genres", () => {
    const buckets = groupByGenre([read({ genres: ["fantasy", "scifi"] })]);
    expect(buckets.map((bucket) => bucket.key).sort()).toEqual(["fantasy", "scifi"]);
    expect(buckets.every((bucket) => bucket.completedReadCount === 1)).toBe(true);
  });

  it("averages only the rated reads", () => {
    const buckets = groupByGenre([
      read({ genres: ["fantasy"], rating: 8 }),
      read({ genres: ["fantasy"], rating: 6, readingCycleId: "cycle-b" }),
      read({ genres: ["fantasy"], readingCycleId: "cycle-c" }),
    ]);
    expect(buckets[0]).toMatchObject({
      averageRating: 7,
      completedReadCount: 3,
      ratedReadCount: 2,
    });
  });
});

describe("groupByAuthor", () => {
  it("counts a co-authored read for both authors", () => {
    const buckets = groupByAuthor([
      read({
        authors: [
          { authorId: "author-b", name: "B" },
          { authorId: "author-a", name: "A" },
        ],
      }),
    ]);
    expect(buckets).toHaveLength(2);
  });
});

describe("groupByLanguage and groupByPublisher", () => {
  it("skips reads whose snapshot has no language", () => {
    expect(groupByLanguage([read({}), read({ language: "english" })])).toHaveLength(1);
  });

  it("skips reads whose snapshot has no publisher", () => {
    expect(
      groupByPublisher([read({}), read({ publisher: { name: "P", publisherId: "pub-a" } })]),
    ).toHaveLength(1);
  });
});

describe("comparators", () => {
  const bucket = (overrides: Partial<ReturnType<typeof groupByGenre>[number]>) => ({
    averageRating: null,
    completedReadCount: 1,
    key: "a",
    label: "A",
    latestFinishedAt: "2026-08-01",
    ratedReadCount: 0,
    ...overrides,
  });

  it("breaks a frequency tie by key", () => {
    const sorted = [bucket({ key: "z" }), bucket({ key: "a" })].sort(compareByFrequency);
    expect(sorted.map((entry) => entry.key)).toEqual(["a", "z"]);
  });

  it("breaks a rating tie by sample size and then by key", () => {
    const sorted = [
      bucket({ averageRating: 9, key: "b", ratedReadCount: 3 }),
      bucket({ averageRating: 9, key: "a", ratedReadCount: 3 }),
      bucket({ averageRating: 9, key: "c", ratedReadCount: 5 }),
    ].sort(compareByRating);
    expect(sorted.map((entry) => entry.key)).toEqual(["c", "a", "b"]);
  });

  it("puts a publisher without an eligible rating after one with a rating", () => {
    const sorted = [
      bucket({ averageRating: 9, key: "b", ratedReadCount: 1 }),
      bucket({ averageRating: 7, key: "a", ratedReadCount: 4 }),
    ].sort(comparePublishers);
    expect(sorted.map((entry) => entry.key)).toEqual(["a", "b"]);
  });

  it("hides a publisher rating built on a single read", () => {
    expect(eligiblePublisherRating(bucket({ averageRating: 10, ratedReadCount: 1 }))).toBeNull();
    expect(eligiblePublisherRating(bucket({ averageRating: 10, ratedReadCount: 2 }))).toBe(10);
  });
});

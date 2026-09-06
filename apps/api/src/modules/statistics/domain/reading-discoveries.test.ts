import { describe, expect, it } from "vitest";

import type { CompletedRead } from "./completed-read.js";

import { collectDiscoveries } from "./reading-discoveries.js";

const NO_PRIOR_EXPOSURE = {
  authorIds: new Set<string>(),
  genreKeys: new Set<string>(),
  publisherIds: new Set<string>(),
};

function read(overrides: Partial<CompletedRead>): CompletedRead {
  return {
    authors: [{ authorId: "author-a", name: "A" }],
    bookId: "book-a",
    bookState: "active",
    coverThumbUrl: null,
    finishedAt: "2026-08-01",
    genres: ["fantasy"],
    isProvenFirstCompletion: true,
    language: null,
    pagesCount: null,
    publisher: { name: "P", publisherId: "pub-a" },
    rating: null,
    readingCycleId: "cycle-a",
    series: null,
    startedAt: null,
    title: "A",
    ...overrides,
  };
}

describe("collectDiscoveries", () => {
  it("treats a proven first completion as a discovery", () => {
    const discoveries = collectDiscoveries({
      periodReads: [read({})],
      priorExposure: NO_PRIOR_EXPOSURE,
    });

    expect(discoveries.authors.map((entity) => entity.key)).toEqual(["author-a"]);
    expect(discoveries.genres.map((entity) => entity.key)).toEqual(["fantasy"]);
    expect(discoveries.publishers.map((entity) => entity.key)).toEqual(["pub-a"]);
  });

  it("does not rediscover an author met before the period", () => {
    const discoveries = collectDiscoveries({
      periodReads: [read({})],
      priorExposure: { ...NO_PRIOR_EXPOSURE, authorIds: new Set(["author-a"]) },
    });

    expect(discoveries.authors).toEqual([]);
  });

  it("refuses to call a reread a discovery", () => {
    const discoveries = collectDiscoveries({
      periodReads: [read({ isProvenFirstCompletion: false })],
      priorExposure: NO_PRIOR_EXPOSURE,
    });

    expect(discoveries.authors).toEqual([]);
    expect(discoveries.provenFirstCompletionCount).toBe(0);
  });

  it("counts how much of the period is reliable enough to classify", () => {
    const discoveries = collectDiscoveries({
      periodReads: [
        read({ bookId: "book-a" }),
        read({ bookId: "book-b", isProvenFirstCompletion: false, readingCycleId: "cycle-b" }),
      ],
      priorExposure: NO_PRIOR_EXPOSURE,
    });

    expect(discoveries).toMatchObject({
      provenFirstCompletionCount: 1,
      uniqueFirstCompletionCandidates: 2,
    });
  });

  it("dates the discovery from the earliest proven first completion", () => {
    const discoveries = collectDiscoveries({
      periodReads: [
        read({ finishedAt: "2026-08-10", readingCycleId: "cycle-b" }),
        read({ finishedAt: "2026-03-05", readingCycleId: "cycle-a" }),
      ],
      priorExposure: NO_PRIOR_EXPOSURE,
    });

    expect(discoveries.authors[0]).toMatchObject({
      completedReadsAfterDiscovery: 2,
      firstFinishedAt: "2026-03-05",
    });
  });
});

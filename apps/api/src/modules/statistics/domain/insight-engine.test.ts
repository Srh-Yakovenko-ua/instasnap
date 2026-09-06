import { describe, expect, it } from "vitest";

import type { InsightEngineInput } from "./insight-engine.js";

import { buildInsightPool } from "./insight-engine.js";

function input(overrides: Partial<InsightEngineInput> = {}): InsightEngineInput {
  return {
    comparison: null,
    current: { completedReads: 0, pagesRead: 0 },
    discoveredAuthors: [],
    longestStreak: { days: 0, endDate: null, startDate: null },
    marathon: null,
    mostActiveWeekday: null,
    ratings: { averageRating: null, highRatedReadsCount: 0, ratedReadsCount: 0 },
    topAuthor: null,
    topGenre: null,
    topLanguage: null,
    ...overrides,
  };
}

describe("buildInsightPool", () => {
  it("returns nothing when no candidate clears its sample rule", () => {
    expect(buildInsightPool(input())).toEqual({ featuredInsight: null, items: [] });
  });

  it("features the reading comparison over everything else", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
        longestStreak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
      }),
    );

    expect(pool.featuredInsight?.code).toBe("completed_reads_vs_comparison");
  });

  it("keeps the featured candidate out of the regular cards", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
        longestStreak: { days: 5, endDate: "2026-08-05", startDate: "2026-08-01" },
        topGenre: { completedReadCount: 6, genreKey: "fantasy", share: 0.6 },
      }),
    );

    expect(pool.items.map((insight) => insight.code)).not.toContain(pool.featuredInsight?.code);
  });

  it("shows one insight per category so two reading insights cannot both appear", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 4, pagesRead: 100 },
        current: { completedReads: 10, pagesRead: 400 },
      }),
    );

    const categories = [pool.featuredInsight, ...pool.items].map((insight) => insight?.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("marks a drop as negative without judging it", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 10, pagesRead: 100 },
        current: { completedReads: 4, pagesRead: 100 },
      }),
    );

    expect(pool.featuredInsight?.tone).toBe("negative");
  });

  it("leaves the percentage unknown when the comparison period was empty", () => {
    const pool = buildInsightPool(
      input({
        comparison: { completedReads: 0, pagesRead: 0 },
        current: { completedReads: 5, pagesRead: 0 },
      }),
    );

    expect(pool.featuredInsight).toMatchObject({
      code: "completed_reads_vs_comparison",
      params: { percentDelta: null },
    });
  });

  it("skips the weekday insight until three active days back it", () => {
    const pool = buildInsightPool(
      input({ mostActiveWeekday: { activeDays: 2, pagesRead: 120, weekday: 1 } }),
    );

    expect(pool.featuredInsight).toBeNull();
  });

  it("produces the same order for the same input", () => {
    const source = input({
      comparison: { completedReads: 4, pagesRead: 100 },
      current: { completedReads: 10, pagesRead: 400 },
      mostActiveWeekday: { activeDays: 5, pagesRead: 120, weekday: 1 },
      topGenre: { completedReadCount: 6, genreKey: "fantasy", share: 0.6 },
    });

    expect(buildInsightPool(source)).toEqual(buildInsightPool(source));
  });
});

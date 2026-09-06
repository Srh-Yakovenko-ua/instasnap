import { describe, expect, it } from "vitest";

import {
  buildStatisticsDrilldownTarget,
  toContextActionLink,
  toContextActionLinks,
} from "./statistics-drilldown";
import { statisticsIds } from "./statistics.fixtures";

describe("buildStatisticsDrilldownTarget", () => {
  it("resolves a reading day to its own date", () => {
    const target = buildStatisticsDrilldownTarget({ date: "2026-03-02", kind: "reading_day" });

    expect(target).toEqual({ date: "2026-03-02", kind: "reading_day" });
  });

  it("resolves a reading cycle to that exact cycle", () => {
    const target = buildStatisticsDrilldownTarget({
      bookId: statisticsIds.bookId,
      kind: "reading_cycle",
      readingCycleId: statisticsIds.cycleId,
    });

    expect(target).toEqual({ kind: "reading_cycle", readingCycleId: statisticsIds.cycleId });
  });

  it("fails closed for a completed-reads subset instead of approximating it", () => {
    const target = buildStatisticsDrilldownTarget({
      filters: { authorId: statisticsIds.authorId },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    });

    expect(target).toEqual({
      kind: "unsupported",
      reason: "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION",
    });
  });
});

describe("toContextActionLink", () => {
  it("uses entity ids rather than a fuzzy search", () => {
    expect(toContextActionLink({ authorId: statisticsIds.authorId, kind: "open_author" })).toEqual({
      href: `/books?author=${statisticsIds.authorId}`,
      kind: "open_author",
    });
    expect(
      toContextActionLink({ kind: "open_publisher", publisherId: statisticsIds.publisherId }),
    ).toEqual({ href: `/publishers/${statisticsIds.publisherId}`, kind: "open_publisher" });
    expect(toContextActionLink({ kind: "open_series", seriesId: statisticsIds.seriesId })).toEqual({
      href: `/series/${statisticsIds.seriesId}`,
      kind: "open_series",
    });
    expect(toContextActionLink({ bookId: statisticsIds.bookId, kind: "open_book" })).toEqual({
      href: `/books/${statisticsIds.bookId}`,
      kind: "open_book",
    });
    expect(toContextActionLink({ goalId: statisticsIds.goalId, kind: "open_goal" })).toEqual({
      href: `/goals/${statisticsIds.goalId}`,
      kind: "open_goal",
    });
  });

  it("keeps the backend order of context actions", () => {
    const links = toContextActionLinks([
      { kind: "open_series", seriesId: statisticsIds.seriesId },
      { authorId: statisticsIds.authorId, kind: "open_author" },
      { bookId: statisticsIds.bookId, kind: "open_book" },
    ]);

    expect(links.map((link) => link.kind)).toEqual(["open_series", "open_author", "open_book"]);
  });
});

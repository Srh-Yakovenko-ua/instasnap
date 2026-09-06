import type {
  Nullable,
  ReadingStatisticsContextAction,
  ReadingStatisticsDrilldown,
} from "@app/shared";

export type StatisticsContextActionLink = {
  href: string;
  kind: ReadingStatisticsContextAction["kind"];
};

export type StatisticsDrilldownTarget =
  | { date: string; kind: "reading_day" }
  | { kind: "reading_cycle"; readingCycleId: string }
  | { kind: "unsupported"; reason: StatisticsUnsupportedReason };

export type StatisticsUnsupportedReason = "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION";

export function buildStatisticsDrilldownTarget(
  drilldown: ReadingStatisticsDrilldown,
): StatisticsDrilldownTarget {
  switch (drilldown.kind) {
    case "completed_reads_subset":
      return { kind: "unsupported", reason: "COMPLETED_READS_SUBSET_HAS_NO_EXACT_DESTINATION" };
    case "reading_cycle":
      return { kind: "reading_cycle", readingCycleId: drilldown.readingCycleId };
    case "reading_day":
      return { date: drilldown.date, kind: "reading_day" };
  }
}

export function resolveReadingDayTarget(drilldown: ReadingStatisticsDrilldown): Nullable<string> {
  const target = buildStatisticsDrilldownTarget(drilldown);
  return target.kind === "reading_day" ? target.date : null;
}

export function toContextActionLink(
  action: ReadingStatisticsContextAction,
): StatisticsContextActionLink {
  switch (action.kind) {
    case "open_author":
      return { href: `/books?author=${action.authorId}`, kind: action.kind };
    case "open_book":
      return { href: `/books/${action.bookId}`, kind: action.kind };
    case "open_goal":
      return { href: `/goals/${action.goalId}`, kind: action.kind };
    case "open_publisher":
      return { href: `/publishers/${action.publisherId}`, kind: action.kind };
    case "open_series":
      return { href: `/series/${action.seriesId}`, kind: action.kind };
  }
}

export function toContextActionLinks(
  actions: readonly ReadingStatisticsContextAction[],
): StatisticsContextActionLink[] {
  return actions.map(toContextActionLink);
}

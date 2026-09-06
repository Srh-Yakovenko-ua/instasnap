import type {
  CompletedReadsFilter,
  Nullable,
  ReadingStatisticsContextAction,
  ReadingStatisticsDrilldown,
} from "@app/shared";

export type StatisticsPeriodScope = { from: Nullable<string>; to: string };

export function toBookContextActions({
  bookId,
  bookState,
}: {
  bookId: string;
  bookState: "active" | "soft_deleted";
}): ReadingStatisticsContextAction[] {
  return bookState === "active" ? [{ bookId, kind: "open_book" }] : [];
}

export function toCompletedReadsDrilldown({
  filters,
  period,
}: {
  filters: CompletedReadsFilter;
  period: StatisticsPeriodScope;
}): ReadingStatisticsDrilldown {
  return { filters, kind: "completed_reads_subset", period };
}

export function toReadingCycleDrilldown({
  bookId,
  readingCycleId,
}: {
  bookId: string;
  readingCycleId: string;
}): ReadingStatisticsDrilldown {
  return { bookId, kind: "reading_cycle", readingCycleId };
}

export function toReadingDayDrilldown(date: string): ReadingStatisticsDrilldown {
  return { date, kind: "reading_day" };
}

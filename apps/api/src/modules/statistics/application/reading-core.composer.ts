import type {
  CompletedReadRef,
  Nullable,
  ReadingStatisticsBucket,
  ReadingStatisticsDynamicsSection,
  ReadingStatisticsGranularity,
  ReadingStatisticsKpis,
  WeekStartDay,
} from "@app/shared";

import { HERO_RECENT_READS_LIMIT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CompletedRead } from "../domain/completed-read.js";
import type { StatisticsPeriodScope } from "../domain/statistics-drilldown.js";
import type { DayActivityRow } from "../infrastructure/statistics-activity.repository.js";
import type { CompletionTotals } from "../infrastructure/statistics-completion.repository.js";

import { compareByFinishedAtDesc, countUniqueBooks, toBookRef } from "../domain/completed-read.js";
import { summarizeRatings } from "../domain/reading-ratings.js";
import { resolveCoverageAvailability, toCoverage } from "../domain/statistics-availability.js";
import { buildStatisticsBuckets } from "../domain/statistics-buckets.js";
import {
  toNumericComparison,
  toRateComparison,
  toScoreComparison,
} from "../domain/statistics-delta.js";
import {
  toBookContextActions,
  toCompletedReadsDrilldown,
  toReadingCycleDrilldown,
} from "../domain/statistics-drilldown.js";

export type ComparisonInputs = {
  activeDays: number;
  activeDaysRate: number;
  averageRating: Nullable<number>;
  pagesRead: number;
  totals: CompletionTotals;
};

export type DynamicsInput = {
  activity: DayActivityRow[];
  comparison: Nullable<{
    activity: DayActivityRow[];
    range: { from: string; to: string };
    reads: CompletedRead[];
  }>;
  granularity: ReadingStatisticsGranularity;
  period: { from: Nullable<string>; to: string };
  reads: CompletedRead[];
  weekStartDay: WeekStartDay;
};

export type KpiInput = {
  activeDays: number;
  activeDaysRate: number;
  comparison: Nullable<ComparisonInputs>;
  pagesRead: number;
  pagesReadReliable: boolean;
  reads: CompletedRead[];
};

@Injectable()
export class ReadingCoreComposer {
  buildDynamics(input: DynamicsInput): ReadingStatisticsDynamicsSection {
    const periodScope: StatisticsPeriodScope = input.period;
    const buckets = this.toBuckets({
      activity: input.activity,
      granularity: input.granularity,
      periodScope,
      range: {
        from:
          input.period.from ??
          earliestDate({ activity: input.activity, reads: input.reads }) ??
          input.period.to,
        to: input.period.to,
      },
      reads: input.reads,
      weekStartDay: input.weekStartDay,
    });

    return {
      buckets,
      comparisonBuckets:
        input.comparison === null
          ? null
          : this.toBuckets({
              activity: input.comparison.activity,
              granularity: input.granularity,
              periodScope: input.comparison.range,
              range: input.comparison.range,
              reads: input.comparison.reads,
              weekStartDay: input.weekStartDay,
            }),
      peakCompletedReads: peakBy(buckets, (bucket) => bucket.completedReads),
      peakPagesRead: peakBy(buckets, (bucket) => bucket.pagesRead),
    };
  }

  buildKpis(input: KpiInput): ReadingStatisticsKpis {
    const { comparison, reads } = input;
    const ratings = summarizeRatings(reads);
    const coverage = toCoverage({
      eligibleCount: reads.length,
      knownCount: ratings.ratedReads.length,
    });
    const uniqueBooks = countUniqueBooks(reads);

    return {
      activeDays: {
        countComparison:
          comparison === null
            ? null
            : toNumericComparison({ current: input.activeDays, previous: comparison.activeDays }),
        rate: input.activeDaysRate,
        rateComparison:
          comparison === null
            ? null
            : toRateComparison({
                currentRate: input.activeDaysRate,
                previousRate: comparison.activeDaysRate,
              }),
        value: input.activeDays,
      },
      averageRating: {
        availability:
          ratings.ratedReads.length === 0 ? "unavailable" : resolveCoverageAvailability(coverage),
        comparison:
          comparison === null
            ? null
            : toScoreComparison({
                current: ratings.averageRating,
                previous: comparison.averageRating,
              }),
        coverage,
        reason: ratings.ratedReads.length === 0 ? "NO_RATINGS" : undefined,
        value: ratings.averageRating,
      },
      completedReads: {
        comparison:
          comparison === null
            ? null
            : toNumericComparison({
                current: reads.length,
                previous: comparison.totals.completedReads,
              }),
        value: reads.length,
      },
      pagesRead: {
        availability: input.pagesReadReliable ? "available" : "partial",
        comparison:
          comparison === null
            ? null
            : toNumericComparison({ current: input.pagesRead, previous: comparison.pagesRead }),
        value: input.pagesRead,
      },
      uniqueBooksCompleted: {
        comparison:
          comparison === null
            ? null
            : toNumericComparison({
                current: uniqueBooks,
                previous: comparison.totals.uniqueBooks,
              }),
        value: uniqueBooks,
      },
    };
  }

  buildRecentCompletedReads(reads: CompletedRead[]): CompletedReadRef[] {
    return [...reads]
      .sort(compareByFinishedAtDesc)
      .slice(0, HERO_RECENT_READS_LIMIT)
      .map((read) => ({
        authorName: read.authors[0]?.name ?? null,
        book: toBookRef(read),
        contextActions: toBookContextActions(read),
        drilldown: toReadingCycleDrilldown(read),
        finishedAt: read.finishedAt,
        rating: read.rating,
        readingCycleId: read.readingCycleId,
      }));
  }

  private toBuckets({
    activity,
    granularity,
    periodScope,
    range,
    reads,
    weekStartDay,
  }: {
    activity: DayActivityRow[];
    granularity: ReadingStatisticsGranularity;
    periodScope: StatisticsPeriodScope;
    range: { from: string; to: string };
    reads: CompletedRead[];
    weekStartDay: WeekStartDay;
  }): ReadingStatisticsBucket[] {
    const ranges = buildStatisticsBuckets({
      from: range.from,
      granularity,
      to: range.to,
      weekStartDay,
    });

    return ranges.map((bucket) => {
      const bucketReads = reads.filter(
        (read) => read.finishedAt >= bucket.start && read.finishedAt <= bucket.end,
      );
      const pagesRead = activity
        .filter((day) => day.date >= bucket.start && day.date <= bucket.end)
        .reduce((sum, day) => sum + day.pagesRead, 0);

      return {
        completedReads: bucketReads.length,
        drilldown: toCompletedReadsDrilldown({
          filters: { finishedFrom: bucket.start, finishedTo: bucket.end },
          period: periodScope,
        }),
        end: bucket.end,
        pagesRead,
        start: bucket.start,
        uniqueBooksCompleted: countUniqueBooks(bucketReads),
      };
    });
  }
}

function earliestDate({
  activity,
  reads,
}: {
  activity: DayActivityRow[];
  reads: CompletedRead[];
}): Nullable<string> {
  const dates = [...activity.map((day) => day.date), ...reads.map((read) => read.finishedAt)];
  return [...dates].sort()[0] ?? null;
}

function peakBy(
  buckets: ReadingStatisticsBucket[],
  value: (bucket: ReadingStatisticsBucket) => number,
): Nullable<ReadingStatisticsBucket> {
  const ranked = [...buckets]
    .filter((bucket) => value(bucket) > 0)
    .sort((left, right) => {
      const delta = value(right) - value(left);
      return delta === 0 ? left.start.localeCompare(right.start) : delta;
    });
  return ranked[0] ?? null;
}

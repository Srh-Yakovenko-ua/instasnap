import { z } from "zod";

import { CountSchema, isoDay, ratingBound } from "./internal.js";
import { ReadingGoalMetricsSchema, ReadingGoalStatusSchema } from "./reading-goals.js";
import { StatisticsStreakSpanSchema } from "./reading-statistics-calendar.js";
import {
  NumericMetricComparisonSchema,
  RateMetricComparisonSchema,
  ReadingStatisticsContextActionSchema,
  ReadingStatisticsDrilldownSchema,
  ScoreMetricComparisonSchema,
  StatisticsAvailabilitySchema,
  StatisticsBookRefSchema,
  StatisticsCoverageSchema,
} from "./reading-statistics-common.js";
import { ReadingStatisticsInsightSchema } from "./reading-statistics-insights.js";
import {
  CompletedReadRefSchema,
  RatingUnavailableReasonSchema,
} from "./reading-statistics-tastes.js";

export const HERO_RECENT_READS_LIMIT = 4;

export const INSIGHT_CARDS_LIMIT = 4;

export const RECORDS_LIMIT = 4;

export const ReadingStatisticsMetaSchema = z
  .object({
    activityHistory: z.object({
      reason: z.literal("LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED").optional(),
      reliableFrom: isoDay(),
      selectedPeriodQuality: z.enum(["exact", "legacy_lower_bound"]),
    }),
    generatedAt: z.iso.datetime(),
    timezone: z.string(),
    weekStartDay: z.enum(["monday", "sunday"]),
  })
  .describe(
    "Context the whole response was built with. reliableFrom is the first day from which the activity ledger is known to be complete; anything before it is observed history rather than a full record.",
  );

export type ReadingStatisticsMeta = z.infer<typeof ReadingStatisticsMetaSchema>;

export const ReadingStatisticsHeroSectionSchema = z.object({
  featuredInsight: ReadingStatisticsInsightSchema.nullable(),
  recentCompletedReads: z.array(CompletedReadRefSchema).max(HERO_RECENT_READS_LIMIT),
});

export type ReadingStatisticsHeroSection = z.infer<typeof ReadingStatisticsHeroSectionSchema>;

export const ReadingStatisticsKpisSchema = z.object({
  activeDays: z.object({
    countComparison: NumericMetricComparisonSchema.nullable(),
    rate: z.number().min(0).max(1),
    rateComparison: RateMetricComparisonSchema.nullable(),
    value: CountSchema,
  }),
  averageRating: z.object({
    availability: StatisticsAvailabilitySchema,
    comparison: ScoreMetricComparisonSchema.nullable(),
    coverage: StatisticsCoverageSchema.optional(),
    reason: RatingUnavailableReasonSchema.optional(),
    value: z.number().nullable(),
  }),
  completedReads: z.object({
    comparison: NumericMetricComparisonSchema.nullable(),
    value: CountSchema,
  }),
  pagesRead: z.object({
    availability: StatisticsAvailabilitySchema,
    comparison: NumericMetricComparisonSchema.nullable(),
    value: z.number().nonnegative().nullable(),
  }),
  uniqueBooksCompleted: z.object({
    comparison: NumericMetricComparisonSchema.nullable(),
    value: CountSchema,
  }),
});

export type ReadingStatisticsKpis = z.infer<typeof ReadingStatisticsKpisSchema>;

export const ReadingStatisticsInsightsSectionSchema = z.object({
  items: z.array(ReadingStatisticsInsightSchema).max(INSIGHT_CARDS_LIMIT),
});

export type ReadingStatisticsInsightsSection = z.infer<
  typeof ReadingStatisticsInsightsSectionSchema
>;

export const ReadingStatisticsBucketSchema = z.object({
  completedReads: CountSchema,
  drilldown: ReadingStatisticsDrilldownSchema,
  end: isoDay(),
  pagesRead: CountSchema,
  start: isoDay(),
  uniqueBooksCompleted: CountSchema,
});

export type ReadingStatisticsBucket = z.infer<typeof ReadingStatisticsBucketSchema>;

export const ReadingStatisticsDynamicsSectionSchema = z
  .object({
    buckets: z.array(ReadingStatisticsBucketSchema),
    comparisonBuckets: z.array(ReadingStatisticsBucketSchema).nullable(),
    peakCompletedReads: ReadingStatisticsBucketSchema.nullable(),
    peakPagesRead: ReadingStatisticsBucketSchema.nullable(),
  })
  .describe(
    "The period split into buckets whose width comes from the period length. Buckets at the edges may be partial because they are clipped to the period.",
  );

export type ReadingStatisticsDynamicsSection = z.infer<
  typeof ReadingStatisticsDynamicsSectionSchema
>;

export const ReadingStatisticsGoalSectionSchema = z
  .object({
    activeGoalsCount: CountSchema,
    primaryGoal: z
      .object({
        contextActions: z.array(ReadingStatisticsContextActionSchema),
        deadline: isoDay(),
        goalId: z.uuid(),
        listName: z.string().nullable(),
        metrics: ReadingGoalMetricsSchema,
        name: z.string().nullable(),
        status: ReadingGoalStatusSchema,
        targetCount: z.number().int().positive(),
      })
      .nullable(),
  })
  .describe(
    "The active goal worth showing first, chosen by nearest deadline. Every number in metrics comes from the reading-goals feature unchanged; statistics only picks which goal to show.",
  );

export type ReadingStatisticsGoalSection = z.infer<typeof ReadingStatisticsGoalSectionSchema>;

export const ReadingStatisticsSeriesSectionSchema = z
  .object({
    availability: StatisticsAvailabilitySchema,
    completedReadsCount: CountSchema,
    lifecycle: z.object({
      availability: StatisticsAvailabilitySchema,
      data: z
        .object({
          caughtUp: CountSchema,
          completed: CountSchema,
          continued: CountSchema,
          started: CountSchema,
        })
        .nullable(),
      reason: z.literal("LEGACY_HISTORY_INCOMPLETE").optional(),
    }),
    marathon: z.object({
      availability: StatisticsAvailabilitySchema,
      data: z
        .object({
          endFinishedAt: isoDay(),
          length: CountSchema,
          name: z.string(),
          seriesId: z.uuid(),
        })
        .nullable(),
      reason: z.literal("INSUFFICIENT_SAMPLE").optional(),
    }),
    mostActive: z.array(
      z.object({
        attributablePagesRead: CountSchema,
        completedReadCycles: CountSchema,
        contextActions: z.array(ReadingStatisticsContextActionSchema),
        drilldown: ReadingStatisticsDrilldownSchema,
        latestFinishedAt: isoDay(),
        name: z.string(),
        seriesId: z.uuid(),
      }),
    ),
    seriesCompletedReadsCount: CountSchema,
    seriesShare: z.number().min(0).max(1).nullable(),
    topProgress: z.array(
      z.object({
        distinctFirstCompletions: CountSchema,
        name: z.string(),
        seriesId: z.uuid(),
      }),
    ),
  })
  .describe(
    "Series activity in the period. mostActive counts read-throughs, so a reread of one part counts again; topProgress and lifecycle count distinct books moving forward for the first time, so a reread never advances them twice.",
  );

export type ReadingStatisticsSeriesSection = z.infer<typeof ReadingStatisticsSeriesSectionSchema>;

export const ReadingStatisticsLibraryBalanceSectionSchema = z
  .object({
    currentOwnedTotal: CountSchema,
    currentTbrCount: CountSchema,
    flow: z.object({
      availability: StatisticsAvailabilitySchema,
      data: z
        .object({ inflow: CountSchema, netChange: z.number().int(), outflow: CountSchema })
        .nullable(),
      reason: z.literal("HISTORY_NOT_TRACKED").optional(),
    }),
    forecast: z.object({
      availability: StatisticsAvailabilitySchema,
      data: z
        .object({ monthsRemaining: z.number().nonnegative(), readsPerMonth: z.number().positive() })
        .nullable(),
      reason: z
        .enum(["INSUFFICIENT_SAMPLE", "LOW_CONFIDENCE", "LEGACY_HISTORY_INCOMPLETE"])
        .optional(),
    }),
    readRatio: z.number().min(0).max(1).nullable(),
  })
  .describe(
    "The current shape of the library. Counts describe books that are in the library right now, so a book moved to trash leaves these numbers while its past reads stay in the history sections.",
  );

export type ReadingStatisticsLibraryBalanceSection = z.infer<
  typeof ReadingStatisticsLibraryBalanceSectionSchema
>;

const record = <TType extends string, TData extends z.ZodType>(type: TType, data: TData) =>
  z.object({ data, type: z.literal(type) });

export const ReadingStatisticsRecordSchema = z.discriminatedUnion("type", [
  record(
    "longest_completed_book",
    z.object({
      book: StatisticsBookRefSchema,
      drilldown: ReadingStatisticsDrilldownSchema,
      finishedAt: isoDay(),
      pagesCount: CountSchema,
      readingCycleId: z.uuid(),
    }),
  ),
  record(
    "shortest_completed_book",
    z.object({
      book: StatisticsBookRefSchema,
      drilldown: ReadingStatisticsDrilldownSchema,
      finishedAt: isoDay(),
      pagesCount: CountSchema,
      readingCycleId: z.uuid(),
    }),
  ),
  record(
    "most_pages_in_day",
    z.object({
      date: isoDay(),
      drilldown: ReadingStatisticsDrilldownSchema,
      pagesRead: CountSchema,
    }),
  ),
  record(
    "fastest_completed_read",
    z.object({
      book: StatisticsBookRefSchema,
      drilldown: ReadingStatisticsDrilldownSchema,
      elapsedDays: z.number().int().positive(),
      finishedAt: isoDay(),
      readingCycleId: z.uuid(),
    }),
  ),
  record(
    "longest_series_marathon",
    z.object({
      endFinishedAt: isoDay(),
      length: CountSchema,
      name: z.string(),
      seriesId: z.uuid(),
    }),
  ),
  record("longest_streak", StatisticsStreakSpanSchema),
  record(
    "peak_month",
    z.object({ completedReads: CountSchema, month: z.string(), pagesRead: CountSchema }),
  ),
]);

export type ReadingStatisticsRecord = z.infer<typeof ReadingStatisticsRecordSchema>;

export const ReadingStatisticsRecordsSectionSchema = z.object({
  items: z.array(ReadingStatisticsRecordSchema).max(RECORDS_LIMIT),
});

export type ReadingStatisticsRecordsSection = z.infer<typeof ReadingStatisticsRecordsSectionSchema>;

export const CompletedReadDetailItemSchema = CompletedReadRefSchema.extend({
  genres: z.array(z.string()),
  language: z.string().nullable(),
  pagesCount: CountSchema.nullable(),
  publisherName: z.string().nullable(),
  seriesName: z.string().nullable(),
});

export type CompletedReadDetailItem = z.infer<typeof CompletedReadDetailItemSchema>;

export const ReadingStatisticsRatingBucketSchema = z.object({
  completedReadCount: CountSchema,
  rating: ratingBound(),
});

export type ReadingStatisticsRatingBucket = z.infer<typeof ReadingStatisticsRatingBucketSchema>;

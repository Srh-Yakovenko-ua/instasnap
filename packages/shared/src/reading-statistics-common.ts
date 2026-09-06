import { z } from "zod";

import { BookLanguageSchema } from "./book-enums.js";
import { CountSchema, isoDay, ratingBound } from "./internal.js";

export const StatisticsAvailabilitySchema = z.enum(["available", "partial", "unavailable"]);

export type StatisticsAvailability = z.infer<typeof StatisticsAvailabilitySchema>;

export const StatisticsCoverageSchema = z
  .object({
    eligibleCount: CountSchema,
    knownCount: CountSchema,
    percent: z.number().min(0).max(1).nullable(),
  })
  .describe(
    "How much of the eligible population the metric could actually see. percent is null only when nothing was eligible, so an empty period stays distinguishable from a metric that saw part of its population.",
  );

export type StatisticsCoverage = z.infer<typeof StatisticsCoverageSchema>;

export const ReadingStatisticsPeriodKindSchema = z.enum([
  "year",
  "last_12_months",
  "custom",
  "all_time",
]);

export type ReadingStatisticsPeriodKind = z.infer<typeof ReadingStatisticsPeriodKindSchema>;

export const ReadingStatisticsGranularitySchema = z.enum(["day", "week", "month", "year"]);

export type ReadingStatisticsGranularity = z.infer<typeof ReadingStatisticsGranularitySchema>;

export const ReadingStatisticsCompareModeSchema = z.enum([
  "previous_period",
  "same_period_last_year",
]);

export type ReadingStatisticsCompareMode = z.infer<typeof ReadingStatisticsCompareModeSchema>;

export const ReadingStatisticsPeriodSchema = z
  .object({
    from: isoDay().nullable(),
    granularity: ReadingStatisticsGranularitySchema,
    kind: ReadingStatisticsPeriodKindSchema,
    to: isoDay(),
  })
  .describe(
    "The period the backend actually used, after normalization. from is null only for all time, which has no lower bound; to is always a real day because reading statistics never look into the future.",
  );

export type ReadingStatisticsPeriod = z.infer<typeof ReadingStatisticsPeriodSchema>;

export const ReadingStatisticsComparisonSchema = z.object({
  from: isoDay(),
  mode: ReadingStatisticsCompareModeSchema,
  to: isoDay(),
});

export type ReadingStatisticsComparison = z.infer<typeof ReadingStatisticsComparisonSchema>;

export const ReadingStatisticsDateRangeSchema = z.object({ from: isoDay(), to: isoDay() });

export type ReadingStatisticsDateRange = z.infer<typeof ReadingStatisticsDateRangeSchema>;

export const NumericMetricComparisonSchema = z
  .object({
    absoluteDelta: z.number(),
    percentDelta: z.number().nullable(),
    previous: z.number(),
  })
  .describe(
    "The same metric one period earlier. percentDelta is null when the previous value was zero, because growth from nothing has no percentage.",
  );

export type NumericMetricComparison = z.infer<typeof NumericMetricComparisonSchema>;

export const ScoreMetricComparisonSchema = z
  .object({ absoluteDelta: z.number(), previous: z.number() })
  .describe(
    "Comparison for a bounded score such as an average rating, where an absolute change reads honestly and a relative percentage does not.",
  );

export type ScoreMetricComparison = z.infer<typeof ScoreMetricComparisonSchema>;

export const RateMetricComparisonSchema = z
  .object({ percentagePointDelta: z.number(), previousRate: z.number().min(0).max(1) })
  .describe("Comparison for a ratio, expressed in percentage points rather than relative percent.");

export type RateMetricComparison = z.infer<typeof RateMetricComparisonSchema>;

export const StatisticsBookStateSchema = z.enum(["active", "soft_deleted"]);

export type StatisticsBookState = z.infer<typeof StatisticsBookStateSchema>;

export const StatisticsBookRefSchema = z
  .object({
    bookId: z.uuid(),
    bookState: StatisticsBookStateSchema,
    coverThumbUrl: z.string().nullable(),
    title: z.string(),
  })
  .describe(
    "A historical book reference. bookState says whether the book still exists in the library, so a completed read stays visible after the book is moved to trash.",
  );

export type StatisticsBookRef = z.infer<typeof StatisticsBookRefSchema>;

export const CompletedReadsFilterSchema = z.object({
  authorId: z.uuid().optional(),
  finishedFrom: isoDay().optional(),
  finishedTo: isoDay().optional(),
  genre: z.string().optional(),
  language: BookLanguageSchema.optional(),
  publisherId: z.uuid().optional(),
  ratingMax: ratingBound().optional(),
  ratingMin: ratingBound().optional(),
  seriesId: z.uuid().optional(),
});

export type CompletedReadsFilter = z.infer<typeof CompletedReadsFilterSchema>;

export const ReadingStatisticsDrilldownSchema = z
  .discriminatedUnion("kind", [
    z.object({
      bookId: z.uuid(),
      kind: z.literal("reading_cycle"),
      readingCycleId: z.uuid(),
    }),
    z.object({ date: isoDay(), kind: z.literal("reading_day") }),
    z.object({
      filters: CompletedReadsFilterSchema,
      kind: z.literal("completed_reads_subset"),
      period: z.object({ from: isoDay().nullable(), to: isoDay() }),
    }),
  ])
  .describe(
    "Where a click on this number leads. It always reproduces the exact set the number was computed from, never a broader related list.",
  );

export type ReadingStatisticsDrilldown = z.infer<typeof ReadingStatisticsDrilldownSchema>;

export const ReadingStatisticsContextActionSchema = z
  .discriminatedUnion("kind", [
    z.object({ authorId: z.uuid(), kind: z.literal("open_author") }),
    z.object({ bookId: z.uuid(), kind: z.literal("open_book") }),
    z.object({ goalId: z.uuid(), kind: z.literal("open_goal") }),
    z.object({ kind: z.literal("open_publisher"), publisherId: z.uuid() }),
    z.object({ kind: z.literal("open_series"), seriesId: z.uuid() }),
  ])
  .describe(
    "Related navigation offered next to the metric. It is deliberately separate from the drill-down because it does not reproduce the same set.",
  );

export type ReadingStatisticsContextAction = z.infer<typeof ReadingStatisticsContextActionSchema>;

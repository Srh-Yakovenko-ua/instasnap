import { z } from "zod";

import { isoDay } from "./internal.js";
import { ReadingStatisticsCalendarSectionSchema } from "./reading-statistics-calendar.js";
import {
  ReadingStatisticsCompareModeSchema,
  ReadingStatisticsComparisonSchema,
  ReadingStatisticsPeriodKindSchema,
  ReadingStatisticsPeriodSchema,
} from "./reading-statistics-common.js";
import {
  ReadingStatisticsDynamicsSectionSchema,
  ReadingStatisticsGoalSectionSchema,
  ReadingStatisticsHeroSectionSchema,
  ReadingStatisticsInsightsSectionSchema,
  ReadingStatisticsKpisSchema,
  ReadingStatisticsLibraryBalanceSectionSchema,
  ReadingStatisticsMetaSchema,
  ReadingStatisticsRecordsSectionSchema,
  ReadingStatisticsSeriesSectionSchema,
} from "./reading-statistics-sections.js";
import {
  ReadingStatisticsAuthorsSectionSchema,
  ReadingStatisticsDiscoveriesSectionSchema,
  ReadingStatisticsGenresSectionSchema,
  ReadingStatisticsLanguagesSectionSchema,
  ReadingStatisticsPublishersSectionSchema,
  ReadingStatisticsRatingsSectionSchema,
} from "./reading-statistics-tastes.js";

export const ReadingStatisticsOverviewQuerySchema = z
  .object({
    compare: ReadingStatisticsCompareModeSchema.optional(),
    from: isoDay().optional(),
    period: ReadingStatisticsPeriodKindSchema.default("year"),
    to: isoDay().optional(),
    year: z.coerce.number().int().min(1000).max(9999).optional(),
  })
  .describe(
    "What to look at. A custom period needs both from and to; a year period needs year; last 12 months and all time need neither. All time cannot be compared with anything.",
  );

export type ReadingStatisticsOverviewQuery = z.infer<typeof ReadingStatisticsOverviewQuerySchema>;

export const ReadingStatisticsOverviewSchema = z.object({
  authors: ReadingStatisticsAuthorsSectionSchema,
  calendar: ReadingStatisticsCalendarSectionSchema,
  comparison: ReadingStatisticsComparisonSchema.nullable(),
  discoveries: ReadingStatisticsDiscoveriesSectionSchema,
  dynamics: ReadingStatisticsDynamicsSectionSchema,
  genres: ReadingStatisticsGenresSectionSchema,
  goal: ReadingStatisticsGoalSectionSchema,
  hero: ReadingStatisticsHeroSectionSchema,
  insights: ReadingStatisticsInsightsSectionSchema,
  kpis: ReadingStatisticsKpisSchema,
  languages: ReadingStatisticsLanguagesSectionSchema,
  libraryBalance: ReadingStatisticsLibraryBalanceSectionSchema,
  meta: ReadingStatisticsMetaSchema,
  period: ReadingStatisticsPeriodSchema,
  publishers: ReadingStatisticsPublishersSectionSchema,
  ratings: ReadingStatisticsRatingsSectionSchema,
  records: ReadingStatisticsRecordsSectionSchema,
  series: ReadingStatisticsSeriesSectionSchema,
});

export type ReadingStatisticsOverview = z.infer<typeof ReadingStatisticsOverviewSchema>;

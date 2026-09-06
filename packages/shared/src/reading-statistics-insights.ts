import { z } from "zod";

import { BookLanguageSchema } from "./book-enums.js";
import { CountSchema, isoDay, ratingAverage } from "./internal.js";
import { ReadingStatisticsContextActionSchema } from "./reading-statistics-common.js";

export const ReadingStatisticsInsightCategorySchema = z.enum([
  "activity",
  "authors",
  "discovery",
  "genres",
  "languages",
  "ratings",
  "reading",
  "series",
]);

export type ReadingStatisticsInsightCategory = z.infer<
  typeof ReadingStatisticsInsightCategorySchema
>;

export const ReadingStatisticsInsightToneSchema = z.enum(["positive", "neutral", "negative"]);

export type ReadingStatisticsInsightTone = z.infer<typeof ReadingStatisticsInsightToneSchema>;

const insight = <TCode extends string, TParams extends z.ZodType>(
  code: TCode,
  category: ReadingStatisticsInsightCategory,
  params: TParams,
) =>
  z.object({
    action: ReadingStatisticsContextActionSchema.optional(),
    category: z.literal(category),
    code: z.literal(code),
    params,
    tone: ReadingStatisticsInsightToneSchema,
  });

const comparisonCountParams = z.object({
  absoluteDelta: z.number(),
  comparisonValue: CountSchema,
  currentValue: CountSchema,
  percentDelta: z.number().nullable(),
});

export const ReadingStatisticsInsightSchema = z
  .discriminatedUnion("code", [
    insight("completed_reads_vs_comparison", "reading", comparisonCountParams),
    insight("pages_read_vs_comparison", "reading", comparisonCountParams),
    insight(
      "most_active_weekday",
      "activity",
      z.object({
        activeDays: CountSchema,
        pagesRead: CountSchema,
        weekday: z.number().int().min(0).max(6),
      }),
    ),
    insight(
      "longest_streak_in_period",
      "activity",
      z.object({ days: CountSchema, endDate: isoDay(), startDate: isoDay() }),
    ),
    insight(
      "top_genre_share",
      "genres",
      z.object({
        completedReadCount: CountSchema,
        genreKey: z.string(),
        shareOfCompletedReads: z.number().min(0).max(1),
      }),
    ),
    insight(
      "top_author_reads",
      "authors",
      z.object({ authorId: z.uuid(), authorName: z.string(), completedReadCount: CountSchema }),
    ),
    insight(
      "series_marathon",
      "series",
      z.object({ marathonLength: CountSchema, seriesId: z.uuid(), seriesName: z.string() }),
    ),
    insight(
      "high_rating_share",
      "ratings",
      z.object({
        averageRating: ratingAverage(),
        highRatedReadsCount: CountSchema,
        ratedReadsCount: CountSchema,
      }),
    ),
    insight(
      "new_authors_discovered",
      "discovery",
      z.object({ authorCount: CountSchema, firstAuthorName: z.string() }),
    ),
    insight(
      "dominant_language",
      "languages",
      z.object({
        completedReadCount: CountSchema,
        language: BookLanguageSchema,
        shareOfKnown: z.number().min(0).max(1),
      }),
    ),
  ])
  .describe(
    "One deterministic observation about the selected period. The backend decides which observations are true and worth showing; the wording lives in the frontend translations keyed by code.",
  );

export type ReadingStatisticsInsight = z.infer<typeof ReadingStatisticsInsightSchema>;

export const ReadingStatisticsInsightCodeSchema = z.enum([
  "completed_reads_vs_comparison",
  "pages_read_vs_comparison",
  "most_active_weekday",
  "longest_streak_in_period",
  "top_genre_share",
  "top_author_reads",
  "series_marathon",
  "high_rating_share",
  "new_authors_discovered",
  "dominant_language",
]);

export type ReadingStatisticsInsightCode = z.infer<typeof ReadingStatisticsInsightCodeSchema>;

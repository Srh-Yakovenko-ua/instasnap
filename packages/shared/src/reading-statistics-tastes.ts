import { z } from "zod";

import { BookLanguageSchema } from "./book-enums.js";
import { CountSchema, isoDay, ratingBound } from "./internal.js";
import {
  ReadingStatisticsContextActionSchema,
  ReadingStatisticsDrilldownSchema,
  StatisticsAvailabilitySchema,
  StatisticsBookRefSchema,
  StatisticsCoverageSchema,
} from "./reading-statistics-common.js";

const share = () => z.number().min(0).max(1);

export const CompletedReadRefSchema = z
  .object({
    authorName: z.string().nullable(),
    book: StatisticsBookRefSchema,
    contextActions: z.array(ReadingStatisticsContextActionSchema),
    drilldown: ReadingStatisticsDrilldownSchema,
    finishedAt: isoDay(),
    rating: ratingBound().nullable(),
    readingCycleId: z.uuid(),
  })
  .describe(
    "One completed read-through. The same book appears once per completed read, so a reread is a second row rather than an overwritten one.",
  );

export type CompletedReadRef = z.infer<typeof CompletedReadRefSchema>;

export const RatingUnavailableReasonSchema = z.enum(["NO_RATINGS", "INSUFFICIENT_SAMPLE"]);

export type RatingUnavailableReason = z.infer<typeof RatingUnavailableReasonSchema>;

export const ReadingStatisticsRatingsSectionSchema = z
  .object({
    availability: StatisticsAvailabilitySchema,
    averageRating: z.number().nullable(),
    completedReadsCount: CountSchema,
    coverage: StatisticsCoverageSchema,
    distribution: z.array(z.object({ completedReadCount: CountSchema, rating: ratingBound() })),
    highRatedReadsCount: CountSchema,
    highRatedShare: share().nullable(),
    ratedReadsCount: CountSchema,
    reason: RatingUnavailableReasonSchema.optional(),
    topRated: z.array(CompletedReadRefSchema),
  })
  .describe(
    "Ratings for the period, on the canonical 0.5 to 10 scale. Coverage compares rated reads with all completed reads, so a high average from three ratings out of forty cannot be mistaken for the whole picture.",
  );

export type ReadingStatisticsRatingsSection = z.infer<typeof ReadingStatisticsRatingsSectionSchema>;

const rankedRating = <TShape extends z.ZodRawShape>(shape: TShape) =>
  z.object({
    availability: StatisticsAvailabilitySchema,
    items: z.array(z.object({ ...shape, averageRating: z.number(), ratedReadCount: CountSchema })),
    reason: z.literal("INSUFFICIENT_SAMPLE").optional(),
  });

export const ReadingStatisticsGenresSectionSchema = z.object({
  availability: StatisticsAvailabilitySchema,
  coverage: StatisticsCoverageSchema,
  frequency: z.array(
    z.object({
      completedReadCount: CountSchema,
      drilldown: ReadingStatisticsDrilldownSchema,
      genreKey: z.string(),
      shareOfCompletedReads: share(),
    }),
  ),
  topRated: rankedRating({ genreKey: z.string() }),
});

export type ReadingStatisticsGenresSection = z.infer<typeof ReadingStatisticsGenresSectionSchema>;

export const ReadingStatisticsAuthorsSectionSchema = z.object({
  availability: StatisticsAvailabilitySchema,
  coverage: StatisticsCoverageSchema,
  frequency: z.array(
    z.object({
      authorId: z.uuid(),
      completedReadCount: CountSchema,
      contextActions: z.array(ReadingStatisticsContextActionSchema),
      drilldown: ReadingStatisticsDrilldownSchema,
      name: z.string(),
    }),
  ),
  returning: z.object({
    availability: StatisticsAvailabilitySchema,
    items: z.array(
      z.object({
        authorId: z.uuid(),
        completedReadCount: CountSchema,
        distinctReadingYears: CountSchema,
        latestFinishedAt: isoDay(),
        name: z.string(),
      }),
    ),
  }),
  topRated: rankedRating({ authorId: z.uuid(), name: z.string() }),
});

export type ReadingStatisticsAuthorsSection = z.infer<typeof ReadingStatisticsAuthorsSectionSchema>;

export const ReadingStatisticsPublishersSectionSchema = z
  .object({
    availability: StatisticsAvailabilitySchema,
    coverage: StatisticsCoverageSchema,
    items: z.array(
      z.object({
        averageRating: z.number().nullable(),
        completedReadCount: CountSchema,
        contextActions: z.array(ReadingStatisticsContextActionSchema),
        drilldown: ReadingStatisticsDrilldownSchema,
        name: z.string(),
        publisherId: z.uuid(),
      }),
    ),
    topThreeConcentration: share().nullable(),
    totalPublishers: CountSchema,
  })
  .describe(
    "Publishers behind the completed reads. Reads whose publisher was never recorded stay out of the ranking and show up in coverage instead of becoming an unknown bucket.",
  );

export type ReadingStatisticsPublishersSection = z.infer<
  typeof ReadingStatisticsPublishersSectionSchema
>;

export const ReadingStatisticsLanguagesSectionSchema = z
  .object({
    availability: StatisticsAvailabilitySchema,
    coverage: StatisticsCoverageSchema,
    items: z.array(
      z.object({
        completedReadCount: CountSchema,
        drilldown: ReadingStatisticsDrilldownSchema,
        language: BookLanguageSchema,
        shareOfKnown: share(),
      }),
    ),
  })
  .describe(
    "The edition language recorded in BookNest when each read was finished. It is not a claim about the original language of the work, and not proof that anyone confirmed the value by hand.",
  );

export type ReadingStatisticsLanguagesSection = z.infer<
  typeof ReadingStatisticsLanguagesSectionSchema
>;

const discoveryCard = <TShape extends z.ZodRawShape>(shape: TShape) =>
  z
    .object({
      ...shape,
      averageRating: z.number().nullable(),
      completedReadsAfterDiscovery: CountSchema,
      drilldown: ReadingStatisticsDrilldownSchema,
      firstFinishedAt: isoDay(),
    })
    .nullable();

export const ReadingStatisticsDiscoveriesSectionSchema = z
  .object({
    author: discoveryCard({ authorId: z.uuid(), name: z.string() }),
    availability: StatisticsAvailabilitySchema,
    coverage: StatisticsCoverageSchema.optional(),
    genre: discoveryCard({ genreKey: z.string() }),
    newAuthorsCount: CountSchema,
    newGenresCount: CountSchema,
    newPublishersCount: CountSchema,
    publisher: discoveryCard({ name: z.string(), publisherId: z.uuid() }),
    reason: z.literal("LEGACY_HISTORY_INCOMPLETE").optional(),
  })
  .describe(
    "First-time encounters in this period. Only reads proven to be a first-ever completion count, so a book carried over from before cycle history began cannot invent a discovery.",
  );

export type ReadingStatisticsDiscoveriesSection = z.infer<
  typeof ReadingStatisticsDiscoveriesSectionSchema
>;

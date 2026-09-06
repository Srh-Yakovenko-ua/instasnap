import { z } from "zod";

import { CountSchema, isoDay } from "./internal.js";
import {
  ReadingStatisticsDateRangeSchema,
  ReadingStatisticsDrilldownSchema,
  StatisticsAvailabilitySchema,
} from "./reading-statistics-common.js";

export const CALENDAR_BOOKS_PREVIEW_LIMIT = 3;

export const StatisticsCalendarHistoryQualitySchema = z.enum(["exact", "legacy_observed_only"]);

export type StatisticsCalendarHistoryQuality = z.infer<
  typeof StatisticsCalendarHistoryQualitySchema
>;

export const StatisticsCalendarBookPreviewSchema = z.object({
  bookId: z.uuid(),
  coverThumbUrl: z.string().nullable(),
  pagesRead: CountSchema,
  title: z.string(),
});

export type StatisticsCalendarBookPreview = z.infer<typeof StatisticsCalendarBookPreviewSchema>;

export const StatisticsCalendarDaySchema = z
  .object({
    booksCount: CountSchema,
    booksPreview: z.array(StatisticsCalendarBookPreviewSchema).max(CALENDAR_BOOKS_PREVIEW_LIMIT),
    date: isoDay(),
    drilldown: ReadingStatisticsDrilldownSchema,
    historyQuality: StatisticsCalendarHistoryQualitySchema,
    intensity: z.number().int().min(0).max(4),
    pagesRead: CountSchema,
    remainingBooksCount: CountSchema,
  })
  .describe(
    "One day of the calendar. booksPreview carries just enough to draw the day without a second request; the rest of the day is behind the day-details endpoint. historyQuality legacy_observed_only means a zero here proves nothing, because events from before the reliability boundary could have been deleted by an old reset.",
  );

export type StatisticsCalendarDay = z.infer<typeof StatisticsCalendarDaySchema>;

export const StatisticsStreakSpanSchema = z.object({
  days: CountSchema,
  endDate: isoDay().nullable(),
  startDate: isoDay().nullable(),
});

export type StatisticsStreakSpan = z.infer<typeof StatisticsStreakSpanSchema>;

export const StatisticsCurrentStreakReasonSchema = z.enum([
  "PERIOD_NOT_CURRENT",
  "LEGACY_HISTORY_INCOMPLETE",
]);

export type StatisticsCurrentStreakReason = z.infer<typeof StatisticsCurrentStreakReasonSchema>;

export const StatisticsCurrentStreakSchema = z
  .object({
    availability: StatisticsAvailabilitySchema,
    data: StatisticsStreakSpanSchema.extend({
      continuesBeforeRange: z.boolean(),
      continuesBeforeReliableHistory: z.boolean(),
    }).nullable(),
    reason: StatisticsCurrentStreakReasonSchema.optional(),
  })
  .describe(
    "The streak running right now. A closed historical period returns unavailable rather than zero, because there is no such thing as a current streak in a period that already ended.",
  );

export type StatisticsCurrentStreak = z.infer<typeof StatisticsCurrentStreakSchema>;

export const StatisticsMostActiveWeekdaySchema = z.object({
  availability: StatisticsAvailabilitySchema,
  data: z
    .object({
      activeDays: CountSchema,
      pagesRead: CountSchema,
      weekday: z.number().int().min(0).max(6),
    })
    .nullable(),
  reason: z.literal("LEGACY_HISTORY_INCOMPLETE").optional(),
});

export type StatisticsMostActiveWeekday = z.infer<typeof StatisticsMostActiveWeekdaySchema>;

export const StatisticsActiveDaysRateSchema = z.object({
  availability: StatisticsAvailabilitySchema,
  reason: z.literal("LEGACY_HISTORY_INCOMPLETE").optional(),
  value: z.number().min(0).max(1).nullable(),
});

export type StatisticsActiveDaysRate = z.infer<typeof StatisticsActiveDaysRateSchema>;

export const ReadingStatisticsCalendarSectionSchema = z
  .object({
    activeDays: CountSchema,
    activeDaysPercentage: StatisticsActiveDaysRateSchema,
    availability: StatisticsAvailabilitySchema,
    currentStreak: StatisticsCurrentStreakSchema,
    days: z.array(StatisticsCalendarDaySchema),
    displayRange: ReadingStatisticsDateRangeSchema,
    longestStreak: StatisticsStreakSpanSchema,
    metricRange: ReadingStatisticsDateRangeSchema,
    mostActiveWeekday: StatisticsMostActiveWeekdaySchema,
    reason: z.literal("NO_ACTIVITY_HISTORY").optional(),
  })
  .describe(
    "metricRange is what the summary numbers describe; displayRange is what days[] draws. For all time the two differ on purpose: the heatmap shows the last twelve months while the summary still covers every tracked day.",
  );

export type ReadingStatisticsCalendarSection = z.infer<
  typeof ReadingStatisticsCalendarSectionSchema
>;

export const ReadingDayDetailsSchema = z.object({
  books: z.array(
    StatisticsCalendarBookPreviewSchema.extend({ bookState: z.enum(["active", "soft_deleted"]) }),
  ),
  booksCount: CountSchema,
  date: isoDay(),
  historyQuality: StatisticsCalendarHistoryQualitySchema,
  pagesRead: CountSchema,
});

export type ReadingDayDetails = z.infer<typeof ReadingDayDetailsSchema>;

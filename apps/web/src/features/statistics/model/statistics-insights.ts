import type {
  BookLanguage,
  ReadingStatisticsInsight,
  ReadingStatisticsInsightCode,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";

export type StatisticsInsightValues = Record<string, number | string>;

export const INSIGHT_ICON = {
  activity: "calendar",
  authors: "user",
  discovery: "sparkles",
  genres: "tag",
  languages: "globe",
  ratings: "star",
  reading: "book",
  series: "book-copy",
} as const satisfies Record<ReadingStatisticsInsight["category"], UiIconName>;

export type StatisticsInsightFormatters = {
  day: (day: string) => string;
  language: (language: BookLanguage) => string;
  rating: (value: number) => string;
  share: (ratio: number) => string;
  weekday: (weekday: number) => string;
};

export type StatisticsInsightView = {
  code: ReadingStatisticsInsightCode;
  icon: UiIconName;
  values: StatisticsInsightValues;
};

export function toInsightView(
  insight: ReadingStatisticsInsight,
  format: StatisticsInsightFormatters,
): StatisticsInsightView {
  return {
    code: insight.code,
    icon: INSIGHT_ICON[insight.category],
    values: toInsightValues(insight, format),
  };
}

function toInsightValues(
  insight: ReadingStatisticsInsight,
  format: StatisticsInsightFormatters,
): StatisticsInsightValues {
  switch (insight.code) {
    case "completed_reads_vs_comparison":
    case "pages_read_vs_comparison":
      return {
        absoluteDelta: Math.abs(insight.params.absoluteDelta),
        comparisonValue: insight.params.comparisonValue,
        currentValue: insight.params.currentValue,
        direction: insight.params.absoluteDelta < 0 ? "down" : "up",
        percentDelta:
          insight.params.percentDelta === null
            ? ""
            : format.share(Math.abs(insight.params.percentDelta) / 100),
      };
    case "dominant_language":
      return {
        completedReadCount: insight.params.completedReadCount,
        language: format.language(insight.params.language),
        share: format.share(insight.params.shareOfKnown),
      };
    case "high_rating_share":
      return {
        averageRating: format.rating(insight.params.averageRating),
        highRatedReadsCount: insight.params.highRatedReadsCount,
        ratedReadsCount: insight.params.ratedReadsCount,
      };
    case "longest_streak_in_period":
      return {
        days: insight.params.days,
        endDate: format.day(insight.params.endDate),
        startDate: format.day(insight.params.startDate),
      };
    case "most_active_weekday":
      return {
        activeDays: insight.params.activeDays,
        pagesRead: insight.params.pagesRead,
        weekday: format.weekday(insight.params.weekday),
      };
    case "new_authors_discovered":
      return {
        authorCount: insight.params.authorCount,
        firstAuthorName: insight.params.firstAuthorName,
      };
    case "series_marathon":
      return {
        marathonLength: insight.params.marathonLength,
        seriesName: insight.params.seriesName,
      };
    case "top_author_reads":
      return {
        authorName: insight.params.authorName,
        completedReadCount: insight.params.completedReadCount,
      };
    case "top_genre_share":
      return {
        completedReadCount: insight.params.completedReadCount,
        genreKey: insight.params.genreKey,
        share: format.share(insight.params.shareOfCompletedReads),
      };
  }
}

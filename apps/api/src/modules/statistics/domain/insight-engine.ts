import type {
  BookLanguage,
  Nullable,
  ReadingStatisticsInsight,
  ReadingStatisticsInsightCategory,
  ReadingStatisticsInsightTone,
  StatisticsStreakSpan,
} from "@app/shared";

import { INSIGHT_CARDS_LIMIT } from "@app/shared";

import type { MostActiveWeekday } from "./reading-calendar.js";
import type { DiscoveredEntity } from "./reading-discoveries.js";
import type { SeriesMarathon } from "./reading-series.js";

const MIN_SAMPLE = {
  authorReads: 2,
  dominantLanguageReads: 3,
  genreReads: 3,
  ratedReads: 3,
  streakDays: 3,
  weekdayActiveDays: 3,
} as const;

const DOMINANT_LANGUAGE_SHARE = 0.6;

const PRIORITY: Record<ReadingStatisticsInsight["code"], number> = {
  completed_reads_vs_comparison: 1,
  dominant_language: 10,
  high_rating_share: 9,
  longest_streak_in_period: 4,
  most_active_weekday: 5,
  new_authors_discovered: 6,
  pages_read_vs_comparison: 2,
  series_marathon: 3,
  top_author_reads: 8,
  top_genre_share: 7,
};

export type InsightEngineInput = {
  comparison: Nullable<{ completedReads: number; pagesRead: number }>;
  current: { completedReads: number; pagesRead: number };
  discoveredAuthors: DiscoveredEntity[];
  longestStreak: StatisticsStreakSpan;
  marathon: Nullable<SeriesMarathon>;
  mostActiveWeekday: Nullable<MostActiveWeekday>;
  ratings: {
    averageRating: Nullable<number>;
    highRatedReadsCount: number;
    ratedReadsCount: number;
  };
  topAuthor: Nullable<{ authorId: string; completedReadCount: number; name: string }>;
  topGenre: Nullable<{ completedReadCount: number; genreKey: string; share: number }>;
  topLanguage: Nullable<{
    completedReadCount: number;
    knownCount: number;
    language: BookLanguage;
  }>;
};

export type InsightPool = {
  featuredInsight: Nullable<ReadingStatisticsInsight>;
  items: ReadingStatisticsInsight[];
};

type InsightCandidate = {
  insight: ReadingStatisticsInsight;
  significance: number;
  stableKey: string;
};

export function buildInsightPool(input: InsightEngineInput): InsightPool {
  const ranked = diversify(collectCandidates(input).sort(compareCandidates));
  const [featured, ...rest] = ranked;

  return {
    featuredInsight: featured?.insight ?? null,
    items: rest.slice(0, INSIGHT_CARDS_LIMIT).map((candidate) => candidate.insight),
  };
}

function activityCandidates(input: InsightEngineInput): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const { longestStreak, mostActiveWeekday } = input;

  if (mostActiveWeekday !== null && mostActiveWeekday.activeDays >= MIN_SAMPLE.weekdayActiveDays) {
    candidates.push({
      insight: {
        category: "activity",
        code: "most_active_weekday",
        params: {
          activeDays: mostActiveWeekday.activeDays,
          pagesRead: mostActiveWeekday.pagesRead,
          weekday: mostActiveWeekday.weekday,
        },
        tone: "neutral",
      },
      significance: mostActiveWeekday.pagesRead,
      stableKey: `most_active_weekday:${String(mostActiveWeekday.weekday)}`,
    });
  }

  if (
    longestStreak.days >= MIN_SAMPLE.streakDays &&
    longestStreak.startDate !== null &&
    longestStreak.endDate !== null
  ) {
    candidates.push({
      insight: {
        category: "activity",
        code: "longest_streak_in_period",
        params: {
          days: longestStreak.days,
          endDate: longestStreak.endDate,
          startDate: longestStreak.startDate,
        },
        tone: "positive",
      },
      significance: longestStreak.days,
      stableKey: `longest_streak_in_period:${longestStreak.startDate}`,
    });
  }

  return candidates;
}

function collectCandidates(input: InsightEngineInput): InsightCandidate[] {
  return [
    ...comparisonCandidates(input),
    ...activityCandidates(input),
    ...tasteCandidates(input),
    ...discoveryCandidates(input),
  ];
}

function compareCandidates(left: InsightCandidate, right: InsightCandidate): number {
  const leftPriority = PRIORITY[left.insight.code];
  const rightPriority = PRIORITY[right.insight.code];
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  if (left.significance !== right.significance) {
    return right.significance - left.significance;
  }
  return left.stableKey.localeCompare(right.stableKey);
}

function comparisonCandidate({
  code,
  currentValue,
  previousValue,
}: {
  code: "completed_reads_vs_comparison" | "pages_read_vs_comparison";
  currentValue: number;
  previousValue: number;
}): Nullable<InsightCandidate> {
  const absoluteDelta = currentValue - previousValue;
  if (absoluteDelta === 0 || currentValue + previousValue === 0) {
    return null;
  }

  return {
    insight: {
      category: "reading",
      code,
      params: {
        absoluteDelta,
        comparisonValue: previousValue,
        currentValue,
        percentDelta: previousValue > 0 ? (absoluteDelta / previousValue) * 100 : null,
      },
      tone: toneOf(absoluteDelta),
    },
    significance: Math.abs(absoluteDelta),
    stableKey: `${code}:${String(currentValue)}:${String(previousValue)}`,
  };
}

function comparisonCandidates(input: InsightEngineInput): InsightCandidate[] {
  const { comparison, current } = input;
  if (comparison === null) {
    return [];
  }

  return [
    comparisonCandidate({
      code: "completed_reads_vs_comparison",
      currentValue: current.completedReads,
      previousValue: comparison.completedReads,
    }),
    comparisonCandidate({
      code: "pages_read_vs_comparison",
      currentValue: current.pagesRead,
      previousValue: comparison.pagesRead,
    }),
  ].flatMap((candidate) => (candidate === null ? [] : [candidate]));
}

function discoveryCandidates(input: InsightEngineInput): InsightCandidate[] {
  const [first] = input.discoveredAuthors;
  if (first === undefined) {
    return [];
  }

  return [
    {
      insight: {
        category: "discovery",
        code: "new_authors_discovered",
        params: { authorCount: input.discoveredAuthors.length, firstAuthorName: first.label },
        tone: "positive",
      },
      significance: input.discoveredAuthors.length,
      stableKey: `new_authors_discovered:${first.key}`,
    },
  ];
}

function diversify(candidates: InsightCandidate[]): InsightCandidate[] {
  const seenCategories = new Set<ReadingStatisticsInsightCategory>();
  const kept: InsightCandidate[] = [];

  for (const candidate of candidates) {
    if (seenCategories.has(candidate.insight.category)) {
      continue;
    }
    seenCategories.add(candidate.insight.category);
    kept.push(candidate);
  }

  return kept;
}

function tasteCandidates(input: InsightEngineInput): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const { marathon, ratings, topAuthor, topGenre, topLanguage } = input;

  if (marathon !== null) {
    candidates.push({
      insight: {
        category: "series",
        code: "series_marathon",
        params: {
          marathonLength: marathon.length,
          seriesId: marathon.seriesId,
          seriesName: marathon.name,
        },
        tone: "positive",
      },
      significance: marathon.length,
      stableKey: `series_marathon:${marathon.seriesId}`,
    });
  }

  if (topGenre !== null && topGenre.completedReadCount >= MIN_SAMPLE.genreReads) {
    candidates.push({
      insight: {
        category: "genres",
        code: "top_genre_share",
        params: {
          completedReadCount: topGenre.completedReadCount,
          genreKey: topGenre.genreKey,
          shareOfCompletedReads: topGenre.share,
        },
        tone: "neutral",
      },
      significance: topGenre.completedReadCount,
      stableKey: `top_genre_share:${topGenre.genreKey}`,
    });
  }

  if (topAuthor !== null && topAuthor.completedReadCount >= MIN_SAMPLE.authorReads) {
    candidates.push({
      insight: {
        action: { authorId: topAuthor.authorId, kind: "open_author" },
        category: "authors",
        code: "top_author_reads",
        params: {
          authorId: topAuthor.authorId,
          authorName: topAuthor.name,
          completedReadCount: topAuthor.completedReadCount,
        },
        tone: "neutral",
      },
      significance: topAuthor.completedReadCount,
      stableKey: `top_author_reads:${topAuthor.authorId}`,
    });
  }

  if (ratings.ratedReadsCount >= MIN_SAMPLE.ratedReads && ratings.averageRating !== null) {
    candidates.push({
      insight: {
        category: "ratings",
        code: "high_rating_share",
        params: {
          averageRating: ratings.averageRating,
          highRatedReadsCount: ratings.highRatedReadsCount,
          ratedReadsCount: ratings.ratedReadsCount,
        },
        tone: "neutral",
      },
      significance: ratings.highRatedReadsCount,
      stableKey: "high_rating_share",
    });
  }

  if (
    topLanguage !== null &&
    topLanguage.knownCount >= MIN_SAMPLE.dominantLanguageReads &&
    topLanguage.completedReadCount / topLanguage.knownCount >= DOMINANT_LANGUAGE_SHARE
  ) {
    candidates.push({
      insight: {
        category: "languages",
        code: "dominant_language",
        params: {
          completedReadCount: topLanguage.completedReadCount,
          language: topLanguage.language,
          shareOfKnown: topLanguage.completedReadCount / topLanguage.knownCount,
        },
        tone: "neutral",
      },
      significance: topLanguage.completedReadCount,
      stableKey: `dominant_language:${topLanguage.language}`,
    });
  }

  return candidates;
}

function toneOf(absoluteDelta: number): ReadingStatisticsInsightTone {
  if (absoluteDelta > 0) {
    return "positive";
  }
  return absoluteDelta < 0 ? "negative" : "neutral";
}

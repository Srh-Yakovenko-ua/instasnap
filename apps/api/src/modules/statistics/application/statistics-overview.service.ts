import type {
  Nullable,
  ReadingStatisticsComparison,
  ReadingStatisticsOverview,
  ReadingStatisticsOverviewQuery,
  ReadingStatisticsPeriod,
} from "@app/shared";

import { Injectable } from "@nestjs/common";
import { format, parseISO, subMonths } from "date-fns";

import type { CompletedRead } from "../domain/completed-read.js";
import type { StatisticsPeriodScope } from "../domain/statistics-drilldown.js";

import { toZonedIsoDate } from "../../../core/iso-date.js";
import { ReadingHistoryProvenanceService } from "../../books/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import {
  isRangeFullyReliable,
  resolveActivityHistoryQuality,
} from "../domain/activity-history-quality.js";
import { buildInsightPool } from "../domain/insight-engine.js";
import { countEligibleDays, toActiveDays } from "../domain/reading-calendar.js";
import { collectDiscoveries } from "../domain/reading-discoveries.js";
import { summarizeRatings } from "../domain/reading-ratings.js";
import {
  compareByFrequency,
  countKnownLanguages,
  groupByAuthor,
  groupByGenre,
  groupByLanguage,
  languageOf,
} from "../domain/reading-tastes.js";
import { buildReadingRecords } from "../domain/record-engine.js";
import { buildStatisticsBuckets } from "../domain/statistics-buckets.js";
import { normalizeReadingStatisticsPeriod } from "../domain/statistics-period.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";
import { StatisticsCompletionRepository } from "../infrastructure/statistics-completion.repository.js";
import { StatisticsLibraryRepository } from "../infrastructure/statistics-library.repository.js";
import { CompletedReadMapper } from "./completed-read.mapper.js";
import { ReadingCoreComposer } from "./reading-core.composer.js";
import { StatisticsCalendarComposer } from "./statistics-calendar.composer.js";
import { StatisticsGoalComposer } from "./statistics-goal.composer.js";
import { StatisticsLibraryComposer } from "./statistics-library.composer.js";
import { StatisticsSeriesComposer } from "./statistics-series.composer.js";
import { StatisticsTastesComposer } from "./statistics-tastes.composer.js";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const RETURNING_AUTHORS_LIMIT = 5;

const FORECAST_WINDOW_MONTHS = 12;

@Injectable()
export class StatisticsOverviewService {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly calendarComposer: StatisticsCalendarComposer,
    private readonly completedReadMapper: CompletedReadMapper,
    private readonly completionRepository: StatisticsCompletionRepository,
    private readonly coreComposer: ReadingCoreComposer,
    private readonly goalComposer: StatisticsGoalComposer,
    private readonly libraryComposer: StatisticsLibraryComposer,
    private readonly libraryRepository: StatisticsLibraryRepository,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
    private readonly seriesComposer: StatisticsSeriesComposer,
    private readonly tastesComposer: StatisticsTastesComposer,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async getOverview({
    query,
    userId,
  }: {
    query: ReadingStatisticsOverviewQuery;
    userId: string;
  }): Promise<ReadingStatisticsOverview> {
    const settings = await this.userSettingsContextService.resolve(userId);
    const localToday = toZonedIsoDate({ instant: new Date(), timeZone: settings.timezone });
    const { activityReliableFrom } = await this.readingHistoryProvenanceService.ensure(userId);
    const { comparison, period } = normalizeReadingStatisticsPeriod({
      query,
      today: localToday,
    });
    const periodScope: StatisticsPeriodScope = { from: period.from, to: period.to };

    const [
      reads,
      pagesRead,
      pagesByBookId,
      activity,
      priorExposure,
      seriesFirstsBefore,
      returningAuthors,
      librarySnapshot,
      firstCompletionsLastYear,
      goal,
    ] = await Promise.all([
      this.loadReads({ from: period.from, to: period.to, userId }),
      this.activityRepository.sumPages({ from: period.from, to: period.to, userId }),
      this.activityRepository.aggregatePagesByBook({ from: period.from, to: period.to, userId }),
      this.activityRepository.aggregateDays({ from: period.from, to: period.to, userId }),
      this.completionRepository.countPriorExposure({ before: period.from, userId }),
      this.completionRepository.countSeriesFirstCompletionsBefore({ before: period.from, userId }),
      this.completionRepository.findReturningAuthors({ limit: RETURNING_AUTHORS_LIMIT, userId }),
      this.libraryRepository.loadSnapshot(userId),
      this.completionRepository.countFirstCompletionsSince({
        since: shiftMonths(localToday, -FORECAST_WINDOW_MONTHS),
        userId,
      }),
      this.goalComposer.compose(userId),
    ]);

    const comparisonInputs = await this.loadComparison({ comparison, userId });
    const calendar = await this.calendarComposer.compose({
      period: periodScope,
      reliableFrom: activityReliableFrom,
      today: localToday,
      userId,
    });

    const activeDays = toActiveDays(activity);
    const eligibleDays = countEligibleDays({
      from: period.from ?? calendar.ranges.metricRange.from,
      to: period.to,
    });
    const activeDaysRate = eligibleDays === 0 ? 0 : activeDays.length / eligibleDays;
    const pagesReadReliable = isRangeFullyReliable({
      from: period.from,
      reliableFrom: activityReliableFrom,
    });

    const discoveries = collectDiscoveries({
      periodReads: reads,
      priorExposure: {
        authorIds: new Set(priorExposure.authorIds),
        genreKeys: new Set(priorExposure.genreKeys),
        publisherIds: new Set(priorExposure.publisherIds),
      },
    });
    const provenFirstCoverageComplete =
      discoveries.uniqueFirstCompletionCandidates === discoveries.provenFirstCompletionCount;

    const series = this.seriesComposer.compose({
      firstCompletionsBeforePeriod: seriesFirstsBefore,
      pagesByBookId,
      periodScope,
      provenFirstCoverageComplete,
      reads,
    });

    const ratings = summarizeRatings(reads);
    const insights = buildInsightPool({
      comparison:
        comparisonInputs === null
          ? null
          : {
              completedReads: comparisonInputs.totals.completedReads,
              pagesRead: comparisonInputs.pagesRead,
            },
      current: { completedReads: reads.length, pagesRead },
      discoveredAuthors: discoveries.authors,
      longestStreak: calendar.section.longestStreak,
      marathon: series.marathon,
      mostActiveWeekday: calendar.section.mostActiveWeekday.data,
      ratings: {
        averageRating: ratings.averageRating,
        highRatedReadsCount: ratings.highRatedReadsCount,
        ratedReadsCount: ratings.ratedReads.length,
      },
      topAuthor: topAuthorOf(reads),
      topGenre: topGenreOf(reads),
      topLanguage: topLanguageOf(reads),
    });

    return {
      authors: this.tastesComposer.buildAuthors({ periodScope, reads, returningAuthors }),
      calendar: calendar.section,
      comparison,
      discoveries: this.tastesComposer.buildDiscoveries({ discoveries, periodScope }),
      dynamics: this.coreComposer.buildDynamics({
        activity,
        comparison:
          comparison === null || comparisonInputs === null
            ? null
            : {
                activity: comparisonInputs.activity,
                range: { from: comparison.from, to: comparison.to },
                reads: comparisonInputs.reads,
              },
        granularity: period.granularity,
        period: periodScope,
        reads,
        weekStartDay: settings.weekStartDay,
      }),
      genres: this.tastesComposer.buildGenres({ periodScope, reads }),
      goal,
      hero: {
        featuredInsight: insights.featuredInsight,
        recentCompletedReads: this.coreComposer.buildRecentCompletedReads(reads),
      },
      insights: { items: insights.items },
      kpis: this.coreComposer.buildKpis({
        activeDays: activeDays.length,
        activeDaysRate,
        comparison: comparisonInputs,
        pagesRead,
        pagesReadReliable,
        reads,
      }),
      languages: this.tastesComposer.buildLanguages({ periodScope, reads }),
      libraryBalance: this.libraryComposer.compose({
        firstCompletionsLastYear,
        provenFirstCoverageComplete,
        snapshot: librarySnapshot,
      }),
      meta: {
        activityHistory: resolveActivityHistoryQuality({
          periodFrom: period.from,
          reliableFrom: activityReliableFrom,
        }),
        generatedAt: new Date().toISOString(),
        timezone: settings.timezone,
        weekStartDay: settings.weekStartDay,
      },
      period,
      publishers: this.tastesComposer.buildPublishers({ periodScope, reads }),
      ratings: this.tastesComposer.buildRatings(reads),
      records: {
        items: buildReadingRecords({
          activity,
          marathon: series.marathon,
          monthlyBuckets: this.toMonthlyBuckets({
            activity,
            period,
            reads,
            weekStartDay: settings.weekStartDay,
          }),
          periodScope,
          reads,
          streak: calendar.section.longestStreak,
        }),
      },
      series: series.section,
    };
  }

  private async loadComparison({
    comparison,
    userId,
  }: {
    comparison: Nullable<ReadingStatisticsComparison>;
    userId: string;
  }) {
    if (comparison === null) {
      return null;
    }

    const [reads, pagesRead, activity, totals] = await Promise.all([
      this.loadReads({ from: comparison.from, to: comparison.to, userId }),
      this.activityRepository.sumPages({ from: comparison.from, to: comparison.to, userId }),
      this.activityRepository.aggregateDays({
        from: comparison.from,
        to: comparison.to,
        userId,
      }),
      this.completionRepository.countTotals({
        from: comparison.from,
        to: comparison.to,
        userId,
      }),
    ]);

    const activeDays = toActiveDays(activity);
    const eligibleDays = countEligibleDays({ from: comparison.from, to: comparison.to });
    const ratings = summarizeRatings(reads);

    return {
      activeDays: activeDays.length,
      activeDaysRate: eligibleDays === 0 ? 0 : activeDays.length / eligibleDays,
      activity,
      averageRating: ratings.averageRating,
      pagesRead,
      reads,
      totals,
    };
  }

  private async loadReads({
    from,
    to,
    userId,
  }: {
    from: Nullable<string>;
    to: string;
    userId: string;
  }): Promise<CompletedRead[]> {
    const rows = await this.completionRepository.findCompletedReads({ from, to, userId });
    return this.completedReadMapper.toCompletedReads(rows);
  }

  private toMonthlyBuckets({
    activity,
    period,
    reads,
    weekStartDay,
  }: {
    activity: { date: string; pagesRead: number }[];
    period: ReadingStatisticsPeriod;
    reads: CompletedRead[];
    weekStartDay: ReadingStatisticsOverview["meta"]["weekStartDay"];
  }) {
    const from = period.from ?? earliestOf({ activity, reads }) ?? period.to;
    return buildStatisticsBuckets({ from, granularity: "month", to: period.to, weekStartDay }).map(
      (bucket) => ({
        completedReads: reads.filter(
          (read) => read.finishedAt >= bucket.start && read.finishedAt <= bucket.end,
        ).length,
        drilldown: { date: bucket.start, kind: "reading_day" as const },
        end: bucket.end,
        pagesRead: activity
          .filter((day) => day.date >= bucket.start && day.date <= bucket.end)
          .reduce((sum, day) => sum + day.pagesRead, 0),
        start: bucket.start,
        uniqueBooksCompleted: new Set(
          reads
            .filter((read) => read.finishedAt >= bucket.start && read.finishedAt <= bucket.end)
            .map((read) => read.bookId),
        ).size,
      }),
    );
  }
}

function earliestOf({
  activity,
  reads,
}: {
  activity: { date: string }[];
  reads: CompletedRead[];
}): Nullable<string> {
  const dates = [...activity.map((day) => day.date), ...reads.map((read) => read.finishedAt)];
  return [...dates].sort()[0] ?? null;
}

function shiftMonths(isoDay: string, offset: number): string {
  return format(subMonths(parseISO(isoDay), Math.abs(offset)), ISO_DAY_FORMAT);
}

function topAuthorOf(reads: CompletedRead[]) {
  const top = [...groupByAuthor(reads)].sort(compareByFrequency)[0];
  return top === undefined
    ? null
    : { authorId: top.key, completedReadCount: top.completedReadCount, name: top.label };
}

function topGenreOf(reads: CompletedRead[]) {
  const top = [...groupByGenre(reads)].sort(compareByFrequency)[0];
  return top === undefined
    ? null
    : {
        completedReadCount: top.completedReadCount,
        genreKey: top.key,
        share: reads.length === 0 ? 0 : top.completedReadCount / reads.length,
      };
}

function topLanguageOf(reads: CompletedRead[]) {
  const top = [...groupByLanguage(reads)].sort(compareByFrequency)[0];
  return top === undefined
    ? null
    : {
        completedReadCount: top.completedReadCount,
        knownCount: countKnownLanguages(reads),
        language: languageOf(top),
      };
}

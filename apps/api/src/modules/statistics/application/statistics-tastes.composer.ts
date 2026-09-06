import type {
  CompletedReadsFilter,
  ReadingStatisticsAuthorsSection,
  ReadingStatisticsDiscoveriesSection,
  ReadingStatisticsGenresSection,
  ReadingStatisticsLanguagesSection,
  ReadingStatisticsPublishersSection,
  ReadingStatisticsRatingsSection,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { CompletedRead } from "../domain/completed-read.js";
import type { DiscoveredEntity, ReadingDiscoveries } from "../domain/reading-discoveries.js";
import type { TasteBucket } from "../domain/reading-tastes.js";
import type { StatisticsPeriodScope } from "../domain/statistics-drilldown.js";

import { toBookRef } from "../domain/completed-read.js";
import { compareDiscoveries } from "../domain/reading-discoveries.js";
import { compareTopRated, summarizeRatings } from "../domain/reading-ratings.js";
import {
  compareByFrequency,
  compareByRating,
  comparePublishers,
  countKnownLanguages,
  countKnownPublishers,
  eligiblePublisherRating,
  groupByAuthor,
  groupByGenre,
  groupByLanguage,
  groupByPublisher,
  languageOf,
  MIN_RATED_READS_FOR_RANKING,
  PUBLISHER_CONCENTRATION_TOP,
  TASTE_RANKING_LIMIT,
} from "../domain/reading-tastes.js";
import { resolveCoverageAvailability, toCoverage } from "../domain/statistics-availability.js";
import {
  toBookContextActions,
  toCompletedReadsDrilldown,
  toReadingCycleDrilldown,
} from "../domain/statistics-drilldown.js";

const TOP_RATED_LIMIT = 4;

@Injectable()
export class StatisticsTastesComposer {
  buildAuthors({
    periodScope,
    reads,
    returningAuthors,
  }: {
    periodScope: StatisticsPeriodScope;
    reads: CompletedRead[];
    returningAuthors: ReadingStatisticsAuthorsSection["returning"]["items"];
  }): ReadingStatisticsAuthorsSection {
    const buckets = groupByAuthor(reads);
    const knownCount = reads.filter((read) => read.authors.length > 0).length;
    const coverage = toCoverage({ eligibleCount: reads.length, knownCount });

    return {
      availability: resolveCoverageAvailability(coverage),
      coverage,
      frequency: [...buckets]
        .sort(compareByFrequency)
        .slice(0, TASTE_RANKING_LIMIT)
        .map((bucket) => ({
          authorId: bucket.key,
          completedReadCount: bucket.completedReadCount,
          contextActions: [{ authorId: bucket.key, kind: "open_author" as const }],
          drilldown: toCompletedReadsDrilldown({
            filters: { authorId: bucket.key },
            period: periodScope,
          }),
          name: bucket.label,
        })),
      returning: { availability: "available", items: returningAuthors },
      topRated: this.buildRatedRanking(buckets, (bucket) => ({
        authorId: bucket.key,
        name: bucket.label,
      })),
    };
  }

  buildDiscoveries({
    discoveries,
    periodScope,
  }: {
    discoveries: ReadingDiscoveries;
    periodScope: StatisticsPeriodScope;
  }): ReadingStatisticsDiscoveriesSection {
    const coverage = toCoverage({
      eligibleCount: discoveries.uniqueFirstCompletionCandidates,
      knownCount: discoveries.provenFirstCompletionCount,
    });
    const availability = resolveCoverageAvailability(coverage);

    return {
      author: toDiscoveryCard({
        entities: discoveries.authors,
        periodScope,
        toFilters: (entity) => ({ authorId: entity.key }),
        toIdentity: (entity) => ({ authorId: entity.key, name: entity.label }),
      }),
      availability,
      coverage,
      genre: toDiscoveryCard({
        entities: discoveries.genres,
        periodScope,
        toFilters: (entity) => ({ genre: entity.key }),
        toIdentity: (entity) => ({ genreKey: entity.key }),
      }),
      newAuthorsCount: discoveries.authors.length,
      newGenresCount: discoveries.genres.length,
      newPublishersCount: discoveries.publishers.length,
      publisher: toDiscoveryCard({
        entities: discoveries.publishers,
        periodScope,
        toFilters: (entity) => ({ publisherId: entity.key }),
        toIdentity: (entity) => ({ name: entity.label, publisherId: entity.key }),
      }),
      reason: availability === "available" ? undefined : "LEGACY_HISTORY_INCOMPLETE",
    };
  }

  buildGenres({
    periodScope,
    reads,
  }: {
    periodScope: StatisticsPeriodScope;
    reads: CompletedRead[];
  }): ReadingStatisticsGenresSection {
    const buckets = groupByGenre(reads);
    const knownCount = reads.filter((read) => read.genres.length > 0).length;
    const coverage = toCoverage({ eligibleCount: reads.length, knownCount });

    return {
      availability: resolveCoverageAvailability(coverage),
      coverage,
      frequency: [...buckets]
        .sort(compareByFrequency)
        .slice(0, TASTE_RANKING_LIMIT)
        .map((bucket) => ({
          completedReadCount: bucket.completedReadCount,
          drilldown: toCompletedReadsDrilldown({
            filters: { genre: bucket.key },
            period: periodScope,
          }),
          genreKey: bucket.key,
          shareOfCompletedReads: reads.length === 0 ? 0 : bucket.completedReadCount / reads.length,
        })),
      topRated: this.buildRatedRanking(buckets, (bucket) => ({ genreKey: bucket.key })),
    };
  }

  buildLanguages({
    periodScope,
    reads,
  }: {
    periodScope: StatisticsPeriodScope;
    reads: CompletedRead[];
  }): ReadingStatisticsLanguagesSection {
    const buckets = groupByLanguage(reads);
    const knownCount = countKnownLanguages(reads);
    const coverage = toCoverage({ eligibleCount: reads.length, knownCount });

    return {
      availability: resolveCoverageAvailability(coverage),
      coverage,
      items: [...buckets].sort(compareByFrequency).map((bucket) => ({
        completedReadCount: bucket.completedReadCount,
        drilldown: toCompletedReadsDrilldown({
          filters: { language: languageOf(bucket) },
          period: periodScope,
        }),
        language: languageOf(bucket),
        shareOfKnown: knownCount === 0 ? 0 : bucket.completedReadCount / knownCount,
      })),
    };
  }

  buildPublishers({
    periodScope,
    reads,
  }: {
    periodScope: StatisticsPeriodScope;
    reads: CompletedRead[];
  }): ReadingStatisticsPublishersSection {
    const buckets = [...groupByPublisher(reads)].sort(comparePublishers);
    const knownCount = countKnownPublishers(reads);
    const coverage = toCoverage({ eligibleCount: reads.length, knownCount });
    const topThreeReads = buckets
      .slice(0, PUBLISHER_CONCENTRATION_TOP)
      .reduce((sum, bucket) => sum + bucket.completedReadCount, 0);

    return {
      availability: resolveCoverageAvailability(coverage),
      coverage,
      items: buckets.slice(0, TASTE_RANKING_LIMIT).map((bucket) => ({
        averageRating: eligiblePublisherRating(bucket),
        completedReadCount: bucket.completedReadCount,
        contextActions: [{ kind: "open_publisher" as const, publisherId: bucket.key }],
        drilldown: toCompletedReadsDrilldown({
          filters: { publisherId: bucket.key },
          period: periodScope,
        }),
        name: bucket.label,
        publisherId: bucket.key,
      })),
      topThreeConcentration: knownCount === 0 ? null : topThreeReads / knownCount,
      totalPublishers: buckets.length,
    };
  }

  buildRatings(reads: CompletedRead[]): ReadingStatisticsRatingsSection {
    const summary = summarizeRatings(reads);
    const coverage = toCoverage({
      eligibleCount: reads.length,
      knownCount: summary.ratedReads.length,
    });

    return {
      availability:
        summary.ratedReads.length === 0 ? "unavailable" : resolveCoverageAvailability(coverage),
      averageRating: summary.averageRating,
      completedReadsCount: reads.length,
      coverage,
      distribution: summary.distribution,
      highRatedReadsCount: summary.highRatedReadsCount,
      highRatedShare: summary.highRatedShare,
      ratedReadsCount: summary.ratedReads.length,
      reason: summary.ratedReads.length === 0 ? "NO_RATINGS" : undefined,
      topRated: [...summary.ratedReads]
        .sort(compareTopRated)
        .slice(0, TOP_RATED_LIMIT)
        .map((read) => ({
          authorName: read.authors[0]?.name ?? null,
          book: toBookRef(read),
          contextActions: toBookContextActions(read),
          drilldown: toReadingCycleDrilldown(read),
          finishedAt: read.finishedAt,
          rating: read.rating,
          readingCycleId: read.readingCycleId,
        })),
    };
  }

  private buildRatedRanking<TShape extends object>(
    buckets: TasteBucket[],
    toIdentity: (bucket: TasteBucket) => TShape,
  ): {
    availability: "available" | "unavailable";
    items: (TShape & { averageRating: number; ratedReadCount: number })[];
    reason?: "INSUFFICIENT_SAMPLE";
  } {
    const eligible = buckets.filter(
      (bucket) =>
        bucket.ratedReadCount >= MIN_RATED_READS_FOR_RANKING && bucket.averageRating !== null,
    );

    if (eligible.length === 0) {
      return { availability: "unavailable", items: [], reason: "INSUFFICIENT_SAMPLE" };
    }

    return {
      availability: "available",
      items: [...eligible]
        .sort(compareByRating)
        .slice(0, TASTE_RANKING_LIMIT)
        .map((bucket) => ({
          ...toIdentity(bucket),
          averageRating: bucket.averageRating ?? 0,
          ratedReadCount: bucket.ratedReadCount,
        })),
    };
  }
}

function toDiscoveryCard<TShape extends object>({
  entities,
  periodScope,
  toFilters,
  toIdentity,
}: {
  entities: DiscoveredEntity[];
  periodScope: StatisticsPeriodScope;
  toFilters: (entity: DiscoveredEntity) => CompletedReadsFilter;
  toIdentity: (entity: DiscoveredEntity) => TShape;
}) {
  const winner = [...entities].sort(compareDiscoveries)[0];
  if (winner === undefined) {
    return null;
  }

  return {
    ...toIdentity(winner),
    averageRating: winner.averageRating,
    completedReadsAfterDiscovery: winner.completedReadsAfterDiscovery,
    drilldown: toCompletedReadsDrilldown({ filters: toFilters(winner), period: periodScope }),
    firstFinishedAt: winner.firstFinishedAt,
  };
}

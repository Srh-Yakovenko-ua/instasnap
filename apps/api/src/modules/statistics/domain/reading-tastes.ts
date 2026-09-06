import type { BookLanguage, Nullable } from "@app/shared";

import { BookLanguageSchema } from "@app/shared";

import type { CompletedRead } from "./completed-read.js";

export const TASTE_RANKING_LIMIT = 5;

export const MIN_RATED_READS_FOR_RANKING = 3;

export const MIN_RATED_READS_FOR_PUBLISHER_RATING = 2;

export const PUBLISHER_CONCENTRATION_TOP = 3;

export type TasteBucket = {
  averageRating: Nullable<number>;
  completedReadCount: number;
  key: string;
  label: string;
  latestFinishedAt: string;
  ratedReadCount: number;
};

export function compareByFrequency(left: TasteBucket, right: TasteBucket): number {
  if (left.completedReadCount !== right.completedReadCount) {
    return right.completedReadCount - left.completedReadCount;
  }
  return left.key.localeCompare(right.key);
}

export function compareByRating(left: TasteBucket, right: TasteBucket): number {
  const leftRating = left.averageRating ?? Number.NEGATIVE_INFINITY;
  const rightRating = right.averageRating ?? Number.NEGATIVE_INFINITY;
  if (leftRating !== rightRating) {
    return rightRating - leftRating;
  }
  if (left.ratedReadCount !== right.ratedReadCount) {
    return right.ratedReadCount - left.ratedReadCount;
  }
  return left.key.localeCompare(right.key);
}

export function comparePublishers(left: TasteBucket, right: TasteBucket): number {
  if (left.completedReadCount !== right.completedReadCount) {
    return right.completedReadCount - left.completedReadCount;
  }
  const leftRating = eligiblePublisherRating(left) ?? Number.NEGATIVE_INFINITY;
  const rightRating = eligiblePublisherRating(right) ?? Number.NEGATIVE_INFINITY;
  if (leftRating !== rightRating) {
    return rightRating - leftRating;
  }
  return left.key.localeCompare(right.key);
}

export function countKnownLanguages(reads: CompletedRead[]): number {
  return reads.filter((read) => read.language !== null).length;
}

export function countKnownPublishers(reads: CompletedRead[]): number {
  return reads.filter((read) => read.publisher !== null).length;
}

export function eligiblePublisherRating(bucket: TasteBucket): Nullable<number> {
  return bucket.ratedReadCount >= MIN_RATED_READS_FOR_PUBLISHER_RATING
    ? bucket.averageRating
    : null;
}

export function groupByAuthor(reads: CompletedRead[]): TasteBucket[] {
  return collect(reads, (read) =>
    read.authors.map((author) => ({ key: author.authorId, label: author.name })),
  );
}

export function groupByGenre(reads: CompletedRead[]): TasteBucket[] {
  return collect(reads, (read) => read.genres.map((genre) => ({ key: genre, label: genre })));
}

export function groupByLanguage(reads: CompletedRead[]): TasteBucket[] {
  return collect(reads, (read) =>
    read.language === null ? [] : [{ key: read.language, label: read.language }],
  );
}

export function groupByPublisher(reads: CompletedRead[]): TasteBucket[] {
  return collect(reads, (read) =>
    read.publisher === null
      ? []
      : [{ key: read.publisher.publisherId, label: read.publisher.name }],
  );
}

export function languageOf(bucket: TasteBucket): BookLanguage {
  return BookLanguageSchema.parse(bucket.key);
}

function collect(
  reads: CompletedRead[],
  extract: (read: CompletedRead) => { key: string; label: string }[],
): TasteBucket[] {
  const buckets = new Map<string, TasteBucket & { ratingTotal: number }>();

  for (const read of reads) {
    for (const { key, label } of extract(read)) {
      const current = buckets.get(key) ?? {
        averageRating: null,
        completedReadCount: 0,
        key,
        label,
        latestFinishedAt: read.finishedAt,
        ratedReadCount: 0,
        ratingTotal: 0,
      };

      const rated = read.rating !== null;
      buckets.set(key, {
        averageRating: null,
        completedReadCount: current.completedReadCount + 1,
        key,
        label,
        latestFinishedAt:
          read.finishedAt > current.latestFinishedAt ? read.finishedAt : current.latestFinishedAt,
        ratedReadCount: current.ratedReadCount + (rated ? 1 : 0),
        ratingTotal: current.ratingTotal + (read.rating ?? 0),
      });
    }
  }

  return [...buckets.values()].map(({ ratingTotal, ...bucket }) => ({
    ...bucket,
    averageRating: bucket.ratedReadCount === 0 ? null : ratingTotal / bucket.ratedReadCount,
  }));
}

import type { Nullable, ReadingStatisticsRatingBucket } from "@app/shared";

import { BOOK_RATING } from "@app/shared";

import type { CompletedRead } from "./completed-read.js";

export const HIGH_RATING_THRESHOLD = 8;

export type RatingSummary = {
  averageRating: Nullable<number>;
  distribution: ReadingStatisticsRatingBucket[];
  highRatedReadsCount: number;
  highRatedShare: Nullable<number>;
  ratedReads: CompletedRead[];
};

export function compareTopRated(left: CompletedRead, right: CompletedRead): number {
  const leftRating = left.rating ?? 0;
  const rightRating = right.rating ?? 0;
  if (leftRating !== rightRating) {
    return rightRating - leftRating;
  }
  if (left.finishedAt !== right.finishedAt) {
    return right.finishedAt.localeCompare(left.finishedAt);
  }
  return left.readingCycleId.localeCompare(right.readingCycleId);
}

export function summarizeRatings(reads: CompletedRead[]): RatingSummary {
  const ratedReads = reads.filter((read) => read.rating !== null);
  const total = ratedReads.reduce((sum, read) => sum + (read.rating ?? 0), 0);
  const highRatedReadsCount = ratedReads.filter(
    (read) => (read.rating ?? 0) >= HIGH_RATING_THRESHOLD,
  ).length;

  return {
    averageRating: ratedReads.length === 0 ? null : total / ratedReads.length,
    distribution: buildDistribution(ratedReads),
    highRatedReadsCount,
    highRatedShare: ratedReads.length === 0 ? null : highRatedReadsCount / ratedReads.length,
    ratedReads,
  };
}

function buildDistribution(ratedReads: CompletedRead[]): ReadingStatisticsRatingBucket[] {
  const counts = new Map<number, number>();
  for (const read of ratedReads) {
    if (read.rating === null) {
      continue;
    }
    counts.set(read.rating, (counts.get(read.rating) ?? 0) + 1);
  }

  const buckets: ReadingStatisticsRatingBucket[] = [];
  for (let rating = BOOK_RATING.max; rating >= BOOK_RATING.min; rating -= BOOK_RATING.step) {
    buckets.push({ completedReadCount: counts.get(rating) ?? 0, rating });
  }
  return buckets;
}

import type { Nullable } from "@app/shared";

import type { CompletedRead } from "./completed-read.js";

export type DiscoveredEntity = {
  averageRating: Nullable<number>;
  completedReadsAfterDiscovery: number;
  firstFinishedAt: string;
  key: string;
  label: string;
};

export type PriorExposure = {
  authorIds: ReadonlySet<string>;
  genreKeys: ReadonlySet<string>;
  publisherIds: ReadonlySet<string>;
};

export type ReadingDiscoveries = {
  authors: DiscoveredEntity[];
  genres: DiscoveredEntity[];
  provenFirstCompletionCount: number;
  publishers: DiscoveredEntity[];
  uniqueFirstCompletionCandidates: number;
};

export function collectDiscoveries({
  periodReads,
  priorExposure,
}: {
  periodReads: CompletedRead[];
  priorExposure: PriorExposure;
}): ReadingDiscoveries {
  const provenFirsts = periodReads.filter((read) => read.isProvenFirstCompletion);

  return {
    authors: discover({
      alreadySeen: priorExposure.authorIds,
      extract: (read) =>
        read.authors.map((author) => ({ key: author.authorId, label: author.name })),
      periodReads,
      provenFirsts,
    }),
    genres: discover({
      alreadySeen: priorExposure.genreKeys,
      extract: (read) => read.genres.map((genre) => ({ key: genre, label: genre })),
      periodReads,
      provenFirsts,
    }),
    provenFirstCompletionCount: new Set(provenFirsts.map((read) => read.bookId)).size,
    publishers: discover({
      alreadySeen: priorExposure.publisherIds,
      extract: (read) =>
        read.publisher === null
          ? []
          : [{ key: read.publisher.publisherId, label: read.publisher.name }],
      periodReads,
      provenFirsts,
    }),
    uniqueFirstCompletionCandidates: new Set(periodReads.map((read) => read.bookId)).size,
  };
}

export function compareDiscoveries(left: DiscoveredEntity, right: DiscoveredEntity): number {
  if (left.completedReadsAfterDiscovery !== right.completedReadsAfterDiscovery) {
    return right.completedReadsAfterDiscovery - left.completedReadsAfterDiscovery;
  }
  const leftRating = left.averageRating ?? Number.NEGATIVE_INFINITY;
  const rightRating = right.averageRating ?? Number.NEGATIVE_INFINITY;
  if (leftRating !== rightRating) {
    return rightRating - leftRating;
  }
  if (left.firstFinishedAt !== right.firstFinishedAt) {
    return right.firstFinishedAt.localeCompare(left.firstFinishedAt);
  }
  return left.key.localeCompare(right.key);
}

function discover({
  alreadySeen,
  extract,
  periodReads,
  provenFirsts,
}: {
  alreadySeen: ReadonlySet<string>;
  extract: (read: CompletedRead) => { key: string; label: string }[];
  periodReads: CompletedRead[];
  provenFirsts: CompletedRead[];
}): DiscoveredEntity[] {
  const discovered = new Map<string, { firstFinishedAt: string; label: string }>();

  for (const read of [...provenFirsts].sort((left, right) =>
    left.finishedAt.localeCompare(right.finishedAt),
  )) {
    for (const { key, label } of extract(read)) {
      if (alreadySeen.has(key) || discovered.has(key)) {
        continue;
      }
      discovered.set(key, { firstFinishedAt: read.finishedAt, label });
    }
  }

  return [...discovered.entries()].map(([key, { firstFinishedAt, label }]) => {
    const related = periodReads.filter((read) =>
      extract(read).some((entity) => entity.key === key),
    );
    const rated = related.filter((read) => read.rating !== null);

    return {
      averageRating:
        rated.length === 0
          ? null
          : rated.reduce((sum, read) => sum + (read.rating ?? 0), 0) / rated.length,
      completedReadsAfterDiscovery: related.length,
      firstFinishedAt,
      key,
      label,
    };
  });
}

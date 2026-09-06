import type { Nullable } from "@app/shared";

import type { CompletedRead } from "./completed-read.js";

export const SERIES_RANKING_LIMIT = 5;

export const SERIES_PROGRESS_LIMIT = 3;

export const MIN_MARATHON_LENGTH = 2;

export type SeriesActivity = {
  attributablePagesRead: number;
  completedReadCycles: number;
  latestFinishedAt: string;
  name: string;
  seriesId: string;
};

export type SeriesLifecycleCounts = {
  caughtUp: number;
  completed: number;
  continued: number;
  started: number;
};

export type SeriesMarathon = {
  endFinishedAt: string;
  length: number;
  name: string;
  seriesId: string;
  startReadingCycleId: string;
};

export type SeriesProgress = {
  distinctFirstCompletions: number;
  name: string;
  seriesId: string;
};

export function collectSeriesActivity({
  pagesByBookId,
  reads,
}: {
  pagesByBookId: ReadonlyMap<string, number>;
  reads: CompletedRead[];
}): SeriesActivity[] {
  const activity = new Map<string, SeriesActivity>();

  for (const read of reads) {
    if (read.series === null) {
      continue;
    }
    const { name, seriesId } = read.series;
    const current = activity.get(seriesId) ?? {
      attributablePagesRead: 0,
      completedReadCycles: 0,
      latestFinishedAt: read.finishedAt,
      name,
      seriesId,
    };

    activity.set(seriesId, {
      attributablePagesRead: current.attributablePagesRead + (pagesByBookId.get(read.bookId) ?? 0),
      completedReadCycles: current.completedReadCycles + 1,
      latestFinishedAt:
        read.finishedAt > current.latestFinishedAt ? read.finishedAt : current.latestFinishedAt,
      name,
      seriesId,
    });
  }

  return [...activity.values()];
}

export function collectSeriesProgress(reads: CompletedRead[]): SeriesProgress[] {
  const progress = new Map<string, { books: Set<string>; name: string }>();

  for (const read of reads) {
    if (read.series === null || !read.isProvenFirstCompletion) {
      continue;
    }
    const current = progress.get(read.series.seriesId) ?? {
      books: new Set<string>(),
      name: read.series.name,
    };
    current.books.add(read.bookId);
    progress.set(read.series.seriesId, current);
  }

  return [...progress.entries()].map(([seriesId, { books, name }]) => ({
    distinctFirstCompletions: books.size,
    name,
    seriesId,
  }));
}

export function compareSeriesActivity(left: SeriesActivity, right: SeriesActivity): number {
  if (left.completedReadCycles !== right.completedReadCycles) {
    return right.completedReadCycles - left.completedReadCycles;
  }
  if (left.attributablePagesRead !== right.attributablePagesRead) {
    return right.attributablePagesRead - left.attributablePagesRead;
  }
  if (left.latestFinishedAt !== right.latestFinishedAt) {
    return right.latestFinishedAt.localeCompare(left.latestFinishedAt);
  }
  return left.seriesId.localeCompare(right.seriesId);
}

export function compareSeriesProgress(left: SeriesProgress, right: SeriesProgress): number {
  if (left.distinctFirstCompletions !== right.distinctFirstCompletions) {
    return right.distinctFirstCompletions - left.distinctFirstCompletions;
  }
  return left.seriesId.localeCompare(right.seriesId);
}

export function countSeriesReads(reads: CompletedRead[]): number {
  return reads.filter((read) => read.series !== null).length;
}

export function findLongestMarathon(reads: CompletedRead[]): Nullable<SeriesMarathon> {
  const ordered = [...reads].sort(compareChronologically);
  const candidates: SeriesMarathon[] = [];
  let run: CompletedRead[] = [];

  const flush = (): void => {
    const first = run[0];
    const last = run.at(-1);
    if (first?.series !== undefined && first.series !== null && last !== undefined) {
      candidates.push({
        endFinishedAt: last.finishedAt,
        length: run.length,
        name: first.series.name,
        seriesId: first.series.seriesId,
        startReadingCycleId: first.readingCycleId,
      });
    }
    run = [];
  };

  for (const read of ordered) {
    const previousSeriesId = run[0]?.series?.seriesId ?? null;
    if (read.series === null) {
      flush();
      continue;
    }
    if (previousSeriesId !== null && previousSeriesId !== read.series.seriesId) {
      flush();
    }
    run.push(read);
  }
  flush();

  const eligible = candidates.filter((candidate) => candidate.length >= MIN_MARATHON_LENGTH);
  return eligible.sort(compareMarathons)[0] ?? null;
}

export function resolveSeriesLifecycle({
  firstCompletionsBeforePeriod,
  periodReads,
}: {
  firstCompletionsBeforePeriod: ReadonlyMap<string, number>;
  periodReads: CompletedRead[];
}): SeriesLifecycleCounts {
  const bySeries = new Map<string, { books: Set<string>; read: CompletedRead }>();

  for (const read of periodReads) {
    if (read.series === null || !read.isProvenFirstCompletion) {
      continue;
    }
    const current = bySeries.get(read.series.seriesId) ?? { books: new Set<string>(), read };
    current.books.add(read.bookId);
    bySeries.set(read.series.seriesId, current);
  }

  const counts: SeriesLifecycleCounts = { caughtUp: 0, completed: 0, continued: 0, started: 0 };

  for (const [seriesId, { books, read }] of bySeries) {
    const before = firstCompletionsBeforePeriod.get(seriesId) ?? 0;
    if (before === 0) {
      counts.started += 1;
    } else {
      counts.continued += 1;
    }

    const series = read.series;
    if (series === null) {
      continue;
    }
    const total = before + books.size;
    if (series.totalBooks !== null && total >= series.totalBooks) {
      counts.completed += 1;
      continue;
    }
    if (series.knownBooksCount > 0 && total >= series.knownBooksCount) {
      counts.caughtUp += 1;
    }
  }

  return counts;
}

function compareChronologically(left: CompletedRead, right: CompletedRead): number {
  if (left.finishedAt !== right.finishedAt) {
    return left.finishedAt.localeCompare(right.finishedAt);
  }
  return left.readingCycleId.localeCompare(right.readingCycleId);
}

function compareMarathons(left: SeriesMarathon, right: SeriesMarathon): number {
  if (left.length !== right.length) {
    return right.length - left.length;
  }
  if (left.endFinishedAt !== right.endFinishedAt) {
    return right.endFinishedAt.localeCompare(left.endFinishedAt);
  }
  if (left.seriesId !== right.seriesId) {
    return left.seriesId.localeCompare(right.seriesId);
  }
  return left.startReadingCycleId.localeCompare(right.startReadingCycleId);
}

import type { BookLanguage, Nullable, StatisticsBookRef } from "@app/shared";

export type CompletedRead = {
  authors: CompletedReadAuthor[];
  bookId: string;
  bookState: StatisticsBookRef["bookState"];
  coverThumbUrl: Nullable<string>;
  finishedAt: string;
  genres: string[];
  isProvenFirstCompletion: boolean;
  language: Nullable<BookLanguage>;
  pagesCount: Nullable<number>;
  publisher: Nullable<CompletedReadPublisher>;
  rating: Nullable<number>;
  readingCycleId: string;
  series: Nullable<CompletedReadSeries>;
  startedAt: Nullable<string>;
  title: string;
};

export type CompletedReadAuthor = { authorId: string; name: string };

export type CompletedReadPublisher = { name: string; publisherId: string };

export type CompletedReadSeries = {
  knownBooksCount: number;
  name: string;
  partNumber: Nullable<number>;
  seriesId: string;
  status: string;
  totalBooks: Nullable<number>;
};

export function compareByFinishedAtDesc(left: CompletedRead, right: CompletedRead): number {
  if (left.finishedAt !== right.finishedAt) {
    return right.finishedAt.localeCompare(left.finishedAt);
  }
  return left.readingCycleId.localeCompare(right.readingCycleId);
}

export function countUniqueBooks(reads: CompletedRead[]): number {
  return new Set(reads.map((read) => read.bookId)).size;
}

export function toBookRef(read: CompletedRead): StatisticsBookRef {
  return {
    bookId: read.bookId,
    bookState: read.bookState,
    coverThumbUrl: read.coverThumbUrl,
    title: read.title,
  };
}

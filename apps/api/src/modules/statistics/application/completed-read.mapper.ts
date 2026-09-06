import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { CompletedRead } from "../domain/completed-read.js";
import type { CompletedReadRow } from "../infrastructure/statistics-completion.repository.js";

import { toIsoDate } from "../../../core/iso-date.js";
import { FIRST_COMPLETION_RELIABILITY, parseReadingCompletionSnapshot } from "../../books/index.js";
import { MediaService } from "../../media/index.js";

@Injectable()
export class CompletedReadMapper {
  constructor(private readonly mediaService: MediaService) {}

  toCompletedRead(row: CompletedReadRow): Nullable<CompletedRead> {
    if (row.finishedAt === null) {
      return null;
    }

    const snapshot = parseReadingCompletionSnapshot(row.completionMetadata);

    return {
      authors: snapshot?.authors ?? [],
      bookId: row.bookId,
      bookState: row.book.deletedAt === null ? "active" : "soft_deleted",
      coverThumbUrl: this.mediaService.buildThumbUrlOrNull(row.book.coverMedia),
      finishedAt: toIsoDate(row.finishedAt),
      genres: snapshot?.book.genres ?? [],
      isProvenFirstCompletion:
        row.firstCompletionReliability === FIRST_COMPLETION_RELIABILITY.provenFirst,
      language: snapshot?.book.language ?? null,
      pagesCount: snapshot?.book.pagesCount ?? null,
      publisher: snapshot?.publisher ?? null,
      rating: row.rating,
      readingCycleId: row.id,
      series: snapshot?.series ?? null,
      startedAt: row.startedAt === null ? null : toIsoDate(row.startedAt),
      title: snapshot?.book.title ?? row.book.title,
    };
  }

  toCompletedReads(rows: CompletedReadRow[]): CompletedRead[] {
    return rows.flatMap((row) => {
      const read = this.toCompletedRead(row);
      return read === null ? [] : [read];
    });
  }
}

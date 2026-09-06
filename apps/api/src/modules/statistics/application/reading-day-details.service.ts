import type { ReadingDayDetails } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ReadingHistoryProvenanceService } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { resolveDayHistoryQuality } from "../domain/activity-history-quality.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";

@Injectable()
export class ReadingDayDetailsService {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly mediaService: MediaService,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
  ) {}

  async getDayDetails({
    date,
    userId,
  }: {
    date: string;
    userId: string;
  }): Promise<ReadingDayDetails> {
    const [rows, { activityReliableFrom }] = await Promise.all([
      this.activityRepository.findDayDetails({ date, userId }),
      this.readingHistoryProvenanceService.ensure(userId),
    ]);

    return {
      books: rows.map((row) => ({
        bookId: row.bookId,
        bookState: row.deletedAt === null ? "active" : "soft_deleted",
        coverThumbUrl: this.mediaService.buildThumbUrlOrNull(row.coverMedia),
        pagesRead: row.pagesRead,
        title: row.title,
      })),
      booksCount: rows.length,
      date,
      historyQuality: resolveDayHistoryQuality({ date, reliableFrom: activityReliableFrom }),
      pagesRead: rows.reduce((sum, row) => sum + row.pagesRead, 0),
    };
  }
}

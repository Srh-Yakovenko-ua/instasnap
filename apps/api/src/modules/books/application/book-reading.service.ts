import type {
  BookView,
  ChangeReadingStatusInput,
  Nullable,
  ReadingHistoryQuery,
  ReadingHistoryView,
  UpdateReadingProgressInput,
} from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingProgressEventData } from "../infrastructure/books.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ValidationError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { toReadingHistoryView } from "../domain/reading-history.mapper.js";
import { computeReadingProgressChange } from "../domain/reading-progress-transition.js";
import { computeReadingStatusChange } from "../domain/reading-status-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const PAGE_EXCEEDS_PAGES_MESSAGE = "Current page cannot exceed the page count";
const PAGE_BELOW_PROGRESS_MESSAGE = "Current page cannot be lower than the saved progress";

@Injectable()
export class BookReadingService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly transactionRunner: TransactionRunner,
    private readonly readingGoalSyncService: ReadingGoalSyncService,
    private readonly readingLifecycleCoordinator: ReadingLifecycleCoordinator,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async changeReadingStatus(
    userId: string,
    bookId: string,
    input: ChangeReadingStatusInput,
  ): Promise<BookView> {
    const changeDate = input.date ?? (await this.userSettingsContextService.today(userId));

    await this.transactionRunner.run(async (tx) => {
      await this.booksRepository.acquireBookLock(bookId, tx);
      const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

      if (
        input.currentPage !== undefined &&
        book.pagesCount !== null &&
        input.currentPage > book.pagesCount
      ) {
        throw new ValidationError(PAGE_EXCEEDS_PAGES_MESSAGE);
      }

      const patch = computeReadingStatusChange({
        currentPage: input.currentPage,
        date: changeDate,
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        hasExistingProgress: book.readingProgress !== null,
        impression: input.impression,
        note: input.note,
        pagesCount: book.pagesCount,
        rating: input.rating,
        resetProgress: input.resetProgress,
        targetStatus: input.status,
      });

      await this.booksRepository.applyReadingChange(userId, bookId, patch, tx);

      await this.readingLifecycleCoordinator.apply(
        {
          bookId,
          currentStatus: ReadingStatusSchema.parse(book.readingStatus),
          date: changeDate,
          event: buildProgressEvent({
            previousPage: book.readingProgress?.currentPage ?? 0,
            resolvedPage: patch.progress.currentPage,
            updateDate: changeDate,
          }),
          existingStartedAt: book.readingProgress?.startedAt ?? null,
          rating: input.rating ?? book.readingProgress?.rating ?? null,
          targetStatus: input.status,
          userId,
        },
        tx,
      );

      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async getReadingHistory(
    userId: string,
    bookId: string,
    query: ReadingHistoryQuery,
  ): Promise<ReadingHistoryView> {
    const book = await this.booksRepository.findReadingSnapshotOrThrow(userId, bookId);
    const events = await this.booksRepository.findReadingEvents({ bookId });
    const today = await this.userSettingsContextService.today(userId);

    return toReadingHistoryView({
      events,
      pagesCount: book.pagesCount,
      progress: {
        abandonedAt: book.readingProgress?.abandonedAt ?? null,
        currentPage: book.readingProgress?.currentPage ?? null,
        finishedAt: book.readingProgress?.finishedAt ?? null,
        lastProgressUpdateAt: book.readingProgress?.lastProgressUpdateAt ?? null,
        pausedAt: book.readingProgress?.pausedAt ?? null,
        startedAt: book.readingProgress?.startedAt ?? null,
      },
      query,
      readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      today: parseIsoDate(today),
    });
  }

  async startReading(
    userId: string,
    bookId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const startDate = await this.userSettingsContextService.today(userId);
    const start = (tx: Prisma.TransactionClient): Promise<void> =>
      this.applyStart({ bookId, startDate, tx, userId });

    if (client === undefined) {
      await this.transactionRunner.run(start);
      return;
    }
    await start(client);
  }

  async updateReadingProgress(
    userId: string,
    bookId: string,
    input: UpdateReadingProgressInput,
  ): Promise<BookView> {
    const updateDate = input.updateDate ?? (await this.userSettingsContextService.today(userId));

    await this.transactionRunner.run(async (tx) => {
      await this.booksRepository.acquireBookLock(bookId, tx);
      const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

      if (book.pagesCount !== null && input.currentPage > book.pagesCount) {
        throw new ValidationError(PAGE_EXCEEDS_PAGES_MESSAGE);
      }

      const existingPage = book.readingProgress?.currentPage ?? null;
      if (existingPage !== null && input.currentPage < existingPage) {
        throw new ValidationError(PAGE_BELOW_PROGRESS_MESSAGE);
      }

      const currentStatus = ReadingStatusSchema.parse(book.readingStatus);
      const patch = computeReadingProgressChange({
        currentPage: input.currentPage,
        currentStatus,
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        markAsFinished: input.markAsFinished,
        pagesCount: book.pagesCount,
        updateDate,
      });

      await this.booksRepository.applyReadingChange(userId, bookId, patch, tx);

      await this.readingLifecycleCoordinator.apply(
        {
          bookId,
          currentStatus,
          date: updateDate,
          event: buildProgressEvent({
            previousPage: book.readingProgress?.currentPage ?? 0,
            resolvedPage: patch.progress.currentPage,
            updateDate,
          }),
          existingStartedAt: book.readingProgress?.startedAt ?? null,
          rating: book.readingProgress?.rating ?? null,
          targetStatus: patch.book?.readingStatus ?? currentStatus,
          userId,
        },
        tx,
      );

      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async applyStart({
    bookId,
    startDate,
    tx,
    userId,
  }: {
    bookId: string;
    startDate: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    await this.booksRepository.acquireBookLock(bookId, tx);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

    const patch = computeReadingStatusChange({
      date: startDate,
      existingStartedAt: book.readingProgress?.startedAt ?? null,
      hasExistingProgress: book.readingProgress !== null,
      pagesCount: book.pagesCount,
      targetStatus: "reading",
    });

    await this.booksRepository.applyReadingChange(userId, bookId, patch, tx);

    await this.readingLifecycleCoordinator.apply(
      {
        bookId,
        currentStatus: ReadingStatusSchema.parse(book.readingStatus),
        date: startDate,
        event: null,
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        rating: book.readingProgress?.rating ?? null,
        targetStatus: "reading",
        userId,
      },
      tx,
    );

    await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
  }
}

function buildProgressEvent({
  previousPage,
  resolvedPage,
  updateDate,
}: {
  previousPage: number;
  resolvedPage: Nullable<number> | undefined;
  updateDate: string;
}): Nullable<ReadingProgressEventData> {
  if (resolvedPage === null || resolvedPage === undefined) {
    return null;
  }

  const pagesRead = resolvedPage - previousPage;
  if (pagesRead <= 0) {
    return null;
  }

  return { date: parseIsoDate(updateDate), page: resolvedPage, pagesRead };
}

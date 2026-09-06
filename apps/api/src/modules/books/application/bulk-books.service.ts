import type {
  BulkActionResult,
  BulkBookIds,
  BulkFavoriteInput,
  BulkListsInput,
  BulkOwnershipStatusInput,
  BulkPagesCountInput,
  BulkPagesCountResult,
  BulkReadingStatusInput,
  BulkTagsInput,
  QueuePriority,
  ReadingStatus,
} from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { parseISO } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { ListsService } from "../../lists/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { TagsService } from "../../tags/index.js";
import {
  ownershipStatusKeepsPurchase,
  ownershipStatusUsesDelivery,
  ownershipStatusUsesLoan,
  readingStatusUsesProgress,
} from "../domain/book-blocks.js";
import { computeReadingStatusChange } from "../domain/reading-status-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BulkBooksRepository } from "../infrastructure/bulk-books.repository.js";
import { BookPurgeScheduler } from "./book-purge.scheduler.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";

@Injectable()
export class BulkBooksService {
  constructor(
    private readonly bulkBooksRepository: BulkBooksRepository,
    private readonly tagsService: TagsService,
    private readonly listsService: ListsService,
    private readonly purgeScheduler: BookPurgeScheduler,
    private readonly transactionRunner: TransactionRunner,
    private readonly readingGoalSyncService: ReadingGoalSyncService,
    private readonly booksRepository: BooksRepository,
    private readonly readingLifecycleCoordinator: ReadingLifecycleCoordinator,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async addTags({
    input,
    userId,
  }: {
    input: BulkTagsInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const ownedBookIds = await this.bulkBooksRepository.findOwnedIds({
      bookIds: input.bookIds,
      userId,
    });
    if (ownedBookIds.length === 0) {
      return { affected: 0 };
    }
    const tagIds = await this.tagsService.resolveOrCreateMany(userId, input.tags);
    if (tagIds.length === 0) {
      return { affected: 0 };
    }
    const affected = await this.bulkBooksRepository.addTags({
      bookIds: ownedBookIds,
      tagIds,
      userId,
    });
    return { affected };
  }

  async addToLists({
    input,
    userId,
  }: {
    input: BulkListsInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const ownedBookIds = await this.bulkBooksRepository.findOwnedIds({
      bookIds: input.bookIds,
      userId,
    });
    if (ownedBookIds.length === 0) {
      return { affected: 0 };
    }

    const affected = await this.transactionRunner.run(async (tx) => {
      const listIds = await this.listsService.resolveListsForBook(
        { input: { listIds: input.listIds, newLists: input.newLists }, userId },
        tx,
      );
      if (listIds.length === 0) {
        return 0;
      }
      return this.bulkBooksRepository.addToLists(
        { bookIds: ownedBookIds, listIds, now: new Date(), userId },
        tx,
      );
    });
    return { affected };
  }

  async addToReadingQueue({
    input,
    userId,
  }: {
    input: BulkBookIds;
    userId: string;
  }): Promise<BulkActionResult> {
    const affected = await this.bulkBooksRepository.addToReadingQueue({
      bookIds: input.bookIds,
      queuePriority: DEFAULT_QUEUE_PRIORITY,
      userId,
    });
    return { affected };
  }

  async delete({
    input,
    userId,
  }: {
    input: BulkBookIds;
    userId: string;
  }): Promise<BulkActionResult> {
    const deletedIds = await this.transactionRunner.run(async (tx) => {
      const softDeleted = await this.bulkBooksRepository.softDelete(
        { bookIds: input.bookIds, stamp: TRASH_RETENTION.stamp(), userId },
        tx,
      );
      await this.readingGoalSyncService.syncBooks({ bookIds: softDeleted, client: tx, userId });
      return softDeleted;
    });
    await this.purgeScheduler.scheduleMany({ bookIds: deletedIds, userId });
    return { affected: deletedIds.length };
  }

  async setFavorite({
    input,
    userId,
  }: {
    input: BulkFavoriteInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const affected = await this.bulkBooksRepository.setFavorite({
      bookIds: input.bookIds,
      isFavorite: input.isFavorite,
      now: new Date(),
      userId,
    });
    return { affected };
  }

  async setOwnershipStatus({
    input,
    userId,
  }: {
    input: BulkOwnershipStatusInput;
    userId: string;
  }): Promise<BulkActionResult> {
    if (ownershipStatusUsesLoan(input.ownershipStatus)) {
      throw new BadRequestError(
        "A loan status requires a per-book borrower; set it on each book individually",
      );
    }

    const affected = await this.bulkBooksRepository.setOwnershipStatus({
      bookIds: input.bookIds,
      clearDelivery: !ownershipStatusUsesDelivery(input.ownershipStatus),
      clearLoan: true,
      clearPurchase: !ownershipStatusKeepsPurchase(input.ownershipStatus),
      now: new Date(),
      ownershipStatus: input.ownershipStatus,
      userId,
    });
    return { affected };
  }

  async setReadingStatus({
    input,
    userId,
  }: {
    input: BulkReadingStatusInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const ownedBookIds = await this.bulkBooksRepository.findOwnedIds({
      bookIds: input.bookIds,
      userId,
    });
    if (ownedBookIds.length === 0) {
      return { affected: 0 };
    }

    const today = await this.userSettingsContextService.today(userId);
    const orderedBookIds = [...ownedBookIds].sort();

    const affected = await this.transactionRunner.run(async (tx) => {
      let applied = 0;
      for (const bookId of orderedBookIds) {
        const changed = await this.applyReadingStatus({
          bookId,
          readingStatus: input.readingStatus,
          today,
          tx,
          userId,
        });
        applied += changed ? 1 : 0;
      }

      await this.readingGoalSyncService.syncBooks({ bookIds: orderedBookIds, client: tx, userId });
      return applied;
    });

    return { affected };
  }

  async updatePagesCount({
    input,
    userId,
  }: {
    input: BulkPagesCountInput;
    userId: string;
  }): Promise<BulkPagesCountResult> {
    return this.transactionRunner.run(async (tx) => {
      const bookIds = input.items.map((item) => item.bookId);
      const snapshots = await this.bulkBooksRepository.findPagesCountSnapshots(
        { bookIds, userId },
        tx,
      );
      const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

      const failed: BulkPagesCountResult["failed"] = [];
      const updated: string[] = [];

      for (const item of input.items) {
        const snapshot = snapshotById.get(item.bookId);
        if (snapshot === undefined) {
          failed.push({ bookId: item.bookId, reason: "not_found" });
          continue;
        }
        if (snapshot.updatedAt.toISOString() !== item.expectedUpdatedAt) {
          failed.push({ bookId: item.bookId, reason: "stale" });
          continue;
        }
        const expectedUpdatedAt = parseISO(item.expectedUpdatedAt);
        if (item.kind === "pages_count") {
          if (snapshot.currentPage !== null && snapshot.currentPage > item.pagesCount) {
            failed.push({ bookId: item.bookId, reason: "below_current_page" });
            continue;
          }
          const changed = await this.bulkBooksRepository.setPagesCount(
            { bookId: item.bookId, expectedUpdatedAt, pagesCount: item.pagesCount, userId },
            tx,
          );
          if (changed === 0) {
            failed.push({ bookId: item.bookId, reason: "stale" });
            continue;
          }
          updated.push(item.bookId);
          continue;
        }
        const changed = await this.bulkBooksRepository.markPagesCountUnavailable(
          { bookId: item.bookId, expectedUpdatedAt, userId },
          tx,
        );
        if (changed === 0) {
          failed.push({ bookId: item.bookId, reason: "stale" });
          continue;
        }
        updated.push(item.bookId);
      }

      return { failed, updated };
    });
  }

  private async applyReadingStatus({
    bookId,
    readingStatus,
    today,
    tx,
    userId,
  }: {
    bookId: string;
    readingStatus: ReadingStatus;
    today: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<boolean> {
    await this.booksRepository.acquireBookLock(bookId, tx);
    const book = await this.booksRepository.findOwnedById(userId, bookId, tx);
    if (book === null) {
      return false;
    }

    const currentStatus = ReadingStatusSchema.parse(book.readingStatus);
    const patch = computeReadingStatusChange({
      date: today,
      existingStartedAt: book.readingProgress?.startedAt ?? null,
      hasExistingProgress: book.readingProgress !== null,
      pagesCount: book.pagesCount,
      targetStatus: readingStatus,
    });

    await this.booksRepository.applyReadingChange(userId, bookId, patch, tx);
    if (!readingStatusUsesProgress(readingStatus)) {
      await this.bulkBooksRepository.clearReadingProgress({ bookIds: [bookId], userId }, tx);
    }

    await this.readingLifecycleCoordinator.apply(
      {
        bookId,
        currentStatus,
        date: today,
        event: null,
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        rating: book.readingProgress?.rating ?? null,
        targetStatus: readingStatus,
        userId,
      },
      tx,
    );

    return true;
  }
}

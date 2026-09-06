import type { Nullable, OwnershipStatus, QueuePriority } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { BookOrderItemsRepository } from "../../delivery/index.js";
import { WISHLIST_OWNERSHIP_STATUS } from "../domain/wishlist-added-at.js";
import { ListMembershipRepository } from "./list-membership.repository.js";
import { resequenceQueue } from "./queue-invariant.js";

export type PagesCountSnapshot = {
  currentPage: Nullable<number>;
  id: string;
  updatedAt: Date;
};

@Injectable()
export class BulkBooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
  ) {}

  addTags(
    {
      bookIds,
      tagIds,
      userId,
    }: {
      bookIds: string[];
      tagIds: string[];
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const ownedBooks = await tx.book.findMany({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
      });
      if (ownedBooks.length === 0) {
        return 0;
      }
      await tx.bookTag.createMany({
        data: ownedBooks.flatMap((book) => tagIds.map((tagId) => ({ bookId: book.id, tagId }))),
        skipDuplicates: true,
      });
      return ownedBooks.length;
    });
  }

  addToLists(
    {
      bookIds,
      listIds,
      now,
      userId,
    }: {
      bookIds: string[];
      listIds: string[];
      now: Date;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const ownedBooks = await tx.book.findMany({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
      });
      if (ownedBooks.length === 0) {
        return 0;
      }

      const ownedIds = new Set(ownedBooks.map((book) => book.id));
      const orderedOwnedIds = [...new Set(bookIds)].filter((bookId) => ownedIds.has(bookId));

      const sortedListIds = [...new Set(listIds)].sort();
      for (const listId of sortedListIds) {
        await this.membershipRepository.acquireListLock(tx, { listId });
      }
      for (const listId of sortedListIds) {
        const added = await this.membershipRepository.appendMany(tx, {
          bookIds: orderedOwnedIds,
          listId,
        });
        if (added > 0) {
          await this.membershipRepository.touchList(tx, { listId, now, userId });
        }
      }

      return ownedBooks.length;
    });
  }

  addToReadingQueue(
    {
      bookIds,
      queuePriority,
      userId,
    }: {
      bookIds: string[];
      queuePriority: QueuePriority;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await acquireUserQueueLock(userId, tx);

      const ownedUnqueued = await tx.book.findMany({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, queuePosition: null, userId },
      });
      if (ownedUnqueued.length === 0) {
        return 0;
      }

      const inputOrder = new Map(bookIds.map((bookId, index) => [bookId, index]));
      const ordered = [...ownedUnqueued].sort(
        (left, right) => (inputOrder.get(left.id) ?? 0) - (inputOrder.get(right.id) ?? 0),
      );

      const aggregate = await tx.book.aggregate({
        _max: { queuePosition: true },
        where: { ...SOFT_DELETE_SCOPE.active, userId },
      });
      const basePosition = aggregate._max.queuePosition ?? 0;

      let offset = 0;
      for (const book of ordered) {
        offset += 1;
        await tx.book.updateMany({
          data: { queuePosition: basePosition + offset, queuePriority },
          where: { ...SOFT_DELETE_SCOPE.active, id: book.id, userId },
        });
      }

      return ordered.length;
    });
  }

  clearReadingProgress(
    { bookIds, userId }: { bookIds: string[]; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await tx.bookReadingProgress.deleteMany({
        where: { book: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId } },
      });
    });
  }

  async findOwnedIds({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<string[]> {
    const ownedBooks = await this.prisma.book.findMany({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
    });
    const ownedIds = new Set(ownedBooks.map((book) => book.id));
    return [...new Set(bookIds)].filter((id) => ownedIds.has(id));
  }

  async findPagesCountSnapshots(
    {
      bookIds,
      userId,
    }: {
      bookIds: string[];
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PagesCountSnapshot[]> {
    const books = await client.book.findMany({
      select: { id: true, readingProgress: { select: { currentPage: true } }, updatedAt: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
    });
    return books.map((book) => ({
      currentPage: book.readingProgress?.currentPage ?? null,
      id: book.id,
      updatedAt: book.updatedAt,
    }));
  }

  async markPagesCountUnavailable(
    {
      bookId,
      expectedUpdatedAt,
      userId,
    }: {
      bookId: string;
      expectedUpdatedAt: Date;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.book.updateMany({
      data: { pagesCountUnavailable: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, updatedAt: expectedUpdatedAt, userId },
    });
    return updated.count;
  }

  async setFavorite({
    bookIds,
    isFavorite,
    now,
    userId,
  }: {
    bookIds: string[];
    isFavorite: boolean;
    now: Date;
    userId: string;
  }): Promise<number> {
    const updated = await this.prisma.book.updateMany({
      data: { favoriteAddedAt: isFavorite ? now : null, isFavorite },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, isFavorite: !isFavorite, userId },
    });
    return updated.count;
  }

  setOwnershipStatus(
    {
      bookIds,
      clearDelivery,
      clearLoan,
      clearPurchase,
      now,
      ownershipStatus,
      userId,
    }: {
      bookIds: string[];
      clearDelivery: boolean;
      clearLoan: boolean;
      clearPurchase: boolean;
      now: Date;
      ownershipStatus: OwnershipStatus;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const scope = { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId };

      if (ownershipStatus === WISHLIST_OWNERSHIP_STATUS) {
        await tx.book.updateMany({
          data: { wishlistAddedAt: now },
          where: { ...scope, ownershipStatus: { not: WISHLIST_OWNERSHIP_STATUS } },
        });
      } else {
        await tx.book.updateMany({
          data: { wishlistAddedAt: null },
          where: { ...scope, ownershipStatus: WISHLIST_OWNERSHIP_STATUS },
        });
      }

      const updated = await tx.book.updateMany({ data: { ownershipStatus }, where: scope });
      if (updated.count === 0) {
        return 0;
      }
      if (clearDelivery) {
        await this.bookOrderItemsRepository.cancelActiveForBooks(
          { bookIds, cancelledAt: now, cancelReason: null, userId },
          tx,
        );
      }
      if (clearLoan) {
        await tx.bookLoan.updateMany({
          data: {
            remindBeforeDays: null,
            remindToReturn: false,
            returnedAt: now,
            status: "returned",
          },
          where: { bookId: { in: bookIds }, status: "active", userId },
        });
      }
      if (clearPurchase) {
        await tx.bookPurchaseInfo.deleteMany({
          where: { book: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId } },
        });
      }
      return updated.count;
    });
  }

  async setPagesCount(
    {
      bookId,
      expectedUpdatedAt,
      pagesCount,
      userId,
    }: {
      bookId: string;
      expectedUpdatedAt: Date;
      pagesCount: number;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.book.updateMany({
      data: { pagesCount, pagesCountUnavailable: false },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, updatedAt: expectedUpdatedAt, userId },
    });
    return updated.count;
  }

  softDelete(
    {
      bookIds,
      stamp,
      userId,
    }: {
      bookIds: string[];
      stamp: TrashStamp;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<string[]> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const owned = await tx.book.findMany({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
      });
      if (owned.length === 0) {
        return [];
      }
      const ownedIds = owned.map((book) => book.id);
      await acquireUserQueueLock(userId, tx);
      await tx.book.updateMany({
        data: {
          ...stamp,
          queuePosition: null,
          queuePriority: null,
          queuePriorityReason: null,
          queuePriorityReasonCustomText: null,
          queuePriorityTargetDate: null,
        },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: ownedIds }, userId },
      });
      await resequenceQueue(tx, userId);
      return ownedIds;
    });
  }
}

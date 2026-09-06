import type { BookView, CreateBookInput, Nullable, UpdateBookInput } from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingLifecycleDates } from "../domain/reading-lifecycle-date.js";

import {
  HEAVY_TRANSACTION_OPTIONS,
  TransactionRunner,
} from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { toCreateDate } from "../../../core/iso-date.js";
import { SingleBookOrderService } from "../../delivery/index.js";
import { LoanContactResolver } from "../../loans/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import {
  buildDeliveryInfoData,
  buildLoanInfoData,
  buildPurchaseInfoData,
  buildReadingProgressData,
  ownershipStatusKeepsPurchase,
  ownershipStatusUsesDelivery,
  ownershipStatusUsesLoan,
  readingStatusUsesProgress,
  resolveDeliveryBlock,
  resolveLoanBlock,
  resolvePurchaseBlock,
  resolveReadingProgressBlock,
} from "../domain/book-blocks.js";
import {
  applyDedicationFields,
  applyFavoriteDedicationFields,
  applyFavoriteFields,
  applyWishlistFields,
  assignScalarFields,
  normalizeDedication,
} from "../domain/book-update-fields.js";
import {
  assertCurrentPageWithinPages,
  assertLoanPersonPresent,
} from "../domain/book-update-guards.js";
import { resolveFavoriteChange } from "../domain/favorite.js";
import { resolveReadingLifecycleDate } from "../domain/reading-lifecycle-date.js";
import { resolveWishlistAddedAtChange } from "../domain/wishlist-added-at.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BookRelationsResolver, type SeriesPlacement } from "./book-relations-resolver.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

@Injectable()
export class BooksService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly relationsResolver: BookRelationsResolver,
    private readonly viewAssembler: BookViewAssembler,
    private readonly coverCleanup: BookCoverCleanup,
    private readonly singleBookOrderService: SingleBookOrderService,
    private readonly transactionRunner: TransactionRunner,
    private readonly readingGoalSyncService: ReadingGoalSyncService,
    private readonly loanContactResolver: LoanContactResolver,
    private readonly readingLifecycleCoordinator: ReadingLifecycleCoordinator,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async create(userId: string, input: CreateBookInput): Promise<BookView> {
    const now = new Date();
    const today = await this.userSettingsContextService.today(userId);
    const favoriteChange = resolveFavoriteChange({ current: false, next: input.isFavorite, now });
    const wishlistChange = resolveWishlistAddedAtChange({
      current: null,
      next: input.ownershipStatus,
      now,
    });

    const deliveryDraft =
      ownershipStatusUsesDelivery(input.ownershipStatus) && input.deliveryInfo !== undefined
        ? buildDeliveryInfoData(input.deliveryInfo)
        : null;
    const loanInfoInput =
      ownershipStatusUsesLoan(input.ownershipStatus) && input.loanInfo !== undefined
        ? input.loanInfo
        : null;
    const purchaseInfo =
      ownershipStatusKeepsPurchase(input.ownershipStatus) && input.purchaseInfo !== undefined
        ? buildPurchaseInfoData(input.purchaseInfo)
        : null;
    const readingProgress =
      readingStatusUsesProgress(input.readingStatus) && input.readingProgress !== undefined
        ? buildReadingProgressData(input.readingProgress)
        : null;

    const resolvedAuthors = await this.relationsResolver.resolveAuthors({
      references: input.authors,
      userId,
    });

    await this.relationsResolver.assertCreatableRelations({ input, userId });

    let placement: SeriesPlacement = { partNumber: null, seriesId: null };
    let book: BookWithRelations;
    try {
      book = await this.transactionRunner.run(async (client) => {
        const resolved = await this.relationsResolver.resolveForCreate(
          { input, resolvedAuthors, userId },
          client,
        );
        placement = { partNumber: resolved.partNumber, seriesId: resolved.seriesId };

        const loanInfo =
          loanInfoInput === null
            ? null
            : buildLoanInfoData({
                loanContact: await this.loanContactResolver.resolve(
                  {
                    attached: null,
                    loanContactId: loanInfoInput.loanContactId,
                    personName: loanInfoInput.personName,
                    userId,
                  },
                  client,
                ),
                loanInfo: loanInfoInput,
              });

        const created = await this.booksRepository.create(
          userId,
          {
            ageCategory: input.ageCategory,
            authorIds: resolved.authorIds,
            coverMediaId: input.coverMediaId ?? null,
            dedication: normalizeDedication(input.dedication ?? null),
            description: input.description ?? null,
            favoriteAddedAt: favoriteChange?.favoriteAddedAt ?? null,
            firstAuthorName: resolved.firstAuthorName,
            formats: input.formats,
            genres: input.genres,
            illustrator: input.illustrator ?? null,
            isbn: input.isbn ?? null,
            isFavorite: input.isFavorite,
            language: input.language,
            listIds: resolved.listIds,
            loanInfo,
            originalTitle: input.originalTitle ?? null,
            ownershipStatus: input.ownershipStatus,
            pagesCount: input.pagesCount ?? null,
            partNumber: resolved.partNumber,
            publicationYear: input.publicationYear ?? null,
            publisherId: resolved.publisherId,
            purchaseInfo,
            queuePosition: resolved.queuePosition,
            queuePriority: resolved.queuePriority,
            queuePriorityReason: resolved.queuePriorityReason,
            queuePriorityReasonCustomText: resolved.queuePriorityReasonCustomText,
            queuePriorityTargetDate: resolved.queuePriorityTargetDate,
            readingProgress,
            readingStatus: input.readingStatus,
            seriesId: resolved.seriesId,
            tagIds: resolved.tagIds,
            title: input.title,
            translator: input.translator ?? null,
            wishlistAddedAt: wishlistChange?.wishlistAddedAt ?? null,
          },
          now,
          client,
        );
        await this.readingLifecycleCoordinator.apply(
          {
            bookId: created.id,
            currentStatus: "not_started",
            date: resolveReadingLifecycleDate({
              dates: toLifecycleDates(readingProgress),
              readingStatus: input.readingStatus,
              today,
            }),
            event: null,
            existingStartedAt: readingProgress?.startedAt ?? null,
            rating: readingProgress?.rating ?? null,
            targetStatus: input.readingStatus,
            userId,
          },
          client,
        );

        if (deliveryDraft === null) {
          return created;
        }

        await this.singleBookOrderService.create(
          { bookId: created.id, draft: deliveryDraft, userId },
          client,
        );
        return this.booksRepository.findOwnedByIdOrThrow(userId, created.id, client);
      }, HEAVY_TRANSACTION_OPTIONS);
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: null,
        placement,
        userId,
      });
    }

    return this.viewAssembler.viewOf(book);
  }

  async getById(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return this.viewAssembler.viewOf(book);
  }

  async update(userId: string, bookId: string, input: UpdateBookInput): Promise<BookView> {
    const current = await this.booksRepository.findOwnedById(userId, bookId);
    if (current === null) {
      throw new NotFoundError("Book not found");
    }

    const readingStatus = input.readingStatus ?? ReadingStatusSchema.parse(current.readingStatus);
    const touchesLifecycle =
      input.readingStatus !== undefined || input.readingProgress !== undefined;
    const today = await this.userSettingsContextService.today(userId);
    const ownershipStatus =
      input.ownershipStatus ?? OwnershipStatusSchema.parse(current.ownershipStatus);

    assertCurrentPageWithinPages({ current, input, readingStatus });
    assertLoanPersonPresent({ current, input, ownershipStatus });

    const now = new Date();

    const resolvedAuthors =
      input.authors === undefined
        ? undefined
        : await this.relationsResolver.resolveAuthors({ references: input.authors, userId });

    await this.relationsResolver.assertUpdatableRelations({ input, userId });

    const deliveryBlock = resolveDeliveryBlock({
      deliveryInfo: input.deliveryInfo,
      now,
      ownershipStatus,
    });

    let seriesPlacement: SeriesPlacement = { partNumber: null, seriesId: null };
    let book: BookWithRelations;
    try {
      book = await this.transactionRunner.run(async (client) => {
        const locked = touchesLifecycle
          ? await this.lockLifecycle({ bookId, client, userId })
          : null;
        const resolved = await this.relationsResolver.resolveForUpdate(
          { bookId, current, input, resolvedAuthors, userId },
          client,
        );
        seriesPlacement = resolved.seriesPlacement;

        const fields = resolved.fields;
        assignScalarFields({ fields, input });
        applyFavoriteFields({ current, fields, input, now });
        applyFavoriteDedicationFields({ fields, input });
        applyDedicationFields({ current, fields, input });
        applyWishlistFields({ current, fields, input, now });

        await this.singleBookOrderService.applyBlock(
          { bookId, change: deliveryBlock, userId },
          client,
        );

        const loanInfoInput =
          ownershipStatusUsesLoan(ownershipStatus) && input.loanInfo !== undefined
            ? input.loanInfo
            : null;
        const resolvedLoanInfo =
          loanInfoInput === null
            ? null
            : {
                loanContact: await this.loanContactResolver.resolve(
                  {
                    attached: current.loans[0] ?? null,
                    loanContactId: loanInfoInput.loanContactId,
                    personName: loanInfoInput.personName,
                    userId,
                  },
                  client,
                ),
                loanInfo: loanInfoInput,
              };

        const updated = await this.booksRepository.updateOwned(
          userId,
          bookId,
          {
            authorIds: resolved.authorIds,
            fields,
            listIds: resolved.listIds,
            loanInfo: resolveLoanBlock({ now, ownershipStatus, resolvedLoanInfo }),
            purchaseInfo: resolvePurchaseBlock({
              ownershipStatus,
              purchaseInfo: input.purchaseInfo,
            }),
            queueRemoval: resolved.queueRemoval,
            readingProgress: resolveReadingProgressBlock({
              readingProgress: input.readingProgress,
              readingStatus,
            }),
            tagIds: resolved.tagIds,
          },
          now,
          client,
        );

        if (locked !== null) {
          const dates = mergeLifecycleDates({
            current: locked.readingProgress,
            input: input.readingProgress,
          });
          await this.readingLifecycleCoordinator.apply(
            {
              bookId,
              currentStatus: ReadingStatusSchema.parse(locked.readingStatus),
              date: resolveReadingLifecycleDate({ dates, readingStatus, today }),
              event: null,
              existingStartedAt: locked.readingProgress?.startedAt ?? null,
              rating: input.readingProgress?.rating ?? locked.readingProgress?.rating ?? null,
              targetStatus: readingStatus,
              userId,
            },
            client,
          );
        }

        await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client, userId });

        return updated;
      }, HEAVY_TRANSACTION_OPTIONS);
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: bookId,
        placement: seriesPlacement,
        userId,
      });
    }

    if (
      input.coverMediaId !== undefined &&
      current.coverMediaId !== null &&
      current.coverMediaId !== input.coverMediaId
    ) {
      await this.coverCleanup.deleteIfOrphaned({ mediaId: current.coverMediaId, userId });
    }

    return this.viewAssembler.viewOf(book);
  }

  private async lockLifecycle({
    bookId,
    client,
    userId,
  }: {
    bookId: string;
    client: Prisma.TransactionClient;
    userId: string;
  }): Promise<BookWithRelations> {
    await this.booksRepository.acquireBookLock(bookId, client);
    return this.booksRepository.findOwnedByIdOrThrow(userId, bookId, client);
  }
}

function mergeLifecycleDates({
  current,
  input,
}: {
  current: Nullable<ReadingLifecycleDates>;
  input: UpdateBookInput["readingProgress"];
}): ReadingLifecycleDates {
  const base = toLifecycleDates(current);
  if (input === undefined || input === null) {
    return base;
  }

  return {
    abandonedAt: overrideDate(input.abandonedAt, base.abandonedAt),
    finishedAt: overrideDate(input.finishedAt, base.finishedAt),
    pausedAt: overrideDate(input.pausedAt, base.pausedAt),
    startedAt: overrideDate(input.startedAt, base.startedAt),
  };
}

function overrideDate(
  value: Nullable<string> | undefined,
  fallback: Nullable<Date>,
): Nullable<Date> {
  return value === undefined ? fallback : toCreateDate(value);
}

function toLifecycleDates(progress: Nullable<ReadingLifecycleDates>): ReadingLifecycleDates {
  return {
    abandonedAt: progress?.abandonedAt ?? null,
    finishedAt: progress?.finishedAt ?? null,
    pausedAt: progress?.pausedAt ?? null,
    startedAt: progress?.startedAt ?? null,
  };
}

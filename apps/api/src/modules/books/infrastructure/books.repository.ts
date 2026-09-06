import type {
  DedicationFilter,
  DedicationSort,
  LibrarySort,
  LoanType,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
  WishlistQuery,
  WishlistSort,
} from "@app/shared";

import {
  DEFAULT_CURRENCY,
  LoanTypeSchema,
  OwnershipStatusSchema,
  WISHLIST_SORT_DEFAULT,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { subDays, subMonths } from "date-fns";
import { z } from "zod";

import type { TrashStamp } from "../../../core/trash-retention.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { BOOK_DELIVERY_SUMMARY } from "../../delivery/index.js";
import { WISHLIST_OWNERSHIP_STATUS } from "../domain/wishlist-added-at.js";
import { placeWishlistBookInSeries } from "../domain/wishlist-counts.js";
import { buildBookSearchConditions } from "./book-search.js";
import { buildLibraryWhere } from "./book-where.js";
import { ListMembershipRepository } from "./list-membership.repository.js";
import { enforceQueueInvariant, resequenceQueue } from "./queue-invariant.js";

const log = createLogger("books.repository");

export const ACTIVE_BOOK_SQL = Prisma.sql`AND book.deleted_at IS NULL`;

const CLEARED_QUEUE_PLACEMENT = {
  queuePosition: null,
  queuePriority: null,
  queuePriorityReason: null,
  queuePriorityReasonCustomText: null,
  queuePriorityTargetDate: null,
} satisfies Prisma.BookUncheckedUpdateManyInput;

const WISHLIST_MAX_BOOKS = 1000;
const READING_STATUS_FINISHED = "finished";

const WISHLIST_ORDER_SQL: Record<WishlistSort, Prisma.Sql> = {
  added_asc: Prisma.sql`COALESCE(book.wishlist_added_at, book.created_at) ASC`,
  added_desc: Prisma.sql`COALESCE(book.wishlist_added_at, book.created_at) DESC`,
  author_asc: Prisma.sql`first_author.name ASC NULLS LAST`,
  price_asc: Prisma.sql`best_offer.price ASC NULLS LAST`,
  price_desc: Prisma.sql`best_offer.price DESC NULLS LAST`,
  publisher_asc: Prisma.sql`publisher.name ASC NULLS LAST`,
  stores_desc: Prisma.sql`store_count.total DESC`,
  title_asc: Prisma.sql`book.title ASC`,
};

function buildWishlistWhere({
  now,
  query,
  userId,
}: {
  now: Date;
  query: WishlistQuery;
  userId: string;
}): Prisma.BookWhereInput {
  const where = buildLibraryWhere({
    authorIds: query.author,
    bookType: query.bookType,
    formats: query.format,
    genreKeys: query.genre,
    hasCover: query.hasCover,
    isFavorite: query.isFavorite,
    languages: query.language,
    ownershipStatuses: [WISHLIST_OWNERSHIP_STATUS],
    pagesMax: query.pagesMax,
    pagesMin: query.pagesMin,
    publisherIds: query.publisher,
    search: query.q === "" ? undefined : query.q,
    tagIds: query.tag,
    userId,
    yearMax: query.yearMax,
    yearMin: query.yearMin,
  });
  const conditions: Prisma.BookWhereInput[] = [];

  if (query.store !== undefined) {
    conditions.push({ storeLinks: { some: { storeName: { in: query.store } } } });
  }
  if (query.currency !== undefined) {
    conditions.push({ storeLinks: { some: { currency: { in: query.currency } } } });
  }
  if (query.priceCurrency !== undefined) {
    conditions.push({
      storeLinks: {
        some: {
          currency: query.priceCurrency,
          price: { gte: query.priceMin, lte: query.priceMax, not: null },
        },
      },
    });
  }
  if (query.link === "has_links") {
    conditions.push({ storeLinks: { some: {} } });
  } else if (query.link === "without_links") {
    conditions.push({ storeLinks: { none: {} } });
  } else if (query.link === "has_price") {
    conditions.push({ storeLinks: { some: { price: { not: null } } } });
  } else if (query.link === "without_price") {
    conditions.push({ storeLinks: { none: { price: { not: null } } } });
  }
  if (query.age !== undefined) {
    const recentThreshold = subDays(now, 30);
    const longThreshold = subMonths(now, 6);
    conditions.push({
      OR: query.age.map((age) => {
        if (age === "recent") return { wishlistAddedAt: { gte: recentThreshold } };
        if (age === "middle") {
          return { wishlistAddedAt: { gte: longThreshold, lt: recentThreshold } };
        }
        return { wishlistAddedAt: { lt: longThreshold } };
      }),
    });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }
  return where;
}

function ownedOrderItemsWhere(userId: string): Prisma.BookOrderItemWhereInput {
  return { order: { userId } };
}

const GenreKeyRowSchema = z.object({ key: z.string() });

const WishlistStoreFacetRowSchema = z.object({
  count: z.number().int().nonnegative(),
  name: z.string(),
});

export type WishlistStoreFacetRow = z.infer<typeof WishlistStoreFacetRowSchema>;

export const GenreCountRowSchema = z.object({ count: z.bigint(), key: z.string() });

const AuthorCountRowSchema = z.object({ count: z.bigint(), name: z.string() });

const DedicationsSummaryCountsRowSchema = z.object({
  favoriteCount: z.number(),
  finishedCount: z.number(),
  totalCount: z.number(),
  unfinishedCount: z.number(),
});

const DedicationsAuthorsCountRowSchema = z.object({ authorsCount: z.number() });

const EMPTY_DEDICATIONS_COUNTS: z.infer<typeof DedicationsSummaryCountsRowSchema> = {
  favoriteCount: 0,
  finishedCount: 0,
  totalCount: 0,
  unfinishedCount: 0,
};

export function wishlistWithRelations(userId: string) {
  return {
    ...withRelations(userId),
    storeLinks: { orderBy: { createdAt: "asc" } },
  } satisfies Prisma.BookInclude;
}

export function withRelations(userId: string) {
  return {
    _count: { select: { orderItems: { where: ownedOrderItemsWhere(userId) } } },
    authors: { include: { author: true }, orderBy: { position: "asc" } },
    coverMedia: true,
    lists: { include: { list: true }, where: { list: SOFT_DELETE_SCOPE.active } },
    loans: {
      include: { loanContact: true },
      orderBy: { createdAt: "desc" },
      take: 1,
      where: { status: "active" },
    },
    orderItems: {
      include: { order: true, shipment: { include: { deliveryService: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: BOOK_DELIVERY_SUMMARY.itemsTake,
      where: ownedOrderItemsWhere(userId),
    },
    publisher: true,
    purchaseInfo: true,
    readingProgress: true,
    series: {
      include: {
        _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
        authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
        books: {
          select: {
            ageCategory: true,
            authors: { include: { author: true }, orderBy: { position: "asc" } },
            createdAt: true,
            formats: true,
            id: true,
            isFavorite: true,
            language: true,
            ownershipStatus: true,
            pagesCount: true,
            partNumber: true,
            publicationYear: true,
            publisherId: true,
            readingProgress: { select: { rating: true } },
            readingStatus: true,
            tags: { select: { tag: { select: { id: true, name: true } } } },
            title: true,
            updatedAt: true,
          },
          where: SOFT_DELETE_SCOPE.active,
        },
      },
    },
    tags: { include: { tag: true } },
  } satisfies Prisma.BookInclude;
}

const trashedSelect = {
  authors: { include: { author: true }, orderBy: { position: "asc" } },
  coverMedia: true,
  deletedAt: true,
  id: true,
  purgeAt: true,
  series: { select: { name: true } },
  title: true,
} satisfies Prisma.BookSelect;

const purgeSelect = {
  bookCharacters: { select: { portraitMediaId: true } },
  coverMediaId: true,
  deletedAt: true,
} satisfies Prisma.BookSelect;

const readingSnapshotSelect = {
  pagesCount: true,
  readingProgress: {
    select: {
      abandonedAt: true,
      currentPage: true,
      finishedAt: true,
      lastProgressUpdateAt: true,
      pausedAt: true,
      startedAt: true,
    },
  },
  readingStatus: true,
} satisfies Prisma.BookSelect;

export type BlockUpsert<TCreate, TUpdate> =
  { create: TCreate; update: TUpdate } | { delete: true } | { skip: true };

export type BookOwnershipFields = {
  ownershipStatus?: OwnershipStatus;
  wishlistAddedAt?: Nullable<Date>;
};

export type BookPurgeRow = Prisma.BookGetPayload<{ select: typeof purgeSelect }>;

export type BookWithRelations = Prisma.BookGetPayload<{
  include: ReturnType<typeof withRelations>;
}>;

export type CreateLoanInfoData = {
  contact: Nullable<string>;
  expectedReturnDate: Nullable<Date>;
  loanContactId: string;
  loanDate: Nullable<Date>;
  note: Nullable<string>;
  personName: string;
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
};

export type CreatePurchaseInfoData = {
  currency: Nullable<string>;
  expectedPrice: Nullable<number>;
  note: Nullable<string>;
  storeName: Nullable<string>;
  storeUrl: Nullable<string>;
};

export type CreateReadingProgressData = {
  abandonedAt: Nullable<Date>;
  currentPage: Nullable<number>;
  finishedAt: Nullable<Date>;
  impression: Nullable<string>;
  lastProgressUpdateAt: Nullable<Date>;
  note: Nullable<string>;
  pausedAt: Nullable<Date>;
  rating: Nullable<number>;
  startedAt: Nullable<Date>;
};

export type DedicationsFilter = {
  filter: DedicationFilter;
  genreKey?: string;
  search?: string;
  searchGenreKeys?: string[];
  userId: string;
};

export type GuardedChangeOutcome = "applied" | "not-found" | "status-conflict";

export type LoanBlockChange =
  | { create: CreateLoanInfoData; kind: "upsertActive"; type: LoanType; update: UpdateLoanInfoData }
  | { kind: "return"; returnedAt: Date }
  | { kind: "syncType"; type: LoanType };

export type LoanChangePatch =
  | {
      book: BookOwnershipFields;
      kind: "create";
      loan: CreateLoanInfoData & { type: LoanType };
    }
  | { book: BookOwnershipFields; kind: "return"; returnedAt: Date };

export type LoanCreateTarget = {
  hasActiveLoan: boolean;
  id: string;
  ownershipStatus: Nullable<OwnershipStatus>;
};

export type LoanReminderData = {
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
};

export type OwnershipChangePatch = {
  book: BookOwnershipFields;
  purchaseInfo?: "delete" | OwnershipPurchaseInfoPatch;
};

export type OwnershipPurchaseInfoPatch = Partial<CreatePurchaseInfoData> & {
  purchasedAt?: Nullable<Date>;
};

export type QueueRemoval = {
  fromPosition: number;
};

export type ReadingChangePatch = {
  book: Nullable<{ readingStatus?: ReadingStatus }>;
  progress: Partial<CreateReadingProgressData>;
};

export type ReadingProgressEventData = {
  date: Date;
  page: number;
  pagesRead: number;
};

export type ReadingSnapshotRow = Prisma.BookGetPayload<{ select: typeof readingSnapshotSelect }>;

export type SeriesWishlistAnchorRow = {
  highestPartNumberOutsideWishlist: Nullable<number>;
  seriesId: Nullable<string>;
};

export type StatusGuard = { expectedStatuses: OwnershipStatus[] };

export type TrashedBookRow = Trashed<TrashedBookSelection>;

export type UpdateActiveLoanData = {
  contact?: Nullable<string>;
  expectedReturnDate: Nullable<Date>;
  loanContactId: string;
  loanDate: Nullable<Date>;
  note: Nullable<string>;
  personName?: string;
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
};

export type UpdateBookData = {
  authorIds?: string[];
  fields: Prisma.BookUncheckedUpdateManyInput;
  listIds?: string[];
  loanInfo: LoanBlockChange;
  purchaseInfo: BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData>;
  queueRemoval: Nullable<QueueRemoval>;
  readingProgress: BlockUpsert<CreateReadingProgressData, UpdateReadingProgressData>;
  tagIds?: string[];
};

export type UpdateLoanInfoData = Partial<CreateLoanInfoData>;

export type UpdatePurchaseInfoData = Partial<CreatePurchaseInfoData>;

export type UpdateReadingProgressData = Partial<CreateReadingProgressData>;

export type WishlistBookRow = Prisma.BookGetPayload<{
  include: ReturnType<typeof wishlistWithRelations>;
}>;

type BlockDelegate<TCreate, TUpdate> = {
  deleteMany: (args: { where: { bookId: string } }) => Promise<{ count: number }>;
  upsert: (args: {
    create: TCreate & { bookId: string };
    update: TUpdate;
    where: { bookId: string };
  }) => Promise<unknown>;
};

type CreateBookData = {
  ageCategory: string;
  authorIds: string[];
  coverMediaId: Nullable<string>;
  dedication: Nullable<string>;
  description: Nullable<string>;
  favoriteAddedAt: Nullable<Date>;
  firstAuthorName: string;
  formats: string[];
  genres: string[];
  illustrator: Nullable<string>;
  isbn: Nullable<string>;
  isFavorite: boolean;
  language: string;
  listIds: string[];
  loanInfo: Nullable<CreateLoanInfoData>;
  originalTitle: Nullable<string>;
  ownershipStatus: string;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  publicationYear: Nullable<number>;
  publisherId: Nullable<string>;
  purchaseInfo: Nullable<CreatePurchaseInfoData>;
  queuePosition: Nullable<number>;
  queuePriority: Nullable<string>;
  queuePriorityReason: Nullable<string>;
  queuePriorityReasonCustomText: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
  readingProgress: Nullable<CreateReadingProgressData>;
  readingStatus: string;
  seriesId: Nullable<string>;
  tagIds: string[];
  title: string;
  translator: Nullable<string>;
  wishlistAddedAt: Nullable<Date>;
};

type DedicationsSummaryResult = {
  authorsCount: number;
  availableGenres: string[];
  favoriteCount: number;
  finishedCount: number;
  topAuthor: Nullable<{ count: number; name: string }>;
  topGenre: Nullable<{ count: number; genre: string }>;
  totalCount: number;
  unfinishedCount: number;
};

type SeriesPartNumberConflict = {
  id: string;
  title: string;
};

type SeriesPartNumberQuery = {
  excludeBookId: Nullable<string>;
  partNumber: number;
  seriesId: string;
};

type TrashedBookSelection = Prisma.BookGetPayload<{ select: typeof trashedSelect }>;

@Injectable()
export class BooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
  ) {}

  async acquireBookLock(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.reading, key: bookId }, client);
  }

  async acquireUserQueueLock(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireUserQueueLock(userId, client);
  }

  async applyGuardedOwnershipFields(
    userId: string,
    {
      bookIds,
      expectedStatuses,
      fields,
    }: { bookIds: string[]; expectedStatuses: OwnershipStatus[]; fields: BookOwnershipFields },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.book.updateMany({
      data: fields,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        id: { in: bookIds },
        ownershipStatus: { in: expectedStatuses },
        userId,
      },
    });

    return updated.count;
  }

  applyLoanChange(
    userId: string,
    bookId: string,
    patch: LoanChangePatch,
    guard: StatusGuard,
    client?: Prisma.TransactionClient,
  ): Promise<GuardedChangeOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const guarded = await this.applyGuardedStatusChange(tx, {
        bookId,
        expectedStatuses: guard.expectedStatuses,
        fields: patch.book,
        userId,
      });
      if (guarded !== "applied") {
        return guarded;
      }

      if (patch.kind === "create") {
        await tx.bookLoan.create({ data: { ...patch.loan, bookId, status: "active", userId } });
        return "applied";
      }

      await tx.bookLoan.updateMany({
        data: {
          remindBeforeDays: null,
          remindToReturn: false,
          returnedAt: patch.returnedAt,
          status: "returned",
        },
        where: { bookId, status: "active" },
      });
      return "applied";
    });
  }

  applyOwnershipChange(
    userId: string,
    bookId: string,
    patch: OwnershipChangePatch,
    guard: StatusGuard,
    client?: Prisma.TransactionClient,
  ): Promise<GuardedChangeOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const guarded = await this.applyGuardedStatusChange(tx, {
        bookId,
        expectedStatuses: guard.expectedStatuses,
        fields: patch.book,
        userId,
      });
      if (guarded !== "applied") {
        return guarded;
      }

      if (patch.purchaseInfo === "delete") {
        await tx.bookPurchaseInfo.deleteMany({ where: { bookId } });
      } else if (patch.purchaseInfo !== undefined && Object.keys(patch.purchaseInfo).length > 0) {
        await tx.bookPurchaseInfo.upsert({
          create: { ...patch.purchaseInfo, bookId },
          update: patch.purchaseInfo,
          where: { bookId },
        });
      }
      return "applied";
    });
  }

  applyReadingChange(
    userId: string,
    bookId: string,
    patch: ReadingChangePatch,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
      if (owned === null) {
        throw new NotFoundError("Book not found");
      }

      if (patch.book !== null) {
        await tx.book.update({ data: patch.book, where: { id: bookId } });
      }

      await enforceQueueInvariant(tx, { readingStatus: patch.book?.readingStatus, userId });

      if (Object.keys(patch.progress).length > 0) {
        await tx.bookReadingProgress.upsert({
          create: { ...patch.progress, bookId },
          update: patch.progress,
          where: { bookId },
        });
      }
    });
  }

  countDedicationsForQuery({ filter }: { filter: DedicationsFilter }): Promise<number> {
    return this.prisma.book.count({ where: buildDedicationsWhere(filter) });
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.book.count({ where: { ...SOFT_DELETE_SCOPE.trashed, userId } });
  }

  countWishlistBooks(userId: string): Promise<number> {
    return this.prisma.book.count({
      where: buildLibraryWhere({
        ownershipStatuses: [WISHLIST_OWNERSHIP_STATUS],
        userId,
      }),
    });
  }

  async create(
    userId: string,
    data: CreateBookData,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookWithRelations> {
    const { authorIds, listIds, loanInfo, purchaseInfo, readingProgress, tagIds, ...bookData } =
      data;

    const created = await client.book.create({
      data: {
        ...bookData,
        authors: {
          create: authorIds.map((authorId, position) => ({ authorId, position })),
        },
        loans:
          loanInfo === null
            ? undefined
            : {
                create: {
                  ...loanInfo,
                  status: "active",
                  type: LoanTypeSchema.parse(bookData.ownershipStatus),
                  userId,
                },
              },
        purchaseInfo: purchaseInfo === null ? undefined : { create: purchaseInfo },
        readingProgress: readingProgress === null ? undefined : { create: readingProgress },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        userId,
      },
      select: { id: true },
    });

    if (listIds.length > 0) {
      const sortedListIds = [...new Set(listIds)].sort();
      for (const listId of sortedListIds) {
        await this.membershipRepository.acquireListLock(client, { listId });
      }
      for (const listId of sortedListIds) {
        await this.membershipRepository.append(client, { bookId: created.id, listId });
      }
      for (const listId of sortedListIds) {
        await this.membershipRepository.touchList(client, { listId, now, userId });
      }
    }

    return client.book.findFirstOrThrow({
      include: withRelations(userId),
      where: { id: created.id },
    });
  }

  async createLoansForBooks(
    userId: string,
    loans: (CreateLoanInfoData & { bookId: string; type: LoanType })[],
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookLoan.createMany({
      data: loans.map((loan) => ({ ...loan, status: "active", userId })),
    });
  }

  async dedicationsSummary({ userId }: { userId: string }): Promise<DedicationsSummaryResult> {
    const [countsRows, genreRows, topGenreRows, topAuthorRows, authorsCountRows] =
      await Promise.all([
        this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "totalCount",
          (count(*) FILTER (WHERE book.is_favorite_dedication = true))::int AS "favoriteCount",
          (count(*) FILTER (WHERE book.reading_status = ${READING_STATUS_FINISHED}))::int AS "finishedCount",
          (count(*) FILTER (WHERE book.reading_status <> ${READING_STATUS_FINISHED}))::int AS "unfinishedCount"
        FROM books book
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
      `),
        this.prisma.$queryRaw`
        SELECT DISTINCT genre AS key
        FROM books book, unnest(book.genres) AS genre
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        ORDER BY key ASC
      `,
        this.prisma.$queryRaw`
        SELECT genre AS key, count(*) AS count
        FROM books book, unnest(book.genres) AS genre
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        GROUP BY genre
        ORDER BY count DESC, key ASC
        LIMIT 1
      `,
        this.prisma.$queryRaw`
        SELECT author.name AS name, count(*) AS count
        FROM book_authors book_author
        JOIN authors author ON author.id = book_author.author_id
        JOIN books book ON book.id = book_author.book_id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        GROUP BY author.name
        ORDER BY count DESC, name ASC
        LIMIT 1
      `,
        this.prisma.$queryRaw`
        SELECT count(DISTINCT book_author.author_id)::int AS "authorsCount"
        FROM book_authors book_author
        JOIN books book ON book.id = book_author.book_id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
      `,
      ]);

    const counts =
      z.array(DedicationsSummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_DEDICATIONS_COUNTS;
    const availableGenreRows = z.array(GenreKeyRowSchema).parse(genreRows);
    const topGenre = z.array(GenreCountRowSchema).parse(topGenreRows)[0];
    const topAuthor = z.array(AuthorCountRowSchema).parse(topAuthorRows)[0];
    const authorsCount =
      z.array(DedicationsAuthorsCountRowSchema).parse(authorsCountRows)[0]?.authorsCount ?? 0;

    return {
      authorsCount,
      availableGenres: availableGenreRows.map((row) => row.key),
      favoriteCount: counts.favoriteCount,
      finishedCount: counts.finishedCount,
      topAuthor:
        topAuthor === undefined ? null : { count: Number(topAuthor.count), name: topAuthor.name },
      topGenre:
        topGenre === undefined ? null : { count: Number(topGenre.count), genre: topGenre.key },
      totalCount: counts.totalCount,
      unfinishedCount: counts.unfinishedCount,
    };
  }

  deleteReadingEvent(
    { bookId, eventId }: { bookId: string; eventId: string },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const deleted = await tx.bookReadingProgressEvent.deleteMany({
        where: { bookId, id: eventId },
      });
      return deleted.count;
    });
  }

  async existsOwned({ bookId, userId }: { bookId: string; userId: string }): Promise<boolean> {
    const book = await this.prisma.book.findFirst({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    return book !== null;
  }

  findForPurge({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<BookPurgeRow>> {
    return this.prisma.book.findFirst({
      select: purgeSelect,
      where: { id: bookId, userId },
    });
  }

  async findLoanCreateTargets(
    { bookIds, userId }: { bookIds: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanCreateTarget[]> {
    const rows = await client.book.findMany({
      select: {
        id: true,
        loans: { select: { id: true }, take: 1, where: { status: "active" } },
        ownershipStatus: true,
      },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
    });

    return rows.map((row) => ({
      hasActiveLoan: row.loans.length > 0,
      id: row.id,
      ownershipStatus:
        row.ownershipStatus === null ? null : OwnershipStatusSchema.parse(row.ownershipStatus),
    }));
  }

  findOwnedById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookWithRelations>> {
    return client.book.findFirst({
      include: withRelations(userId),
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
    });
  }

  async findOwnedByIdOrThrow(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookWithRelations> {
    const book = await this.findOwnedById(userId, id, client);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return book;
  }

  findPurgeCandidates({
    limit,
    now,
  }: {
    limit: number;
    now: Date;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.book.findMany({
      orderBy: { purgeAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: SOFT_DELETE_SCOPE.overdue(now),
    });
  }

  findReadingEvents(args: {
    bookId: string;
  }): Promise<Array<{ createdAt: Date; date: Date; id: string; page: number; pagesRead: number }>> {
    return this.prisma.bookReadingProgressEvent.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { createdAt: true, date: true, id: true, page: true, pagesRead: true },
      where: { book: SOFT_DELETE_SCOPE.active, bookId: args.bookId },
    });
  }

  async findReadingSnapshotOrThrow(userId: string, bookId: string): Promise<ReadingSnapshotRow> {
    const book = await this.prisma.book.findFirst({
      select: readingSnapshotSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return book;
  }

  findSeriesPartNumberConflict(
    userId: string,
    { excludeBookId, partNumber, seriesId }: SeriesPartNumberQuery,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SeriesPartNumberConflict>> {
    return client.book.findFirst({
      select: { id: true, title: true },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        id: excludeBookId === null ? undefined : { not: excludeBookId },
        partNumber,
        seriesId,
        userId,
      },
    });
  }

  async hardDeleteIfTrashed({
    bookId,
    now,
    userId,
  }: {
    bookId: string;
    now: Date;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.book.deleteMany({
      where: { ...SOFT_DELETE_SCOPE.overdue(now), id: bookId, userId },
    });
    return purged.count;
  }

  listDedicationsForQuery({
    filter,
    skip,
    sort,
    take,
  }: {
    filter: DedicationsFilter;
    skip: number;
    sort: DedicationSort;
    take: number;
  }): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations(filter.userId),
      orderBy: DEDICATIONS_ORDER_BY[sort],
      skip,
      take,
      where: buildDedicationsWhere(filter),
    });
  }

  async listSeriesWishlistAnchors({
    client,
    seriesIds,
    userId,
  }: {
    client?: Prisma.TransactionClient;
    seriesIds: string[];
    userId: string;
  }): Promise<SeriesWishlistAnchorRow[]> {
    if (seriesIds.length === 0) {
      return [];
    }
    const db = client ?? this.prisma;
    const rows = await db.book.groupBy({
      _max: { partNumber: true },
      by: ["seriesId"],
      where: {
        ...SOFT_DELETE_SCOPE.active,
        ownershipStatus: { not: WISHLIST_OWNERSHIP_STATUS },
        seriesId: { in: seriesIds },
        userId,
      },
    });
    return rows.map((row) => ({
      highestPartNumberOutsideWishlist: row._max.partNumber,
      seriesId: row.seriesId,
    }));
  }

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedBookRow[]> {
    const rows = await this.prisma.book.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, userId },
    });
    return rows.filter(isTrashed);
  }

  async listWishlistBooks({
    client,
    now,
    query,
    userId,
  }: {
    client?: Prisma.TransactionClient;
    now: Date;
    query: WishlistQuery;
    userId: string;
  }): Promise<WishlistBookRow[]> {
    const db = client ?? this.prisma;
    const matches = await db.book.findMany({
      select: { id: true },
      where: buildWishlistWhere({ now, query, userId }),
    });
    const orderedIds = await this.orderWishlistIds({
      db,
      ids: matches.map((match) => match.id),
      sort: query.sort ?? WISHLIST_SORT_DEFAULT,
    });
    if (orderedIds.length === WISHLIST_MAX_BOOKS) {
      log.warn({ cap: WISHLIST_MAX_BOOKS, userId }, "wishlist truncated at the safety cap");
    }
    const unordered = await db.book.findMany({
      include: wishlistWithRelations(userId),
      where: { id: { in: orderedIds } },
    });
    const byId = new Map(unordered.map((row) => [row.id, row]));
    const rows = orderedIds.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    });
    if (query.seriesPlacement === undefined) {
      return rows;
    }

    const seriesIds = [
      ...new Set(rows.flatMap((row) => (row.seriesId === null ? [] : [row.seriesId]))),
    ];
    const anchors = await this.listSeriesWishlistAnchors({ client, seriesIds, userId });
    const anchorBySeriesId = new Map(
      anchors.flatMap((anchor) =>
        anchor.highestPartNumberOutsideWishlist === null || anchor.seriesId === null
          ? []
          : [[anchor.seriesId, anchor.highestPartNumberOutsideWishlist] as const],
      ),
    );
    return rows.filter((book) => {
      const placement = placeWishlistBookInSeries({ anchorBySeriesId, book });
      return placement !== null && query.seriesPlacement?.includes(placement.kind) === true;
    });
  }

  async listWishlistStoreFacets(userId: string): Promise<WishlistStoreFacetRow[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT link.store_name AS name, count(DISTINCT link.book_id)::int AS count
      FROM book_store_links link
      JOIN books book ON book.id = link.book_id
      WHERE book.user_id = ${userId}::uuid
        AND book.ownership_status = ${WISHLIST_OWNERSHIP_STATUS}
        ${ACTIVE_BOOK_SQL}
      GROUP BY link.store_name
      ORDER BY count DESC, name ASC
    `;
    return z.array(WishlistStoreFacetRowSchema).parse(rows);
  }

  async maxQueuePosition(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.book.aggregate({
      _max: { queuePosition: true },
      where: { ...SOFT_DELETE_SCOPE.active, userId },
    });
    return result._max.queuePosition ?? 0;
  }

  recordReadingEvent(
    args: {
      bookId: string;
      event: ReadingProgressEventData;
      readingCycleId: Nullable<string>;
    },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await tx.bookReadingProgressEvent.create({
        data: {
          bookId: args.bookId,
          date: args.event.date,
          page: args.event.page,
          pagesRead: args.event.pagesRead,
          readingCycleId: args.readingCycleId,
        },
      });
    });
  }

  async restore(
    { bookId, userId }: { bookId: string; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    const restored = await runInClient({ client, prisma: this.prisma }, (tx) =>
      tx.book.updateMany({
        data: SOFT_DELETE_SCOPE.restored,
        where: { ...SOFT_DELETE_SCOPE.trashed, id: bookId, userId },
      }),
    );
    return restored.count;
  }

  async shiftQueueUpAfter(
    userId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { decrement: 1 } },
      where: { ...SOFT_DELETE_SCOPE.active, queuePosition: { gt: position }, userId },
    });
  }

  softDelete(
    {
      bookId,
      stamp,
      userId,
    }: {
      bookId: string;
      stamp: TrashStamp;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await acquireUserQueueLock(userId, tx);
      const deleted = await tx.book.updateMany({
        data: { ...stamp, ...CLEARED_QUEUE_PLACEMENT },
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
      if (deleted.count > 0) {
        await resequenceQueue(tx, userId);
      }
      return deleted.count;
    });
  }

  async updateActiveLoan(
    userId: string,
    bookId: string,
    data: UpdateActiveLoanData,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.updateActiveLoanFields(userId, bookId, data, client);
  }

  async updateActiveLoanReminder(
    userId: string,
    bookId: string,
    data: LoanReminderData,
  ): Promise<void> {
    await this.updateActiveLoanFields(userId, bookId, data);
  }

  async updateActiveLoanSchedule(
    userId: string,
    bookId: string,
    data: LoanReminderData & { expectedReturnDate: Date },
  ): Promise<void> {
    await this.updateActiveLoanFields(userId, bookId, data);
  }

  updateOwned(
    userId: string,
    bookId: string,
    data: UpdateBookData,
    now: Date,
    client?: Prisma.TransactionClient,
  ): Promise<BookWithRelations> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      if (data.queueRemoval !== null) {
        await acquireUserQueueLock(userId, tx);
      }

      const updated = await tx.book.updateMany({
        data: data.fields,
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
      if (updated.count === 0) {
        throw new NotFoundError("Book not found");
      }

      if (data.queueRemoval !== null) {
        await this.shiftQueueUpAfter(userId, data.queueRemoval.fromPosition, tx);
      }

      const nextReadingStatus =
        typeof data.fields.readingStatus === "string" ? data.fields.readingStatus : undefined;
      await enforceQueueInvariant(tx, { readingStatus: nextReadingStatus, userId });

      await applyBlockUpsert(tx.bookReadingProgress, bookId, data.readingProgress);
      await applyBlockUpsert(tx.bookPurchaseInfo, bookId, data.purchaseInfo);
      await applyLoanBlock(tx, bookId, userId, data.loanInfo);

      if (data.authorIds !== undefined) {
        await tx.bookAuthor.deleteMany({ where: { bookId } });
        await tx.bookAuthor.createMany({
          data: data.authorIds.map((authorId, position) => ({ authorId, bookId, position })),
        });
      }

      if (data.tagIds !== undefined) {
        await tx.bookTag.deleteMany({ where: { bookId } });
        if (data.tagIds.length > 0) {
          await tx.bookTag.createMany({
            data: data.tagIds.map((tagId) => ({ bookId, tagId })),
          });
        }
      }

      if (data.listIds !== undefined) {
        const targetListIds = new Set(data.listIds);
        const current = await tx.bookListItem.findMany({
          select: { listId: true },
          where: { bookId },
        });
        const currentListIds = new Set(current.map((item) => item.listId));

        const toRemove = current
          .map((item) => item.listId)
          .filter((listId) => !targetListIds.has(listId));
        const toAdd = data.listIds.filter((listId) => !currentListIds.has(listId));

        if (toAdd.length > 0 || toRemove.length > 0) {
          const affectedListIds = [...new Set([...toAdd, ...toRemove])].sort();
          for (const listId of affectedListIds) {
            await this.membershipRepository.acquireListLock(tx, { listId });
          }

          for (const listId of toRemove) {
            const membership = await this.membershipRepository.findMembership(tx, {
              bookId,
              listId,
            });
            if (membership === null) {
              continue;
            }
            await this.membershipRepository.deleteMembership(tx, { bookId, listId });
            await this.membershipRepository.shiftUpAfter(tx, {
              listId,
              position: membership.position,
            });
          }

          for (const listId of toAdd) {
            await this.membershipRepository.append(tx, { bookId, listId });
          }

          for (const listId of affectedListIds) {
            await this.membershipRepository.touchList(tx, { listId, now, userId });
          }
        }
      }

      return tx.book.findFirstOrThrow({
        include: withRelations(userId),
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
    });
  }

  private async applyGuardedStatusChange(
    client: Prisma.TransactionClient,
    {
      bookId,
      expectedStatuses,
      fields,
      userId,
    }: {
      bookId: string;
      expectedStatuses: OwnershipStatus[];
      fields: BookOwnershipFields;
      userId: string;
    },
  ): Promise<GuardedChangeOutcome> {
    const updated = await client.book.updateMany({
      data: fields,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        id: bookId,
        ownershipStatus: { in: expectedStatuses },
        userId,
      },
    });
    if (updated.count > 0) {
      return "applied";
    }

    const exists = await client.book.findFirst({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    return exists === null ? "not-found" : "status-conflict";
  }

  private async orderWishlistIds({
    db,
    ids,
    sort,
  }: {
    db: Prisma.TransactionClient | PrismaService;
    ids: string[];
    sort: WishlistSort;
  }): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await db.$queryRaw`
      SELECT book.id
      FROM books book
      LEFT JOIN publishers publisher ON publisher.id = book.publisher_id
      LEFT JOIN LATERAL (
        SELECT author.name
        FROM book_authors book_author
        JOIN authors author ON author.id = book_author.author_id
        WHERE book_author.book_id = book.id
        ORDER BY book_author.position ASC
        LIMIT 1
      ) first_author ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          min(link.price) FILTER (WHERE COALESCE(link.currency, ${DEFAULT_CURRENCY}) = 'UAH'),
          min(link.price) FILTER (WHERE link.currency = 'EUR'),
          min(link.price) FILTER (WHERE link.currency = 'USD')
        ) AS price
        FROM book_store_links link
        WHERE link.book_id = book.id AND link.price IS NOT NULL
      ) best_offer ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS total
        FROM book_store_links link
        WHERE link.book_id = book.id
      ) store_count ON true
      WHERE book.id = ANY(${ids}::uuid[])
      ORDER BY ${WISHLIST_ORDER_SQL[sort]}, book.created_at DESC, book.id ASC
      LIMIT ${WISHLIST_MAX_BOOKS}
    `;
    return z
      .array(z.object({ id: z.uuid() }))
      .parse(rows)
      .map((row) => row.id);
  }

  private async updateActiveLoanFields(
    userId: string,
    bookId: string,
    data: Prisma.BookLoanUncheckedUpdateManyInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const updated = await client.bookLoan.updateMany({
      data,
      where: { book: { ...SOFT_DELETE_SCOPE.active, userId }, bookId, status: "active" },
    });
    if (updated.count === 0) {
      throw new NotFoundError("Loan not found");
    }
  }
}

const CREATED_AT_TIEBREAKER: Prisma.BookOrderByWithRelationInput = { createdAt: "desc" };

const ID_TIEBREAKER: Prisma.BookOrderByWithRelationInput = { id: "asc" };

export const LIBRARY_ORDER_BY: Record<LibrarySort, Prisma.BookOrderByWithRelationInput[]> = {
  author_asc: [{ firstAuthorName: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  author_desc: [{ firstAuthorName: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  created_asc: [{ createdAt: "asc" }, ID_TIEBREAKER],
  created_desc: [{ createdAt: "desc" }, ID_TIEBREAKER],
  favorite_added_asc: [
    { favoriteAddedAt: { nulls: "last", sort: "asc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  favorite_added_desc: [
    { favoriteAddedAt: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  pages_asc: [{ pagesCount: { nulls: "last", sort: "asc" } }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  pages_desc: [
    { pagesCount: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  rating_asc: [
    { readingProgress: { rating: { nulls: "last", sort: "asc" } } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  rating_desc: [
    { readingProgress: { rating: { nulls: "last", sort: "desc" } } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  title_asc: [{ title: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  title_desc: [{ title: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  updated_desc: [{ updatedAt: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  year_asc: [
    { publicationYear: { nulls: "last", sort: "asc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  year_desc: [
    { publicationYear: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
};

export const DEDICATIONS_ORDER_BY: Record<DedicationSort, Prisma.BookOrderByWithRelationInput[]> = {
  author_asc: [{ firstAuthorName: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  book_title_asc: [{ title: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  favorites_first: [{ isFavoriteDedication: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  newest: [{ createdAt: "desc" }, ID_TIEBREAKER],
  publication_year_desc: [
    { publicationYear: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  recently_updated: [{ updatedAt: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
};

async function applyBlockUpsert<TCreate, TUpdate>(
  delegate: BlockDelegate<TCreate, TUpdate>,
  bookId: string,
  block: BlockUpsert<TCreate, TUpdate>,
): Promise<void> {
  if ("skip" in block) {
    return;
  }

  if ("delete" in block) {
    await delegate.deleteMany({ where: { bookId } });
    return;
  }

  await delegate.upsert({
    create: { ...block.create, bookId },
    update: block.update,
    where: { bookId },
  });
}

function applyDedicationStatusFilter(where: Prisma.BookWhereInput, filter: DedicationFilter): void {
  switch (filter) {
    case "all":
      return;
    case "favorites":
      where.isFavoriteDedication = true;
      return;
    case "finished":
      where.readingStatus = "finished";
      return;
    case "unfinished":
      where.readingStatus = { not: "finished" };
      return;
    case "without_favorites":
      where.isFavoriteDedication = false;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

async function applyLoanBlock(
  tx: Prisma.TransactionClient,
  bookId: string,
  userId: string,
  change: LoanBlockChange,
): Promise<void> {
  if (change.kind === "return") {
    await tx.bookLoan.updateMany({
      data: {
        remindBeforeDays: null,
        remindToReturn: false,
        returnedAt: change.returnedAt,
        status: "returned",
      },
      where: { bookId, status: "active" },
    });
    return;
  }

  const active = await tx.bookLoan.findFirst({
    select: { id: true, type: true },
    where: { bookId, status: "active" },
  });

  if (change.kind === "syncType") {
    if (active !== null && active.type !== change.type) {
      await tx.bookLoan.update({ data: { type: change.type }, where: { id: active.id } });
    }
    return;
  }

  if (active === null) {
    await tx.bookLoan.create({
      data: { ...change.create, bookId, status: "active", type: change.type, userId },
    });
    return;
  }

  await tx.bookLoan.update({
    data: { ...change.update, type: change.type },
    where: { id: active.id },
  });
}

function buildDedicationsWhere(input: DedicationsFilter): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = {
    AND: [{ dedication: { not: null } }, { dedication: { not: "" } }],
    ...SOFT_DELETE_SCOPE.active,
    userId: input.userId,
  };

  applyDedicationStatusFilter(where, input.filter);

  if (input.genreKey !== undefined) {
    where.genres = { hasSome: [input.genreKey] };
  }

  const searchConditions = buildBookSearchConditions({
    includeDedication: true,
    search: input.search,
    searchGenreKeys: input.searchGenreKeys,
  });
  if (searchConditions !== undefined) {
    where.OR = searchConditions;
  }

  return where;
}

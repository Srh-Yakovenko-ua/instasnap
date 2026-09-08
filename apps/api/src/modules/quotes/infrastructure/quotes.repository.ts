import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { QUOTE_PAGE_MAX, QuoteFilterSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { QuoteBookCount, QuotesSummaryData } from "../domain/quotes-summary.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import { addDaysToIsoDate, parseIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookTextSearchConditions } from "../../books/index.js";

const QuotesSummaryCountsRowSchema = z.object({
  favorites: z.number(),
  spoiler: z.number(),
  total: z.number(),
  withComment: z.number(),
});

const EMPTY_QUOTE_COUNTS: z.infer<typeof QuotesSummaryCountsRowSchema> = {
  favorites: 0,
  spoiler: 0,
  total: 0,
  withComment: 0,
};

const quoteWithBook = {
  include: { book: { include: { coverMedia: true } } },
} satisfies Prisma.QuoteDefaultArgs;

export type BookQuoteCounts = {
  favorites: number;
  spoiler: number;
  total: number;
};

export type OwnedBook = {
  id: string;
  pagesCount: Nullable<number>;
};

export type QuoteAuthorLink = {
  author: { id: string; name: string };
  bookId: string;
};

export type QuoteFilterCounts = Record<QuoteFilter, number>;

export type QuotesDatasetInput = {
  authorIds: string[] | undefined;
  bookIds: string[] | undefined;
  createdFrom: string | undefined;
  createdTo: string | undefined;
  search: string | undefined;
  userId: string;
};

export type QuotesFilterInput = QuotesDatasetInput & {
  filter: QuoteFilter;
};

export type QuoteUpdateData = Partial<QuoteWriteData>;

export type QuoteWithBook = Prisma.QuoteGetPayload<typeof quoteWithBook>;

export type QuoteWriteData = {
  chapter: Nullable<string>;
  comment: Nullable<string>;
  isFavorite: boolean;
  isSpoiler: boolean;
  page: Nullable<number>;
  text: string;
};

type ListQuotesInput = QuotesFilterInput & {
  skip: number;
  sort: QuoteSort;
  take: number;
};

const trashedQuoteSelect = {
  book: { select: { title: true } },
  deletedAt: true,
  id: true,
  purgeAt: true,
  text: true,
} satisfies Prisma.QuoteSelect;

export type TrashedQuoteRow = Trashed<TrashedQuoteSelection>;

type TrashedQuoteSelection = Prisma.QuoteGetPayload<{ select: typeof trashedQuoteSelect }>;

@Injectable()
export class QuotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async authorQuoteLinks(bookIds: string[]): Promise<QuoteAuthorLink[]> {
    if (bookIds.length === 0) {
      return [];
    }
    return this.prisma.bookAuthor.findMany({
      select: { author: { select: { id: true, name: true } }, bookId: true },
      where: { bookId: { in: bookIds } },
    });
  }

  async bookCounts(userId: string, bookId: string): Promise<BookQuoteCounts> {
    const base: Prisma.QuoteWhereInput = {
      ...SOFT_DELETE_SCOPE.active,
      book: SOFT_DELETE_SCOPE.active,
      bookId,
      userId,
    };
    const [total, favorites, spoiler] = await Promise.all([
      this.prisma.quote.count({ where: base }),
      this.prisma.quote.count({ where: { ...base, isFavorite: true } }),
      this.prisma.quote.count({ where: { ...base, isSpoiler: true } }),
    ]);

    return { favorites, spoiler, total };
  }

  async bookQuoteCounts(dataset: QuotesDatasetInput): Promise<QuoteBookCount[]> {
    const groups = await this.prisma.quote.groupBy({
      _count: { _all: true },
      by: ["bookId"],
      where: buildQuotesDatasetWhere(dataset),
    });
    return this.resolveBookCounts(dataset.userId, groups);
  }

  count(filter: QuotesFilterInput): Promise<number> {
    return this.prisma.quote.count({ where: buildQuotesWhere(filter) });
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.quote.count({
      where: { ...SOFT_DELETE_SCOPE.trashed, book: SOFT_DELETE_SCOPE.active, userId },
    });
  }

  create(
    {
      bookId,
      data,
      userId,
    }: {
      bookId: string;
      data: QuoteWriteData;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<QuoteWithBook> {
    return client.quote.create({ data: { ...data, bookId, userId }, ...quoteWithBook });
  }

  async filterCounts(dataset: QuotesDatasetInput): Promise<QuoteFilterCounts> {
    const counted = await Promise.all(
      QuoteFilterSchema.options.map(async (filter) => ({
        count: await this.prisma.quote.count({
          where: buildQuotesWhere({ ...dataset, filter }),
        }),
        filter,
      })),
    );

    const counts: QuoteFilterCounts = {
      all: 0,
      favorites: 0,
      no_spoiler: 0,
      with_comment: 0,
      with_spoiler: 0,
      without_comment: 0,
    };
    for (const { count, filter } of counted) {
      counts[filter] = count;
    }

    return counts;
  }

  findForPurge({
    quoteId,
    userId,
  }: {
    quoteId: string;
    userId: string;
  }): Promise<Nullable<{ deletedAt: Nullable<Date> }>> {
    return this.prisma.quote.findFirst({
      select: { deletedAt: true },
      where: { id: quoteId, userId },
    });
  }

  findOwnedBook(userId: string, bookId: string): Promise<Nullable<OwnedBook>> {
    return this.prisma.book.findFirst({
      select: { id: true, pagesCount: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
  }

  findOwnedQuote({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<Nullable<QuoteWithBook>> {
    return this.prisma.quote.findFirst({
      where: {
        ...SOFT_DELETE_SCOPE.active,
        book: SOFT_DELETE_SCOPE.active,
        bookId,
        id: quoteId,
        userId,
      },
      ...quoteWithBook,
    });
  }

  findPurgeCandidates({
    limit,
    now,
  }: {
    limit: number;
    now: Date;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.quote.findMany({
      orderBy: { purgeAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: SOFT_DELETE_SCOPE.overdue(now),
    });
  }

  async hardDeleteIfTrashed({
    now,
    quoteId,
    userId,
  }: {
    now: Date;
    quoteId: string;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.quote.deleteMany({
      where: { ...SOFT_DELETE_SCOPE.overdue(now), id: quoteId, userId },
    });
    return purged.count;
  }

  list({ skip, sort, take, ...filter }: ListQuotesInput): Promise<QuoteWithBook[]> {
    return this.prisma.quote.findMany({
      orderBy: QUOTE_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildQuotesWhere(filter),
      ...quoteWithBook,
    });
  }

  listForBook(userId: string, bookId: string): Promise<QuoteWithBook[]> {
    return this.prisma.quote.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: { ...SOFT_DELETE_SCOPE.active, book: SOFT_DELETE_SCOPE.active, bookId, userId },
      ...quoteWithBook,
    });
  }

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedQuoteRow[]> {
    const rows = await this.prisma.quote.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedQuoteSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, book: SOFT_DELETE_SCOPE.active, userId },
    });
    return rows.filter(isTrashed);
  }

  async restore({
    bookId,
    quoteId,
    userId,
  }: {
    bookId: string;
    quoteId: string;
    userId: string;
  }): Promise<number> {
    const restored = await this.prisma.quote.updateMany({
      data: SOFT_DELETE_SCOPE.restored,
      where: {
        ...SOFT_DELETE_SCOPE.trashed,
        book: SOFT_DELETE_SCOPE.active,
        bookId,
        id: quoteId,
        userId,
      },
    });
    return restored.count;
  }

  async softDelete({
    quoteId,
    stamp,
    userId,
  }: {
    quoteId: string;
    stamp: TrashStamp;
    userId: string;
  }): Promise<number> {
    const deleted = await this.prisma.quote.updateMany({
      data: stamp,
      where: { ...SOFT_DELETE_SCOPE.active, id: quoteId, userId },
    });
    return deleted.count;
  }

  async summaryData(userId: string): Promise<QuotesSummaryData> {
    const [countsRows, groups] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "total",
          (count(*) FILTER (WHERE quote.is_favorite = true))::int AS "favorites",
          (count(*) FILTER (WHERE quote.is_spoiler = true))::int AS "spoiler",
          (count(*) FILTER (WHERE quote.comment IS NOT NULL))::int AS "withComment"
        FROM quotes quote
        JOIN books book ON book.id = quote.book_id
        WHERE quote.user_id = ${userId}::uuid
          AND quote.deleted_at IS NULL
          AND book.deleted_at IS NULL
      `),
      this.prisma.quote.groupBy({
        _count: { _all: true },
        by: ["bookId"],
        where: { ...SOFT_DELETE_SCOPE.active, book: SOFT_DELETE_SCOPE.active, userId },
      }),
    ]);

    const counts = z.array(QuotesSummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_QUOTE_COUNTS;

    return {
      bookCounts: await this.resolveBookCounts(userId, groups),
      favorites: counts.favorites,
      spoiler: counts.spoiler,
      total: counts.total,
      withComment: counts.withComment,
    };
  }

  update(
    {
      data,
      quoteId,
    }: {
      data: QuoteUpdateData;
      quoteId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<QuoteWithBook> {
    return client.quote.update({ data, where: { id: quoteId }, ...quoteWithBook });
  }

  private async resolveBookCounts(
    userId: string,
    groups: Array<{ _count: { _all: number }; bookId: string }>,
  ): Promise<QuoteBookCount[]> {
    if (groups.length === 0) {
      return [];
    }

    const books = await this.prisma.book.findMany({
      select: { firstAuthorName: true, id: true, title: true },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        id: { in: groups.map((group) => group.bookId) },
        userId,
      },
    });
    const bookById = new Map(books.map((book) => [book.id, book]));

    return groups.flatMap((group) => {
      const book = bookById.get(group.bookId);
      if (book === undefined) {
        return [];
      }
      return [
        {
          bookId: group.bookId,
          count: group._count._all,
          firstAuthorName: book.firstAuthorName,
          title: book.title,
        },
      ];
    });
  }
}

const ID_TIEBREAKER: Prisma.QuoteOrderByWithRelationInput = { id: "asc" };
const RECENT_TIEBREAKER: Prisma.QuoteOrderByWithRelationInput = { createdAt: "desc" };

const QUOTE_SORT_ORDER_BY: Record<QuoteSort, Prisma.QuoteOrderByWithRelationInput[]> = {
  book_author: [{ book: { firstAuthorName: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  book_title: [{ book: { title: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  favorites_first: [{ isFavorite: "desc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  newest: [{ createdAt: "desc" }, ID_TIEBREAKER],
  no_spoiler_first: [{ isSpoiler: "asc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  oldest: [{ createdAt: "asc" }, ID_TIEBREAKER],
  page: [{ page: { nulls: "last", sort: "asc" } }, RECENT_TIEBREAKER, ID_TIEBREAKER],
  with_spoiler_first: [{ isSpoiler: "desc" }, RECENT_TIEBREAKER, ID_TIEBREAKER],
};

function applyQuoteFilter(filter: QuoteFilter, where: Prisma.QuoteWhereInput): void {
  switch (filter) {
    case "all":
      return;
    case "favorites":
      where.isFavorite = true;
      return;
    case "no_spoiler":
      where.isSpoiler = false;
      return;
    case "with_comment":
      where.comment = { not: null };
      return;
    case "with_spoiler":
      where.isSpoiler = true;
      return;
    case "without_comment":
      where.comment = null;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildCreatedRange({
  createdFrom,
  createdTo,
}: {
  createdFrom: string | undefined;
  createdTo: string | undefined;
}): Prisma.DateTimeFilter | undefined {
  if (createdFrom === undefined && createdTo === undefined) {
    return undefined;
  }
  return {
    ...(createdFrom === undefined ? {} : { gte: parseIsoDate(createdFrom) }),
    ...(createdTo === undefined ? {} : { lt: parseIsoDate(addDaysToIsoDate(createdTo, 1)) }),
  };
}

function buildQuotesDatasetWhere({
  authorIds,
  bookIds,
  createdFrom,
  createdTo,
  search,
  userId,
}: QuotesDatasetInput): Prisma.QuoteWhereInput {
  const book: Prisma.BookWhereInput = { ...SOFT_DELETE_SCOPE.active };
  const where: Prisma.QuoteWhereInput = { ...SOFT_DELETE_SCOPE.active, book, userId };

  if (bookIds !== undefined && bookIds.length > 0) {
    where.bookId = { in: bookIds };
  }

  if (authorIds !== undefined && authorIds.length > 0) {
    book.authors = { some: { authorId: { in: authorIds } } };
  }

  const createdAt = buildCreatedRange({ createdFrom, createdTo });
  if (createdAt !== undefined) {
    where.createdAt = createdAt;
  }

  if (search !== undefined) {
    where.OR = buildQuoteSearchConditions(search);
  }

  return where;
}

function buildQuoteSearchConditions(search: string): Prisma.QuoteWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  const conditions: Prisma.QuoteWhereInput[] = [
    { text: contains },
    { comment: contains },
    { chapter: contains },
    ...buildBookTextSearchConditions(search).map((condition) => ({ book: condition })),
  ];

  const pageMatch = Number.parseInt(search, 10);
  if (
    Number.isInteger(pageMatch) &&
    pageMatch > 0 &&
    pageMatch <= QUOTE_PAGE_MAX &&
    String(pageMatch) === search
  ) {
    conditions.push({ page: pageMatch });
  }

  return conditions;
}

function buildQuotesWhere({ filter, ...dataset }: QuotesFilterInput): Prisma.QuoteWhereInput {
  const where = buildQuotesDatasetWhere(dataset);
  applyQuoteFilter(filter, where);
  return where;
}

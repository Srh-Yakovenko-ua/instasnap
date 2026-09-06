import type {
  LoanHistoryResult,
  LoanHistoryResultCounts,
  LoanHistoryResultFilter,
  LoanHistorySort,
  LoanType,
  Nullable,
} from "@app/shared";

import { LoanHistoryResultSchema, LoanStatusSchema, LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { toLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const LOAN_STATUS_RETURNED = LoanStatusSchema.enum.returned;

const LOAN_TYPE_BORROWED = LoanTypeSchema.enum.borrowed_from_someone;

const LOAN_TYPE_LENT = LoanTypeSchema.enum.lent_to_someone;

const HISTORY_RESULT = LoanHistoryResultSchema.enum;

const loanContactSelect = {
  select: { contact: true, id: true, name: true },
} satisfies Prisma.LoanContactDefaultArgs;

const historyBookInclude = {
  include: {
    book: { include: { coverMedia: true, publisher: true } },
    loanContact: loanContactSelect,
  },
} satisfies Prisma.BookLoanDefaultArgs;

const RETURNED_CALENDAR_DATE = Prisma.sql`(loan.returned_at AT TIME ZONE 'UTC')::date`;

const DELAY_DAYS = Prisma.sql`(${RETURNED_CALENDAR_DATE} - loan.expected_return_date)`;

const DURATION_DAYS = Prisma.sql`(${RETURNED_CALENDAR_DATE} - loan.loan_date)`;

const HISTORY_SOURCE = Prisma.sql`
  FROM book_loans loan
  JOIN books book ON book.id = loan.book_id
  JOIN loan_contacts contact ON contact.id = loan.loan_contact_id
`;

const HISTORY_RESULT_CONDITION: Record<LoanHistoryResult, Prisma.Sql> = {
  late: Prisma.sql`(loan.expected_return_date IS NOT NULL AND ${RETURNED_CALENDAR_DATE} > loan.expected_return_date)`,
  no_due_date: Prisma.sql`(loan.expected_return_date IS NULL)`,
  on_time: Prisma.sql`(loan.expected_return_date IS NOT NULL AND ${RETURNED_CALENDAR_DATE} <= loan.expected_return_date)`,
};

const HISTORY_RESULT_EXPRESSION = Prisma.sql`(CASE
  WHEN ${HISTORY_RESULT_CONDITION.no_due_date} THEN ${HISTORY_RESULT.no_due_date}::text
  WHEN ${HISTORY_RESULT_CONDITION.late} THEN ${HISTORY_RESULT.late}::text
  ELSE ${HISTORY_RESULT.on_time}::text
END)`;

const HISTORY_ORDER_BY: Record<LoanHistorySort, Prisma.Sql> = {
  duration_desc: Prisma.sql`duration_days DESC NULLS LAST, returned_at DESC, id ASC`,
  loan_date_desc: Prisma.sql`loan_date DESC NULLS LAST, returned_at DESC, id ASC`,
  person_asc: Prisma.sql`person_name ASC, returned_at DESC, id ASC`,
  returned_asc: Prisma.sql`returned_at ASC, id ASC`,
  returned_desc: Prisma.sql`returned_at DESC, id ASC`,
  title_asc: Prisma.sql`title ASC, id ASC`,
};

const LoanHistoryOverviewRowSchema = z.object({
  borrowedCount: z.number(),
  durationCount: z.number(),
  lateCount: z.number(),
  lentCount: z.number(),
  longestDurationDays: z.number().nullable(),
  noDueDateCount: z.number(),
  onTimeCount: z.number(),
  shortestDurationDays: z.number().nullable(),
  totalCompleted: z.number(),
  totalDelayDays: z.number().nullable(),
  totalDurationDays: z.number().nullable(),
});

const LoanHistoryPageRowSchema = z.object({
  allCount: z.number(),
  ids: z.array(z.uuid()),
  lateCount: z.number(),
  noDueDateCount: z.number(),
  onTimeCount: z.number(),
  totalCount: z.number(),
});

const LoanHistoryPersonCountsRowSchema = z.object({
  borrowedCount: z.number(),
  contactId: z.uuid(),
  lentCount: z.number(),
  name: z.string(),
  totalCount: z.number(),
});

const LoanHistoryPersonOptionRowSchema = z.object({
  contactId: z.uuid(),
  name: z.string(),
  totalCount: z.number(),
});

export type CompletedLoanWithBook = LoanHistoryRow & { returnedAt: Date };

export type CorrectLoanHistoryInput = {
  loanId: string;
  note: Nullable<string> | undefined;
  returnedAt: Date | undefined;
  userId: string;
};

export type LoanHistoryOverviewRow = z.infer<typeof LoanHistoryOverviewRowSchema>;

export type LoanHistoryPage = {
  items: CompletedLoanWithBook[];
  resultCounts: LoanHistoryResultCounts;
  totalCount: number;
};

export type LoanHistoryPeopleInput = Omit<LoanHistoryScope, "contactId"> & {
  limit: number;
  search: string | undefined;
};

export type LoanHistoryPersonCountsRow = z.infer<typeof LoanHistoryPersonCountsRowSchema>;

export type LoanHistoryPersonOptionRow = z.infer<typeof LoanHistoryPersonOptionRowSchema>;

export type LoanHistoryScope = {
  contactId: string | undefined;
  loanDateFrom: string | undefined;
  loanDateTo: string | undefined;
  returnedFrom: string | undefined;
  returnedTo: string | undefined;
  type: LoanType | undefined;
  userId: string;
};

type ListLoanHistoryInput = LoanHistoryScopedFilter & {
  result: LoanHistoryResultFilter;
  skip: number;
  sort: LoanHistorySort;
  take: number;
};

type LoanHistoryPageRow = z.infer<typeof LoanHistoryPageRowSchema>;

type LoanHistoryRow = Prisma.BookLoanGetPayload<typeof historyBookInclude>;

type LoanHistoryScopedFilter = LoanHistoryScope & { search: string | undefined };

type TopHistoryPeopleInput = Omit<LoanHistoryScope, "contactId"> & { take: number };

@Injectable()
export class LoanHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async correct({ loanId, note, returnedAt, userId }: CorrectLoanHistoryInput): Promise<number> {
    const { count } = await this.prisma.bookLoan.updateMany({
      data: { note, returnedAt },
      where: { id: loanId, status: LOAN_STATUS_RETURNED, userId },
    });
    return count;
  }

  async findCompletedById({
    loanId,
    userId,
  }: {
    loanId: string;
    userId: string;
  }): Promise<Nullable<CompletedLoanWithBook>> {
    const loan = await this.prisma.bookLoan.findFirst({
      where: {
        book: SOFT_DELETE_SCOPE.active,
        id: loanId,
        returnedAt: { not: null },
        status: LOAN_STATUS_RETURNED,
        userId,
      },
      ...historyBookInclude,
    });
    return loan !== null && isCompletedLoan(loan) ? loan : null;
  }

  async listHistory({
    result,
    skip,
    sort,
    take,
    ...filter
  }: ListLoanHistoryInput): Promise<LoanHistoryPage> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH scoped AS (
        SELECT
          loan.id AS id,
          loan.returned_at AS returned_at,
          loan.loan_date AS loan_date,
          contact.name AS person_name,
          book.title AS title,
          ${DURATION_DAYS} AS duration_days,
          ${HISTORY_RESULT_EXPRESSION} AS history_result
        ${HISTORY_SOURCE}
        WHERE ${buildHistoryScopedWhere(filter)}
      ),
      matched AS (
        SELECT * FROM scoped
        ${buildMatchedResultWhere(result)}
      ),
      ranked AS (
        SELECT id, row_number() OVER (ORDER BY ${HISTORY_ORDER_BY[sort]}) AS row_position
        FROM matched
      ),
      page AS (
        SELECT id, row_position
        FROM ranked
        ORDER BY row_position
        LIMIT ${take} OFFSET ${skip}
      )
      SELECT
        (SELECT count(*) FROM matched)::int AS "totalCount",
        (SELECT count(*) FROM scoped)::int AS "allCount",
        (SELECT count(*) FILTER (WHERE history_result = ${HISTORY_RESULT.on_time}) FROM scoped)::int AS "onTimeCount",
        (SELECT count(*) FILTER (WHERE history_result = ${HISTORY_RESULT.late}) FROM scoped)::int AS "lateCount",
        (SELECT count(*) FILTER (WHERE history_result = ${HISTORY_RESULT.no_due_date}) FROM scoped)::int AS "noDueDateCount",
        COALESCE(
          (SELECT array_agg(id ORDER BY row_position) FROM page),
          ARRAY[]::uuid[]
        ) AS "ids"
    `);
    const [page] = z.tuple([LoanHistoryPageRowSchema]).parse(rows);
    const resultCounts = toResultCounts(page);
    if (page.ids.length === 0) {
      return { items: [], resultCounts, totalCount: page.totalCount };
    }

    const unordered = await this.prisma.bookLoan.findMany({
      where: { id: { in: page.ids }, userId: filter.userId },
      ...historyBookInclude,
    });
    return {
      items: orderLoansByIds({ ids: page.ids, rows: unordered }),
      resultCounts,
      totalCount: page.totalCount,
    };
  }

  async overview(scope: LoanHistoryScope): Promise<LoanHistoryOverviewRow> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        (count(*))::int AS "totalCompleted",
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_BORROWED}))::int AS "borrowedCount",
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_LENT}))::int AS "lentCount",
        (count(*) FILTER (WHERE ${HISTORY_RESULT_CONDITION.on_time}))::int AS "onTimeCount",
        (count(*) FILTER (WHERE ${HISTORY_RESULT_CONDITION.late}))::int AS "lateCount",
        (count(*) FILTER (WHERE ${HISTORY_RESULT_CONDITION.no_due_date}))::int AS "noDueDateCount",
        (sum(${DELAY_DAYS}) FILTER (WHERE ${HISTORY_RESULT_CONDITION.late}))::int AS "totalDelayDays",
        (count(*) FILTER (WHERE loan.loan_date IS NOT NULL))::int AS "durationCount",
        (sum(${DURATION_DAYS}))::int AS "totalDurationDays",
        (max(${DURATION_DAYS}))::int AS "longestDurationDays",
        (min(${DURATION_DAYS}))::int AS "shortestDurationDays"
      ${HISTORY_SOURCE}
      WHERE ${buildHistoryScopeWhere(scope)}
    `);
    const [row] = z.tuple([LoanHistoryOverviewRowSchema]).parse(rows);
    return row;
  }

  async people({
    limit,
    search,
    ...scope
  }: LoanHistoryPeopleInput): Promise<LoanHistoryPersonOptionRow[]> {
    const conditions = buildHistoryScopeConditions({ ...scope, contactId: undefined });
    if (search !== undefined) {
      conditions.push(Prisma.sql`contact.name ILIKE ${toLikePattern(search)}`);
    }

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        contact.id AS "contactId",
        contact.name AS "name",
        (count(*))::int AS "totalCount"
      ${HISTORY_SOURCE}
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY contact.id
      ORDER BY contact.name ASC
      LIMIT ${limit}
    `);
    return z.array(LoanHistoryPersonOptionRowSchema).parse(rows);
  }

  async topPeople({
    take,
    ...scope
  }: TopHistoryPeopleInput): Promise<LoanHistoryPersonCountsRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        contact.id AS "contactId",
        contact.name AS "name",
        (count(*))::int AS "totalCount",
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_BORROWED}))::int AS "borrowedCount",
        (count(*) FILTER (WHERE loan.type = ${LOAN_TYPE_LENT}))::int AS "lentCount"
      ${HISTORY_SOURCE}
      WHERE ${buildHistoryScopeWhere({ ...scope, contactId: undefined })}
      GROUP BY contact.id
      ORDER BY "totalCount" DESC, contact.name ASC
      LIMIT ${take}
    `);
    return z.array(LoanHistoryPersonCountsRowSchema).parse(rows);
  }
}

function buildBaseHistoryConditions(userId: string): Prisma.Sql[] {
  return [
    Prisma.sql`loan.user_id = ${userId}::uuid`,
    Prisma.sql`loan.status = ${LOAN_STATUS_RETURNED}`,
    Prisma.sql`loan.returned_at IS NOT NULL`,
    Prisma.sql`book.deleted_at IS NULL`,
  ];
}

function buildHistoryScopeConditions({
  contactId,
  loanDateFrom,
  loanDateTo,
  returnedFrom,
  returnedTo,
  type,
  userId,
}: LoanHistoryScope): Prisma.Sql[] {
  const conditions = buildBaseHistoryConditions(userId);
  if (type !== undefined) {
    conditions.push(Prisma.sql`loan.type = ${type}`);
  }
  if (contactId !== undefined) {
    conditions.push(Prisma.sql`loan.loan_contact_id = ${contactId}::uuid`);
  }
  if (returnedFrom !== undefined) {
    conditions.push(Prisma.sql`${RETURNED_CALENDAR_DATE} >= ${returnedFrom}::date`);
  }
  if (returnedTo !== undefined) {
    conditions.push(Prisma.sql`${RETURNED_CALENDAR_DATE} <= ${returnedTo}::date`);
  }
  if (loanDateFrom !== undefined) {
    conditions.push(Prisma.sql`loan.loan_date >= ${loanDateFrom}::date`);
  }
  if (loanDateTo !== undefined) {
    conditions.push(Prisma.sql`loan.loan_date <= ${loanDateTo}::date`);
  }
  return conditions;
}

function buildHistoryScopedWhere({ search, ...scope }: LoanHistoryScopedFilter): Prisma.Sql {
  const conditions = buildHistoryScopeConditions(scope);
  if (search !== undefined) {
    conditions.push(buildHistorySearchCondition(search));
  }
  return Prisma.join(conditions, " AND ");
}

function buildHistoryScopeWhere(scope: LoanHistoryScope): Prisma.Sql {
  return Prisma.join(buildHistoryScopeConditions(scope), " AND ");
}

function buildHistorySearchCondition(search: string): Prisma.Sql {
  const pattern = toLikePattern(search);
  return Prisma.sql`(
    book.title ILIKE ${pattern}
    OR book.original_title ILIKE ${pattern}
    OR contact.name ILIKE ${pattern}
    OR contact.contact ILIKE ${pattern}
    OR loan.person_name ILIKE ${pattern}
    OR loan.contact ILIKE ${pattern}
    OR loan.note ILIKE ${pattern}
    OR EXISTS (
      SELECT 1
      FROM book_authors book_author
      JOIN authors author ON author.id = book_author.author_id
      LEFT JOIN author_names author_name ON author_name.author_id = author.id
      WHERE book_author.book_id = book.id
        AND (author.name ILIKE ${pattern} OR author_name.name ILIKE ${pattern})
    )
  )`;
}

function buildMatchedResultWhere(result: LoanHistoryResultFilter): Prisma.Sql {
  return result === "all" ? Prisma.empty : Prisma.sql`WHERE history_result = ${result}`;
}

function isCompletedLoan(loan: LoanHistoryRow): loan is CompletedLoanWithBook {
  return loan.returnedAt !== null;
}

function orderLoansByIds({
  ids,
  rows,
}: {
  ids: string[];
  rows: LoanHistoryRow[];
}): CompletedLoanWithBook[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined || !isCompletedLoan(row) ? [] : [row];
  });
}

function toResultCounts({
  allCount,
  lateCount,
  noDueDateCount,
  onTimeCount,
}: LoanHistoryPageRow): LoanHistoryResultCounts {
  return {
    all: allCount,
    late: lateCount,
    no_due_date: noDueDateCount,
    on_time: onTimeCount,
  };
}

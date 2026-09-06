import type { LoanFilter, LoanReminderFilter, LoanSort, LoanType, Nullable } from "@app/shared";

import { LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";

import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookTextSearchConditions } from "../../books/index.js";

const LOAN_STATUS_ACTIVE = "active";

const PERSON_COVERS_LIMIT = 3;

const PERSON_COVERS_SLICE = Prisma.raw(`[1:${PERSON_COVERS_LIMIT}]`);

const LoanDirectionCountsRowSchema = z.object({
  earliestLoanDate: z.string().nullable(),
  longHeldCount: z.number(),
  nearestReturnDate: z.string().nullable(),
  noReminderWithDateCount: z.number(),
  noReturnDateCount: z.number(),
  noReturnDatePeopleCount: z.number(),
  oldestOverdueReturnDate: z.string().nullable(),
  overdueCount: z.number(),
  peopleCount: z.number(),
  returningSoonCount: z.number(),
  totalCount: z.number(),
  type: LoanTypeSchema,
});

const LoanPersonCountsRowSchema = z.object({
  bookCount: z.number(),
  contactId: z.uuid(),
  coverMediaIds: z.array(z.uuid()).nullable(),
  personName: z.string(),
  type: LoanTypeSchema,
});

const loanContactSelect = {
  select: { contact: true, id: true, name: true },
} satisfies Prisma.LoanContactDefaultArgs;

const loanBookInclude = {
  include: {
    book: { include: { coverMedia: true, publisher: true } },
    loanContact: loanContactSelect,
  },
} satisfies Prisma.BookLoanDefaultArgs;

export type LoanDirectionCounts = z.infer<typeof LoanDirectionCountsRowSchema>;

export type LoanPersonCounts = z.infer<typeof LoanPersonCountsRowSchema>;

export type LoansFilterInput = {
  contactId: string | undefined;
  expectedReturnDateFrom: Nullable<Date>;
  expectedReturnDateTo: Nullable<Date>;
  filter: LoanFilter;
  hasNote: boolean | undefined;
  loanDateFrom: Nullable<Date>;
  loanDateTo: Nullable<Date>;
  reminder: LoanReminderFilter | undefined;
  search: string | undefined;
  soonEnd: Date;
  today: Date;
  type: LoanType | undefined;
  userId: string;
};

export type LoanWithBook = Prisma.BookLoanGetPayload<typeof loanBookInclude>;

type ListLoansInput = LoansFilterInput & {
  skip: number;
  sort: LoanSort;
  take: number;
};

type LongHeldLoansInput = {
  loanedBefore: Date;
  take: number;
  type: LoanType;
  userId: string;
};

type SummaryInput = {
  longHeldBefore: Date;
  soonEnd: Date;
  today: Date;
  userId: string;
};

type TopPeopleInput = {
  take: number;
  userId: string;
};

type UpcomingReturnsInput = {
  take: number;
  today: Date;
  type: LoanType;
  userId: string;
};

@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  countLoans(input: LoansFilterInput): Promise<number> {
    return this.prisma.bookLoan.count({ where: buildLoansWhere(input) });
  }

  coverAssets(ids: string[]): Promise<MediaAssetModel[]> {
    return this.prisma.mediaAsset.findMany({ where: { id: { in: ids } } });
  }

  listLoans({ skip, sort, take, ...filter }: ListLoansInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildLoansWhere(filter),
      ...loanBookInclude,
    });
  }

  longHeldLoans({ loanedBefore, take, type, userId }: LongHeldLoansInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_DATE_ASC_ORDER,
      take,
      where: {
        ...buildActiveLoansWhere({ type, userId }),
        loanDate: { lte: loanedBefore },
      },
      ...loanBookInclude,
    });
  }

  async summary({
    longHeldBefore,
    soonEnd,
    today,
    userId,
  }: SummaryInput): Promise<LoanDirectionCounts[]> {
    const todayIso = toIsoDate(today);
    const soonEndIso = toIsoDate(soonEnd);
    const longHeldBeforeIso = toIsoDate(longHeldBefore);

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        loan.type AS "type",
        (count(*))::int AS "totalCount",
        (count(DISTINCT loan.loan_contact_id))::int AS "peopleCount",
        (count(*) FILTER (
          WHERE loan.expected_return_date >= ${todayIso}::date
            AND loan.expected_return_date <= ${soonEndIso}::date
        ))::int AS "returningSoonCount",
        to_char(
          min(loan.expected_return_date) FILTER (
            WHERE loan.expected_return_date >= ${todayIso}::date
          ),
          'YYYY-MM-DD'
        ) AS "nearestReturnDate",
        (count(*) FILTER (WHERE loan.expected_return_date < ${todayIso}::date))::int AS "overdueCount",
        to_char(
          min(loan.expected_return_date) FILTER (
            WHERE loan.expected_return_date < ${todayIso}::date
          ),
          'YYYY-MM-DD'
        ) AS "oldestOverdueReturnDate",
        (count(*) FILTER (
          WHERE loan.loan_date <= ${longHeldBeforeIso}::date
        ))::int AS "longHeldCount",
        to_char(min(loan.loan_date), 'YYYY-MM-DD') AS "earliestLoanDate",
        (count(*) FILTER (
          WHERE loan.expected_return_date IS NOT NULL
            AND loan.remind_to_return = false
        ))::int AS "noReminderWithDateCount",
        (count(*) FILTER (WHERE loan.expected_return_date IS NULL))::int AS "noReturnDateCount",
        (count(DISTINCT loan.loan_contact_id) FILTER (
          WHERE loan.expected_return_date IS NULL
        ))::int AS "noReturnDatePeopleCount"
      FROM book_loans loan
      JOIN books book ON book.id = loan.book_id
      WHERE loan.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
        AND loan.status = ${LOAN_STATUS_ACTIVE}
      GROUP BY loan.type
    `);

    return z.array(LoanDirectionCountsRowSchema).parse(rows);
  }

  async topPeople({ take, userId }: TopPeopleInput): Promise<LoanPersonCounts[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH ranked AS (
        SELECT
          loan.type AS "type",
          contact.id AS "contactId",
          contact.name AS "personName",
          (count(*))::int AS "bookCount",
          (array_agg(book.cover_media_id ORDER BY loan.loan_date DESC NULLS LAST, loan.id)
            FILTER (WHERE book.cover_media_id IS NOT NULL))${PERSON_COVERS_SLICE} AS "coverMediaIds",
          row_number() OVER (
            PARTITION BY loan.type
            ORDER BY count(*) DESC, contact.name ASC
          ) AS "rank"
        FROM book_loans loan
        JOIN books book ON book.id = loan.book_id
        JOIN loan_contacts contact ON contact.id = loan.loan_contact_id
        WHERE loan.user_id = ${userId}::uuid
          AND book.deleted_at IS NULL
          AND loan.status = ${LOAN_STATUS_ACTIVE}
        GROUP BY loan.type, contact.id
      )
      SELECT "type", "contactId", "personName", "bookCount", "coverMediaIds"
      FROM ranked
      WHERE "rank" <= ${take}
      ORDER BY "type", "rank"
    `);

    return z.array(LoanPersonCountsRowSchema).parse(rows);
  }

  upcomingReturns({ take, today, type, userId }: UpcomingReturnsInput): Promise<LoanWithBook[]> {
    return this.prisma.bookLoan.findMany({
      orderBy: LOAN_SORT_ORDER_BY.return_date,
      take,
      where: {
        ...buildActiveLoansWhere({ type, userId }),
        expectedReturnDate: { gte: today },
      },
      ...loanBookInclude,
    });
  }
}

const ID_TIEBREAKER: Prisma.BookLoanOrderByWithRelationInput = { id: "asc" };

const LOAN_DATE_ASC_ORDER: Prisma.BookLoanOrderByWithRelationInput[] = [
  { loanDate: { nulls: "last", sort: "asc" } },
  ID_TIEBREAKER,
];

const RETURN_DATE_ORDER: Prisma.BookLoanOrderByWithRelationInput[] = [
  { expectedReturnDate: { nulls: "last", sort: "asc" } },
  { loanDate: { nulls: "last", sort: "desc" } },
  ID_TIEBREAKER,
];

const URGENCY_ORDER: Prisma.BookLoanOrderByWithRelationInput[] = [
  { expectedReturnDate: { nulls: "last", sort: "asc" } },
  { loanDate: { nulls: "last", sort: "asc" } },
  ID_TIEBREAKER,
];

const LOAN_SORT_ORDER_BY: Record<LoanSort, Prisma.BookLoanOrderByWithRelationInput[]> = {
  author: [{ book: { firstAuthorName: "asc" } }, ID_TIEBREAKER],
  loan_date: [{ loanDate: { nulls: "last", sort: "desc" } }, ID_TIEBREAKER],
  overdue_first: URGENCY_ORDER,
  person: [{ loanContact: { name: "asc" } }, ID_TIEBREAKER],
  return_date: RETURN_DATE_ORDER,
  title: [{ book: { title: "asc" } }, ID_TIEBREAKER],
};

function buildActiveLoansWhere({
  type,
  userId,
}: {
  type: LoanType | undefined;
  userId: string;
}): Prisma.BookLoanWhereInput {
  const where: Prisma.BookLoanWhereInput = {
    book: SOFT_DELETE_SCOPE.active,
    status: LOAN_STATUS_ACTIVE,
    userId,
  };

  if (type !== undefined) {
    where.type = type;
  }

  return where;
}

function buildDayRangeConditions(
  field: "expectedReturnDate" | "loanDate",
  from: Nullable<Date>,
  to: Nullable<Date>,
): Prisma.BookLoanWhereInput[] {
  const conditions: Prisma.BookLoanWhereInput[] = [];
  if (from !== null) conditions.push({ [field]: { gte: from } });
  if (to !== null) conditions.push({ [field]: { lte: to } });
  return conditions;
}

function buildHasNoteConditions(hasNote: boolean | undefined): Prisma.BookLoanWhereInput[] {
  if (hasNote === undefined) return [];
  if (hasNote) return [{ note: { not: null } }, { NOT: { note: "" } }];
  return [{ OR: [{ note: null }, { note: "" }] }];
}

function buildLoanFilterConditions({
  filter,
  soonEnd,
  today,
}: {
  filter: LoanFilter;
  soonEnd: Date;
  today: Date;
}): Prisma.BookLoanWhereInput[] {
  switch (filter) {
    case "all":
      return [];
    case "no_return_date":
      return [{ expectedReturnDate: null }];
    case "overdue":
      return [{ expectedReturnDate: { lt: today } }];
    case "return_soon":
      return [{ expectedReturnDate: { gte: today, lte: soonEnd } }];
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildLoanSearchConditions(search: string): Prisma.BookLoanWhereInput[] {
  const contains = { contains: escapeLikePattern(search), mode: "insensitive" } as const;
  return [
    ...buildBookTextSearchConditions(search).map((condition) => ({ book: condition })),
    { loanContact: { name: contains } },
    { loanContact: { contact: contains } },
    { personName: contains },
    { contact: contains },
    { note: contains },
  ];
}

function buildLoansWhere({
  contactId,
  expectedReturnDateFrom,
  expectedReturnDateTo,
  filter,
  hasNote,
  loanDateFrom,
  loanDateTo,
  reminder,
  search,
  soonEnd,
  today,
  type,
  userId,
}: LoansFilterInput): Prisma.BookLoanWhereInput {
  const where = buildActiveLoansWhere({ type, userId });

  const conditions = [
    ...buildLoanFilterConditions({ filter, soonEnd, today }),
    ...buildDayRangeConditions("loanDate", loanDateFrom, loanDateTo),
    ...buildDayRangeConditions("expectedReturnDate", expectedReturnDateFrom, expectedReturnDateTo),
    ...buildReminderConditions(reminder),
    ...buildHasNoteConditions(hasNote),
  ];

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  if (contactId !== undefined) {
    where.loanContactId = contactId;
  }

  if (search !== undefined) {
    where.OR = buildLoanSearchConditions(search);
  }

  return where;
}

function buildReminderConditions(
  reminder: LoanReminderFilter | undefined,
): Prisma.BookLoanWhereInput[] {
  if (reminder === undefined) return [];
  if (reminder === "on") return [{ remindToReturn: true }];
  return [{ expectedReturnDate: { not: null }, remindToReturn: false }];
}

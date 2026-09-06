import { isAfter, parseISO } from "date-fns";
import { z } from "zod";

import { LoanTypeSchema, OwnershipStatusSchema } from "./book-enums.js";
import {
  collapseHorizontalSpaces,
  createPaginatedSchema,
  paginationQueryFields,
} from "./common.js";
import { NoHtmlString, notInFutureDate } from "./internal.js";
import { MediaViewSchema } from "./media.js";

const LOAN_SEARCH_MAX = 100;
const LOAN_PERSON_QUERY_MAX = 100;
const LOAN_NOTE_MAX = 500;

const LOAN_HISTORY_PEOPLE_LIMIT = {
  default: 50,
  max: 200,
} as const;

export const LoanNoteSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(LOAN_NOTE_MAX, "Note must be at most 500 characters long"));

export const LoanUiStatusSchema = z.enum(["overdue", "return_soon", "no_return_date", "on_time"]);

export type LoanUiStatus = z.infer<typeof LoanUiStatusSchema>;

export const LoanInfoViewSchema = z.object({
  contact: z.string().nullable(),
  expectedReturnDate: z.string().nullable(),
  loanContactId: z.string(),
  loanDate: z.string().nullable(),
  loanType: LoanTypeSchema,
  loanUiStatus: LoanUiStatusSchema,
  note: z.string().nullable(),
  personName: z.string(),
  remindBeforeDays: z.number().int().nullable(),
  remindToReturn: z.boolean(),
});

export type LoanInfoView = z.infer<typeof LoanInfoViewSchema>;

export const LoanFilterSchema = z.enum(["all", "return_soon", "overdue", "no_return_date"]);

export type LoanFilter = z.infer<typeof LoanFilterSchema>;

export const LoanReminderFilterSchema = z.enum(["on", "off"]);

export type LoanReminderFilter = z.infer<typeof LoanReminderFilterSchema>;

export const LoanSortSchema = z.enum([
  "overdue_first",
  "return_date",
  "loan_date",
  "title",
  "author",
  "person",
]);

export type LoanSort = z.infer<typeof LoanSortSchema>;

const LOAN_DATE_RANGE_MESSAGE = "Loan date from cannot be after loan date to";
const RETURN_DATE_RANGE_MESSAGE = "Return date from cannot be after return date to";

const isDayRangeOrdered = (from: string | undefined, to: string | undefined): boolean =>
  from === undefined || to === undefined || !isAfter(parseISO(from), parseISO(to));

export const LoansQuerySchema = z
  .object({
    contactId: z.uuid().optional(),
    expectedReturnDateFrom: z.iso.date().optional(),
    expectedReturnDateTo: z.iso.date().optional(),
    filter: LoanFilterSchema.default("all"),
    hasNote: z.stringbool().optional(),
    loanDateFrom: z.iso.date().optional(),
    loanDateTo: z.iso.date().optional(),
    ...paginationQueryFields({ pageSizeDefault: 10 }),
    reminder: LoanReminderFilterSchema.optional(),
    search: z.string().trim().max(LOAN_SEARCH_MAX).optional(),
    sort: LoanSortSchema.default("overdue_first"),
    type: LoanTypeSchema.optional(),
  })
  .refine((value) => isDayRangeOrdered(value.loanDateFrom, value.loanDateTo), {
    error: LOAN_DATE_RANGE_MESSAGE,
    path: ["loanDateTo"],
  })
  .refine((value) => isDayRangeOrdered(value.expectedReturnDateFrom, value.expectedReturnDateTo), {
    error: RETURN_DATE_RANGE_MESSAGE,
    path: ["expectedReturnDateTo"],
  });

export type LoansQuery = z.infer<typeof LoansQuerySchema>;

export const LoanBookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  firstAuthorName: z.string(),
  id: z.string(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  publisher: z.object({ id: z.string(), name: z.string() }).nullable(),
  title: z.string(),
});

export type LoanBookPreview = z.infer<typeof LoanBookPreviewSchema>;

export const LoanListItemViewSchema = z.object({
  book: LoanBookPreviewSchema,
  contact: z.string().nullable(),
  createdAt: z.string(),
  expectedReturnDate: z.string().nullable(),
  id: z.string(),
  loanContactId: z.string(),
  loanDate: z.string().nullable(),
  loanUiStatus: LoanUiStatusSchema,
  note: z.string().nullable(),
  personName: z.string(),
  remindBeforeDays: z.number().int().nullable(),
  remindToReturn: z.boolean(),
  type: LoanTypeSchema,
  updatedAt: z.string(),
});

export type LoanListItemView = z.infer<typeof LoanListItemViewSchema>;

export const PaginatedLoansSchema = createPaginatedSchema(LoanListItemViewSchema);

export const LOAN_STATS_WINDOWS = {
  longHeldDays: 30,
  returnSoonDays: 7,
} as const;

export const LoanPersonSummarySchema = z.object({
  bookCount: z.number().int().nonnegative(),
  contactId: z.string(),
  covers: z.array(MediaViewSchema),
  personName: z.string(),
});

export type LoanPersonSummary = z.infer<typeof LoanPersonSummarySchema>;

export const LoanDirectionSummarySchema = z.object({
  earliestLoanDate: z.string().nullable(),
  longHeldCount: z.number().int().nonnegative(),
  longHeldLoans: z.array(LoanListItemViewSchema),
  nearestReturnDate: z.string().nullable(),
  noReminderWithDateCount: z.number().int().nonnegative(),
  noReturnDateCount: z.number().int().nonnegative(),
  noReturnDatePeopleCount: z.number().int().nonnegative(),
  oldestOverdueReturnDate: z.string().nullable(),
  overdueCount: z.number().int().nonnegative(),
  peopleCount: z.number().int().nonnegative(),
  returningSoonCount: z.number().int().nonnegative(),
  topPeople: z.array(LoanPersonSummarySchema),
  totalCount: z.number().int().nonnegative(),
  upcomingReturns: z.array(LoanListItemViewSchema),
});

export type LoanDirectionSummary = z.infer<typeof LoanDirectionSummarySchema>;

export const LoansSummaryViewSchema = z.object({
  borrowed: LoanDirectionSummarySchema,
  lent: LoanDirectionSummarySchema,
});

export type LoansSummaryView = z.infer<typeof LoansSummaryViewSchema>;

export const LoanHistoryResultSchema = z.enum(["on_time", "late", "no_due_date"]);

export type LoanHistoryResult = z.infer<typeof LoanHistoryResultSchema>;

export const LoanHistoryResultFilterSchema = z.enum(["all", "on_time", "late", "no_due_date"]);

export type LoanHistoryResultFilter = z.infer<typeof LoanHistoryResultFilterSchema>;

export const LoanHistorySortSchema = z.enum([
  "returned_desc",
  "returned_asc",
  "loan_date_desc",
  "duration_desc",
  "title_asc",
  "person_asc",
]);

export type LoanHistorySort = z.infer<typeof LoanHistorySortSchema>;

const RETURNED_RANGE_MESSAGE = "Returned from cannot be after returned to";

const isReturnedRangeOrdered = (value: { returnedFrom?: string; returnedTo?: string }): boolean =>
  value.returnedFrom === undefined ||
  value.returnedTo === undefined ||
  !isAfter(parseISO(value.returnedFrom), parseISO(value.returnedTo));

export const LoanHistoryQuerySchema = z
  .object({
    contactId: z.uuid().optional(),
    loanDateFrom: z.iso.date().optional(),
    loanDateTo: z.iso.date().optional(),
    ...paginationQueryFields({ pageSizeDefault: 10 }),
    result: LoanHistoryResultFilterSchema.default("all"),
    returnedFrom: z.iso.date().optional(),
    returnedTo: z.iso.date().optional(),
    search: z.string().trim().max(LOAN_SEARCH_MAX).optional(),
    sort: LoanHistorySortSchema.default("returned_desc"),
    type: LoanTypeSchema.optional(),
  })
  .refine(isReturnedRangeOrdered, { error: RETURNED_RANGE_MESSAGE, path: ["returnedTo"] })
  .refine((value) => isDayRangeOrdered(value.loanDateFrom, value.loanDateTo), {
    error: LOAN_DATE_RANGE_MESSAGE,
    path: ["loanDateTo"],
  });

export type LoanHistoryQuery = z.infer<typeof LoanHistoryQuerySchema>;

export const LoanHistoryOverviewQuerySchema = z
  .object({
    contactId: z.uuid().optional(),
    loanDateFrom: z.iso.date().optional(),
    loanDateTo: z.iso.date().optional(),
    returnedFrom: z.iso.date().optional(),
    returnedTo: z.iso.date().optional(),
    type: LoanTypeSchema.optional(),
  })
  .refine(isReturnedRangeOrdered, { error: RETURNED_RANGE_MESSAGE, path: ["returnedTo"] })
  .refine((value) => isDayRangeOrdered(value.loanDateFrom, value.loanDateTo), {
    error: LOAN_DATE_RANGE_MESSAGE,
    path: ["loanDateTo"],
  });

export type LoanHistoryOverviewQuery = z.infer<typeof LoanHistoryOverviewQuerySchema>;

export const LoanHistoryListItemViewSchema = z.object({
  book: LoanBookPreviewSchema,
  delayDays: z.number().int().nullable(),
  durationDays: z.number().int().nullable(),
  expectedReturnDate: z.string().nullable(),
  historyResult: LoanHistoryResultSchema,
  id: z.string(),
  loanContactId: z.string(),
  loanDate: z.string().nullable(),
  personName: z.string(),
  returnedAt: z.string(),
  returnedDate: z.string(),
  type: LoanTypeSchema,
});

export type LoanHistoryListItemView = z.infer<typeof LoanHistoryListItemViewSchema>;

export const LoanHistoryResultCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  no_due_date: z.number().int().nonnegative(),
  on_time: z.number().int().nonnegative(),
});

export type LoanHistoryResultCounts = z.infer<typeof LoanHistoryResultCountsSchema>;

export const PaginatedLoanHistorySchema = createPaginatedSchema(
  LoanHistoryListItemViewSchema,
).extend({
  resultCounts: LoanHistoryResultCountsSchema.describe(
    "Answers to every list filter except result itself, so all === on_time + late + no_due_date and all is the size of the dataset before the result filter is applied.",
  ),
});

export type PaginatedLoanHistory = z.infer<typeof PaginatedLoanHistorySchema>;

export const LoanHistoryDetailViewSchema = LoanHistoryListItemViewSchema.extend({
  contact: z.string().nullable(),
  createdAt: z.string(),
  note: z.string().nullable(),
  updatedAt: z.string(),
});

export type LoanHistoryDetailView = z.infer<typeof LoanHistoryDetailViewSchema>;

export const LoanHistoryPersonStatsSchema = z.object({
  borrowedCount: z.number().int().nonnegative(),
  contactId: z.string(),
  lentCount: z.number().int().nonnegative(),
  personName: z.string(),
  totalCount: z.number().int().nonnegative(),
});

export type LoanHistoryPersonStats = z.infer<typeof LoanHistoryPersonStatsSchema>;

const loanHistoryOnTimePercent = () =>
  z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Share of the loans that had a due date and came back on time, so onTimeCount / (onTimeCount + lateCount). Null when no completed loan carried a due date, which keeps a missing percentage apart from a real 0%.",
    );

export const LoanHistoryOverviewViewSchema = z.object({
  duration: z.object({
    averageDays: z.number().int().nullable(),
    longestDays: z.number().int().nullable(),
    shortestDays: z.number().int().nullable(),
  }),
  reliability: z.object({
    lateCount: z.number().int().nonnegative(),
    noDueDateCount: z.number().int().nonnegative(),
    onTimeCount: z.number().int().nonnegative(),
    onTimePercent: loanHistoryOnTimePercent(),
  }),
  summary: z.object({
    averageDelayDays: z.number().int().nullable(),
    averageDurationDays: z.number().int().nullable(),
    borrowedCount: z.number().int().nonnegative(),
    durationCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "How many completed loans have a loan date, so how many averageDurationDays covers.",
      ),
    lateCount: z.number().int().nonnegative(),
    lentCount: z.number().int().nonnegative(),
    noDueDateCount: z.number().int().nonnegative(),
    onTimeCount: z.number().int().nonnegative(),
    onTimePercent: loanHistoryOnTimePercent(),
    totalCompleted: z.number().int().nonnegative(),
  }),
  topPeople: z.array(LoanHistoryPersonStatsSchema),
});

export type LoanHistoryOverviewView = z.infer<typeof LoanHistoryOverviewViewSchema>;

export const LoanHistoryPeopleQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LOAN_HISTORY_PEOPLE_LIMIT.max)
      .default(LOAN_HISTORY_PEOPLE_LIMIT.default),
    loanDateFrom: z.iso.date().optional(),
    loanDateTo: z.iso.date().optional(),
    returnedFrom: z.iso.date().optional(),
    returnedTo: z.iso.date().optional(),
    search: z.string().trim().max(LOAN_PERSON_QUERY_MAX).optional(),
    type: LoanTypeSchema.optional(),
  })
  .refine(isReturnedRangeOrdered, { error: RETURNED_RANGE_MESSAGE, path: ["returnedTo"] })
  .refine((value) => isDayRangeOrdered(value.loanDateFrom, value.loanDateTo), {
    error: LOAN_DATE_RANGE_MESSAGE,
    path: ["loanDateTo"],
  });

export type LoanHistoryPeopleQuery = z.infer<typeof LoanHistoryPeopleQuerySchema>;

export const LoanHistoryPersonOptionSchema = z.object({
  contactId: z.string(),
  personName: z.string(),
  totalCount: z.number().int().nonnegative(),
});

export type LoanHistoryPersonOption = z.infer<typeof LoanHistoryPersonOptionSchema>;

export const LoanHistoryPeopleViewSchema = z.object({
  items: z.array(LoanHistoryPersonOptionSchema),
});

export type LoanHistoryPeopleView = z.infer<typeof LoanHistoryPeopleViewSchema>;

const EMPTY_CORRECTION_MESSAGE = "Provide a returned date or a note to correct";

const hasLoanHistoryCorrection = (value: {
  note?: null | string;
  returnedDate?: string;
}): boolean => value.returnedDate !== undefined || value.note !== undefined;

export const UpdateLoanHistoryInputSchema = z
  .strictObject({
    note: LoanNoteSchema.nullable().optional(),
    returnedDate: notInFutureDate("Returned date must not be in the future").optional(),
  })
  .refine(hasLoanHistoryCorrection, {
    error: EMPTY_CORRECTION_MESSAGE,
    path: ["returnedDate"],
  });

export type UpdateLoanHistoryInput = z.infer<typeof UpdateLoanHistoryInputSchema>;

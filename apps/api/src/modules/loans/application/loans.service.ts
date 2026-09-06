import type {
  LoanBookPreview,
  LoanDirectionSummary,
  LoanListItemView,
  LoanPersonSummary,
  LoansQuery,
  LoansSummaryView,
  LoanType,
  Paginator,
} from "@app/shared";

import {
  LOAN_STATS_WINDOWS,
  LoanTypeSchema,
  normalizeSearch,
  OwnershipStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { subDays } from "date-fns";

import { toCreateDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { resolveActiveLoanPerson } from "../domain/loan-person.js";
import { getLoanUiStatus, loanDateBounds } from "../domain/loan-ui-status.js";
import {
  type LoanDirectionCounts,
  LoansRepository,
  type LoanWithBook,
} from "../infrastructure/loans.repository.js";

const SIDEBAR_LOANS_LIMIT = 5;
const SIDEBAR_PEOPLE_LIMIT = 5;

type DirectionLoanLists = DirectionSidebarLoans & Pick<LoanDirectionSummary, "topPeople">;

type DirectionSidebarLoans = Pick<LoanDirectionSummary, "longHeldLoans" | "upcomingReturns">;

type PersonSummaryWithType = LoanPersonSummary & { type: LoanType };

const EMPTY_DIRECTION_COUNTS = {
  earliestLoanDate: null,
  longHeldCount: 0,
  nearestReturnDate: null,
  noReminderWithDateCount: 0,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  totalCount: 0,
} satisfies Omit<LoanDirectionSummary, keyof DirectionLoanLists>;

@Injectable()
export class LoansService {
  constructor(
    private readonly loansRepository: LoansRepository,
    private readonly mediaService: MediaService,
  ) {}

  async list({
    query,
    userId,
  }: {
    query: LoansQuery;
    userId: string;
  }): Promise<Paginator<LoanListItemView>> {
    const { soonEnd, today } = loanDateBounds(new Date());
    const filter = {
      contactId: query.contactId,
      expectedReturnDateFrom: toCreateDate(query.expectedReturnDateFrom),
      expectedReturnDateTo: toCreateDate(query.expectedReturnDateTo),
      filter: query.filter,
      hasNote: query.hasNote,
      loanDateFrom: toCreateDate(query.loanDateFrom),
      loanDateTo: toCreateDate(query.loanDateTo),
      reminder: query.reminder,
      search: normalizeSearch(query.search),
      soonEnd,
      today,
      type: query.type,
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.loansRepository.listLoans({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.loansRepository.countLoans(filter),
    ]);

    return buildPaginator({
      items: items.map((loan) => this.toListItemView(loan, today)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async summary({ userId }: { userId: string }): Promise<LoansSummaryView> {
    const { soonEnd, today } = loanDateBounds(new Date());
    const longHeldBefore = subDays(today, LOAN_STATS_WINDOWS.longHeldDays);

    const [counts, people, borrowedLoans, lentLoans] = await Promise.all([
      this.loansRepository.summary({ longHeldBefore, soonEnd, today, userId }),
      this.topPeople(userId),
      this.sidebarLoans({ longHeldBefore, today, type: "borrowed_from_someone", userId }),
      this.sidebarLoans({ longHeldBefore, today, type: "lent_to_someone", userId }),
    ]);

    return {
      borrowed: toDirectionSummary(counts, "borrowed_from_someone", {
        ...borrowedLoans,
        topPeople: toPersonSummaries(people, "borrowed_from_someone"),
      }),
      lent: toDirectionSummary(counts, "lent_to_someone", {
        ...lentLoans,
        topPeople: toPersonSummaries(people, "lent_to_someone"),
      }),
    };
  }

  private async sidebarLoans({
    longHeldBefore,
    today,
    type,
    userId,
  }: {
    longHeldBefore: Date;
    today: Date;
    type: LoanType;
    userId: string;
  }): Promise<DirectionSidebarLoans> {
    const [longHeldLoans, upcomingReturns] = await Promise.all([
      this.loansRepository.longHeldLoans({
        loanedBefore: longHeldBefore,
        take: SIDEBAR_LOANS_LIMIT,
        type,
        userId,
      }),
      this.loansRepository.upcomingReturns({ take: SIDEBAR_LOANS_LIMIT, today, type, userId }),
    ]);

    return {
      longHeldLoans: longHeldLoans.map((loan) => this.toListItemView(loan, today)),
      upcomingReturns: upcomingReturns.map((loan) => this.toListItemView(loan, today)),
    };
  }

  private toBookPreview(book: LoanWithBook["book"]): LoanBookPreview {
    return {
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      firstAuthorName: book.firstAuthorName,
      id: book.id,
      originalTitle: book.originalTitle,
      ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
      publisher:
        book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
      title: book.title,
    };
  }

  private toListItemView(loan: LoanWithBook, today: Date): LoanListItemView {
    const person = resolveActiveLoanPerson(loan);

    return {
      book: this.toBookPreview(loan.book),
      contact: person.contact,
      createdAt: loan.createdAt.toISOString(),
      expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
      id: loan.id,
      loanContactId: person.loanContactId,
      loanDate: toNullableIsoDate(loan.loanDate),
      loanUiStatus: getLoanUiStatus({ expectedReturnDate: loan.expectedReturnDate, today }),
      note: loan.note,
      personName: person.personName,
      remindBeforeDays: loan.remindBeforeDays,
      remindToReturn: loan.remindToReturn,
      type: LoanTypeSchema.parse(loan.type),
      updatedAt: loan.updatedAt.toISOString(),
    };
  }

  private async topPeople(userId: string): Promise<PersonSummaryWithType[]> {
    const rows = await this.loansRepository.topPeople({ take: SIDEBAR_PEOPLE_LIMIT, userId });
    const coverIds = rows.flatMap((row) => row.coverMediaIds ?? []);
    const assets = coverIds.length === 0 ? [] : await this.loansRepository.coverAssets(coverIds);
    const coverViews = new Map(
      assets.map((asset) => [asset.id, this.mediaService.buildViewOrNull(asset)]),
    );

    return rows.map((row) => ({
      bookCount: row.bookCount,
      contactId: row.contactId,
      covers: (row.coverMediaIds ?? []).flatMap((id) => {
        const view = coverViews.get(id);
        return view === undefined || view === null ? [] : [view];
      }),
      personName: row.personName,
      type: row.type,
    }));
  }
}

function toDirectionSummary(
  counts: LoanDirectionCounts[],
  type: LoanType,
  loans: DirectionLoanLists,
): LoanDirectionSummary {
  const row = counts.find((candidate) => candidate.type === type);
  if (row === undefined) {
    return { ...EMPTY_DIRECTION_COUNTS, ...loans };
  }

  return {
    earliestLoanDate: row.earliestLoanDate,
    longHeldCount: row.longHeldCount,
    longHeldLoans: loans.longHeldLoans,
    nearestReturnDate: row.nearestReturnDate,
    noReminderWithDateCount: row.noReminderWithDateCount,
    noReturnDateCount: row.noReturnDateCount,
    noReturnDatePeopleCount: row.noReturnDatePeopleCount,
    oldestOverdueReturnDate: row.oldestOverdueReturnDate,
    overdueCount: row.overdueCount,
    peopleCount: row.peopleCount,
    returningSoonCount: row.returningSoonCount,
    topPeople: loans.topPeople,
    totalCount: row.totalCount,
    upcomingReturns: loans.upcomingReturns,
  };
}

function toPersonSummaries(people: PersonSummaryWithType[], type: LoanType): LoanPersonSummary[] {
  return people
    .filter((person) => person.type === type)
    .map(({ bookCount, contactId, covers, personName }) => ({
      bookCount,
      contactId,
      covers,
      personName,
    }));
}

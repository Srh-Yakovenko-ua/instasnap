import type { LoanType } from "@app/shared";

import {
  type inferParserType,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { LoansControllerListParams } from "@/shared/api/generated/model";

import { isInvertedDayRange, isStorableDay } from "@/features/books/model/filter-chips";
import {
  LoansControllerListFilter,
  LoansControllerListReminder,
  LoansControllerListSort,
} from "@/shared/api/generated/model";

import { parseAsContactId } from "./contact-id-param";

export const LOANS_PAGE_SIZE = 10;

export const LOANS_FILTER_DEFAULT = LoansControllerListFilter.all;
export const LOANS_SORT_DEFAULT = LoansControllerListSort.overdue_first;

export const LOANS_FILTER_VALUES = Object.values(LoansControllerListFilter);
export const LOANS_REMINDER_VALUES = Object.values(LoansControllerListReminder);
export const LOANS_SORT_VALUES = Object.values(LoansControllerListSort);

export const loansQueryParsers = {
  contactId: parseAsContactId,
  dueFrom: parseAsString,
  dueTo: parseAsString,
  filter: parseAsStringLiteral(LOANS_FILTER_VALUES).withDefault(LOANS_FILTER_DEFAULT),
  hasNote: parseAsBoolean,
  loanFrom: parseAsString,
  loanTo: parseAsString,
  q: parseAsString.withDefault(""),
  reminder: parseAsStringLiteral(LOANS_REMINDER_VALUES),
  sort: parseAsStringLiteral(LOANS_SORT_VALUES).withDefault(LOANS_SORT_DEFAULT),
};

export type LoansAdvancedState = Omit<LoansQueryState, "filter" | "q" | "sort">;

export type LoansListParams = Omit<LoansControllerListParams, "pageNumber">;

export type LoansQueryState = inferParserType<typeof loansQueryParsers>;

type LoanDayBoundKey =
  "expectedReturnDateFrom" | "expectedReturnDateTo" | "loanDateFrom" | "loanDateTo";

type LoansRangeFlags = {
  due: boolean;
  loan: boolean;
};

export const LOANS_ADVANCED_EMPTY: LoansAdvancedState = {
  contactId: "",
  dueFrom: null,
  dueTo: null,
  hasNote: null,
  loanFrom: null,
  loanTo: null,
  reminder: null,
};

export const LOANS_ADVANCED_RESET = {
  contactId: null,
  dueFrom: null,
  dueTo: null,
  hasNote: null,
  loanFrom: null,
  loanTo: null,
  reminder: null,
} satisfies Record<keyof LoansAdvancedState, null>;

export const LOANS_FILTERS_RESET = {
  ...LOANS_ADVANCED_RESET,
  filter: null,
  q: null,
} satisfies Partial<Record<keyof LoansQueryState, null>>;

export function countActiveLoanFilters(state: LoansAdvancedState): number {
  return [
    state.contactId !== "",
    state.loanFrom !== null || state.loanTo !== null,
    state.dueFrom !== null || state.dueTo !== null,
    state.reminder !== null,
    state.hasNote !== null,
  ].filter(Boolean).length;
}

export function hasActiveLoanFilters(state: LoansQueryState): boolean {
  return state.filter !== LOANS_FILTER_DEFAULT || countActiveLoanFilters(state) > 0;
}

export function hasActiveLoanSearch(state: LoansQueryState): boolean {
  return state.q.trim() !== "";
}

export function hasInvalidLoanRange(state: LoansAdvancedState): boolean {
  const flags = loanRangeFlags(state);
  return flags.due || flags.loan;
}

export function loanRangeFlags(state: LoansAdvancedState): LoansRangeFlags {
  return {
    due: isInvertedDayRange(state.dueFrom, state.dueTo),
    loan: isInvertedDayRange(state.loanFrom, state.loanTo),
  };
}

export function toLoansListParams(state: LoansQueryState, type: LoanType): LoansListParams {
  const search = state.q.trim();
  const flags = loanRangeFlags(state);

  return {
    filter: state.filter,
    pageSize: LOANS_PAGE_SIZE,
    sort: state.sort,
    type,
    ...(state.contactId === "" ? {} : { contactId: state.contactId }),
    ...(search === "" ? {} : { search }),
    ...(state.reminder === null ? {} : { reminder: state.reminder }),
    ...(state.hasNote === null ? {} : { hasNote: String(state.hasNote) }),
    ...(flags.loan ? {} : dayBound("loanDateFrom", state.loanFrom)),
    ...(flags.loan ? {} : dayBound("loanDateTo", state.loanTo)),
    ...(flags.due ? {} : dayBound("expectedReturnDateFrom", state.dueFrom)),
    ...(flags.due ? {} : dayBound("expectedReturnDateTo", state.dueTo)),
  };
}

function dayBound(key: LoanDayBoundKey, value: null | string): Partial<LoansListParams> {
  return isStorableDay(value) ? { [key]: value } : {};
}

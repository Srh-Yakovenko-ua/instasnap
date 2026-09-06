"use client";

import type { LoanType, Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  LoansControllerListFilter,
  LoansControllerListReminder,
  LoansControllerListSort,
} from "@/shared/api/generated/model";

import type { LoansAdvancedState, LoansListParams, LoansQueryState } from "./loans-query";

import {
  countActiveLoanFilters,
  hasActiveLoanFilters,
  hasActiveLoanSearch,
  LOANS_FILTERS_RESET,
  loansQueryParsers,
  toLoansListParams,
} from "./loans-query";

export type UseLoansQueryResult = {
  advanced: LoansAdvancedState;
  advancedCount: number;
  applyAdvanced: (draft: LoansAdvancedState) => void;
  clearFilters: () => void;
  clearSearch: () => void;
  contactId: string;
  filter: LoansControllerListFilter;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LoansListParams;
  reminder: Nullable<LoansControllerListReminder>;
  setContactId: (value: string) => void;
  setFilter: (value: LoansControllerListFilter) => void;
  setReminder: (value: Nullable<LoansControllerListReminder>) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoansControllerListSort) => void;
  sort: LoansControllerListSort;
  state: LoansQueryState;
};

export function useLoansQuery(type: LoanType): UseLoansQueryResult {
  const [state, setState] = useQueryStates(loansQueryParsers);

  return {
    advanced: state,
    advancedCount: countActiveLoanFilters(state),
    applyAdvanced: (draft) => void setState(toAdvancedPatch(draft)),
    clearFilters: () => void setState(LOANS_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    contactId: state.contactId,
    filter: state.filter,
    hasActiveFilters: hasActiveLoanFilters(state),
    hasActiveSearch: hasActiveLoanSearch(state),
    listParams: toLoansListParams(state, type),
    reminder: state.reminder,
    setContactId: (value) => void setState({ contactId: emptyToNull(value) }),
    setFilter: (value) => void setState({ filter: value }),
    setReminder: (value) => void setState({ reminder: value }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    sort: state.sort,
    state,
  };
}

function emptyToNull(value: Nullable<string>): Nullable<string> {
  return value === null || value.trim() === "" ? null : value;
}

function toAdvancedPatch(draft: LoansAdvancedState) {
  return {
    contactId: emptyToNull(draft.contactId),
    dueFrom: emptyToNull(draft.dueFrom),
    dueTo: emptyToNull(draft.dueTo),
    hasNote: draft.hasNote,
    loanFrom: emptyToNull(draft.loanFrom),
    loanTo: emptyToNull(draft.loanTo),
    reminder: draft.reminder,
  };
}

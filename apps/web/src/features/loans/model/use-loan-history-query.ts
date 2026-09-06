"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  LoanHistoryControllerListResult,
  LoanHistoryControllerListSort,
  LoanHistoryControllerOverviewParams,
  LoanHistoryControllerPeopleParams,
} from "@/shared/api/generated/model";

import type {
  LoanHistoryAdvancedState,
  LoanHistoryListParams,
  LoanHistoryQueryState,
} from "./loan-history-query";

import {
  countActiveLoanHistoryFilters,
  hasActiveLoanHistoryFilters,
  hasActiveLoanHistorySearch,
  LOAN_HISTORY_FILTERS_RESET,
  loanHistoryQueryParsers,
  toLoanHistoryListParams,
  toLoanHistoryOverviewParams,
  toLoanHistoryPeopleParams,
} from "./loan-history-query";

export type UseLoanHistoryQueryResult = {
  advanced: LoanHistoryAdvancedState;
  advancedCount: number;
  applyAdvanced: (draft: LoanHistoryAdvancedState) => void;
  clearFilters: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LoanHistoryListParams;
  overviewParams: LoanHistoryControllerOverviewParams;
  peopleParams: LoanHistoryControllerPeopleParams;
  result: LoanHistoryControllerListResult;
  setResult: (value: LoanHistoryControllerListResult) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoanHistoryControllerListSort) => void;
  sort: LoanHistoryControllerListSort;
  state: LoanHistoryQueryState;
};

export function useLoanHistoryQuery(): UseLoanHistoryQueryResult {
  const [state, setState] = useQueryStates(loanHistoryQueryParsers);
  const advanced = toAdvancedState(state);

  return {
    advanced,
    advancedCount: countActiveLoanHistoryFilters(advanced),
    applyAdvanced: (draft) => void setState(toAdvancedPatch(draft)),
    clearFilters: () => void setState(LOAN_HISTORY_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    hasActiveFilters: hasActiveLoanHistoryFilters(state),
    hasActiveSearch: hasActiveLoanHistorySearch(state),
    listParams: toLoanHistoryListParams(state),
    overviewParams: toLoanHistoryOverviewParams(advanced),
    peopleParams: toLoanHistoryPeopleParams(advanced),
    result: state.result,
    setResult: (value) => void setState({ result: value }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    sort: state.sort,
    state,
  };
}

function emptyToNull(value: Nullable<string>): Nullable<string> {
  return value === null || value.trim() === "" ? null : value;
}

function toAdvancedPatch(draft: LoanHistoryAdvancedState) {
  return {
    contactId: emptyToNull(draft.contactId),
    from: emptyToNull(draft.from),
    loanFrom: emptyToNull(draft.loanFrom),
    loanTo: emptyToNull(draft.loanTo),
    to: emptyToNull(draft.to),
    type: draft.type,
  } satisfies Record<keyof LoanHistoryAdvancedState, Nullable<string>>;
}

function toAdvancedState(state: LoanHistoryQueryState): LoanHistoryAdvancedState {
  return {
    contactId: state.contactId,
    from: state.from,
    loanFrom: state.loanFrom,
    loanTo: state.loanTo,
    to: state.to,
    type: state.type,
  };
}

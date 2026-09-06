"use client";

import { useQueryStates } from "nuqs";

import type { LoanContactsControllerListStatus } from "@/shared/api/generated/model";

import type { LoanContactsListParams, LoanContactsQueryState } from "./loan-contacts-query";

import {
  activeLoanContactFilterCount,
  hasActiveLoanContactsQuery,
  LOAN_CONTACTS_QUERY_RESET,
  loanContactsQueryParsers,
  toLoanContactsListParams,
} from "./loan-contacts-query";

export type UseLoanContactsQueryResult = {
  activeFilterCount: number;
  clearQuery: () => void;
  hasActiveQuery: boolean;
  listParams: LoanContactsListParams;
  search: string;
  setSearch: (value: string) => void;
  setState: ReturnType<typeof useQueryStates<typeof loanContactsQueryParsers>>[1];
  state: LoanContactsQueryState;
  status: LoanContactsControllerListStatus;
};

export function useLoanContactsQuery(): UseLoanContactsQueryResult {
  const [state, setState] = useQueryStates(loanContactsQueryParsers);

  return {
    activeFilterCount: activeLoanContactFilterCount(state),
    clearQuery: () => void setState(LOAN_CONTACTS_QUERY_RESET),
    hasActiveQuery: hasActiveLoanContactsQuery(state),
    listParams: toLoanContactsListParams(state),
    search: state.q,
    setSearch: (value) => void setState({ q: value === "" ? null : value }),
    setState,
    state,
    status: state.status,
  };
}

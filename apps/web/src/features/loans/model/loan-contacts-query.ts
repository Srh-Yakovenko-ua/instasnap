import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { LoanContactsControllerListParams } from "@/shared/api/generated/model";

import { LoanContactsControllerListStatus } from "@/shared/api/generated/model";

export const LOAN_CONTACTS_PAGE_SIZE = 20;

export const LOAN_CONTACTS_STATUS_DEFAULT = LoanContactsControllerListStatus.active;

export const LOAN_CONTACTS_STATUS_VALUES = [
  LoanContactsControllerListStatus.active,
  LoanContactsControllerListStatus.archived,
  LoanContactsControllerListStatus.all,
] as const;

export const loanContactsQueryParsers = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(LOAN_CONTACTS_STATUS_VALUES).withDefault(
    LOAN_CONTACTS_STATUS_DEFAULT,
  ),
};

export type LoanContactsListParams = Omit<LoanContactsControllerListParams, "pageNumber">;

export type LoanContactsQueryState = inferParserType<typeof loanContactsQueryParsers>;

export function activeLoanContactFilterCount(state: LoanContactsQueryState): number {
  return state.status === LOAN_CONTACTS_STATUS_DEFAULT ? 0 : 1;
}

export function hasActiveLoanContactsQuery(state: LoanContactsQueryState): boolean {
  return state.q.trim() !== "" || activeLoanContactFilterCount(state) > 0;
}

export function toLoanContactsListParams(state: LoanContactsQueryState): LoanContactsListParams {
  const search = state.q.trim();

  return {
    pageSize: LOAN_CONTACTS_PAGE_SIZE,
    status: state.status,
    ...(search === "" ? {} : { search }),
  };
}

export const LOAN_CONTACTS_QUERY_RESET = {
  q: null,
  status: null,
} satisfies Record<keyof LoanContactsQueryState, null>;

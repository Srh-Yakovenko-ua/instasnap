import type { QueryKey } from "@tanstack/react-query";

import type {
  LoanHistoryControllerOverviewParams,
  LoanHistoryControllerPeopleParams,
} from "@/shared/api/generated/model";

import type { LoanContactsListParams } from "../model/loan-contacts-query";
import type { LoanHistoryListParams } from "../model/loan-history-query";
import type { LoansListParams } from "../model/loans-query";

const LOAN_ROOTS = {
  active: "/api/loans",
  contacts: "/api/loans/contacts",
  history: "/api/loans/history",
} as const;

export const loanKeys = {
  contacts: {
    all: [LOAN_ROOTS.contacts] as const,
    detail: (contactId: string) => [LOAN_ROOTS.contacts, "detail", contactId] as const,
    list: (params: LoanContactsListParams) => [LOAN_ROOTS.contacts, "list", params] as const,
    search: (search: string) => [LOAN_ROOTS.contacts, "search", search] as const,
  },
  history: {
    detail: (loanId: string) => [LOAN_ROOTS.history, "detail", loanId] as const,
    list: (params: LoanHistoryListParams) => [LOAN_ROOTS.history, "list", params] as const,
    lists: [LOAN_ROOTS.history, "list"] as const,
    overview: (params: LoanHistoryControllerOverviewParams) =>
      [LOAN_ROOTS.history, "overview", params] as const,
    overviews: [LOAN_ROOTS.history, "overview"] as const,
    people: (params: LoanHistoryControllerPeopleParams) =>
      [LOAN_ROOTS.history, "people", params] as const,
    peoples: [LOAN_ROOTS.history, "people"] as const,
  },
  list: (params: LoansListParams) => [LOAN_ROOTS.active, "list", params] as const,
};

export function matchesLoans(query: { queryKey: QueryKey }): boolean {
  const [root] = query.queryKey;
  if (typeof root !== "string") return false;
  return root === LOAN_ROOTS.active || root.startsWith(`${LOAN_ROOTS.active}/`);
}

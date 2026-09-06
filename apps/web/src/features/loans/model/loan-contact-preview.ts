import type { LoanType } from "@app/shared";

import {
  LoanHistoryControllerListResult,
  LoanHistoryControllerListSort,
  LoansControllerListFilter,
  LoansControllerListSort,
} from "@/shared/api/generated/model";

import type { LoanHistoryListParams } from "./loan-history-query";
import type { LoansListParams } from "./loans-query";

import { LOAN_HISTORY_PAGE_HREF, LOAN_PAGES } from "./loan-pages";

export const LOAN_CONTACT_PREVIEW = {
  limit: 3,
} as const;

export function toContactHistoryHref(contactId: string): string {
  return `${LOAN_HISTORY_PAGE_HREF}?${new URLSearchParams({ contactId }).toString()}`;
}

export function toContactHistoryParams(contactId: string): LoanHistoryListParams {
  return {
    contactId,
    pageSize: LOAN_CONTACT_PREVIEW.limit,
    result: LoanHistoryControllerListResult.all,
    sort: LoanHistoryControllerListSort.returned_desc,
  };
}

export function toContactLoansHref({
  contactId,
  type,
}: {
  contactId: string;
  type: LoanType;
}): string {
  return `${LOAN_PAGES[type].href}?${new URLSearchParams({ contactId }).toString()}`;
}

export function toContactLoansParams({
  contactId,
  type,
}: {
  contactId: string;
  type: LoanType;
}): LoansListParams {
  return {
    contactId,
    filter: LoansControllerListFilter.all,
    pageSize: LOAN_CONTACT_PREVIEW.limit,
    sort: LoansControllerListSort.overdue_first,
    type,
  };
}

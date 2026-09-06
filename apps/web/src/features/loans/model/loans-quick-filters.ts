import type { LoanDirectionSummary } from "@app/shared";

import type { LoansControllerListFilter } from "@/shared/api/generated/model";

export const LOANS_QUICK_FILTER_KEYS = [
  "all",
  "overdue",
  "return_soon",
  "no_return_date",
] as const satisfies readonly LoansControllerListFilter[];

export type LoansQuickFilterCounts = Record<LoansQuickFilterKey, number>;

export type LoansQuickFilterKey = (typeof LOANS_QUICK_FILTER_KEYS)[number];

export function loansQuickFilterCounts(summary: LoanDirectionSummary): LoansQuickFilterCounts {
  return {
    all: summary.totalCount,
    no_return_date: summary.noReturnDateCount,
    overdue: summary.overdueCount,
    return_soon: summary.returningSoonCount,
  };
}

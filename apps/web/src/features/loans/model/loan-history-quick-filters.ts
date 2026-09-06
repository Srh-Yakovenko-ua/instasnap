import type { LoanHistoryControllerListResult } from "@/shared/api/generated/model";

export const LOAN_HISTORY_QUICK_FILTER_KEYS = [
  "all",
  "on_time",
  "late",
  "no_due_date",
] as const satisfies readonly LoanHistoryControllerListResult[];

export type LoanHistoryQuickFilterKey = (typeof LOAN_HISTORY_QUICK_FILTER_KEYS)[number];

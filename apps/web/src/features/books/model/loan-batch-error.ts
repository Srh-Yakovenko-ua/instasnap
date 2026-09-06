import type { LoanBatchConflictReason } from "@app/shared";

import { LOAN_BATCH_CONFLICT_CODE, LoanBatchConflictDetailsSchema } from "@app/shared";

import { ApiError } from "@/lib/http-client";

export type LoanBatchConflict = {
  bookId: string;
  reason: LoanBatchConflictReason;
};

export function toLoanBatchConflicts(error: unknown): LoanBatchConflict[] {
  if (!(error instanceof ApiError)) return [];
  if (error.code !== LOAN_BATCH_CONFLICT_CODE) return [];

  const details = LoanBatchConflictDetailsSchema.safeParse(error.details);
  return details.success ? details.data.conflicts : [];
}

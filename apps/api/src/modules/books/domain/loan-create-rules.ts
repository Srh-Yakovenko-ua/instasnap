import type {
  LoanBatchConflictReason,
  LoanDirection,
  LoanType,
  OwnershipStatus,
} from "@app/shared";

import { LOAN_ERROR_CODES } from "@app/shared";

export type LoanCreateRule = {
  conflictCode: string;
  conflictMessage: string;
  conflictReason: LoanBatchConflictReason;
  expectedStatuses: OwnershipStatus[];
  loanType: LoanType;
};

export const LOAN_CREATE_RULES: Record<LoanDirection, LoanCreateRule> = {
  borrowed: {
    conflictCode: LOAN_ERROR_CODES.borrowRequiresFreeBook,
    conflictMessage: 'Book must have ownership status "none" or "want to buy" to be borrowed',
    conflictReason: "borrow_requires_available_ownership",
    expectedStatuses: ["none", "want_to_buy"],
    loanType: "borrowed_from_someone",
  },
  lent: {
    conflictCode: LOAN_ERROR_CODES.lendRequiresOwned,
    conflictMessage: 'Book must have ownership status "owned" to be lent',
    conflictReason: "lend_requires_owned",
    expectedStatuses: ["owned"],
    loanType: "lent_to_someone",
  },
};

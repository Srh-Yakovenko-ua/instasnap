import type { LoanDirection } from "@app/shared";

import { BooksControllerListOwnerItem } from "@/shared/api/generated/model";

export const LOAN_CANDIDATE_OWNERSHIP = {
  borrowed: [BooksControllerListOwnerItem.none, BooksControllerListOwnerItem.want_to_buy],
  lent: [BooksControllerListOwnerItem.owned],
} as const satisfies Record<LoanDirection, readonly BooksControllerListOwnerItem[]>;

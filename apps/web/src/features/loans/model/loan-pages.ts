import type { LoanType } from "@app/shared";

export type LoanDirection = "borrowed" | "lent";

type LoanPageDefinition = {
  direction: LoanDirection;
  href: "/loans/borrowed" | "/loans/lent";
  otherType: LoanType;
};

export const LOAN_HISTORY_PAGE_HREF = "/loans/history";

export const LOAN_PAGES = {
  borrowed_from_someone: {
    direction: "borrowed",
    href: "/loans/borrowed",
    otherType: "lent_to_someone",
  },
  lent_to_someone: {
    direction: "lent",
    href: "/loans/lent",
    otherType: "borrowed_from_someone",
  },
} satisfies Record<LoanType, LoanPageDefinition>;

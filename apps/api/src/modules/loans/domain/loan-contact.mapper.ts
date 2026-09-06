import type { LoanContactListItemView, LoanContactView } from "@app/shared";

import type {
  ActiveLoanCounts,
  LoanContactCard,
} from "../infrastructure/loan-contacts.repository.js";

import { toNullableIsoDateTime } from "../../../core/iso-date.js";

export function toLoanContactListItemView(
  contact: LoanContactCard,
  activeLoans: ActiveLoanCounts | undefined,
): LoanContactListItemView {
  return {
    ...toLoanContactView(contact),
    activeBorrowedCount: activeLoans?.borrowed ?? 0,
    activeLentCount: activeLoans?.lent ?? 0,
  };
}

export function toLoanContactView(contact: LoanContactCard): LoanContactView {
  return {
    archivedAt: toNullableIsoDateTime(contact.archivedAt),
    contact: contact.contact,
    createdAt: contact.createdAt.toISOString(),
    id: contact.id,
    loanCount: contact._count.loans,
    name: contact.name,
    updatedAt: contact.updatedAt.toISOString(),
  };
}

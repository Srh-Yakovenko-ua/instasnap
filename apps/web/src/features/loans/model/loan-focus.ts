import type { Nullable } from "@app/shared";

const LOAN_TRIGGER_SELECTOR = {
  details: (loanId: string) => `[data-loan-details-trigger="${loanId}"]`,
  menu: (loanId: string) => `[data-loan-trigger="${loanId}"]`,
} as const satisfies Record<string, (loanId: string) => string>;

export function restoreFocusTo(event: Event, target: Nullable<HTMLElement>): void {
  if (target === null || !target.isConnected) return;
  event.preventDefault();
  target.focus();
}

export function restoreLoanHistoryDetailFocus(event: Event, loanId: string): void {
  restoreFocusTo(event, findTrigger(LOAN_TRIGGER_SELECTOR.details(loanId)));
}

export function restoreLoanTriggerFocus(event: Event, loanId: string): void {
  restoreFocusTo(event, findTrigger(LOAN_TRIGGER_SELECTOR.menu(loanId)));
}

function findTrigger(selector: string): Nullable<HTMLElement> {
  return document.querySelector<HTMLElement>(selector);
}

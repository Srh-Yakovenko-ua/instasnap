"use client";

import type { LoanListItemView, LoanUiStatus } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { BookRow } from "@/features/books/components/book-row";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { LoanTerm } from "../model/loans-derive";

import { toLoanRowBook } from "../model/loan-library-book";
import { formatLoanDate, loanTerm } from "../model/loans-derive";
import { LoanContactNameButton } from "./contact/loan-contact-name-button";
import { LoanActionsMenu } from "./loan-actions-menu";
import { LoanNoteButton } from "./loan-note-button";

const LOAN_TERM_LOOK = {
  inDays: { icon: "calendar", toneClass: "text-foreground" },
  none: { icon: "circle-slash", toneClass: "text-muted-foreground" },
  overdue: { icon: "alert-triangle", toneClass: "text-error" },
  today: { icon: "clock", toneClass: "text-warning" },
  tomorrow: { icon: "clock", toneClass: "text-warning" },
} as const satisfies Record<LoanTerm["kind"], { icon: UiIconName; toneClass: string }>;

type LoanRowProps = {
  loan: LoanListItemView;
  onEdit: () => void;
  onOpenContact: () => void;
  onReturn: () => void;
  today: string;
};

export function LoanRow({ loan, onEdit, onOpenContact, onReturn, today }: LoanRowProps) {
  const tRow = useTranslations("loans.row");

  const isBorrowed = loan.type === "borrowed_from_someone";

  return (
    <BookRow
      book={toLoanRowBook(loan)}
      coverAspect="portrait"
      detailsSlot={
        <LoanPeopleZone isBorrowed={isBorrowed} loan={loan} onOpenContact={onOpenContact} />
      }
      kebab={
        <div className="flex w-[3.25rem] items-center justify-end gap-1">
          {loan.remindToReturn ? (
            <TooltipHint label={tRow("reminderOn")}>
              <UiIcon
                aria-label={tRow("reminderOn")}
                className="text-warning"
                name="bell"
                size={16}
              />
            </TooltipHint>
          ) : null}
          <LoanActionsMenu loan={loan} onEdit={onEdit} onReturn={onReturn} />
        </div>
      }
      linkComponent={Link}
      mobileCompact
      note={
        loan.note === null ? undefined : (
          <LoanNoteButton bookTitle={loan.book.title} note={loan.note} onEdit={onEdit} />
        )
      }
      rowLink={false}
      statusSlot={<LoanTermZone loan={loan} today={today} />}
    />
  );
}

function InfoLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground/90">{children}</span>
    </div>
  );
}

function LoanPeopleZone({
  isBorrowed,
  loan,
  onOpenContact,
}: {
  isBorrowed: boolean;
  loan: LoanListItemView;
  onOpenContact: () => void;
}) {
  const tRow = useTranslations("loans.row");
  const loanDate = formatLoanDate(loan.loanDate);

  return (
    <div className="flex shrink-0 flex-col gap-2 @xl/book-row:w-40">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {isBorrowed ? tRow("personBorrowed") : tRow("personLent")}
        </span>
        <LoanContactNameButton
          contact={loan.contact}
          name={loan.personName}
          onOpen={onOpenContact}
        />
      </div>
      {loanDate === null ? null : (
        <InfoLine label={isBorrowed ? tRow("loanDateBorrowed") : tRow("loanDateLent")}>
          {loanDate}
        </InfoLine>
      )}
    </div>
  );
}

function LoanTermZone({ loan, today }: { loan: LoanListItemView; today: string }) {
  const tTerm = useTranslations("loans.row.term");

  const term = loanTerm(loan.expectedReturnDate, today);
  const look = LOAN_TERM_LOOK[term.kind];
  const returnDate = formatLoanDate(loan.expectedReturnDate);

  return (
    <div className="flex shrink-0 flex-col gap-0.5 @xl/book-row:w-48">
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-semibold",
          termToneClass({ status: loan.loanUiStatus, term }),
        )}
      >
        <UiIcon aria-hidden name={look.icon} size={16} />
        {term.kind === "inDays" || term.kind === "overdue"
          ? tTerm(term.kind, { days: term.days })
          : tTerm(term.kind)}
      </p>

      {returnDate === null ? null : (
        <p className="pl-[1.375rem] text-xs text-muted-foreground tabular-nums">
          {tTerm(term.kind === "overdue" ? "wasDue" : "dueBy", { date: returnDate })}
        </p>
      )}
    </div>
  );
}

function termToneClass({ status, term }: { status: LoanUiStatus; term: LoanTerm }): string {
  if (term.kind === "inDays" && status === "return_soon") return "text-warning";
  return LOAN_TERM_LOOK[term.kind].toneClass;
}

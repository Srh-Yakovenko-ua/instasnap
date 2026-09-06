"use client";

import type { LoanHistoryListItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { LOAN_HISTORY_RESULT_LOOK } from "../../model/loan-history-result";
import { formatLoanDate } from "../../model/loans-derive";
import { LoanContactNameButton } from "../contact/loan-contact-name-button";

type LoanHistoryRowProps = {
  loan: LoanHistoryListItemView;
  onCorrectDate: () => void;
  onEditNote: () => void;
  onOpenContact: () => void;
  onOpenDetails: () => void;
};

export function LoanHistoryRow({
  loan,
  onCorrectDate,
  onEditNote,
  onOpenContact,
  onOpenDetails,
}: LoanHistoryRowProps) {
  const tDirection = useTranslations("loans.history.direction");

  const isBorrowed = loan.type === "borrowed_from_someone";
  const bookHref = `/books/${loan.book.id}`;
  const titleId = `loan-history-title-${loan.id}`;

  return (
    <article className="@container/history-row flex items-stretch gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none sm:gap-3.5">
      <Link
        className="relative aspect-[2/3] w-16 shrink-0 self-start overflow-hidden rounded-lg bg-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-20"
        href={bookHref}
        tabIndex={-1}
      >
        {loan.book.cover === null ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={24} />
          </span>
        ) : (
          <Image
            alt={loan.book.title}
            className="object-cover"
            fill
            sizes="80px"
            src={loan.book.cover.urls.card}
            unoptimized
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl/history-row:flex-row @3xl/history-row:items-stretch @3xl/history-row:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5 @3xl/history-row:w-56 @3xl/history-row:shrink-0">
          <h3
            className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink"
            id={titleId}
          >
            <Link
              className="rounded-sm text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={bookHref}
            >
              {loan.book.title}
            </Link>
          </h3>

          {loan.book.firstAuthorName === "" ? null : (
            <p className="truncate text-xs text-muted-foreground">{loan.book.firstAuthorName}</p>
          )}

          <Badge variant={isBorrowed ? "info" : "primary"}>{tDirection(loan.type)}</Badge>

          <LoanContactNameButton
            className="max-w-full self-start"
            contact={null}
            name={loan.personName}
            onOpen={onOpenContact}
          />
        </div>

        <div className="hidden w-px self-stretch bg-border @3xl/history-row:block" />

        <LoanHistoryPeriod loan={loan} />

        <div className="hidden w-px self-stretch bg-border @3xl/history-row:block" />

        <LoanHistoryOutcome loan={loan} onOpenDetails={onOpenDetails} titleId={titleId} />
      </div>

      <div className="shrink-0 self-start">
        <LoanHistoryActionsMenu
          loanId={loan.id}
          onCorrectDate={onCorrectDate}
          onEditNote={onEditNote}
        />
      </div>
    </article>
  );
}

function LoanHistoryActionsMenu({
  loanId,
  onCorrectDate,
  onEditNote,
}: {
  loanId: string;
  onCorrectDate: () => void;
  onEditNote: () => void;
}) {
  const t = useTranslations("loans.history.actions");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("menu")} data-loan-trigger={loanId} size="icon" variant="ghost">
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onCorrectDate}>
          <UiIcon name="calendar" size={16} />
          {t("correctDate")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEditNote}>
          <UiIcon name="note" size={16} />
          {t("editNote")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoanHistoryOutcome({
  loan,
  onOpenDetails,
  titleId,
}: {
  loan: LoanHistoryListItemView;
  onOpenDetails: () => void;
  titleId: string;
}) {
  const t = useTranslations("loans.history.row");
  const look = LOAN_HISTORY_RESULT_LOOK[loan.historyResult];
  const outcomeId = useId();

  return (
    <TooltipHint label={t("openDetails")}>
      <button
        aria-describedby={`${titleId} ${outcomeId}`}
        aria-label={t("openDetails")}
        className={cn(
          "group/outcome flex cursor-pointer items-center gap-2 self-start rounded-lg border px-3 py-2 text-left transition-colors duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none @3xl/history-row:w-52 @3xl/history-row:shrink-0",
          look.surfaceClass,
          look.hoverSurfaceClass,
        )}
        data-loan-details-trigger={loan.id}
        onClick={onOpenDetails}
        type="button"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5" id={outcomeId}>
          <span className={cn("flex items-start gap-1.5 text-sm font-semibold", look.toneClass)}>
            <UiIcon aria-hidden className="mt-0.5 shrink-0" name={look.icon} size={16} />
            <span className="min-w-0">
              <LoanHistoryOutcomeResult loan={loan} />
            </span>
          </span>
          {loan.durationDays === null ? null : (
            <span className="pl-[1.375rem] text-xs text-muted-foreground tabular-nums">
              {t("outcome.duration", { count: loan.durationDays })}
            </span>
          )}
        </span>

        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground transition-colors group-hover/outcome:text-foreground"
          name="chevron-right"
          size={16}
        />
      </button>
    </TooltipHint>
  );
}

function LoanHistoryOutcomeResult({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.history");

  if (loan.historyResult === "late") {
    return <>{t("result.late", { count: loan.delayDays ?? 0 })}</>;
  }
  if (loan.historyResult === "no_due_date") {
    return <>{t("row.outcome.noDueDate")}</>;
  }
  return <>{t("result.on_time")}</>;
}

function LoanHistoryPeriod({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.history.loanPeriod");

  const startDate = formatLoanDate(loan.loanDate);
  const returnDate = formatLoanDate(loan.returnedDate) ?? loan.returnedDate;
  const planDate = formatLoanDate(loan.expectedReturnDate);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <UiIcon aria-hidden className="shrink-0" name="clock" size={14} />
        {t("title")}
      </p>

      <p className="min-w-0 text-sm">
        {startDate === null ? null : (
          <>
            <PeriodPoint
              label={t(loan.type === "borrowed_from_someone" ? "borrowed" : "lent")}
              value={startDate}
            />{" "}
            <span aria-hidden className="text-muted-foreground">
              &rarr;
            </span>{" "}
          </>
        )}
        <PeriodPoint label={t("returned")} value={returnDate} />
      </p>

      <p className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground tabular-nums">
        {startDate === null ? <span>{t("startUnknown")}</span> : null}
        <span>{planDate === null ? t("noTerm") : t("plan", { date: planDate })}</span>
      </p>
    </div>
  );
}

function PeriodPoint({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </span>
  );
}

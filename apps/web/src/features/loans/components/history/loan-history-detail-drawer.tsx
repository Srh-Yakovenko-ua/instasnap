"use client";

import type { LoanHistoryDetailView, LoanHistoryResult, Nullable } from "@app/shared";
import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import { useLoanHistoryDetail } from "../../api/use-loan-history-detail";

type LoanHistoryDetailDrawerProps = {
  loanId: Nullable<string>;
  onCloseAutoFocus: (event: Event) => void;
  onCorrectDate: () => void;
  onEditNote: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const RESULT_BADGE_VARIANT = {
  late: "warning",
  no_due_date: "secondary",
  on_time: "success",
} as const satisfies Record<LoanHistoryResult, VariantProps<typeof badgeVariants>["variant"]>;

export function LoanHistoryDetailDrawer({
  loanId,
  onCloseAutoFocus,
  onCorrectDate,
  onEditNote,
  onOpenChange,
  open,
}: LoanHistoryDetailDrawerProps) {
  const t = useTranslations("loans.history.detail");

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        aria-describedby={undefined}
        className="w-full gap-0 p-0 data-[side=right]:w-full sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>

        {open && loanId !== null ? (
          <DetailBody loanId={loanId} onCorrectDate={onCorrectDate} onEditNote={onEditNote} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function BookSection({ book }: { book: LoanHistoryDetailView["book"] }) {
  const t = useTranslations("loans.history.detail");
  const bookHref = `/books/${book.id}`;

  return (
    <section className="flex items-start gap-4">
      <h4 className="sr-only">{t("sections.book")}</h4>
      <Link
        className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        href={bookHref}
        tabIndex={-1}
      >
        {book.cover === null ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={24} />
          </span>
        ) : (
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="80px"
            src={book.cover.urls.card}
            unoptimized
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-heading text-lg leading-tight font-semibold text-ink">
          <Link
            className="rounded-sm text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            href={bookHref}
          >
            {book.title}
          </Link>
        </h3>
        {book.firstAuthorName === "" ? null : (
          <p className="text-sm text-muted-foreground">{book.firstAuthorName}</p>
        )}
      </div>
    </section>
  );
}

function DetailBody({
  loanId,
  onCorrectDate,
  onEditNote,
}: {
  loanId: string;
  onCorrectDate: () => void;
  onEditNote: () => void;
}) {
  const t = useTranslations("loans.history.detail");
  const tActions = useTranslations("loans.history.actions");
  const detail = useLoanHistoryDetail(loanId);

  if (detail.isError) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 py-5" role="alert">
        <p className="text-sm text-muted-foreground">{t("error")}</p>
        <Button onClick={() => void detail.refetch()} size="sm" variant="secondary">
          <UiIcon name="refresh" size={16} />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (detail.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4 px-5 py-5" role="status">
        <span className="sr-only">{t("loading")}</span>
        <div className="flex items-start gap-4">
          <Skeleton className="aspect-[2/3] w-20 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  const loan = detail.data;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <BookSection book={loan.book} />
        <LoanSection loan={loan} />
        <TimelineSection loan={loan} />
        <OutcomeSection loan={loan} />
        <NoteSection note={loan.note} />
      </div>

      <SheetFooter className="flex-col gap-2 sm:flex-col">
        <Button asChild variant="secondary">
          <Link href={`/books/${loan.book.id}`}>
            <UiIcon name="book" size={16} />
            {tActions("openBook")}
          </Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onCorrectDate} variant="ghost">
            <UiIcon name="calendar" size={16} />
            {tActions("correctDate")}
          </Button>
          <Button className="flex-1" onClick={onEditNote} variant="ghost">
            <UiIcon name="note" size={16} />
            {tActions("editNote")}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function LoanSection({ loan }: { loan: LoanHistoryDetailView }) {
  const t = useTranslations("loans.history.detail");
  const tDirection = useTranslations("loans.history.direction");

  return (
    <DetailSection title={t("sections.loan")}>
      <dl className="flex flex-col gap-2">
        <Field label={t("fields.direction")}>{tDirection(loan.type)}</Field>
        <Field label={t("fields.person")}>{loan.personName}</Field>
        <Field label={t("fields.contact")}>
          {loan.contact ?? <span className="text-muted-foreground">{t("contactEmpty")}</span>}
        </Field>
      </dl>
    </DetailSection>
  );
}

function NoteSection({ note }: { note: Nullable<string> }) {
  const t = useTranslations("loans.history.detail");

  return (
    <DetailSection title={t("sections.note")}>
      {note === null ? (
        <p className="text-sm text-muted-foreground">{t("noteEmpty")}</p>
      ) : (
        <p className="rounded-md bg-secondary/60 px-3 py-2 text-sm whitespace-pre-line text-foreground/90">
          {note}
        </p>
      )}
    </DetailSection>
  );
}

function OutcomeSection({ loan }: { loan: LoanHistoryDetailView }) {
  const t = useTranslations("loans.history.detail");
  const tHistory = useTranslations("loans.history");

  const result =
    loan.historyResult === "late"
      ? tHistory("result.late", { count: loan.delayDays ?? 0 })
      : tHistory(`result.${loan.historyResult}`);

  return (
    <DetailSection title={t("sections.outcome")}>
      <dl className="flex flex-col gap-2">
        <Field label={t("fields.result")}>
          <Badge variant={RESULT_BADGE_VARIANT[loan.historyResult]}>{result}</Badge>
        </Field>
        {loan.delayDays === null ? null : (
          <Field label={t("fields.delay")}>{t("delayDays", { count: loan.delayDays })}</Field>
        )}
        <Field label={t("fields.duration")}>
          {loan.durationDays === null
            ? tHistory("duration.unknown")
            : tHistory("duration.days", { count: loan.durationDays })}
        </Field>
      </dl>
    </DetailSection>
  );
}

function TimelineSection({ loan }: { loan: LoanHistoryDetailView }) {
  const t = useTranslations("loans.history.detail");
  const tTimeline = useTranslations("loans.history.timeline");
  const locale = useLocale();

  const formatDate = (iso: Nullable<string>, fallback: string) =>
    iso === null ? fallback : formatDateLong(iso, locale);

  return (
    <DetailSection title={t("sections.timeline")}>
      <dl className="flex flex-col gap-2">
        <Field
          label={tTimeline(
            loan.type === "borrowed_from_someone" ? "loanDateBorrowed" : "loanDateLent",
          )}
        >
          {formatDate(loan.loanDate, tTimeline("unknownDate"))}
        </Field>
        <Field label={tTimeline("expected")}>
          {formatDate(loan.expectedReturnDate, tTimeline("expectedNone"))}
        </Field>
        <Field label={tTimeline("returned")}>{formatDateLong(loan.returnedDate, locale)}</Field>
      </dl>
    </DetailSection>
  );
}

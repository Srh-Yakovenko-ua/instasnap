"use client";

import type {
  LoanHistoryListItemView,
  LoanHistoryOverviewView,
  LoanHistoryResult,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useLoanHistory } from "../../api/use-loan-history";
import { useLoanHistoryOverview } from "../../api/use-loan-history-overview";
import { toContactHistoryHref, toContactHistoryParams } from "../../model/loan-contact-preview";
import { LOAN_HISTORY_RESULT_LOOK } from "../../model/loan-history-result";
import { LoanContactPreviewRow, LoanContactPreviewSkeleton } from "./loan-contact-preview-row";

type BreakdownKey = "borrowed" | "late" | "lent" | "noDueDate" | "onTime";

type BreakdownPart = {
  count: number;
  key: BreakdownKey;
};

type HistoryResultRow = {
  count: number;
  key: BreakdownKey;
  result: LoanHistoryResult;
};

type LoanContactHistoryBlockProps = {
  contactId: string;
  onNavigate: () => void;
};

type LoanHistorySummary = LoanHistoryOverviewView["summary"];

export function LoanContactHistoryBlock({ contactId, onNavigate }: LoanContactHistoryBlockProps) {
  const t = useTranslations("loans.contactDrawer.history");
  const tDrawer = useTranslations("loans.contactDrawer");

  const overview = useLoanHistoryOverview({ contactId });
  const history = useLoanHistory(toContactHistoryParams(contactId));

  const summary = overview.data?.summary;
  const items = history.data?.pages[0]?.items ?? [];
  const isPending = overview.isPending || history.isPending;
  const isEmpty = summary !== undefined && summary.totalCompleted === 0;
  const hasHistory = summary !== undefined && summary.totalCompleted > 0;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("title")}
      </h3>

      {isPending ? (
        <>
          <SummarySkeleton />
          <LoanContactPreviewSkeleton rows={2} />
        </>
      ) : null}

      {overview.isError ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {tDrawer("error")}
        </p>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-foreground">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
        </div>
      ) : null}

      {hasHistory ? (
        <>
          <HistorySummary summary={summary} />

          {items.length > 0 ? (
            <>
              <h4 className="text-xs font-medium text-muted-foreground">{t("recentTitle")}</h4>
              <ul className="flex flex-col gap-2.5">
                {items.map((loan) => (
                  <LoanContactPreviewRow
                    book={loan.book}
                    key={loan.id}
                    meta={<HistoryRecentMeta loan={loan} />}
                  />
                ))}
              </ul>
            </>
          ) : null}

          <Button asChild className="self-start" size="sm" variant="ghost">
            <Link href={toContactHistoryHref(contactId)} onClick={onNavigate}>
              {t("viewAll")}
              <UiIcon name="arrow-right" size={16} />
            </Link>
          </Button>
        </>
      ) : null}
    </section>
  );
}

function BreakdownLine({ className, parts }: { className?: string; parts: BreakdownPart[] }) {
  const t = useTranslations("loans.contactDrawer.history.breakdown");

  const visible = parts.filter((part) => part.count > 0);
  if (visible.length === 0) return null;

  return (
    <p className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {visible.map((part) => t(part.key, { count: part.count })).join(" · ")}
    </p>
  );
}

function HistoryAverageDuration({ days }: { days: number }) {
  const t = useTranslations("loans.contactDrawer.history");
  const tDuration = useTranslations("loans.history.duration");

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Tooltip>
        <TooltipTrigger className="flex min-w-0 cursor-default items-center gap-2 rounded-sm text-left text-xs text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={14} />
          <span className="truncate">{t("averageDurationLabel")}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{t("averageDurationHint")}</TooltipContent>
      </Tooltip>
      <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
        {tDuration("days", { count: days })}
      </span>
    </div>
  );
}

function HistoryOutcome({ loan }: { loan: LoanHistoryListItemView }) {
  const locale = useLocale();
  const t = useTranslations("loans.contactDrawer.history.recent");

  if (loan.historyResult === "no_due_date") return <>{t("noDueDate")}</>;
  if (loan.historyResult === "late") return <>{t("late", { count: loan.delayDays ?? 0 })}</>;
  return <>{t("returned", { date: formatDateShort(loan.returnedDate, locale) })}</>;
}

function HistoryRecentMeta({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.contactDrawer.history.recent");

  return (
    <span className="min-w-0">
      {loan.type === "lent_to_someone" ? t("lent") : t("borrowed")}
      {" · "}
      <HistoryOutcome loan={loan} />
    </span>
  );
}

function HistoryResultRows({ rows }: { rows: HistoryResultRow[] }) {
  const t = useTranslations("loans.contactDrawer.history.breakdown");

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const look = LOAN_HISTORY_RESULT_LOOK[row.result];

        return (
          <li className="flex items-center gap-2 text-xs" key={row.key}>
            <UiIcon
              aria-hidden
              className={cn("shrink-0", look.toneClass)}
              name={look.icon}
              size={14}
            />
            <span className="min-w-0 text-foreground/90 tabular-nums">
              {t(row.key, { count: row.count })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HistorySummary({ summary }: { summary: LoanHistorySummary }) {
  const t = useTranslations("loans.contactDrawer.history");

  const resultRows: HistoryResultRow[] = [
    { count: summary.onTimeCount, key: "onTime", result: "on_time" },
    { count: summary.lateCount, key: "late", result: "late" },
    { count: summary.noDueDateCount, key: "noDueDate", result: "no_due_date" },
  ];
  const visibleRows = resultRows.filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink tabular-nums">
          <UiIcon aria-hidden className="shrink-0 text-icon" name="book-copy" size={16} />
          {t("completedCount", { count: summary.totalCompleted })}
        </p>
        <BreakdownLine
          className="pl-6"
          parts={[
            { count: summary.lentCount, key: "lent" },
            { count: summary.borrowedCount, key: "borrowed" },
          ]}
        />
      </div>

      {visibleRows.length === 0 ? null : (
        <>
          <Separator />
          <HistoryResultRows rows={visibleRows} />
        </>
      )}

      {summary.averageDurationDays === null ? null : (
        <>
          <Separator />
          <HistoryAverageDuration days={summary.averageDurationDays} />
        </>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return <Skeleton className="h-28 w-full rounded-lg" />;
}

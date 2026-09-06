"use client";

import type { LoanHistoryOverviewView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type HistoryCardKey = "duration" | "late" | "onTime" | "total";

const EMPTY_VALUE = "—";

type LoanHistorySummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

const HISTORY_CARD_LOOK = {
  duration: { icon: "calendar", iconTone: "info" },
  late: { icon: "clock", iconTone: "tag" },
  onTime: { icon: "check-circle", iconTone: "success" },
  total: { icon: "book-copy", iconTone: "primary" },
} as const satisfies Record<HistoryCardKey, Pick<LibrarySummaryCard, "icon" | "iconTone">>;

export function LoanHistorySummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
}: LoanHistorySummaryCardsProps) {
  const t = useTranslations("loans.summary");

  if (isError) {
    return (
      <Card
        aria-live="assertive"
        className="flex flex-col items-start gap-2 border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <p className="text-sm text-muted-foreground">{t("error.description")}</p>
        <Button onClick={onRetry} size="sm" variant="secondary">
          <UiIcon name="refresh" size={16} />
          {t("error.retry")}
        </Button>
      </Card>
    );
  }

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}

export function useLoanHistorySummaryCards(
  overview: LoanHistoryOverviewView | undefined,
): LibrarySummaryCard[] {
  const t = useTranslations("loans.history.cards");

  const summary = overview?.summary;
  const totalCompleted = summary?.totalCompleted ?? 0;
  const onTimeCount = summary?.onTimeCount ?? 0;
  const onTimePercent = summary?.onTimePercent ?? null;
  const lateCount = summary?.lateCount ?? 0;
  const averageDelayDays = summary?.averageDelayDays ?? null;
  const averageDurationDays = summary?.averageDurationDays ?? null;
  const durationCount = summary?.durationCount ?? 0;

  const mobileLabels = (key: HistoryCardKey) => ({
    compact: t(`${key}.mobile.compact`),
    detailed: t(`${key}.mobile.detailed`),
  });

  function lateMicrofact() {
    if (lateCount === 0) return t("late.noDelays");
    if (averageDelayDays === null) return undefined;
    return t("late.microfact", { count: averageDelayDays });
  }

  return [
    {
      ...HISTORY_CARD_LOOK.total,
      label: t("total.label"),
      microfact: t("total.microfact", {
        borrowed: summary?.borrowedCount ?? 0,
        lent: summary?.lentCount ?? 0,
      }),
      mobileLabels: mobileLabels("total"),
      unit: t("unitLoans", { count: totalCompleted }),
      value: totalCompleted,
    },
    {
      ...HISTORY_CARD_LOOK.onTime,
      label: t("onTime.label"),
      microfact:
        onTimePercent === null
          ? t("onTime.empty")
          : t("onTime.microfact", { percent: onTimePercent }),
      mobileLabels: mobileLabels("onTime"),
      unit: t("unitLoans", { count: onTimeCount }),
      value: onTimeCount,
    },
    {
      ...HISTORY_CARD_LOOK.late,
      label: t("late.label"),
      microfact: lateMicrofact(),
      mobileLabels: mobileLabels("late"),
      unit: t("unitLoans", { count: lateCount }),
      value: lateCount,
    },
    {
      ...HISTORY_CARD_LOOK.duration,
      label: t("duration.label"),
      microfact:
        averageDurationDays === null
          ? t("duration.empty")
          : t("duration.microfact", { count: durationCount }),
      mobileLabels: mobileLabels("duration"),
      unit:
        averageDurationDays === null ? undefined : t("unitDays", { count: averageDurationDays }),
      value: averageDurationDays ?? EMPTY_VALUE,
    },
  ];
}

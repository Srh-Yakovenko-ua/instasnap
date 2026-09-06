"use client";

import type { ReadingStatisticsCalendarSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { formatShare, weekdayLabel } from "../../model/statistics-format";

export function ReadingCalendarSummary({
  calendar,
  isLowerBound,
}: {
  calendar: ReadingStatisticsCalendarSection;
  isLowerBound: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.summary");

  const lowerBound = (value: string) => (isLowerBound ? t("lowerBoundValue", { value }) : value);
  const { activeDaysPercentage, currentStreak, mostActiveWeekday } = calendar;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryItem
        label={t("activeDays")}
        value={lowerBound(t("days", { count: calendar.activeDays }))}
      />

      <SummaryItem
        hint={
          activeDaysPercentage.availability === "unavailable"
            ? t(`reason.${activeDaysPercentage.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)
            : undefined
        }
        label={t("activeDaysRate")}
        value={
          activeDaysPercentage.availability === "unavailable" || activeDaysPercentage.value === null
            ? t("unavailable")
            : lowerBound(`${formatShare(activeDaysPercentage.value, locale)}%`)
        }
      />

      <SummaryItem
        label={t("longestStreak")}
        value={lowerBound(t("days", { count: calendar.longestStreak.days }))}
      />

      {currentStreak.availability === "unavailable" ? (
        currentStreak.reason === "PERIOD_NOT_CURRENT" ? null : (
          <SummaryItem
            hint={t(`reason.${currentStreak.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
            label={t("currentStreak")}
            value={t("unavailable")}
          />
        )
      ) : currentStreak.data === null ? null : (
        <SummaryItem
          hint={currentStreak.data.continuesBeforeRange ? t("continuesBeforeRange") : undefined}
          label={t("currentStreak")}
          value={
            currentStreak.data.continuesBeforeRange
              ? t("daysAtLeast", { count: currentStreak.data.days })
              : t("days", { count: currentStreak.data.days })
          }
        />
      )}

      {mostActiveWeekday.availability === "unavailable" ? (
        <SummaryItem
          hint={t(`reason.${mostActiveWeekday.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
          label={t("mostActiveWeekday")}
          value={t("unavailable")}
        />
      ) : mostActiveWeekday.data === null ? null : (
        <SummaryItem
          hint={t("weekdayHint", {
            days: mostActiveWeekday.data.activeDays,
            pages: formatNumber(mostActiveWeekday.data.pagesRead, locale),
          })}
          label={t("mostActiveWeekday")}
          value={weekdayLabel({ locale, weekday: mostActiveWeekday.data.weekday })}
        />
      )}
    </dl>
  );
}

function SummaryItem({ hint, label, value }: { hint?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base font-semibold text-ink tabular-nums">{value}</dd>
      {hint === undefined ? null : (
        <dd className="text-[0.6875rem] text-muted-foreground">{hint}</dd>
      )}
    </div>
  );
}

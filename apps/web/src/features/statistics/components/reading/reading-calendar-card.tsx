"use client";

import type { ReadingStatisticsCalendarSection, ReadingStatisticsMeta } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDayRange } from "../../model/statistics-format";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { ReadingBooksCalendar } from "./reading-books-calendar";
import { ReadingCalendarSummary } from "./reading-calendar-summary";
import { ReadingHeatmap } from "./reading-heatmap";

const CALENDAR_MODES = ["activity", "books"] as const;

type CalendarMode = (typeof CALENDAR_MODES)[number];

export function ReadingCalendarCard({
  calendar,
  meta,
}: {
  calendar: ReadingStatisticsCalendarSection;
  meta: ReadingStatisticsMeta;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar");
  const [mode, setMode] = useState<CalendarMode>("activity");

  const isLowerBound = meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";
  const metricLabel = formatDayRange({
    from: calendar.metricRange.from,
    locale,
    to: calendar.metricRange.to,
  });
  const displayLabel = formatDayRange({
    from: calendar.displayRange.from,
    locale,
    to: calendar.displayRange.to,
  });
  const isDisplayNarrower =
    calendar.displayRange.from !== calendar.metricRange.from ||
    calendar.displayRange.to !== calendar.metricRange.to;

  if (calendar.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t(`reason.${calendar.reason ?? "NO_ACTIVITY_HISTORY"}`)}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={CALENDAR_MODES}
          onChange={setMode}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      description={
        metricLabel === null ? t("description") : t("metricRange", { range: metricLabel })
      }
      note={
        <>
          {isDisplayNarrower && displayLabel !== null ? (
            <StatisticsNote>{t("displayRange", { range: displayLabel })}</StatisticsNote>
          ) : null}
          {isLowerBound ? <StatisticsNote>{t("legacyNote")}</StatisticsNote> : null}
        </>
      }
      title={t("title")}
    >
      <ReadingCalendarSummary calendar={calendar} isLowerBound={isLowerBound} />

      {calendar.days.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : mode === "activity" ? (
        <ReadingHeatmap days={calendar.days} weekStartDay={meta.weekStartDay} />
      ) : (
        <ReadingBooksCalendar calendar={calendar} weekStartDay={meta.weekStartDay} />
      )}
    </StatisticsSection>
  );
}

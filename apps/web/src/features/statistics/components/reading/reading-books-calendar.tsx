"use client";

import type { ReadingStatisticsCalendarSection, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

import { isDateInMonth, listCalendarMonths } from "../../model/statistics-calendar";
import { formatMonthKey } from "../../model/statistics-format";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

export function ReadingBooksCalendar({
  calendar,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  weekStartDay: WeekStartDay;
}) {
  const isMobile = useIsMobile();
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const months = listCalendarMonths(calendar.displayRange);
  const [requestedMonth, setRequestedMonth] = useState<null | string>(null);

  const monthKey = resolveMonth({ months, requested: requestedMonth });
  if (monthKey === null) {
    return <StatisticsSectionState kind="empty" title={t("empty")} />;
  }

  const index = months.indexOf(monthKey);
  const monthDays = calendar.days.filter((day) => isDateInMonth(day.date, monthKey));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label={t("previousMonth")}
          disabled={index <= 0}
          onClick={() => setRequestedMonth(months[index - 1] ?? monthKey)}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="chevron-left" size={16} />
        </Button>
        <span className="font-heading text-sm font-semibold text-ink">
          {formatMonthKey(monthKey, locale)}
        </span>
        <Button
          aria-label={t("nextMonth")}
          disabled={index >= months.length - 1}
          onClick={() => setRequestedMonth(months[index + 1] ?? monthKey)}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="chevron-right" size={16} />
        </Button>
      </div>

      {isMobile ? (
        <ReadingBooksDiary days={monthDays} />
      ) : (
        <ReadingBooksMonthGrid days={monthDays} monthKey={monthKey} weekStartDay={weekStartDay} />
      )}
    </div>
  );
}

function resolveMonth({
  months,
  requested,
}: {
  months: readonly string[];
  requested: null | string;
}): null | string {
  if (requested !== null && months.includes(requested)) return requested;
  return months.at(-1) ?? null;
}

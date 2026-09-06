"use client";

import type { StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { buildMonthGrid, weekdayOrder } from "../../model/statistics-calendar";
import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, weekdayLabel } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { ReadingDayPreview } from "./reading-day-preview";

export function ReadingBooksMonthGrid({
  days,
  monthKey,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  monthKey: string;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const weeks = buildMonthGrid({ days, monthKey, weekStartDay });
  const order = weekdayOrder(weekStartDay);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5">
        {order.map((weekday) => (
          <span
            className="text-center text-[0.6875rem] font-medium text-muted-foreground"
            key={weekday}
          >
            {weekdayLabel({ locale, weekday, width: "short" })}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weeks.flatMap((week, weekIndex) =>
          week.map((day, dayIndex) =>
            day === null ? (
              <span aria-hidden className="min-h-[4.5rem]" key={`${weekIndex}-${dayIndex}`} />
            ) : (
              <MonthDayCell day={day} key={day.date} />
            ),
          ),
        )}
      </div>
    </div>
  );
}

function MonthDayCell({ day }: { day: StatisticsCalendarDay }) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");

  const date = formatDayLong(day.date, locale);
  const dayNumber = day.date.slice(8);
  const cellClass = cn(
    "flex min-h-[4.5rem] w-full flex-col gap-1 rounded-lg border border-border p-1.5",
    day.booksCount === 0 ? "bg-secondary/30" : "bg-card",
  );
  const detailDate = resolveReadingDayTarget(day.drilldown);

  const body = (
    <>
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[0.6875rem] font-medium text-muted-foreground tabular-nums">
          {dayNumber}
        </span>
        {day.pagesRead === 0 ? null : (
          <span className="text-[0.625rem] text-muted-foreground tabular-nums">
            {formatNumber(day.pagesRead, locale)}
          </span>
        )}
      </span>
      <ReadingDayPreview day={day} />
    </>
  );

  if (day.booksCount === 0 || detailDate === null) {
    return (
      <span
        aria-label={
          day.historyQuality === "legacy_observed_only"
            ? t("dayUnknown", { date })
            : t("dayEmpty", { date })
        }
        className={cellClass}
      >
        {body}
      </span>
    );
  }

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      label={t("daySummary", { books: day.booksCount, date, pages: day.pagesRead })}
      title={date}
      triggerClassName={cn(
        cellClass,
        "transition-colors outline-none hover:border-accent-border focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      {body}
    </StatisticsDetailSurface>
  );
}

"use client";

import type { StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { buildHeatmapWeeks, weekdayOrder } from "../../model/statistics-calendar";
import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthShort, weekdayLabel } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";

const INTENSITY_CLASS = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

const VISIBLE_WEEKDAY_ROWS = [0, 2, 4] as const;

export function ReadingHeatmap({
  days,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");
  const weeks = buildHeatmapWeeks({ days, weekStartDay });
  const order = weekdayOrder(weekStartDay);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          <div className="flex shrink-0 flex-col gap-[3px] pt-4">
            {order.map((weekday, row) => (
              <span
                aria-hidden
                className="flex h-[13px] items-center text-[0.625rem] leading-none text-muted-foreground"
                key={weekday}
              >
                {VISIBLE_WEEKDAY_ROWS.some((visible) => visible === row)
                  ? weekdayLabel({ locale, weekday, width: "short" })
                  : ""}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <span
                  className="w-[13px] text-[0.6875rem] text-muted-foreground"
                  key={firstDate(week) ?? weekIndex}
                >
                  {monthTick(weeks, weekIndex, locale)}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div className="flex flex-col gap-[3px]" key={firstDate(week) ?? weekIndex}>
                  {week.map((day, dayIndex) =>
                    day === null ? (
                      <span aria-hidden className="size-[13px]" key={dayIndex} />
                    ) : (
                      <HeatmapCell day={day} key={day.date} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t("legendLess")}</span>
        {INTENSITY_CLASS.map((className, level) => (
          <span aria-hidden className={cn("size-[13px] rounded-[3px]", className)} key={level} />
        ))}
        <span>{t("legendMore")}</span>
        <span className="ms-2">{t("relativeHint")}</span>
      </div>
    </div>
  );
}

function firstDate(week: readonly (null | StatisticsCalendarDay)[]): null | string {
  return week.find((day) => day !== null)?.date ?? null;
}

function HeatmapCell({ day }: { day: StatisticsCalendarDay }) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.heatmap");

  const date = formatDayLong(day.date, locale);
  const label =
    day.pagesRead === 0
      ? day.historyQuality === "legacy_observed_only"
        ? t("dayUnknown", { date })
        : t("dayEmpty", { date })
      : t("daySummary", {
          books: day.booksCount,
          date,
          pages: formatNumber(day.pagesRead, locale),
        });

  const cellClass = cn(
    "size-[13px] rounded-[3px] outline-none",
    INTENSITY_CLASS[day.intensity],
    day.pagesRead === 0 && day.historyQuality === "legacy_observed_only" && "opacity-60",
  );
  const detailDate = resolveReadingDayTarget(day.drilldown);

  if (day.pagesRead === 0 || detailDate === null) {
    return <span aria-label={label} className={cellClass} role="img" />;
  }

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      label={label}
      title={date}
      triggerClassName={cn(
        cellClass,
        "transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-primary motion-safe:hover:scale-110",
      )}
    >
      <span aria-hidden className="block size-full" />
    </StatisticsDetailSurface>
  );
}

function monthTick(
  weeks: readonly (null | StatisticsCalendarDay)[][],
  weekIndex: number,
  locale: string,
): string {
  const current = firstDate(weeks[weekIndex] ?? []);
  if (current === null) return "";
  const previous = weekIndex === 0 ? null : firstDate(weeks[weekIndex - 1] ?? []);
  if (previous !== null && previous.slice(0, 7) === current.slice(0, 7)) return "";
  return formatMonthShort(current, locale);
}

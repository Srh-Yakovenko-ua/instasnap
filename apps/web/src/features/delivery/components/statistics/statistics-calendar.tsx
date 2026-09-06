"use client";

import type { BookOrderStatisticsDaily, Nullable, StatisticsPeriod } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { addDays, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import type { CalendarCell, CalendarMetric } from "../../model/statistics-calendar";
import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";

import { formatCurrencyTotals } from "../../model/money-format";
import {
  CALENDAR_METRICS,
  calendarGrid,
  calendarScope,
  resolveCalendarYear,
} from "../../model/statistics-calendar";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { StatisticsDrilldownMenuContent } from "./statistics-drilldown-action";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const CELL_PITCH_PX = 14;

const WEEKDAY_ROWS = [0, 2, 4, 6] as const;

const WEEKDAY_ANCHOR = "2026-01-05";

const LEVEL_CLASS = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

export function StatisticsCalendar({
  daily,
  drilldown,
  isTruncated,
  period,
  today,
}: {
  daily: BookOrderStatisticsDaily;
  drilldown: StatisticsDrilldownContext;
  isTruncated: boolean;
  period: StatisticsPeriod;
  today: string;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();
  const [metric, setMetric] = useState<CalendarMetric>("orders");
  const [requestedYear, setRequestedYear] = useState<Nullable<number>>(null);

  const scope = calendarScope({ daily, period, today });
  const year = scope === null ? null : resolveCalendarYear({ requested: requestedYear, scope });
  const grid =
    scope === null || year === null ? null : calendarGrid({ daily, metric, scope, year });

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={CALENDAR_METRICS}
            onChange={setMetric}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {scope === null || scope.years.length < 2 ? null : (
            <Select onValueChange={(value) => setRequestedYear(Number(value))} value={String(year)}>
              <SelectTrigger aria-label={t("yearLabel")} className="w-24 data-[size=default]:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scope.years.map((entry) => (
                  <SelectItem key={entry} value={String(entry)}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      }
      description={t(`subtitle.${metric}`)}
      title={t("title")}
    >
      {grid === null || year === null ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <div className="flex shrink-0 flex-col gap-[3px] pt-4">
                {Array.from({ length: 7 }, (_, row) => (
                  <span
                    aria-hidden
                    className="flex h-[11px] items-center text-[0.625rem] leading-none text-muted-foreground"
                    key={row}
                  >
                    {WEEKDAY_ROWS.some((visible) => visible === row)
                      ? weekdayLabel(row, locale)
                      : ""}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <div className="relative h-4">
                  {grid.monthLabels.map((label) => (
                    <span
                      className="absolute top-0 text-[0.6875rem] text-muted-foreground"
                      key={label.monthStart}
                      style={{ left: `${label.weekIndex * CELL_PITCH_PX}px` }}
                    >
                      {monthShortLabel(label.monthStart, locale)}
                    </span>
                  ))}
                </div>
                <div className="flex gap-[3px]">
                  {grid.weeks.map((week, weekIndex) => (
                    <div className="flex flex-col gap-[3px]" key={weekIndex}>
                      {week.map((cell, dayIndex) =>
                        cell === null ? (
                          <span aria-hidden className="size-[11px]" key={dayIndex} />
                        ) : (
                          <CalendarDay
                            cell={cell}
                            drilldown={drilldown}
                            isTruncated={isTruncated}
                            key={cell.date}
                            metric={metric}
                          />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t(`legendLess.${metric}`)}</span>
              {LEVEL_CLASS.map((className, level) => (
                <span
                  aria-hidden
                  className={`size-[11px] rounded-[3px] ${className}`}
                  key={level}
                />
              ))}
              <span>{t("legendMore")}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("relativeHint")}</p>
          </div>

          {grid.hasValues ? null : (
            <StatisticsSectionState kind="empty" title={t("emptyYear", { year: String(year) })} />
          )}
        </>
      )}
    </StatisticsSection>
  );
}

function CalendarDay({
  cell,
  drilldown,
  isTruncated,
  metric,
}: {
  cell: CalendarCell;
  drilldown: StatisticsDrilldownContext;
  isTruncated: boolean;
  metric: CalendarMetric;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();

  const date = formatDateLong(cell.date, locale);
  const summary =
    cell.value === 0
      ? t("dayEmpty", { date })
      : t(`daySummary.${metric}`, { books: cell.booksCount, date, orders: cell.ordersCount });

  if (cell.value === 0) {
    return (
      <span
        aria-label={summary}
        className={`size-[11px] rounded-[3px] ${LEVEL_CLASS[0]}`}
        role="img"
      />
    );
  }

  const links = isTruncated
    ? []
    : statisticsDrilldownLinks({
        breakdown: cell.drilldown,
        context: drilldown,
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { from: cell.date, kind: "order_date_range", to: cell.date },
      });

  const cellClass = `size-[11px] rounded-[3px] transition-transform outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-primary motion-safe:hover:scale-110 ${LEVEL_CLASS[cell.level]}`;
  const only = links.at(0);
  const summaryTooltip = (
    <TooltipContent>
      <CalendarDayDetails cell={cell} date={date} metric={metric} />
    </TooltipContent>
  );

  if (only === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger aria-label={summary} className={cellClass} type="button" />
        {summaryTooltip}
      </Tooltip>
    );
  }

  if (links.length === 1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link aria-label={summary} className={`block ${cellClass}`} href={only.href} />
        </TooltipTrigger>
        {summaryTooltip}
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={summary}
            className={`cursor-pointer ${cellClass}`}
            type="button"
          />
        </TooltipTrigger>
        {summaryTooltip}
      </Tooltip>
      <StatisticsDrilldownMenuContent
        align="center"
        links={links}
        unit={metric === "books" ? "books" : "orders"}
      />
    </DropdownMenu>
  );
}

function CalendarDayDetails({
  cell,
  date,
  metric,
}: {
  cell: CalendarCell;
  date: string;
  metric: CalendarMetric;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();

  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{date}</span>
      <span>{t(`tooltipPrimary.${metric}`, { count: primaryCount(cell, metric) })}</span>
      <span className="opacity-80">
        {t(`tooltipSecondary.${metric}`, { count: secondaryCount(cell, metric) })}
      </span>
      {cell.totalsByCurrency.length === 0 ? (
        <span className="opacity-80">{t("tooltipMoneyMissing")}</span>
      ) : (
        <>
          <span className="pt-0.5 opacity-80">{t("tooltipMoney")}</span>
          <span className="tabular-nums">
            {formatCurrencyTotals(cell.totalsByCurrency, locale)}
          </span>
        </>
      )}
    </span>
  );
}

function monthShortLabel(monthStart: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(parseISO(monthStart));
}

function primaryCount(cell: CalendarCell, metric: CalendarMetric): number {
  return metric === "books" ? cell.booksCount : cell.ordersCount;
}

function secondaryCount(cell: CalendarCell, metric: CalendarMetric): number {
  return metric === "books" ? cell.ordersCount : cell.booksCount;
}

function weekdayLabel(row: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
    addDays(parseISO(WEEKDAY_ANCHOR), row),
  );
}

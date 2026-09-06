import type {
  BookOrderStatisticsDay,
  CurrencyTotal,
  Nullable,
  StatisticsDrilldownBreakdown,
  StatisticsPeriod,
} from "@app/shared";

import { eachDayOfInterval, endOfWeek, format, getDate, parseISO, startOfWeek } from "date-fns";

import { STATISTICS_PERIOD } from "./statistics-period";

export const CALENDAR_METRICS = ["orders", "books"] as const;

export type CalendarMetric = (typeof CALENDAR_METRICS)[number];

export const CALENDAR = {
  levels: 4,
  weekStartsOn: 1,
} as const;

export type CalendarCell = {
  booksCount: number;
  date: string;
  drilldown: StatisticsDrilldownBreakdown;
  level: number;
  ordersCount: number;
  totalsByCurrency: CurrencyTotal[];
  value: number;
};

export type CalendarGrid = {
  from: string;
  hasValues: boolean;
  monthLabels: CalendarMonthLabel[];
  peak: number;
  to: string;
  weeks: Nullable<CalendarCell>[][];
};

export type CalendarMonthLabel = {
  monthStart: string;
  weekIndex: number;
};

export type CalendarScope = {
  from: string;
  to: string;
  years: number[];
};

export function calendarGrid({
  daily,
  metric,
  scope,
  year,
}: {
  daily: readonly BookOrderStatisticsDay[];
  metric: CalendarMetric;
  scope: CalendarScope;
  year: number;
}): CalendarGrid {
  const from = laterDay(scope.from, `${year}-01-01`);
  const to = earlierDay(scope.to, `${year}-12-31`);
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const peak = Math.max(
    ...daily
      .filter((day) => isWithinDays({ day: day.date, from, to }))
      .map((day) => cellValue(day, metric)),
    0,
  );

  const weeks: Nullable<CalendarCell>[][] = [];
  const monthLabels: CalendarMonthLabel[] = [];
  let week: Nullable<CalendarCell>[] = [];

  const days = eachDayOfInterval({
    end: endOfWeek(parseISO(to), { weekStartsOn: CALENDAR.weekStartsOn }),
    start: startOfWeek(parseISO(from), { weekStartsOn: CALENDAR.weekStartsOn }),
  });

  for (const date of days) {
    const iso = format(date, STATISTICS_PERIOD.isoDayFormat);
    const isInside = isWithinDays({ day: iso, from, to });
    week.push(isInside ? toCell({ day: byDate.get(iso), iso, metric, peak }) : null);

    if (isInside && (getDate(date) === 1 || iso === from)) {
      monthLabels.push({ monthStart: iso, weekIndex: weeks.length });
    }

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) weeks.push(week);

  return { from, hasValues: peak > 0, monthLabels, peak, to, weeks };
}

export function calendarScope({
  daily,
  period,
  today,
}: {
  daily: readonly BookOrderStatisticsDay[];
  period: StatisticsPeriod;
  today: string;
}): Nullable<CalendarScope> {
  const from = period.from ?? earliestDay(daily) ?? today;
  const to = earlierDay(period.to ?? today, today);

  if (from > to) return null;

  const firstYear = yearOf(from);
  const lastYear = yearOf(to);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index);

  return { from, to, years };
}

export function resolveCalendarYear({
  requested,
  scope,
}: {
  requested: Nullable<number>;
  scope: CalendarScope;
}): number {
  const latest = scope.years[0] ?? yearOf(scope.to);
  return requested !== null && scope.years.includes(requested) ? requested : latest;
}

function cellValue(day: BookOrderStatisticsDay, metric: CalendarMetric): number {
  return metric === "books" ? day.booksCount : day.ordersCount;
}

function earlierDay(left: string, right: string): string {
  return left < right ? left : right;
}

function earliestDay(daily: readonly BookOrderStatisticsDay[]): Nullable<string> {
  return daily.reduce<Nullable<string>>(
    (earliest, day) => (earliest === null || day.date < earliest ? day.date : earliest),
    null,
  );
}

function isWithinDays({ day, from, to }: { day: string; from: string; to: string }): boolean {
  return day >= from && day <= to;
}

function laterDay(left: string, right: string): string {
  return left > right ? left : right;
}

function toCell({
  day,
  iso,
  metric,
  peak,
}: {
  day: BookOrderStatisticsDay | undefined;
  iso: string;
  metric: CalendarMetric;
  peak: number;
}): CalendarCell {
  if (day === undefined) {
    return {
      booksCount: 0,
      date: iso,
      drilldown: { targets: [] },
      level: 0,
      ordersCount: 0,
      totalsByCurrency: [],
      value: 0,
    };
  }

  const value = cellValue(day, metric);

  return {
    booksCount: day.booksCount,
    date: iso,
    drilldown: day.drilldown,
    level: toLevel({ peak, value }),
    ordersCount: day.ordersCount,
    totalsByCurrency: day.totalsByCurrency,
    value,
  };
}

function toLevel({ peak, value }: { peak: number; value: number }): number {
  if (value <= 0 || peak <= 0) return 0;
  return Math.max(1, Math.ceil((value / peak) * CALENDAR.levels));
}

function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

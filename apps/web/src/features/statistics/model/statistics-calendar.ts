import type { Nullable, StatisticsCalendarDay, WeekStartDay } from "@app/shared";

import { addDays, addMonths, endOfMonth, format, getDay, startOfMonth } from "date-fns";

import { parseIsoDay } from "@/lib/format";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const ISO_MONTH_FORMAT = "yyyy-MM";

const DAYS_IN_WEEK = 7;

const WEEK_START_INDEX: Record<WeekStartDay, number> = { monday: 1, sunday: 0 };

export type CalendarWeek = Nullable<StatisticsCalendarDay>[];

export function buildHeatmapWeeks({
  days,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  weekStartDay: WeekStartDay;
}): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  let current: CalendarWeek = [];

  for (const day of days) {
    const column = weekdayColumn({ date: day.date, weekStartDay });
    while (current.length !== column) {
      current.push(null);
      if (current.length === DAYS_IN_WEEK) {
        weeks.push(current);
        current = [];
      }
    }
    current.push(day);
    if (current.length === DAYS_IN_WEEK) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    weeks.push(padTrailingCells(current));
  }

  return weeks;
}

export function buildMonthGrid({
  days,
  monthKey,
  weekStartDay,
}: {
  days: readonly StatisticsCalendarDay[];
  monthKey: string;
  weekStartDay: WeekStartDay;
}): CalendarWeek[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const monthStart = startOfMonth(parseIsoDay(`${monthKey}-01`));
  const monthEnd = endOfMonth(monthStart);
  const weeks: CalendarWeek[] = [];

  let current: CalendarWeek = padLeadingCells({
    date: format(monthStart, ISO_DAY_FORMAT),
    weekStartDay,
  });

  for (const date of enumerateDays({
    from: format(monthStart, ISO_DAY_FORMAT),
    to: format(monthEnd, ISO_DAY_FORMAT),
  })) {
    current.push(byDate.get(date) ?? null);
    if (current.length === DAYS_IN_WEEK) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    weeks.push(padTrailingCells(current));
  }

  return weeks;
}

export function isDateInMonth(date: string, monthKey: string): boolean {
  return date.startsWith(monthKey);
}

export function listCalendarMonths({ from, to }: { from: string; to: string }): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(parseIsoDay(from));
  const last = startOfMonth(parseIsoDay(to));

  while (format(cursor, ISO_MONTH_FORMAT) <= format(last, ISO_MONTH_FORMAT)) {
    months.push(format(cursor, ISO_MONTH_FORMAT));
    cursor = addMonths(cursor, 1);
  }

  return months;
}

export function weekdayOrder(weekStartDay: WeekStartDay): number[] {
  const start = WEEK_START_INDEX[weekStartDay];
  return Array.from({ length: DAYS_IN_WEEK }, (_unused, index) => (start + index) % DAYS_IN_WEEK);
}

function enumerateDays({ from, to }: { from: string; to: string }): string[] {
  const days: string[] = [];
  let cursor = parseIsoDay(from);

  while (format(cursor, ISO_DAY_FORMAT) <= to) {
    days.push(format(cursor, ISO_DAY_FORMAT));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function padLeadingCells({
  date,
  weekStartDay,
}: {
  date: string;
  weekStartDay: WeekStartDay;
}): CalendarWeek {
  return Array.from({ length: weekdayColumn({ date, weekStartDay }) }, () => null);
}

function padTrailingCells(week: CalendarWeek): CalendarWeek {
  return [...week, ...Array.from({ length: DAYS_IN_WEEK - week.length }, () => null)];
}

function weekdayColumn({
  date,
  weekStartDay,
}: {
  date: string;
  weekStartDay: WeekStartDay;
}): number {
  return (getDay(parseIsoDay(date)) - WEEK_START_INDEX[weekStartDay] + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}

import type { Nullable, StatisticsCalendarBookPreview, StatisticsCalendarDay } from "@app/shared";

import { CALENDAR_BOOKS_PREVIEW_LIMIT } from "@app/shared";
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";

import { resolveDayHistoryQuality } from "./activity-history-quality.js";
import { toReadingDayDrilldown } from "./statistics-drilldown.js";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const INTENSITY_LEVELS = 4;

export type DayActivity = {
  booksCount: number;
  date: string;
  pagesRead: number;
};

export type DayBookActivity = {
  bookId: string;
  coverThumbUrl: Nullable<string>;
  date: string;
  pagesRead: number;
  title: string;
};

export type MostActiveWeekday = { activeDays: number; pagesRead: number; weekday: number };

export function buildCalendarDays({
  activity,
  bookActivity,
  displayRange,
  reliableFrom,
}: {
  activity: DayActivity[];
  bookActivity: DayBookActivity[];
  displayRange: { from: string; to: string };
  reliableFrom: string;
}): StatisticsCalendarDay[] {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const previews = groupPreviews(bookActivity);
  const thresholds = intensityThresholds(activity.map((day) => day.pagesRead));
  const days: StatisticsCalendarDay[] = [];

  for (const date of enumerateDays(displayRange)) {
    const day = byDate.get(date);
    const pagesRead = day?.pagesRead ?? 0;
    const dayPreviews = previews.get(date) ?? [];
    const booksCount = day?.booksCount ?? 0;

    days.push({
      booksCount,
      booksPreview: dayPreviews.slice(0, CALENDAR_BOOKS_PREVIEW_LIMIT),
      date,
      drilldown: toReadingDayDrilldown(date),
      historyQuality: resolveDayHistoryQuality({ date, reliableFrom }),
      intensity: resolveIntensity({ pagesRead, thresholds }),
      pagesRead,
      remainingBooksCount: Math.max(
        booksCount - Math.min(dayPreviews.length, CALENDAR_BOOKS_PREVIEW_LIMIT),
        0,
      ),
    });
  }

  return days;
}

export function countEligibleDays({ from, to }: { from: string; to: string }): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
}

export function findMostActiveWeekday(activity: DayActivity[]): Nullable<MostActiveWeekday> {
  const totals = new Map<number, MostActiveWeekday>();

  for (const day of activity) {
    if (day.pagesRead <= 0) {
      continue;
    }
    const weekday = getDay(parseISO(day.date));
    const current = totals.get(weekday) ?? { activeDays: 0, pagesRead: 0, weekday };
    totals.set(weekday, {
      activeDays: current.activeDays + 1,
      pagesRead: current.pagesRead + day.pagesRead,
      weekday,
    });
  }

  return [...totals.values()].sort(compareWeekdays)[0] ?? null;
}

export function toActiveDays(activity: DayActivity[]): string[] {
  return activity.filter((day) => day.pagesRead > 0).map((day) => day.date);
}

function comparePreviews(left: DayBookActivity, right: DayBookActivity): number {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  if (left.pagesRead !== right.pagesRead) {
    return right.pagesRead - left.pagesRead;
  }
  return left.bookId.localeCompare(right.bookId);
}

function compareWeekdays(left: MostActiveWeekday, right: MostActiveWeekday): number {
  if (left.pagesRead !== right.pagesRead) {
    return right.pagesRead - left.pagesRead;
  }
  if (left.activeDays !== right.activeDays) {
    return right.activeDays - left.activeDays;
  }
  return left.weekday - right.weekday;
}

function enumerateDays({ from, to }: { from: string; to: string }): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = format(addDays(parseISO(cursor), 1), ISO_DAY_FORMAT);
  }
  return days;
}

function groupPreviews(
  bookActivity: DayBookActivity[],
): Map<string, StatisticsCalendarBookPreview[]> {
  const byDate = new Map<string, StatisticsCalendarBookPreview[]>();

  for (const entry of [...bookActivity].sort(comparePreviews)) {
    if (entry.pagesRead <= 0) {
      continue;
    }
    const previews = byDate.get(entry.date) ?? [];
    previews.push({
      bookId: entry.bookId,
      coverThumbUrl: entry.coverThumbUrl,
      pagesRead: entry.pagesRead,
      title: entry.title,
    });
    byDate.set(entry.date, previews);
  }

  return byDate;
}

function intensityThresholds(pageCounts: number[]): number[] {
  const active = pageCounts.filter((pages) => pages > 0).sort((left, right) => left - right);
  if (active.length === 0) {
    return [];
  }

  return Array.from({ length: INTENSITY_LEVELS - 1 }, (_unused, index) => {
    const quantile = (index + 1) / INTENSITY_LEVELS;
    const position = Math.min(Math.floor(active.length * quantile), active.length - 1);
    return active[position] ?? 0;
  });
}

function resolveIntensity({
  pagesRead,
  thresholds,
}: {
  pagesRead: number;
  thresholds: number[];
}): number {
  if (pagesRead <= 0) {
    return 0;
  }
  const level = thresholds.filter((threshold) => pagesRead > threshold).length + 1;
  return Math.min(level, INTENSITY_LEVELS);
}

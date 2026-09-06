import type { ReadingStatisticsGranularity, WeekStartDay } from "@app/shared";

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

import { assertNever } from "../../../core/assert-never.js";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const WEEK_STARTS_ON = { monday: 1, sunday: 0 } as const;

export type StatisticsBucketRange = { end: string; start: string };

export function buildStatisticsBuckets({
  from,
  granularity,
  to,
  weekStartDay,
}: {
  from: string;
  granularity: ReadingStatisticsGranularity;
  to: string;
  weekStartDay: WeekStartDay;
}): StatisticsBucketRange[] {
  const buckets: StatisticsBucketRange[] = [];
  let cursor = bucketStart({ granularity, isoDay: from, weekStartDay });

  while (cursor <= to) {
    const end = bucketEnd({ granularity, start: cursor });
    buckets.push({ end: end > to ? to : end, start: cursor < from ? from : cursor });
    cursor = nextBucketStart({ granularity, start: cursor });
  }

  return buckets;
}

function bucketEnd({
  granularity,
  start,
}: {
  granularity: ReadingStatisticsGranularity;
  start: string;
}): string {
  const date = parseISO(start);
  switch (granularity) {
    case "day":
      return start;
    case "month":
      return toIsoDay(endOfMonth(date));
    case "week":
      return toIsoDay(addDays(date, 6));
    case "year":
      return toIsoDay(endOfYear(date));
    default:
      return assertNever(granularity);
  }
}

function bucketStart({
  granularity,
  isoDay,
  weekStartDay,
}: {
  granularity: ReadingStatisticsGranularity;
  isoDay: string;
  weekStartDay: WeekStartDay;
}): string {
  const date = parseISO(isoDay);
  switch (granularity) {
    case "day":
      return isoDay;
    case "month":
      return toIsoDay(startOfMonth(date));
    case "week":
      return toIsoDay(startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON[weekStartDay] }));
    case "year":
      return toIsoDay(startOfYear(date));
    default:
      return assertNever(granularity);
  }
}

function nextBucketStart({
  granularity,
  start,
}: {
  granularity: ReadingStatisticsGranularity;
  start: string;
}): string {
  const date = parseISO(start);
  switch (granularity) {
    case "day":
      return toIsoDay(addDays(date, 1));
    case "month":
      return toIsoDay(addMonths(date, 1));
    case "week":
      return toIsoDay(addDays(date, 7));
    case "year":
      return toIsoDay(addYears(date, 1));
    default:
      return assertNever(granularity);
  }
}

function toIsoDay(date: Date): string {
  return format(date, ISO_DAY_FORMAT);
}

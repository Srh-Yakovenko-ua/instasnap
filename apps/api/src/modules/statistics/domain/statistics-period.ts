import type {
  Nullable,
  ReadingStatisticsComparison,
  ReadingStatisticsGranularity,
  ReadingStatisticsOverviewQuery,
  ReadingStatisticsPeriod,
} from "@app/shared";

import { addDays, differenceInCalendarDays, format, parseISO, subMonths, subYears } from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const GRANULARITY_BOUNDS = { dailyMaxDays: 31, weeklyMaxDays: 180 } as const;

const CUSTOM_PERIOD_BOUNDS = { earliestDay: "1900-01-01", maxDays: 1830 } as const;

const PERIOD_MESSAGE = {
  allTimeComparison: "All time cannot be compared with another period",
  customBoundsRequired: "A custom period needs both a start and an end date",
  customTooEarly: `A custom period cannot start before ${CUSTOM_PERIOD_BOUNDS.earliestDay}`,
  customTooWide: `A custom period cannot span more than ${String(CUSTOM_PERIOD_BOUNDS.maxDays)} days`,
  futureBound: "A statistics period cannot reach into the future",
  reversedBounds: "The start of a custom period cannot be later than its end",
  yearRequired: "A calendar-year period needs a year",
} as const;

export type NormalizedReadingStatisticsPeriod = {
  comparison: Nullable<ReadingStatisticsComparison>;
  period: ReadingStatisticsPeriod;
};

export function inclusiveDays({ from, to }: { from: string; to: string }): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
}

export function normalizeReadingStatisticsPeriod({
  query,
  today,
}: {
  query: ReadingStatisticsOverviewQuery;
  today: string;
}): NormalizedReadingStatisticsPeriod {
  const bounds = resolveBounds({ query, today });
  const period: ReadingStatisticsPeriod = {
    from: bounds.from,
    granularity: resolveGranularity(bounds),
    kind: query.period,
    to: bounds.to,
  };

  return { comparison: resolveComparison({ bounds, query }), period };
}

function isFullCalendarYear({ from, to }: { from: string; to: string }): boolean {
  return from.endsWith("-01-01") && to === `${from.slice(0, 4)}-12-31`;
}

function resolveBounds({
  query,
  today,
}: {
  query: ReadingStatisticsOverviewQuery;
  today: string;
}): { from: Nullable<string>; to: string } {
  switch (query.period) {
    case "all_time":
      return { from: null, to: today };
    case "custom": {
      const { from, to } = query;
      if (from === undefined || to === undefined) {
        throw new BadRequestError(PERIOD_MESSAGE.customBoundsRequired);
      }
      if (from > to) {
        throw new BadRequestError(PERIOD_MESSAGE.reversedBounds);
      }
      if (from > today || to > today) {
        throw new BadRequestError(PERIOD_MESSAGE.futureBound);
      }
      if (from < CUSTOM_PERIOD_BOUNDS.earliestDay) {
        throw new BadRequestError(PERIOD_MESSAGE.customTooEarly);
      }
      if (inclusiveDays({ from, to }) > CUSTOM_PERIOD_BOUNDS.maxDays) {
        throw new BadRequestError(PERIOD_MESSAGE.customTooWide);
      }
      return { from, to };
    }
    case "last_12_months":
      return { from: rollingYearStart(today), to: today };
    case "year": {
      const { year } = query;
      if (year === undefined) {
        throw new BadRequestError(PERIOD_MESSAGE.yearRequired);
      }
      const from = `${String(year).padStart(4, "0")}-01-01`;
      if (from > today) {
        throw new BadRequestError(PERIOD_MESSAGE.futureBound);
      }
      const yearEnd = `${String(year).padStart(4, "0")}-12-31`;
      return { from, to: yearEnd > today ? today : yearEnd };
    }
    default:
      return assertNever(query.period);
  }
}

function resolveComparison({
  bounds,
  query,
}: {
  bounds: { from: Nullable<string>; to: string };
  query: ReadingStatisticsOverviewQuery;
}): Nullable<ReadingStatisticsComparison> {
  const { compare } = query;
  if (compare === undefined) {
    return null;
  }
  if (bounds.from === null) {
    throw new BadRequestError(PERIOD_MESSAGE.allTimeComparison);
  }

  const from = bounds.from;
  if (compare === "same_period_last_year") {
    return { from: shiftYearBack(from), mode: compare, to: shiftYearBack(bounds.to) };
  }

  if (query.period === "year" && isFullCalendarYear({ from, to: bounds.to })) {
    const previousYear = shiftYearBack(from).slice(0, 4);
    return { from: `${previousYear}-01-01`, mode: compare, to: `${previousYear}-12-31` };
  }

  const days = inclusiveDays({ from, to: bounds.to });
  const comparisonTo = shiftDays(from, -1);
  return { from: shiftDays(comparisonTo, -(days - 1)), mode: compare, to: comparisonTo };
}

function resolveGranularity(bounds: {
  from: Nullable<string>;
  to: string;
}): ReadingStatisticsGranularity {
  if (bounds.from === null) {
    return "year";
  }
  const days = inclusiveDays({ from: bounds.from, to: bounds.to });
  if (days <= GRANULARITY_BOUNDS.dailyMaxDays) {
    return "day";
  }
  return days <= GRANULARITY_BOUNDS.weeklyMaxDays ? "week" : "month";
}

function rollingYearStart(today: string): string {
  return format(addDays(subMonths(parseISO(today), 12), 1), ISO_DAY_FORMAT);
}

function shiftDays(isoDay: string, days: number): string {
  return format(addDays(parseISO(isoDay), days), ISO_DAY_FORMAT);
}

function shiftYearBack(isoDay: string): string {
  return format(subYears(parseISO(isoDay), 1), ISO_DAY_FORMAT);
}

import type {
  Nullable,
  ReadingStatisticsCompareMode,
  ReadingStatisticsPeriodKind,
} from "@app/shared";

import { ReadingStatisticsCompareModeSchema, ReadingStatisticsPeriodKindSchema } from "@app/shared";
import { format, isValid, parse } from "date-fns";
import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { StatisticsControllerGetOverviewParams } from "@/shared/api/generated/model";

export const STATISTICS_PERIOD = {
  defaultKind: "year",
  isoDayFormat: "yyyy-MM-dd",
  selectableYearsBack: 30,
} as const satisfies Record<string, number | string> & {
  defaultKind: ReadingStatisticsPeriodKind;
  isoDayFormat: string;
};

export const STATISTICS_PERIOD_KINDS = ReadingStatisticsPeriodKindSchema.options;

export const STATISTICS_COMPARE_MODES = ReadingStatisticsCompareModeSchema.options;

export type StatisticsCustomRangeIssue = "future" | "incomplete" | "invalid" | "reversed";

export type StatisticsQueryState = inferParserType<typeof statisticsParsers>;

export const statisticsParsers = {
  compare: parseAsStringLiteral(STATISTICS_COMPARE_MODES),
  from: parseAsString.withDefault(""),
  period: parseAsStringLiteral(STATISTICS_PERIOD_KINDS).withDefault(STATISTICS_PERIOD.defaultKind),
  to: parseAsString.withDefault(""),
  year: parseAsInteger,
};

export function canCompareStatisticsPeriod(kind: ReadingStatisticsPeriodKind): boolean {
  return kind !== "all_time";
}

export function customRangeIssue({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}): Nullable<StatisticsCustomRangeIssue> {
  if (from === "" || to === "") return "incomplete";
  if (!isStatisticsDay(from) || !isStatisticsDay(to)) return "invalid";
  if (from > to) return "reversed";
  if (to > today) return "future";
  return null;
}

export function defaultStatisticsCompareMode(
  kind: ReadingStatisticsPeriodKind,
): ReadingStatisticsCompareMode {
  return kind === "year" ? "same_period_last_year" : "previous_period";
}

export function isStatisticsDay(value: string): boolean {
  return value !== "" && isValid(parse(value, STATISTICS_PERIOD.isoDayFormat, new Date()));
}

export function resolvedStatisticsYear(state: StatisticsQueryState, today: string): number {
  return state.year ?? todayYear(today);
}

export function selectableYearBounds(today: string): { max: number; min: number } {
  const max = todayYear(today);
  return { max, min: max - STATISTICS_PERIOD.selectableYearsBack };
}

export function statisticsCompareMode(
  state: StatisticsQueryState,
): Nullable<ReadingStatisticsCompareMode> {
  return canCompareStatisticsPeriod(state.period) ? state.compare : null;
}

export function todayIsoDay(): string {
  return format(new Date(), STATISTICS_PERIOD.isoDayFormat);
}

export function toOverviewParams(
  state: StatisticsQueryState,
  today: string,
): StatisticsControllerGetOverviewParams {
  const compare = statisticsCompareMode(state);

  return {
    period: state.period,
    ...(state.period === "year" ? { year: resolvedStatisticsYear(state, today) } : {}),
    ...(state.period === "custom" ? { from: state.from, to: state.to } : {}),
    ...(compare === null ? {} : { compare }),
  };
}

function todayYear(today: string): number {
  return Number(today.slice(0, 4));
}

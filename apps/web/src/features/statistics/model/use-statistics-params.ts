"use client";

import type {
  Nullable,
  ReadingStatisticsCompareMode,
  ReadingStatisticsPeriodKind,
} from "@app/shared";

import { useQueryStates } from "nuqs";

import type { StatisticsControllerGetOverviewParams } from "@/shared/api/generated/model";

import type { StatisticsCustomRangeIssue, StatisticsQueryState } from "./statistics-period";

import {
  canCompareStatisticsPeriod,
  customRangeIssue,
  statisticsCompareMode,
  statisticsParsers,
  todayIsoDay,
  toOverviewParams,
} from "./statistics-period";

export type UseStatisticsParamsResult = {
  canCompare: boolean;
  compareMode: Nullable<ReadingStatisticsCompareMode>;
  isRequestable: boolean;
  queryParams: StatisticsControllerGetOverviewParams;
  rangeIssue: Nullable<StatisticsCustomRangeIssue>;
  setCompareMode: (mode: Nullable<ReadingStatisticsCompareMode>) => void;
  setCustomRange: (range: { from: string; to: string }) => void;
  setPeriod: (kind: ReadingStatisticsPeriodKind) => void;
  setYear: (year: number) => void;
  state: StatisticsQueryState;
  today: string;
};

type StatisticsStatePatch = Partial<{
  [Key in keyof StatisticsQueryState]: Nullable<StatisticsQueryState[Key]>;
}>;

export function useStatisticsParams(): UseStatisticsParamsResult {
  const [state, setState] = useQueryStates(statisticsParsers);
  const today = todayIsoDay();
  const rangeIssue =
    state.period === "custom" ? customRangeIssue({ from: state.from, to: state.to, today }) : null;

  const commit = (patch: StatisticsStatePatch) => {
    void setState(patch);
  };

  return {
    canCompare: canCompareStatisticsPeriod(state.period),
    compareMode: statisticsCompareMode(state),
    isRequestable: rangeIssue === null,
    queryParams: toOverviewParams(state, today),
    rangeIssue,
    setCompareMode: (mode) => commit({ compare: mode }),
    setCustomRange: (range) => commit({ from: range.from, period: "custom", to: range.to }),
    setPeriod: (kind) =>
      commit({
        compare: canCompareStatisticsPeriod(kind) ? (state.compare ?? null) : null,
        from: kind === "custom" ? state.from : null,
        period: kind,
        to: kind === "custom" ? state.to : null,
        year: kind === "year" ? state.year : null,
      }),
    setYear: (year) => commit({ period: "year", year }),
    state,
    today,
  };
}

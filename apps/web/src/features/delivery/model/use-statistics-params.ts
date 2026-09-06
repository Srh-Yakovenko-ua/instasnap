"use client";

import type { BookOrderStatisticsCompareMode, Currency, Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BookOrdersControllerStatisticsParams } from "@/shared/api/generated/model";

import type { DeliveryStatisticsQueryState } from "./statistics-params";
import type {
  StatisticsCustomRange,
  StatisticsPeriodPreset,
  StatisticsPeriodRange,
} from "./statistics-period";

import {
  deliveryStatisticsParsers,
  hasActiveStatisticsFilters,
  resolveStatisticsCompareMode,
  statisticsFilterCount,
  statisticsPeriodRange,
  toDeliveryStatisticsParams,
} from "./statistics-params";
import {
  canCompareStatisticsPeriod,
  defaultStatisticsCompareMode,
  resolveStatisticsPeriod,
  todayIsoDay,
} from "./statistics-period";

export type StatisticsFilterPatch = Partial<
  Pick<DeliveryStatisticsQueryState, "currency" | "orderState" | "store">
>;

export type UseStatisticsParamsResult = {
  budgetCurrency: Nullable<Currency>;
  canCompare: boolean;
  clearFilters: () => void;
  compareMode: Nullable<BookOrderStatisticsCompareMode>;
  filterCount: number;
  hasActiveFilters: boolean;
  periodRange: StatisticsPeriodRange;
  queryParams: BookOrdersControllerStatisticsParams;
  requestedDisplayCurrency: Nullable<Currency>;
  setBudgetCurrency: (currency: Currency) => void;
  setCompareMode: (mode: Nullable<BookOrderStatisticsCompareMode>) => void;
  setCustomRange: (range: StatisticsCustomRange) => void;
  setDisplayCurrency: (currency: Currency) => void;
  setFilters: (patch: StatisticsFilterPatch) => void;
  setIncludeCancelled: (value: boolean) => void;
  setPeriod: (preset: StatisticsPeriodPreset) => void;
  state: DeliveryStatisticsQueryState;
  today: string;
};

type StatisticsStatePatch = Partial<{
  [Key in keyof DeliveryStatisticsQueryState]: Nullable<DeliveryStatisticsQueryState[Key]>;
}>;

export function useStatisticsParams(): UseStatisticsParamsResult {
  const [state, setState] = useQueryStates(deliveryStatisticsParsers);
  const today = todayIsoDay();
  const periodRange = statisticsPeriodRange(state, today);

  const commit = (patch: StatisticsStatePatch) => {
    void setState(patch);
  };

  return {
    budgetCurrency: state.budgetCurrency,
    canCompare: canCompareStatisticsPeriod(periodRange),
    clearFilters: () => commit({ currency: null, orderState: null, store: null }),
    compareMode: resolveStatisticsCompareMode(state, periodRange),
    filterCount: statisticsFilterCount(state),
    hasActiveFilters: hasActiveStatisticsFilters(state),
    periodRange,
    queryParams: toDeliveryStatisticsParams(state, today),
    requestedDisplayCurrency: state.money,
    setBudgetCurrency: (currency) => commit({ budgetCurrency: currency }),
    setCompareMode: (mode) => commit({ compare: mode }),
    setCustomRange: (range) => commit({ from: range.from, period: "custom", to: range.to }),
    setDisplayCurrency: (currency) => commit({ money: currency }),
    setFilters: (patch) => commit(patch),
    setIncludeCancelled: (value) => commit({ includeCancelled: value }),
    setPeriod: (preset) =>
      commit({
        compare: nextCompareMode({ compare: state.compare, preset, state, today }),
        from: preset === "custom" ? state.from : null,
        period: preset,
        to: preset === "custom" ? state.to : null,
      }),
    state,
    today,
  };
}

function nextCompareMode({
  compare,
  preset,
  state,
  today,
}: {
  compare: Nullable<BookOrderStatisticsCompareMode>;
  preset: StatisticsPeriodPreset;
  state: DeliveryStatisticsQueryState;
  today: string;
}): Nullable<BookOrderStatisticsCompareMode> {
  if (compare === null) return null;

  const range = resolveStatisticsPeriod({
    custom: { from: state.from, to: state.to },
    preset,
    today,
  });
  if (!canCompareStatisticsPeriod(range)) return null;

  return defaultStatisticsCompareMode(preset);
}

import type { BookOrderStatisticsCompareMode } from "@app/shared";

import { BookOrderStatisticsCompareModeSchema } from "@app/shared";
import {
  type inferParserType,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { BookOrdersControllerStatisticsParams } from "@/shared/api/generated/model";

import {
  BookOrdersControllerStatisticsCurrency,
  BookOrdersControllerStatisticsOrderState,
} from "@/shared/api/generated/model";

import type { StatisticsPeriodRange } from "./statistics-period";

import {
  canCompareStatisticsPeriod,
  resolveStatisticsPeriod,
  STATISTICS_PERIOD,
  STATISTICS_PERIOD_PRESETS,
} from "./statistics-period";

export const DELIVERY_STATISTICS_CURRENCIES = Object.values(BookOrdersControllerStatisticsCurrency);
export const DELIVERY_STATISTICS_ORDER_STATES = Object.values(
  BookOrdersControllerStatisticsOrderState,
);

const currencyValues = Object.values(BookOrdersControllerStatisticsCurrency);
const orderStateValues = Object.values(BookOrdersControllerStatisticsOrderState);

export const deliveryStatisticsParsers = {
  budgetCurrency: parseAsStringLiteral(currencyValues),
  compare: parseAsStringLiteral(BookOrderStatisticsCompareModeSchema.options),
  currency: parseAsStringLiteral(currencyValues),
  from: parseAsString.withDefault(""),
  includeCancelled: parseAsBoolean.withDefault(false),
  money: parseAsStringLiteral(currencyValues),
  orderState: parseAsStringLiteral(orderStateValues),
  period: parseAsStringLiteral(STATISTICS_PERIOD_PRESETS).withDefault(
    STATISTICS_PERIOD.defaultPreset,
  ),
  store: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
};

export type DeliveryStatisticsQueryState = inferParserType<typeof deliveryStatisticsParsers>;

export function hasActiveStatisticsFilters(state: DeliveryStatisticsQueryState): boolean {
  return statisticsFilterCount(state) > 0;
}

export function resolveStatisticsCompareMode(
  state: DeliveryStatisticsQueryState,
  range: StatisticsPeriodRange,
): BookOrderStatisticsCompareMode | null {
  return canCompareStatisticsPeriod(range) ? state.compare : null;
}

export function statisticsFilterCount(state: DeliveryStatisticsQueryState): number {
  const flags = [state.currency !== null, state.orderState !== null, state.store.trim() !== ""];
  return flags.filter(Boolean).length;
}

export function statisticsPeriodRange(
  state: DeliveryStatisticsQueryState,
  today: string,
): StatisticsPeriodRange {
  return resolveStatisticsPeriod({
    custom: { from: state.from, to: state.to },
    preset: state.period,
    today,
  });
}

export function toDeliveryStatisticsParams(
  state: DeliveryStatisticsQueryState,
  today: string,
): BookOrdersControllerStatisticsParams {
  const store = state.store.trim();
  const range = statisticsPeriodRange(state, today);
  const compare = resolveStatisticsCompareMode(state, range);

  return {
    includeCancelled: state.includeCancelled ? "true" : "false",
    ...(state.currency === null ? {} : { currency: state.currency }),
    ...(state.orderState === null ? {} : { orderState: state.orderState }),
    ...(store === "" ? {} : { store }),
    ...(range.from === null ? {} : { from: range.from }),
    ...(range.to === null ? {} : { to: range.to }),
    ...(compare === null ? {} : { compare }),
  };
}

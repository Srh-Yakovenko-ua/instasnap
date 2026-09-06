import type {
  BookOrderStatisticsView,
  Currency,
  CurrencyAverage,
  CurrencyDelta,
  CurrencyTotal,
  Nullable,
} from "@app/shared";

import { CurrencySchema } from "@app/shared";

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

export function currencyAverageOf(
  averages: readonly CurrencyAverage[],
  currency: Currency,
): Nullable<number> {
  return averages.find((entry) => entry.currency === currency)?.average ?? null;
}

export function currencyDeltaOf(
  deltas: readonly CurrencyDelta[] | undefined,
  currency: Currency,
): Nullable<CurrencyDelta> {
  return deltas?.find((entry) => entry.currency === currency) ?? null;
}

export function currencyTotalOf(
  totals: readonly CurrencyTotal[],
  currency: Currency,
): Nullable<number> {
  return totals.find((entry) => entry.currency === currency)?.total ?? null;
}

export function otherCurrencyTotals(
  totals: readonly CurrencyTotal[],
  currency: Currency,
): CurrencyTotal[] {
  return totals.filter((entry) => entry.currency !== currency);
}

export function statisticsCurrencies(view: BookOrderStatisticsView): Currency[] {
  const present = new Set<Currency>();

  for (const entry of view.summary.totalsByCurrency) present.add(entry.currency);
  for (const entry of view.summary.activeTotalsByCurrency) present.add(entry.currency);
  for (const entry of view.topOrdersByCurrency) {
    if (entry.orders.length > 0) present.add(entry.currency);
  }
  for (const month of view.monthly) {
    for (const entry of month.totalsByCurrency) present.add(entry.currency);
  }

  return CURRENCY_ORDER.filter((currency) => present.has(currency));
}

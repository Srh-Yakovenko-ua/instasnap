import type {
  Currency,
  Nullable,
  StatisticsDynamics,
  StatisticsDynamicsBucket,
  StatisticsDynamicsFacts,
} from "@app/shared";

import { parseISO } from "date-fns";

import { currencyTotalOf } from "./statistics-currency";

export const DYNAMICS_METRICS = ["spend", "orders", "books"] as const;

export type DynamicsMetric = (typeof DYNAMICS_METRICS)[number];

export type DynamicsPoint = {
  bucket: StatisticsDynamicsBucket;
  comparisonValue: Nullable<number>;
  key: string;
  label: string;
  value: number;
};

const MONTH_KEY_LENGTH = 7;

export function bucketLabel({
  bucket,
  granularity,
  locale,
}: {
  bucket: StatisticsDynamicsFacts;
  granularity: StatisticsDynamics["granularity"];
  locale: string;
}): string {
  if (granularity === "month") {
    return monthLabel(bucket.from.slice(0, MONTH_KEY_LENGTH), locale, false);
  }

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).formatRange(
    parseISO(bucket.from),
    parseISO(bucket.to),
  );
}

export function bucketRange({
  bucket,
  locale,
}: {
  bucket: StatisticsDynamicsFacts;
  locale: string;
}): string {
  return dayRange({ from: bucket.from, locale, to: bucket.to });
}

export function dayRange({
  from,
  locale,
  to,
}: {
  from: string;
  locale: string;
  to: string;
}): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatRange(parseISO(from), parseISO(to));
}

export function dynamicsPoints({
  currency,
  dynamics,
  locale,
  metric,
}: {
  currency: Currency;
  dynamics: StatisticsDynamics;
  locale: string;
  metric: DynamicsMetric;
}): DynamicsPoint[] {
  return dynamics.buckets.map((bucket) => ({
    bucket,
    comparisonValue:
      bucket.comparison === null
        ? null
        : metricValue({ currency, facts: bucket.comparison, metric }),
    key: bucket.key,
    label: bucketLabel({ bucket: bucket.current, granularity: dynamics.granularity, locale }),
    value: metricValue({ currency, facts: bucket.current, metric }),
  }));
}

export function isMoneyMetric(metric: DynamicsMetric): boolean {
  return metric === "spend";
}

export function monthLabel(monthKey: string, locale: string, long: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    month: long ? "long" : "short",
    year: "numeric",
  }).format(parseISO(`${monthKey}-01`));
}

export function percentChange({
  current,
  previous,
}: {
  current: number;
  previous: Nullable<number>;
}): Nullable<number> {
  if (previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function metricValue({
  currency,
  facts,
  metric,
}: {
  currency: Currency;
  facts: StatisticsDynamicsFacts;
  metric: DynamicsMetric;
}): number {
  if (metric === "books") return facts.booksCount;
  if (metric === "orders") return facts.ordersCount;
  return currencyTotalOf(facts.totalsByCurrency, currency) ?? 0;
}

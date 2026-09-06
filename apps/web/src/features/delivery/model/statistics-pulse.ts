import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulse,
  BookOrderStatisticsPulseSignal,
  Currency,
  Nullable,
} from "@app/shared";

import type { DynamicsMetric } from "./statistics-dynamics";

export function pulseBucketKey(signal: BookOrderStatisticsPulseSignal): Nullable<string> {
  return signal.code === "record_books_bucket" || signal.code === "record_orders_bucket"
    ? signal.bucketKey
    : null;
}

export function pulseDirection(absoluteDelta: Nullable<number>): "down" | "flat" | "up" {
  if (absoluteDelta === null || absoluteDelta === 0) return "flat";
  return absoluteDelta > 0 ? "up" : "down";
}

export function pulseSignalsFor({
  currency,
  insights,
  metric,
}: {
  currency: Currency;
  insights: BookOrderStatisticsInsights;
  metric: DynamicsMetric;
}): BookOrderStatisticsPulse {
  if (metric === "orders") return insights.orders;
  if (metric === "books") return insights.books;
  return insights.spendByCurrency.find((group) => group.currency === currency)?.signals ?? [];
}

export function signedPercent({
  absoluteDelta,
  percentDelta,
}: {
  absoluteDelta: Nullable<number>;
  percentDelta: Nullable<number>;
}): Nullable<{ direction: "down" | "flat" | "up"; magnitude: number }> {
  if (percentDelta === null) return null;
  return { direction: pulseDirection(absoluteDelta), magnitude: Math.abs(percentDelta) };
}

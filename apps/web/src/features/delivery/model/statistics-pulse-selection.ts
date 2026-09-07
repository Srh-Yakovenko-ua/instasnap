import type {
  BookOrderStatisticsBestValueStore,
  BookOrderStatisticsInsights,
  BookOrderStatisticsOrderIdentity,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsRecordMonth,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  BookOrderStatisticsStoreLeader,
  BookOrderStatisticsTopOrder,
  Currency,
} from "@app/shared";

import { normalizeName } from "@app/shared";

import type { DynamicsMetric } from "./statistics-dynamics";

import { pulseSignalsFor } from "./statistics-pulse";

export type PulseEntry =
  | {
      fact: PulseRecordFact;
      identity: string;
      scope: BookOrderStatisticsRecordScope;
      source: "record";
    }
  | { identity: string; signal: BookOrderStatisticsPulseSignal; source: "signal" };

export type PulseRecordFact =
  | { bestValue: BookOrderStatisticsBestValueStore; code: "best_value_store" }
  | { code: "largest_order"; order: BookOrderStatisticsTopOrder }
  | { code: "most_active_store_by_books"; leader: BookOrderStatisticsStoreLeader }
  | { code: "most_active_store_by_orders"; leader: BookOrderStatisticsStoreLeader }
  | { code: "most_books_in_order"; order: BookOrderStatisticsOrderIdentity }
  | { code: "record_month"; recordMonth: BookOrderStatisticsRecordMonth };

export const PULSE_SELECTION = {
  identity: { recordMonth: "record-month" },
  rowLimit: { comparison: 4, period: 3 },
  signalMode: {
    average_books_per_order_change: "change",
    avg_book_price_change: "change",
    avg_landed_cost_change: "change",
    books_count_change: "change",
    delivery_share: "both",
    discount_savings: "both",
    orders_count_change: "change",
    record_books_bucket: "period",
    record_month: "period",
    record_orders_bucket: "period",
    spend_change: "change",
    store_movement: "change",
  },
} as const satisfies {
  identity: { recordMonth: string };
  rowLimit: { comparison: number; period: number };
  signalMode: Record<BookOrderStatisticsPulseSignal["code"], "both" | "change" | "period">;
};

export function selectPulseEntries({
  currency,
  hasComparison,
  insights,
  metric,
  records,
}: {
  currency: Currency;
  hasComparison: boolean;
  insights: BookOrderStatisticsInsights;
  metric: DynamicsMetric;
  records: BookOrderStatisticsRecords;
}): PulseEntry[] {
  const signals = pulseSignalsFor({ currency, insights, metric });

  if (hasComparison) {
    const changes = signals.filter(showsWhen("change"));
    const shown = changes.length === 0 ? signals.filter(showsWhen("period")) : changes;

    return takeDistinct(shown.map(signalEntry), {
      limit: PULSE_SELECTION.rowLimit.comparison,
    });
  }

  const topUps = recordFactsFor({ currency, metric, records }).map((fact) =>
    recordEntry(fact, records.scope),
  );

  return takeDistinct([...signals.filter(showsWhen("period")).map(signalEntry), ...topUps], {
    limit: PULSE_SELECTION.rowLimit.period,
  });
}

function bestValueFacts(
  records: BookOrderStatisticsRecords,
  currency: Currency,
): PulseRecordFact[] {
  const bestValue = records.bestValueStoreByCurrency.find((entry) => entry.currency === currency);
  return bestValue === undefined ? [] : [{ bestValue, code: "best_value_store" }];
}

function largestOrderFacts(
  records: BookOrderStatisticsRecords,
  currency: Currency,
): PulseRecordFact[] {
  const largest = records.largestOrderByCurrency.find((entry) => entry.currency === currency);
  return largest === undefined ? [] : [{ code: "largest_order", order: largest.order }];
}

function mostActiveByBooksFacts(records: BookOrderStatisticsRecords): PulseRecordFact[] {
  const leader = records.mostActiveStore.byBooks;
  return leader === null ? [] : [{ code: "most_active_store_by_books", leader }];
}

function mostActiveByOrdersFacts(records: BookOrderStatisticsRecords): PulseRecordFact[] {
  const leader = records.mostActiveStore.byOrders;
  return leader === null ? [] : [{ code: "most_active_store_by_orders", leader }];
}

function mostBooksInOrderFacts(records: BookOrderStatisticsRecords): PulseRecordFact[] {
  const order = records.mostBooksInOrder;
  return order === null ? [] : [{ code: "most_books_in_order", order }];
}

function recordEntry(fact: PulseRecordFact, scope: BookOrderStatisticsRecordScope): PulseEntry {
  return { fact, identity: recordFactIdentity(fact), scope, source: "record" };
}

function recordFactIdentity(fact: PulseRecordFact): string {
  switch (fact.code) {
    case "best_value_store":
      return storeIdentity(fact.bestValue.store);
    case "largest_order":
    case "most_books_in_order":
      return `order:${fact.order.id}`;
    case "most_active_store_by_books":
    case "most_active_store_by_orders":
      return storeIdentity(fact.leader.store);
    case "record_month":
      return PULSE_SELECTION.identity.recordMonth;
  }
}

function recordFactsFor({
  currency,
  metric,
  records,
}: {
  currency: Currency;
  metric: DynamicsMetric;
  records: BookOrderStatisticsRecords;
}): PulseRecordFact[] {
  if (metric === "books") {
    return [...mostBooksInOrderFacts(records), ...mostActiveByBooksFacts(records)];
  }

  if (metric === "orders") {
    return [...mostActiveByOrdersFacts(records), ...largestOrderFacts(records, currency)];
  }

  return [
    ...recordMonthFacts(records, currency),
    ...largestOrderFacts(records, currency),
    ...bestValueFacts(records, currency),
  ];
}

function recordMonthFacts(
  records: BookOrderStatisticsRecords,
  currency: Currency,
): PulseRecordFact[] {
  const recordMonth = records.recordMonthByCurrency.find((entry) => entry.currency === currency);
  return recordMonth === undefined ? [] : [{ code: "record_month", recordMonth }];
}

function showsWhen(mode: "change" | "period") {
  return (signal: BookOrderStatisticsPulseSignal): boolean => {
    const signalMode = PULSE_SELECTION.signalMode[signal.code];
    return signalMode === "both" || signalMode === mode;
  };
}

function signalEntry(signal: BookOrderStatisticsPulseSignal): PulseEntry {
  return { identity: signalIdentity(signal), signal, source: "signal" };
}

function signalIdentity(signal: BookOrderStatisticsPulseSignal): string {
  switch (signal.code) {
    case "average_books_per_order_change":
    case "avg_book_price_change":
    case "avg_landed_cost_change":
    case "books_count_change":
    case "delivery_share":
    case "discount_savings":
    case "orders_count_change":
    case "spend_change":
      return `signal:${signal.code}`;
    case "record_books_bucket":
    case "record_orders_bucket":
      return `bucket:${signal.bucketKey}`;
    case "record_month":
      return PULSE_SELECTION.identity.recordMonth;
    case "store_movement":
      return storeIdentity(signal.store);
  }
}

function storeIdentity(store: string): string {
  return `store:${normalizeName(store)}`;
}

function takeDistinct(entries: PulseEntry[], { limit }: { limit: number }): PulseEntry[] {
  const seen = new Set<string>();
  const kept: PulseEntry[] = [];

  for (const entry of entries) {
    if (kept.length === limit) break;
    if (seen.has(entry.identity)) continue;
    seen.add(entry.identity);
    kept.push(entry);
  }

  return kept;
}

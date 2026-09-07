"use client";

import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsPulseTone,
  BookOrderStatisticsRecords,
  BookOrderStatisticsRecordScope,
  Currency,
  Nullable,
} from "@app/shared";
import type { LucideIcon } from "lucide-react";

import {
  BadgePercent,
  BookMarked,
  BookOpen,
  CalendarDays,
  Coins,
  Flame,
  Library,
  PiggyBank,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trophy,
  Truck,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { StatCardIconTone } from "@/components/ui/stat-card";

import { statCardIconBadge } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";
import type { PulseRecordFact } from "../../model/statistics-pulse-selection";

import { formatMoney } from "../../model/money-format";
import { dayRange, monthLabel } from "../../model/statistics-dynamics";
import { formatPercentValue } from "../../model/statistics-format";
import { pulseBucketKey, signedPercent } from "../../model/statistics-pulse";
import { selectPulseEntries } from "../../model/statistics-pulse-selection";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

type PulseRow = {
  bucketKey: Nullable<string>;
  helper: string;
  icon: LucideIcon;
  key: string;
  label: string;
  tone: StatCardIconTone;
  value: string;
};

function PulseRowBody({ row }: { row: PulseRow }) {
  const Icon = row.icon;

  return (
    <>
      <span
        className={cn(statCardIconBadge({ tone: row.tone }), "mt-0.5 size-7 [&_svg]:size-[15px]")}
      >
        <Icon aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{row.label}</span>
        <span className="truncate text-base font-semibold text-ink tabular-nums">{row.value}</span>
        <span className="text-xs text-muted-foreground">{row.helper}</span>
      </span>
    </>
  );
}

const SIGN = { down: "−", flat: "", up: "+" } as const;

const META_SEPARATOR = " · ";

const PULSE_ROW = {
  frame: "flex min-h-[4.875rem] w-full items-start gap-2.5 rounded-lg px-1.5 py-2",
  interactive:
    "cursor-pointer text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
} as const;

const PULSE_BADGE = {
  icon: {
    average_books_per_order_change: ShoppingCart,
    avg_book_price_change: BookMarked,
    avg_landed_cost_change: Coins,
    books_count_change: BookOpen,
    delivery_share: Truck,
    discount_savings: BadgePercent,
    orders_count_change: ShoppingBag,
    record_books_bucket: Flame,
    record_month: CalendarDays,
    record_orders_bucket: Flame,
    spend_change: Wallet,
    store_movement: Store,
  },
  recordIcon: {
    best_value_store: PiggyBank,
    largest_order: Trophy,
    most_active_store_by_books: Store,
    most_active_store_by_orders: Store,
    most_books_in_order: Library,
    record_month: CalendarDays,
  },
  recordTone: "ink",
  tone: {
    attention: "favorite",
    neutral: "ink",
    positive: "success",
  },
} as const satisfies {
  icon: Record<BookOrderStatisticsPulseSignal["code"], LucideIcon>;
  recordIcon: Record<PulseRecordFact["code"], LucideIcon>;
  recordTone: StatCardIconTone;
  tone: Record<BookOrderStatisticsPulseTone, StatCardIconTone>;
};

export function StatisticsPulse({
  comparisonLabel,
  currency,
  highlightedBucketKey,
  insights,
  metric,
  onHighlightBucket,
  records,
}: {
  comparisonLabel: Nullable<string>;
  currency: Currency;
  highlightedBucketKey: Nullable<string>;
  insights: BookOrderStatisticsInsights;
  metric: DynamicsMetric;
  onHighlightBucket: (bucketKey: Nullable<string>) => void;
  records: BookOrderStatisticsRecords;
}) {
  const t = useTranslations("delivery.statistics.pulse");
  const tRecords = useTranslations("delivery.statistics.records");
  const locale = useLocale();

  const hasComparison = comparisonLabel !== null;
  const comparison = comparisonLabel ?? t("previousPeriod");
  const entries = selectPulseEntries({ currency, hasComparison, insights, metric, records });

  const money = (amount: number, signalCurrency: Currency) =>
    formatMoney({ amount, currency: signalCurrency, locale });
  const percent = (value: number) => formatPercentValue(value, locale);
  const range = (from: string, to: string) => dayRange({ from, locale, to });
  const metaLine = (parts: string[]) => parts.filter((part) => part !== "").join(META_SEPARATOR);
  const recordMonthHelper = (scope: BookOrderStatisticsRecordScope) =>
    t(
      scope.isPeriodFiltered || scope.isTruncated
        ? "helpers.recordMonthPeriod"
        : "helpers.recordMonthAllTime",
    );

  const changeRow = (
    signal: Extract<
      BookOrderStatisticsPulseSignal,
      {
        code:
          | "average_books_per_order_change"
          | "avg_book_price_change"
          | "avg_landed_cost_change"
          | "books_count_change"
          | "orders_count_change"
          | "spend_change";
      }
    >,
  ) => {
    const change = signedPercent(signal);
    return {
      helper:
        change === null || change.direction === "flat"
          ? t("helpers.noChange", { comparison })
          : t("helpers.againstComparison", { comparison }),
      label: t(`labels.${signal.code}`),
      value: change === null ? "—" : `${SIGN[change.direction]}${percent(change.magnitude)}`,
    };
  };

  const signalContent = (signal: BookOrderStatisticsPulseSignal) => {
    switch (signal.code) {
      case "average_books_per_order_change":
      case "avg_book_price_change":
      case "avg_landed_cost_change":
      case "books_count_change":
      case "orders_count_change":
      case "spend_change":
        return changeRow(signal);

      case "delivery_share":
        return {
          helper: t("helpers.deliveryShare", {
            total: money(signal.deliveryTotal, signal.currency),
          }),
          label: t("labels.delivery_share"),
          value: percent(signal.deliveryShareOfSpendPercent),
        };

      case "discount_savings":
        return {
          helper:
            signal.discountShareOfRawSubtotalPercent === null
              ? t("helpers.discountPlain")
              : t("helpers.discountWithPercent", {
                  percent: percent(signal.discountShareOfRawSubtotalPercent),
                }),
          label: t("labels.discount_savings"),
          value: money(signal.discountTotal, signal.currency),
        };

      case "record_books_bucket":
        return {
          helper: t("helpers.recordBooks"),
          label: range(signal.from, signal.to),
          value: t("units.books", { count: signal.booksCount }),
        };

      case "record_month":
        return {
          helper: recordMonthHelper(signal.scope),
          label: monthLabel(signal.month, locale, true),
          value: money(signal.total, signal.currency),
        };

      case "record_orders_bucket":
        return {
          helper: t("helpers.recordOrders"),
          label: range(signal.from, signal.to),
          value: t("units.orders", { count: signal.ordersCount }),
        };

      case "store_movement": {
        const change = signedPercent(signal);
        return {
          helper: t("helpers.againstComparison", { comparison }),
          label: signal.store,
          value:
            change === null
              ? money(signal.absoluteDelta ?? 0, signal.currency)
              : `${SIGN[change.direction]}${percent(change.magnitude)}`,
        };
      }
    }
  };

  const recordContent = (fact: PulseRecordFact, scope: BookOrderStatisticsRecordScope) => {
    switch (fact.code) {
      case "best_value_store":
        return {
          helper: tRecords("bestValue.helper", {
            count: fact.bestValue.eligibleBooksCount,
            store: fact.bestValue.store,
          }),
          label: tRecords("bestValue.title"),
          value: money(fact.bestValue.averageLandedBookCost, currency),
        };

      case "largest_order":
        return {
          helper: metaLine([
            fact.order.storeName,
            tRecords("books", { count: fact.order.booksCount }),
          ]),
          label: tRecords("largestOrder.title"),
          value: money(fact.order.totalAmount, currency),
        };

      case "most_active_store_by_books":
        return {
          helper: t("units.books", { count: fact.leader.booksCount }),
          label: tRecords("mostActiveByBooks.title"),
          value: fact.leader.store,
        };

      case "most_active_store_by_orders":
        return {
          helper: t("units.orders", { count: fact.leader.ordersCount }),
          label: tRecords("mostActive.title"),
          value: fact.leader.store,
        };

      case "most_books_in_order":
        return {
          helper: metaLine([fact.order.storeName]),
          label: tRecords("mostBooks.title"),
          value: tRecords("mostBooks.value", { count: fact.order.booksCount }),
        };

      case "record_month":
        return {
          helper: recordMonthHelper(scope),
          label: monthLabel(fact.recordMonth.month, locale, true),
          value: money(fact.recordMonth.total, currency),
        };
    }
  };

  const rows: PulseRow[] = entries.map((entry) => {
    if (entry.source === "record") {
      return {
        ...recordContent(entry.fact, entry.scope),
        bucketKey: null,
        icon: PULSE_BADGE.recordIcon[entry.fact.code],
        key: entry.identity,
        tone: PULSE_BADGE.recordTone,
      };
    }

    return {
      ...signalContent(entry.signal),
      bucketKey: pulseBucketKey(entry.signal),
      icon: PULSE_BADGE.icon[entry.signal.code],
      key: entry.identity,
      tone: PULSE_BADGE.tone[entry.signal.tone],
    };
  });

  return (
    <StatisticsSection
      contentClassName="gap-3"
      description={t(hasComparison ? "subtitleComparison" : "subtitlePeriod", {
        period: comparisonLabel ?? "",
      })}
      title={t(hasComparison ? "titleComparison" : "titlePeriod")}
    >
      {rows.length === 0 ? (
        <StatisticsSectionState
          kind="insufficient"
          title={t(hasComparison ? "emptyComparison" : "emptyPeriod")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const isHighlighted = row.bucketKey !== null && row.bucketKey === highlightedBucketKey;

            return (
              <li
                className={cn("rounded-lg transition-colors", isHighlighted && "bg-accent")}
                key={row.key}
                onMouseEnter={() => onHighlightBucket(row.bucketKey)}
                onMouseLeave={() => onHighlightBucket(null)}
              >
                {row.bucketKey === null ? (
                  <span className={PULSE_ROW.frame}>
                    <PulseRowBody row={row} />
                  </span>
                ) : (
                  <button
                    className={cn(PULSE_ROW.frame, PULSE_ROW.interactive)}
                    onBlur={() => onHighlightBucket(null)}
                    onClick={() => onHighlightBucket(row.bucketKey)}
                    onFocus={() => onHighlightBucket(row.bucketKey)}
                    type="button"
                  >
                    <PulseRowBody row={row} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </StatisticsSection>
  );
}

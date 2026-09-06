"use client";

import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsPulseTone,
  Currency,
  Nullable,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import { formatMoney } from "../../model/money-format";
import { dayRange, monthLabel } from "../../model/statistics-dynamics";
import { formatPercentValue } from "../../model/statistics-format";
import { pulseBucketKey, pulseSignalsFor, signedPercent } from "../../model/statistics-pulse";
import { StatisticsSectionState } from "./statistics-states";

type PulseRow = {
  bucketKey: Nullable<string>;
  helper: string;
  label: string;
  tone: BookOrderStatisticsPulseTone;
  value: string;
};

function PulseRowBody({ row }: { row: PulseRow }) {
  const tone = TONE_STYLE[row.tone];

  return (
    <>
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
          tone.className,
        )}
      >
        <UiIcon name={tone.icon} size={15} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{row.label}</span>
        <span className="text-base font-semibold text-ink tabular-nums">{row.value}</span>
        <span className="text-xs text-muted-foreground">{row.helper}</span>
      </span>
    </>
  );
}

const SIGN = { down: "−", flat: "", up: "+" } as const;

const TONE_STYLE: Record<BookOrderStatisticsPulseTone, { className: string; icon: UiIconName }> = {
  attention: { className: "bg-favorite-soft text-favorite", icon: "alert-circle" },
  neutral: { className: "bg-accent text-icon", icon: "info" },
  positive: { className: "bg-success-soft text-success", icon: "sparkles" },
};

export function StatisticsPulse({
  comparisonLabel,
  currency,
  highlightedBucketKey,
  insights,
  metric,
  onHighlightBucket,
}: {
  comparisonLabel: Nullable<string>;
  currency: Currency;
  highlightedBucketKey: Nullable<string>;
  insights: BookOrderStatisticsInsights;
  metric: DynamicsMetric;
  onHighlightBucket: (bucketKey: Nullable<string>) => void;
}) {
  const t = useTranslations("delivery.statistics.pulse");
  const locale = useLocale();

  const hasComparison = comparisonLabel !== null;
  const comparison = comparisonLabel ?? t("previousPeriod");
  const signals = pulseSignalsFor({ currency, insights, metric });

  const money = (amount: number, signalCurrency: Currency) =>
    formatMoney({ amount, currency: signalCurrency, locale });
  const percent = (value: number) => formatPercentValue(value, locale);
  const range = (from: string, to: string) => dayRange({ from, locale, to });

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
  ): PulseRow => {
    const change = signedPercent(signal);
    return {
      bucketKey: null,
      helper:
        change === null || change.direction === "flat"
          ? t("helpers.noChange", { comparison })
          : t("helpers.againstComparison", { comparison }),
      label: t(`labels.${signal.code}`),
      tone: signal.tone,
      value: change === null ? "—" : `${SIGN[change.direction]}${percent(change.magnitude)}`,
    };
  };

  const rows: PulseRow[] = signals.map((signal) => {
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
          bucketKey: null,
          helper: t("helpers.deliveryShare", {
            total: money(signal.deliveryTotal, signal.currency),
          }),
          label: t("labels.delivery_share"),
          tone: signal.tone,
          value: percent(signal.deliveryShareOfSpendPercent),
        };

      case "discount_savings":
        return {
          bucketKey: null,
          helper:
            signal.discountShareOfRawSubtotalPercent === null
              ? t("helpers.discountPlain")
              : t("helpers.discountWithPercent", {
                  percent: percent(signal.discountShareOfRawSubtotalPercent),
                }),
          label: t("labels.discount_savings"),
          tone: signal.tone,
          value: money(signal.discountTotal, signal.currency),
        };

      case "record_books_bucket":
        return {
          bucketKey: signal.bucketKey,
          helper: t("helpers.recordBooks"),
          label: range(signal.from, signal.to),
          tone: signal.tone,
          value: t("units.books", { count: signal.booksCount }),
        };

      case "record_month":
        return {
          bucketKey: null,
          helper: t(
            signal.scope.isPeriodFiltered || signal.scope.isTruncated
              ? "helpers.recordMonthPeriod"
              : "helpers.recordMonthAllTime",
          ),
          label: monthLabel(signal.month, locale, true),
          tone: signal.tone,
          value: money(signal.total, signal.currency),
        };

      case "record_orders_bucket":
        return {
          bucketKey: signal.bucketKey,
          helper: t("helpers.recordOrders"),
          label: range(signal.from, signal.to),
          tone: signal.tone,
          value: t("units.orders", { count: signal.ordersCount }),
        };

      case "store_movement": {
        const change = signedPercent(signal);
        return {
          bucketKey: null,
          helper: t("helpers.againstComparison", { comparison }),
          label: signal.store,
          tone: signal.tone,
          value:
            change === null
              ? money(signal.absoluteDelta ?? 0, signal.currency)
              : `${SIGN[change.direction]}${percent(change.magnitude)}`,
        };
      }
    }
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-[0.9375rem] font-semibold text-ink">
          {t(hasComparison ? "titleComparison" : "titlePeriod")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(hasComparison ? "subtitleComparison" : "subtitlePeriod", {
            period: comparisonLabel ?? "",
          })}
        </p>
      </div>

      {rows.length === 0 ? (
        <StatisticsSectionState
          kind="insufficient"
          title={t(hasComparison ? "emptyComparison" : "emptyPeriod")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {signals.map((signal, index) => {
            const row = rows[index];
            if (row === undefined) return null;
            const isHighlighted = row.bucketKey !== null && row.bucketKey === highlightedBucketKey;

            return (
              <li
                className={cn("rounded-lg transition-colors", isHighlighted && "bg-accent")}
                key={`${signal.code}-${pulseBucketKey(signal) ?? index}`}
                onMouseEnter={() => onHighlightBucket(row.bucketKey)}
                onMouseLeave={() => onHighlightBucket(null)}
              >
                {row.bucketKey === null ? (
                  <span className="flex items-start gap-2.5 px-1.5 py-1">
                    <PulseRowBody row={row} />
                  </span>
                ) : (
                  <button
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
    </section>
  );
}

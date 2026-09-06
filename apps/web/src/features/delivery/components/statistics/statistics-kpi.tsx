"use client";

import type {
  BookOrderStatisticsFinancialCoverage,
  BookOrderStatisticsSnapshot,
  BookOrderStatisticsView,
  Currency,
  Nullable,
  NumericDelta,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { UiIcon } from "@/components/icons";
import { StatCard } from "@/components/ui/stat-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatMoney } from "../../model/money-format";
import {
  currencyAverageOf,
  currencyDeltaOf,
  currencyTotalOf,
  otherCurrencyTotals,
} from "../../model/statistics-currency";
import { toDeltaView } from "../../model/statistics-view-model";
import { StatisticsDelta } from "./statistics-delta";

const KPI_VALUE = {
  compactFromLength: 11,
  empty: "—",
} as const;

const EMPTY_VALUE = KPI_VALUE.empty;

type KpiCard = {
  caption: Nullable<string>;
  coverage: Nullable<string>;
  footer: Nullable<ReactNode>;
  helper: Nullable<string>;
  icon: UiIconName;
  key: "average" | "basket" | "snapshot" | "spend";
  tone: StatCardIconTone;
  value: Nullable<number>;
};

export function StatisticsKpi({
  currency,
  snapshot,
  view,
}: {
  currency: Currency;
  snapshot: BookOrderStatisticsSnapshot;
  view: BookOrderStatisticsView;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const locale = useLocale();
  const { comparison, summary } = view;

  const money = (amount: Nullable<number>) =>
    amount === null ? null : formatMoney({ amount, currency, locale });

  const captionOfOtherCurrencies = (
    totals: readonly { currency: Currency; total: number }[],
  ): Nullable<string> => {
    const others = otherCurrencyTotals(totals, currency);
    if (others.length === 0) return null;
    return t("otherCurrencies", {
      value: others
        .map((entry) => formatMoney({ amount: entry.total, currency: entry.currency, locale }))
        .join(" · "),
    });
  };

  const comparisonFooter = (delta: Nullable<NumericDelta>): Nullable<ReactNode> => {
    const deltaView = toDeltaView(delta);
    if (deltaView === null) return null;

    return (
      <StatisticsDelta
        className="text-xs"
        delta={deltaView}
        flatLabel={t("noChange")}
        previousText={
          deltaView.previous === null
            ? null
            : t("previous", {
                value: formatMoney({ amount: deltaView.previous, currency, locale }),
              })
        }
      />
    );
  };

  const financialCoverage = coverageOf(summary.financialCoverageByCurrency, currency);
  const activeCoverage = coverageOf(snapshot.activeMoneyCoverageByCurrency, currency);
  const priceCoverage = summary.priceCoverageByCurrency.find(
    (entry) => entry.currency === currency,
  );

  const periodCards: KpiCard[] = [
    {
      caption: captionOfOtherCurrencies(summary.totalsByCurrency),
      coverage:
        unresolvedOf(financialCoverage) === 0
          ? null
          : t("coverage.unresolvedOrders", {
              count: unresolvedOf(financialCoverage),
            }),
      footer: comparisonFooter(currencyDeltaOf(comparison?.totalsByCurrency, currency)),
      helper: null,
      icon: "wallet",
      key: "spend",
      tone: "primary",
      value: currencyTotalOf(summary.totalsByCurrency, currency),
    },
    {
      caption: null,
      coverage:
        priceCoverage === undefined || priceCoverage.booksWithPrice === priceCoverage.booksInScope
          ? null
          : t("coverage.pricedBooks", {
              counted: priceCoverage.booksWithPrice,
              total: priceCoverage.booksInScope,
            }),
      footer: comparisonFooter(currencyDeltaOf(comparison?.averageBookPriceByCurrency, currency)),
      helper: t("average.helper"),
      icon: "book",
      key: "average",
      tone: "genre",
      value: currencyAverageOf(summary.averageBookPriceByCurrency, currency),
    },
    {
      caption: null,
      coverage:
        financialCoverage === null ||
        financialCoverage.ordersWithResolvedAmount === financialCoverage.ordersInScope
          ? null
          : t("coverage.resolvedOrders", {
              counted: financialCoverage.ordersWithResolvedAmount,
              total: financialCoverage.ordersInScope,
            }),
      footer: comparisonFooter(currencyDeltaOf(comparison?.averageOrderAmountByCurrency, currency)),
      helper:
        summary.averageBooksPerOrder === null
          ? null
          : t("basket.helper", {
              value: formatNumber(summary.averageBooksPerOrder, locale, {
                maximumFractionDigits: 1,
              }),
            }),
      icon: "cart",
      key: "basket",
      tone: "tag",
      value: currencyAverageOf(summary.averageOrderAmountByCurrency, currency),
    },
  ];

  const snapshotCard: KpiCard = {
    caption: captionOfOtherCurrencies(snapshot.activeTotalsByCurrency),
    coverage:
      unresolvedOf(activeCoverage) === 0
        ? null
        : t("coverage.unresolvedActive", {
            count: unresolvedOf(activeCoverage),
          }),
    footer: (
      <span className="text-xs text-muted-foreground">
        {t("snapshotFact", {
          books: snapshot.activeBooksCount,
          orders: snapshot.activeOrdersCount,
          shipments: snapshot.activeShipmentsCount,
        })}
      </span>
    ),
    helper: null,
    icon: "truck",
    key: "snapshot",
    tone: "info",
    value: currencyTotalOf(snapshot.activeTotalsByCurrency, currency),
  };

  const secondary = [
    { delta: comparison?.ordersCount ?? null, key: "orders", value: summary.ordersCount },
    { delta: comparison?.booksCount ?? null, key: "books", value: summary.booksCount },
    { delta: comparison?.shipmentsCount ?? null, key: "shipments", value: summary.shipmentsCount },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScopeHeading className="sm:col-span-2 xl:col-span-3">{t("scope.period")}</ScopeHeading>
        {periodCards.map((card) => (
          <KpiCardBody card={card} currency={currency} key={card.key} money={money} />
        ))}
        <ScopeHeading className="sm:col-span-2 xl:col-span-1 xl:col-start-4 xl:row-start-1">
          {t("scope.now")}
        </ScopeHeading>
        <KpiCardBody card={snapshotCard} currency={currency} money={money} />
      </div>

      <ul className="flex flex-wrap items-center gap-2">
        {secondary.map((entry) => (
          <SecondaryChip
            delta={entry.delta}
            key={entry.key}
            label={t(`secondary.${entry.key}`)}
            value={entry.value}
          />
        ))}
      </ul>
    </div>
  );
}

function coverageOf(
  rows: readonly BookOrderStatisticsFinancialCoverage[],
  currency: Currency,
): Nullable<BookOrderStatisticsFinancialCoverage> {
  return rows.find((entry) => entry.currency === currency) ?? null;
}

function KpiCardBody({
  card,
  currency,
  money,
}: {
  card: KpiCard;
  currency: Currency;
  money: (amount: Nullable<number>) => Nullable<string>;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const value = money(card.value) ?? EMPTY_VALUE;

  return (
    <StatCard
      caption={card.caption ?? undefined}
      className="h-full"
      footer={card.footer ?? undefined}
      icon={card.icon}
      iconTone={card.tone}
      label={
        <span className="inline-flex items-center gap-1.5">
          {t(`${card.key}.label`)}
          <KpiHint text={t(`${card.key}.hint`)} />
        </span>
      }
      microfact={
        <span className="flex flex-col gap-1">
          {card.helper}
          {card.value === null ? (
            <span className="text-xs text-muted-foreground">
              {t("missingForCurrency", { currency })}
            </span>
          ) : null}
          {card.coverage === null ? null : (
            <span className="text-xs text-muted-foreground">{card.coverage}</span>
          )}
        </span>
      }
      value={value}
      valueClassName={
        value.length < KPI_VALUE.compactFromLength
          ? "whitespace-nowrap"
          : "text-2xl whitespace-nowrap"
      }
    />
  );
}

function KpiHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={text}
        className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
        type="button"
      >
        <UiIcon name="info" size={13} />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

function ScopeHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "self-end text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SecondaryChip({
  delta,
  label,
  value,
}: {
  delta: Nullable<NumericDelta>;
  label: string;
  value: Nullable<number>;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const locale = useLocale();
  const view = toDeltaView(delta);
  const previous =
    view === null || view.previous === null
      ? null
      : t("previousShort", { value: formatNumber(view.previous, locale) });
  const chip = (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.8125rem]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-ink tabular-nums">
        {value === null ? EMPTY_VALUE : formatNumber(value, locale, { maximumFractionDigits: 1 })}
      </span>
      <StatisticsDelta delta={view} flatLabel="" previousText={null} />
    </li>
  );

  if (previous === null) {
    return chip;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{previous}</TooltipContent>
    </Tooltip>
  );
}

function unresolvedOf(coverage: Nullable<BookOrderStatisticsFinancialCoverage>): number {
  return coverage === null ? 0 : coverage.ordersInScope - coverage.ordersWithResolvedAmount;
}

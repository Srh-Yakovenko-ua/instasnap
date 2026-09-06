"use client";

import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StoreMetric, StoreRow } from "../../model/statistics-stores";

import { formatMoney } from "../../model/money-format";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { isMoneyStoreMetric, STORE_METRICS, storeRows } from "../../model/statistics-stores";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsDrilldownAction } from "./statistics-drilldown-action";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const BAR = { fullWidth: 100, minWidth: 4 } as const;

const VISIBLE_ROWS = 6;

export function StatisticsStores({
  currency,
  drilldown,
  highlightedStoreKey,
  onHighlight,
  stores,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  highlightedStoreKey: Nullable<string>;
  onHighlight: (storeKey: Nullable<string>) => void;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.stores");
  const [metric, setMetric] = useState<StoreMetric>("spend");
  const [expanded, setExpanded] = useState(false);

  const rows = storeRows({ currency, metric, stores });
  const visible = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const isMoney = isMoneyStoreMetric(metric);

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={STORE_METRICS}
            onChange={setMetric}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {isMoney ? <StatisticsCurrencyBadge currency={currency} /> : null}
        </div>
      }
      description={t(`subtitles.${metric}`)}
      title={t("title")}
    >
      {rows.length === 0 ? (
        <StatisticsSectionState
          kind="empty"
          title={isMoney ? t("emptyForCurrency", { currency }) : t("empty")}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {visible.map((row) => (
              <StoreListRow
                currency={currency}
                drilldown={drilldown}
                isHighlighted={row.storeKey === highlightedStoreKey}
                key={row.storeKey}
                metric={metric}
                onHighlight={onHighlight}
                row={row}
              />
            ))}
          </ul>
          {rows.length > VISIBLE_ROWS ? (
            <Button
              className="self-start"
              onClick={() => setExpanded((value) => !value)}
              size="sm"
              variant="ghost"
            >
              {expanded ? t("showLess") : t("showAll", { count: rows.length })}
            </Button>
          ) : null}
        </>
      )}
    </StatisticsSection>
  );
}

const COUNT_LABELS = {
  books: { primary: "countsOrders", secondary: "countsBooks" },
  orders: { primary: "countsBooks", secondary: "countsOrders" },
} as const;

function StoreListRow({
  currency,
  drilldown,
  isHighlighted,
  metric,
  onHighlight,
  row,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  isHighlighted: boolean;
  metric: StoreMetric;
  onHighlight: (storeKey: Nullable<string>) => void;
  row: StoreRow;
}) {
  const t = useTranslations("delivery.statistics.stores");
  const locale = useLocale();

  const isMoney = isMoneyStoreMetric(metric);
  const money = (amount: number) => formatMoney({ amount, currency, locale });
  const countLabels = metric === "spend" ? null : COUNT_LABELS[metric];
  const counted = { books: row.booksCount, orders: row.ordersCount };
  const value = countLabels === null ? money(row.value) : t(countLabels.primary, counted);
  const links = statisticsDrilldownLinks({
    breakdown: row.drilldown,
    context: drilldown,
    metricKind: isMoney
      ? STATISTICS_METRIC_KIND.currencySpecificMoney
      : STATISTICS_METRIC_KIND.countOrStatus,
    scope: { kind: "store", store: row.store },
  });

  const counts = t(countLabels === null ? "counts" : countLabels.secondary, counted);
  const booksPerOrder =
    isMoney || row.booksPerOrder === null
      ? null
      : t("booksPerOrder", {
          value: formatNumber(row.booksPerOrder, locale, { maximumFractionDigits: 1 }),
        });

  return (
    <li
      className="flex flex-col gap-1.5"
      onBlur={() => onHighlight(null)}
      onFocus={() => onHighlight(row.storeKey)}
      onMouseEnter={() => onHighlight(row.storeKey)}
      onMouseLeave={() => onHighlight(null)}
    >
      <StatisticsDrilldownAction
        className={cn(
          "flex flex-col gap-1.5 rounded-md px-1.5 py-1 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isHighlighted && "bg-accent",
        )}
        label={row.store}
        links={links}
        unit={metric === "books" ? "books" : "orders"}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{row.store}</span>
          <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{value}</span>
        </span>
        <span className="block h-2 w-full overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary/70"
            style={{ width: `${Math.max(row.share * BAR.fullWidth, BAR.minWidth)}%` }}
          />
        </span>
      </StatisticsDrilldownAction>

      <span className="flex flex-wrap items-center gap-x-2 px-1.5 text-xs text-muted-foreground">
        <span>{[counts, booksPerOrder].filter((part) => part !== null).join(" · ")}</span>
        {isMoney ? <StoreMoneyDetails money={money} row={row} /> : null}
      </span>
    </li>
  );
}

function StoreMoneyDetails({ money, row }: { money: (amount: number) => string; row: StoreRow }) {
  const t = useTranslations("delivery.statistics.stores");

  return (
    <>
      {row.averageLandedBookCost === null ? null : (
        <span>{t("landed", { value: money(row.averageLandedBookCost) })}</span>
      )}
      {row.averageOrderAmount === null ? null : (
        <span>{t("perOrder", { value: money(row.averageOrderAmount) })}</span>
      )}
      {row.averageBookPrice === null ? null : (
        <Tooltip>
          <TooltipTrigger
            className="cursor-help underline decoration-dotted underline-offset-2"
            type="button"
          >
            {t("rawPrice")}
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <p>{t("rawPriceValue", { value: money(row.averageBookPrice) })}</p>
            <p className="mt-1 text-muted-foreground">{t("rawPriceHint")}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

"use client";

import type {
  BookOrderStatisticsBestValueStoreByCurrency,
  BookOrderStatisticsStore,
  Currency,
  Nullable,
} from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type {
  StatisticsDrilldownContext,
  StatisticsDrilldownLink,
} from "../../model/statistics-drilldown";
import type { StoreMetric, StoreRow } from "../../model/statistics-stores";
import type { StatisticsDrilldownUnit } from "./statistics-drilldown-action";

import { formatMoney } from "../../model/money-format";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { isMoneyStoreMetric, storeRows } from "../../model/statistics-stores";
import { StatisticsDrilldownMenuContent } from "./statistics-drilldown-action";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const BAR = { fullWidth: 100, minWidth: 4 } as const;

const STORE_LIST = {
  badge:
    "inline-flex shrink-0 cursor-help items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-medium text-accent-foreground",
  badgeIconSize: 12,
  pageSize: 5,
  rank: "grid size-7 shrink-0 place-items-center self-start rounded-full border border-transparent bg-secondary text-xs font-semibold text-muted-foreground tabular-nums",
} as const;

export function StatisticsStores({
  bestValueStores,
  currency,
  drilldown,
  highlightedStoreKey,
  metric,
  onHighlight,
  stores,
}: {
  bestValueStores: BookOrderStatisticsBestValueStoreByCurrency;
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  highlightedStoreKey: Nullable<string>;
  metric: StoreMetric;
  onHighlight: (storeKey: Nullable<string>) => void;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.stores");
  const [page, setPage] = useState(1);
  const [seenMetric, setSeenMetric] = useState(metric);

  if (seenMetric !== metric) {
    setSeenMetric(metric);
    setPage(1);
  }

  const rows = storeRows({ currency, metric, stores });
  const isMoney = isMoneyStoreMetric(metric);
  const bestValueStoreKey = isMoney
    ? (bestValueStores.find((entry) => entry.currency === currency)?.storeKey ?? null)
    : null;

  const pageCount = Math.max(1, Math.ceil(rows.length / STORE_LIST.pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * STORE_LIST.pageSize;
  const visible = rows.slice(firstIndex, firstIndex + STORE_LIST.pageSize);

  const pagination =
    rows.length <= STORE_LIST.pageSize ? undefined : (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("pageRange", {
            from: firstIndex + 1,
            to: firstIndex + visible.length,
            total: rows.length,
          })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Button
            aria-label={t("previousPage")}
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="chevron-left" size={16} />
          </Button>
          <Button
            aria-label={t("nextPage")}
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="chevron-right" size={16} />
          </Button>
        </span>
      </span>
    );

  return (
    <StatisticsSection
      action={pagination}
      className="flex-1 border-border/60 bg-background/50 shadow-none"
      contentClassName="flex-1"
      description={t(`subtitles.${metric}`)}
      title={t("title")}
    >
      {rows.length === 0 ? (
        <StatisticsSectionState
          kind="empty"
          title={isMoney ? t("emptyForCurrency", { currency }) : t("empty")}
        />
      ) : (
        <ul className="flex flex-1 flex-col gap-2.5">
          {visible.map((row, index) => (
            <StoreListRow
              currency={currency}
              drilldown={drilldown}
              isBestValue={row.storeKey === bestValueStoreKey}
              isHighlighted={row.storeKey === highlightedStoreKey}
              key={row.storeKey}
              metric={metric}
              onHighlight={onHighlight}
              rank={firstIndex + index + 1}
              row={row}
            />
          ))}
        </ul>
      )}
    </StatisticsSection>
  );
}

const COUNT_LABELS = {
  books: { primary: "countsOrders", secondary: "countsBooks" },
  orders: { primary: "countsBooks", secondary: "countsOrders" },
} as const;

function StoreDrilldownAction({
  label,
  links,
  unit,
}: {
  label: string;
  links: StatisticsDrilldownLink[];
  unit: StatisticsDrilldownUnit;
}) {
  const only = links.at(0);

  if (only === undefined) {
    return null;
  }

  if (links.length === 1) {
    return (
      <Button
        aria-label={label}
        asChild
        className="-mt-0.5 shrink-0"
        size="icon-sm"
        variant="ghost"
      >
        <Link href={only.href}>
          <UiIcon name="chevron-right" size={16} />
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} className="-mt-0.5 shrink-0" size="icon-sm" variant="ghost">
          <UiIcon name="chevron-down" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <StatisticsDrilldownMenuContent links={links} unit={unit} />
    </DropdownMenu>
  );
}

function StoreListRow({
  currency,
  drilldown,
  isBestValue,
  isHighlighted,
  metric,
  onHighlight,
  rank,
  row,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  isBestValue: boolean;
  isHighlighted: boolean;
  metric: StoreMetric;
  onHighlight: (storeKey: Nullable<string>) => void;
  rank: number;
  row: StoreRow;
}) {
  const t = useTranslations("delivery.statistics.stores");
  const locale = useLocale();

  const isMoney = isMoneyStoreMetric(metric);
  const countLabels = metric === "spend" ? null : COUNT_LABELS[metric];
  const counted = { books: row.booksCount, orders: row.ordersCount };
  const value =
    countLabels === null
      ? formatMoney({ amount: row.value, currency, locale })
      : t(countLabels.primary, counted);
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
  const landed =
    isMoney && row.averageLandedBookCost !== null
      ? t("landed", {
          value: formatMoney({ amount: row.averageLandedBookCost, currency, locale }),
        })
      : null;

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-1.5 py-1.5 transition-colors",
        isHighlighted && "bg-accent",
      )}
      onBlur={() => onHighlight(null)}
      onFocus={() => onHighlight(row.storeKey)}
      onMouseEnter={() => onHighlight(row.storeKey)}
      onMouseLeave={() => onHighlight(null)}
    >
      <span className={STORE_LIST.rank}>{rank}</span>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{row.store}</span>
          {isBestValue ? (
            <Tooltip>
              <TooltipTrigger className={STORE_LIST.badge} type="button">
                <UiIcon name="crown" size={STORE_LIST.badgeIconSize} />
                {t("bestValue.label")}
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{t("bestValue.hint")}</TooltipContent>
            </Tooltip>
          ) : null}
          <span className="ml-auto shrink-0 text-sm font-semibold text-ink tabular-nums">
            {value}
          </span>
        </div>

        <span className="block h-2 w-full overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary/70"
            style={{ width: `${Math.max(row.share * BAR.fullWidth, BAR.minWidth)}%` }}
          />
        </span>

        <span className="truncate text-xs text-muted-foreground">
          {[counts, booksPerOrder, landed].filter((part) => part !== null).join(" · ")}
        </span>
      </div>

      <StoreDrilldownAction
        label={t("openOrders", { store: row.store })}
        links={links}
        unit={metric === "books" ? "books" : "orders"}
      />
    </li>
  );
}

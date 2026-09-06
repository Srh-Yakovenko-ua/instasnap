"use client";

import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES, STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StoreScatterPoint } from "../../model/statistics-stores";

import { formatMoney } from "../../model/money-format";
import { buildStatisticsDrilldown } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { storeScatter } from "../../model/statistics-stores";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const POINT_SIZE: [number, number] = [220, 220];

const HIGHLIGHT_SIZE: [number, number] = [520, 520];

const ScatterClickSchema = z.object({ storeKey: z.string() });

export function StatisticsStoreMap({
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
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const [showExcluded, setShowExcluded] = useState(false);

  const { excluded, points } = storeScatter({ currency, stores });
  const highlighted = points.find((point) => point.storeKey === highlightedStoreKey) ?? null;
  const highlightedHref =
    highlighted === null
      ? null
      : buildStatisticsDrilldown({
          context: drilldown,
          destination: "history_received",
          metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
          scope: { kind: "store", store: highlighted.store },
        });
  const single = points.at(0);

  const config = {
    averageOrderAmount: { color: "var(--chart-1)", label: t("axisY") },
  } satisfies ChartConfig;

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      description={t("subtitle")}
      title={t("title")}
    >
      {points.length === 0 ? (
        <StatisticsSectionState
          description={t("insufficientHelper")}
          kind="insufficient"
          title={t("insufficient")}
        />
      ) : points.length === 1 && single !== undefined ? (
        <SingleStore currency={currency} point={single} />
      ) : (
        <ChartContainer
          aria-label={t("aria")}
          className="aspect-auto h-[16rem] w-full sm:h-[20rem]"
          config={config}
          role="img"
        >
          <ScatterChart margin={{ bottom: 8, left: 4, right: 12, top: 12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              axisLine={{ stroke: "var(--border)" }}
              dataKey="averageLandedBookCost"
              name={t("axisX")}
              tickFormatter={(value: number) =>
                formatNumber(value, locale, { notation: "compact" })
              }
              tickLine={false}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="averageOrderAmount"
              name={t("axisY")}
              tickFormatter={(value: number) =>
                formatNumber(value, locale, { notation: "compact" })
              }
              tickLine={false}
              type="number"
              width={52}
            />
            <ZAxis dataKey="pointSize" range={POINT_SIZE} type="number" />
            <ChartTooltip content={<StoreMapTooltip currency={currency} />} cursor={false} />
            <Scatter
              className="cursor-pointer"
              data={points.map((point) => ({
                ...point,
                pointSize:
                  point.storeKey === highlightedStoreKey ? HIGHLIGHT_SIZE[0] : POINT_SIZE[0],
              }))}
              fill="color-mix(in srgb, var(--chart-1) 55%, var(--card))"
              onClick={(point) => {
                const clicked = ScatterClickSchema.safeParse(point.payload);
                if (clicked.success) onHighlight(clicked.data.storeKey);
              }}
              onMouseEnter={(point) => {
                const hovered = ScatterClickSchema.safeParse(point.payload);
                if (hovered.success) onHighlight(hovered.data.storeKey);
              }}
              onMouseLeave={() => onHighlight(null)}
              stroke="var(--chart-1)"
              strokeWidth={1.5}
            />
          </ScatterChart>
        </ChartContainer>
      )}

      {points.length < 2 ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("axisHintX")}</span>
          <span>{t("axisHintY")}</span>
        </div>
      )}

      {highlighted === null || highlightedHref === null ? null : (
        <Link
          className="w-fit text-sm text-primary underline-offset-2 hover:underline"
          href={highlightedHref}
        >
          {t("openStore", { store: highlighted.store })}
        </Link>
      )}

      {excluded.length === 0 ? null : (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>
            {t("excluded", { count: excluded.length })} · {t("excludedHelper")}
          </span>
          <Button
            className="h-6 w-fit px-2 text-xs"
            onClick={() => setShowExcluded((value) => !value)}
            size="sm"
            variant="ghost"
          >
            {showExcluded ? t("excludedHide") : t("excludedShow")}
          </Button>
          {showExcluded ? (
            <>
              <span>{excluded.map((entry) => entry.store).join(", ")}</span>
              <span>
                {t("excludedRule", {
                  count: BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks,
                })}
              </span>
            </>
          ) : null}
        </div>
      )}
    </StatisticsSection>
  );
}

function SingleStore({ currency, point }: { currency: Currency; point: StoreScatterPoint }) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-3">
      <span className="text-sm text-muted-foreground">{t("singleStore")}</span>
      <span className="font-heading text-base font-semibold text-ink">{point.store}</span>
      <span className="text-sm text-muted-foreground">
        {t("axisX")}: {formatMoney({ amount: point.averageLandedBookCost, currency, locale })}
      </span>
      <span className="text-sm text-muted-foreground">
        {t("axisY")}: {formatMoney({ amount: point.averageOrderAmount, currency, locale })}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("coverage", {
          counted: point.landedEligibleBooksCount,
          total: point.currencyBooksCount,
        })}
      </span>
    </div>
  );
}

function StoreMapTooltip({
  active,
  currency,
  payload,
}: {
  active?: boolean;
  currency: Currency;
  payload?: readonly { payload: StoreScatterPoint }[];
}) {
  const t = useTranslations("delivery.statistics.storeMap");
  const locale = useLocale();
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  return (
    <div className="grid min-w-52 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-ink">{point.store}</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{t("axisX")}</dt>
        <dd className="text-end font-semibold text-ink tabular-nums">
          {formatMoney({ amount: point.averageLandedBookCost, currency, locale })}
        </dd>
        <dt className="text-muted-foreground">{t("axisY")}</dt>
        <dd className="text-end font-semibold text-ink tabular-nums">
          {formatMoney({ amount: point.averageOrderAmount, currency, locale })}
        </dd>
        <dt className="text-muted-foreground">{t("booksInCalculation")}</dt>
        <dd className="text-end tabular-nums">{point.landedEligibleBooksCount}</dd>
        <dt className="text-muted-foreground">{t("ordersInCurrency", { currency })}</dt>
        <dd className="text-end tabular-nums">{point.currencyOrdersCount}</dd>
      </dl>
      <div className="text-muted-foreground">
        {t("coverage", {
          counted: point.landedEligibleBooksCount,
          total: point.currencyBooksCount,
        })}{" "}
        · {formatPercentValue(point.coveragePercent, locale)}
      </div>
    </div>
  );
}

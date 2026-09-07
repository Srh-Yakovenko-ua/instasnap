"use client";

import type { Currency, Nullable, StatisticsDynamics } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, CartesianGrid, Cell, BarChart as RechartsBarChart, XAxis, YAxis } from "recharts";
import { z } from "zod";

import type { ChartConfig } from "@/components/ui/chart";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import { formatMoney } from "../../model/money-format";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import {
  bucketLabel,
  bucketRange,
  DYNAMICS_METRICS,
  dynamicsPoints,
  formatSignedPercent,
  formatSignedValue,
  isMoneyMetric,
  percentChange,
} from "../../model/statistics-dynamics";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const CURRENT_FILL = "color-mix(in srgb, var(--chart-1) 62%, var(--card))";
const HIGHLIGHT_FILL = "var(--chart-1)";
const COMPARISON_FILL = "color-mix(in srgb, var(--chart-4) 18%, var(--card))";
const COMPARISON_STROKE = "var(--chart-4)";

const DELTA_ICON = { down: ArrowDown, up: ArrowUp } as const;

const CHART_LAYOUT = {
  chart: "aspect-auto h-[15rem] w-full sm:h-[18rem] lg:h-[19rem]",
  content: "gap-2",
  header: "lg:min-h-[4.09rem]",
  legend: "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
} as const;

const BucketPointSchema = z.object({ key: z.string() });

export function DynamicsTooltip({
  active,
  formatValue,
  granularity,
  metric,
  payload,
}: {
  active?: boolean;
  formatValue: (value: number) => string;
  granularity: StatisticsDynamics["granularity"];
  metric: DynamicsMetric;
  payload?: readonly { payload: DynamicsPoint }[];
}) {
  const t = useTranslations("delivery.statistics.dynamics");
  const locale = useLocale();
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  const comparison = point.bucket.comparison;
  const difference = point.comparisonValue === null ? null : point.value - point.comparisonValue;
  const percent = percentChange({ current: point.value, previous: point.comparisonValue });
  const DeltaIcon = DELTA_ICON[difference !== null && difference > 0 ? "up" : "down"];

  return (
    <div className="grid min-w-52 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-ink">{point.label}</div>

      {comparison === null ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">{t(`metrics.${metric}`)}</span>
          <span className="font-semibold text-ink tabular-nums">{formatValue(point.value)}</span>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: CURRENT_FILL }} />
              {t("legend.current")}
            </dt>
            <dd className="text-end font-semibold text-ink tabular-nums">
              {formatValue(point.value)}
            </dd>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full border border-dashed"
                style={{ background: COMPARISON_FILL, borderColor: COMPARISON_STROKE }}
              />
              {bucketLabel({ bucket: comparison, granularity, locale })}
            </dt>
            <dd className="text-end font-medium text-foreground tabular-nums">
              {formatValue(point.comparisonValue ?? 0)}
            </dd>
          </dl>
          <Separator />
          <p className="flex flex-wrap items-center gap-1 font-medium text-foreground tabular-nums">
            {difference === null || difference === 0 ? (
              <span className="text-muted-foreground">{t("noChange")}</span>
            ) : (
              <>
                <DeltaIcon aria-hidden className="size-3.5 text-icon" />
                {formatSignedValue(difference, formatValue)}
                {percent === null ? null : (
                  <>
                    <span aria-hidden className="text-muted-foreground">
                      ·
                    </span>
                    {formatSignedPercent(percent, locale)}
                  </>
                )}
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

export function StatisticsDynamics({
  comparisonLabel,
  currency,
  currentLabel,
  drilldown,
  dynamics,
  highlightedBucketKey,
  metric,
  onHighlightBucket,
  onMetricChange,
}: {
  comparisonLabel: Nullable<string>;
  currency: Currency;
  currentLabel: Nullable<string>;
  drilldown: StatisticsDrilldownContext;
  dynamics: StatisticsDynamics;
  highlightedBucketKey: Nullable<string>;
  metric: DynamicsMetric;
  onHighlightBucket: (bucketKey: Nullable<string>) => void;
  onMetricChange: (metric: DynamicsMetric) => void;
}) {
  const t = useTranslations("delivery.statistics.dynamics");
  const locale = useLocale();
  const [openBucketKey, setOpenBucketKey] = useState<Nullable<string>>(null);

  const points = dynamicsPoints({ currency, dynamics, locale, metric });
  const isMoney = isMoneyMetric(metric);
  const hasComparison = points.some((point) => point.comparisonValue !== null);
  const openPoint = points.find((point) => point.key === openBucketKey) ?? null;

  const config = {
    comparisonValue: { color: COMPARISON_STROKE, label: comparisonLabel ?? t("comparison") },
    value: { color: "var(--chart-1)", label: currentLabel ?? t("current") },
  } satisfies ChartConfig;

  const formatValue = (value: number) =>
    isMoney ? formatMoney({ amount: value, currency, locale }) : formatNumber(value, locale);

  const hasSpend = points.some((point) => point.value > 0);
  const isComparisonEmpty =
    comparisonLabel !== null &&
    !dynamics.buckets.some(
      (bucket) => bucket.comparison !== null && bucket.comparison.ordersCount > 0,
    );

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={DYNAMICS_METRICS}
            onChange={onMetricChange}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {isMoney ? <StatisticsCurrencyBadge currency={currency} /> : null}
        </div>
      }
      contentClassName={CHART_LAYOUT.content}
      description={t(`subtitles.${metric}`)}
      headerClassName={CHART_LAYOUT.header}
      title={t("title")}
    >
      {points.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : isMoney && !hasSpend ? (
        <StatisticsSectionState kind="empty" title={t("emptyForCurrency", { currency })} />
      ) : (
        <>
          <ChartContainer
            aria-label={t("aria", { metric: t(`metrics.${metric}`) })}
            className={CHART_LAYOUT.chart}
            config={config}
            role="img"
          >
            <RechartsBarChart
              data={points}
              margin={{ bottom: 0, left: 4, right: 4, top: 12 }}
              onClick={(event) => {
                const key = event?.activeLabel;
                setOpenBucketKey(typeof key === "string" ? key : null);
              }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
              <XAxis
                axisLine={{ stroke: "var(--border)" }}
                dataKey="key"
                interval="preserveStartEnd"
                minTickGap={16}
                tickFormatter={(value: string) =>
                  points.find((point) => point.key === value)?.label ?? value
                }
                tickLine={false}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickFormatter={(value: number) =>
                  formatNumber(value, locale, { notation: "compact" })
                }
                tickLine={false}
                width={44}
              />
              <ChartTooltip
                content={
                  <DynamicsTooltip
                    formatValue={formatValue}
                    granularity={dynamics.granularity}
                    metric={metric}
                  />
                }
                cursor={{ fill: "var(--muted)" }}
              />
              {hasComparison ? (
                <Bar
                  dataKey="comparisonValue"
                  fill={COMPARISON_FILL}
                  maxBarSize={22}
                  radius={[6, 6, 0, 0]}
                  stroke={COMPARISON_STROKE}
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
              ) : null}
              <Bar
                className="cursor-pointer"
                dataKey="value"
                maxBarSize={26}
                onMouseEnter={(point: unknown) => onHighlightBucket(bucketKeyOf(point))}
                onMouseLeave={() => onHighlightBucket(null)}
                radius={[6, 6, 0, 0]}
              >
                {points.map((point) => (
                  <Cell
                    fill={point.key === highlightedBucketKey ? HIGHLIGHT_FILL : CURRENT_FILL}
                    key={point.key}
                  />
                ))}
              </Bar>
            </RechartsBarChart>
          </ChartContainer>

          <div className={CHART_LAYOUT.legend}>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: CURRENT_FILL }} />
              {t("legend.current")}
            </span>
            {hasComparison ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full border border-dashed"
                  style={{ background: COMPARISON_FILL, borderColor: COMPARISON_STROKE }}
                />
                {t("legend.comparison")}
              </span>
            ) : null}
            <span className="ms-auto">{t("clickHint")}</span>
          </div>

          {isComparisonEmpty ? (
            <p className="text-xs text-muted-foreground" role="status">
              {t("comparisonEmpty")}
            </p>
          ) : null}

          {openPoint === null ? null : (
            <BucketDestinations
              drilldown={drilldown}
              isMoney={isMoney}
              onClose={() => setOpenBucketKey(null)}
              point={openPoint}
            />
          )}
        </>
      )}
    </StatisticsSection>
  );
}

function BucketDestinations({
  drilldown,
  isMoney,
  onClose,
  point,
}: {
  drilldown: StatisticsDrilldownContext;
  isMoney: boolean;
  onClose: () => void;
  point: DynamicsPoint;
}) {
  const t = useTranslations("delivery.statistics.dynamics");
  const tDrilldown = useTranslations("delivery.statistics.drilldown");
  const locale = useLocale();

  const links = statisticsDrilldownLinks({
    breakdown: point.bucket.drilldown,
    context: drilldown,
    metricKind: isMoney
      ? STATISTICS_METRIC_KIND.currencySpecificMoney
      : STATISTICS_METRIC_KIND.countOrStatus,
    scope: {
      from: point.bucket.current.from,
      kind: "order_date_range",
      to: point.bucket.current.to,
    },
  });

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {bucketRange({ bucket: point.bucket.current, locale })}
      </span>
      {links.map((link) => (
        <Link
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-primary transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href={link.href}
          key={link.destination}
          onClick={onClose}
        >
          {tDrilldown(`destination.${link.destination}`)}
          <span className="text-muted-foreground tabular-nums">
            {tDrilldown("unit.orders", { count: link.ordersCount })}
          </span>
        </Link>
      ))}
      <button
        className="ms-auto cursor-pointer text-xs text-muted-foreground"
        onClick={onClose}
        type="button"
      >
        {t("closeDestinations")}
      </button>
    </div>
  );
}

function bucketKeyOf(point: unknown): Nullable<string> {
  const parsed = BucketPointSchema.safeParse(point);
  return parsed.success ? parsed.data.key : null;
}

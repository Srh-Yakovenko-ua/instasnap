"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import type { ChartConfig } from "@/components/ui/chart";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatNumber } from "@/lib/format";

import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import { formatDayRange } from "../../model/statistics-format";

const CURRENT_FILL = "var(--chart-1)";

const COMPARISON_STROKE = "var(--chart-4)";

export function ReadingDynamicsChart({
  comparisonLabel,
  currentLabel,
  metric,
  points,
}: {
  comparisonLabel: Nullable<string>;
  currentLabel: Nullable<string>;
  metric: DynamicsMetric;
  points: DynamicsPoint[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");

  const hasComparison = points.some((point) => point.comparisonValue !== null);
  const config = {
    comparisonValue: { color: COMPARISON_STROKE, label: comparisonLabel ?? t("comparison") },
    value: { color: CURRENT_FILL, label: currentLabel ?? t("current") },
  } satisfies ChartConfig;

  return (
    <>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.key}>
            {t("srBucket", {
              pages: point.bucket.pagesRead,
              range:
                formatDayRange({ from: point.bucket.start, locale, to: point.bucket.end }) ??
                point.label,
              reads: point.bucket.completedReads,
            })}
          </li>
        ))}
      </ul>
      <ChartContainer
        aria-hidden
        className="aspect-auto h-[16rem] w-full sm:h-[20rem]"
        config={config}
      >
        <ComposedChart data={points} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickFormatter={(value: number) => formatNumber(value, locale)}
            tickLine={false}
            width={36}
          />
          <ChartTooltip content={<DynamicsTooltip metric={metric} />} />
          <Bar dataKey="value" fill={CURRENT_FILL} maxBarSize={44} radius={[4, 4, 0, 0]} />
          {hasComparison ? (
            <Line
              dataKey="comparisonValue"
              dot={false}
              stroke={COMPARISON_STROKE}
              strokeDasharray="4 3"
              strokeWidth={2}
              type="monotone"
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
    </>
  );
}

function DynamicsTooltip({
  metric,
  payload,
}: {
  metric: DynamicsMetric;
  payload?: { payload: DynamicsPoint }[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const point = payload?.[0]?.payload;

  if (point === undefined) return null;

  const range = formatDayRange({ from: point.bucket.start, locale, to: point.bucket.end });

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <span className="font-medium text-foreground">{range ?? point.label}</span>
      <span className="text-muted-foreground tabular-nums">
        {t("tooltip.reads", { count: point.bucket.completedReads })}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {t("tooltip.uniqueBooks", { count: point.bucket.uniqueBooksCompleted })}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {t("tooltip.pages", { count: point.bucket.pagesRead })}
      </span>
      {point.comparisonValue === null ? null : (
        <span className="text-muted-foreground tabular-nums">
          {t("tooltip.comparison", {
            metric: t(`metrics.${metric}`),
            value: formatNumber(point.comparisonValue, locale),
          })}
        </span>
      )}
    </div>
  );
}

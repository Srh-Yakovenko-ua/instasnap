"use client";

import type { BookOrderStatisticsLifecycle, Nullable, StatisticsPeriod } from "@app/shared";

import { STATISTICS_METRIC_KIND, statisticsDrilldownDestinationOf } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { LifecycleMode, LifecycleRow } from "../../model/statistics-lifecycle";

import { buildStatisticsDrilldown } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { LIFECYCLE_MODES, lifecycleBreakdown } from "../../model/statistics-lifecycle";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const PERCENT_MULTIPLIER = 100;

const STAGE_ICON: Record<LifecycleRow["stage"], UiIconName> = {
  active: "package",
  cancelled: "x-circle",
  partially_received: "check-circle",
  partially_shipped: "truck",
  received: "check-circle",
  shipped: "truck",
};

export function StatisticsLifecycle({
  currentLabel,
  drilldown,
  includeCancelled,
  lifecycle,
  period,
}: {
  currentLabel: Nullable<string>;
  drilldown: StatisticsDrilldownContext;
  includeCancelled: boolean;
  lifecycle: BookOrderStatisticsLifecycle;
  period: StatisticsPeriod;
}) {
  const t = useTranslations("delivery.statistics.lifecycle");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();
  const [mode, setMode] = useState<LifecycleMode>("orders");

  const breakdown = lifecycleBreakdown(lifecycle, mode);

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={LIFECYCLE_MODES}
          onChange={setMode}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      description={t(`subtitles.${mode}`, { period: currentLabel ?? t("allTime") })}
      title={t("title")}
    >
      {breakdown.total === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {breakdown.stages.map((row) => (
              <StageRow
                drilldown={mode === "orders" ? drilldown : null}
                key={row.stage}
                label={tStatus(row.stage)}
                locale={locale}
                period={period}
                row={row}
                unit={t(`units.${mode}`)}
              />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <UiIcon aria-hidden className="text-icon" name="x-circle" size={15} />
              {tStatus("cancelled")}
            </span>
            {includeCancelled ? (
              <StageValue locale={locale} row={breakdown.cancelled} unit={t(`units.${mode}`)} />
            ) : (
              <span className="text-sm text-muted-foreground">{t("cancelledExcluded")}</span>
            )}
          </div>
        </>
      )}
    </StatisticsSection>
  );
}

function LifecycleDelta({ delta, locale }: { delta: Nullable<number>; locale: string }) {
  if (delta === null || delta === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
      <UiIcon name={delta > 0 ? "arrow-up" : "arrow-down"} size={11} />
      {formatNumber(Math.abs(delta), locale)}
    </span>
  );
}

function StageRow({
  drilldown,
  label,
  locale,
  period,
  row,
  unit,
}: {
  drilldown: Nullable<StatisticsDrilldownContext>;
  label: string;
  locale: string;
  period: StatisticsPeriod;
  row: LifecycleRow;
  unit: string;
}) {
  const href =
    drilldown === null || row.count === 0
      ? null
      : buildStatisticsDrilldown({
          context: { ...drilldown, orderState: row.stage },
          destination: statisticsDrilldownDestinationOf(row.stage),
          metricKind: STATISTICS_METRIC_KIND.countOrStatus,
          scope: { from: period.from, kind: "order_date_range", to: period.to },
        });

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
          <UiIcon
            aria-hidden
            className="shrink-0 text-icon"
            name={STAGE_ICON[row.stage]}
            size={14}
          />
          {label}
        </span>
        <StageValue locale={locale} row={row} unit={unit} />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(row.share * 100, row.count > 0 ? 4 : 0)}%` }}
        />
      </div>
    </>
  );

  return (
    <li className="flex flex-col gap-1.5">
      {href === null ? (
        content
      ) : (
        <Link
          className={cn(
            "flex cursor-pointer flex-col gap-1.5 rounded-md transition-colors outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:[&_span:first-child]:text-primary",
          )}
          href={href}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function StageValue({ locale, row, unit }: { locale: string; row: LifecycleRow; unit: string }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-sm font-semibold text-ink tabular-nums">
        {formatNumber(row.count, locale)}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatPercentValue(row.totalShare * PERCENT_MULTIPLIER, locale)}
      </span>
      <LifecycleDelta delta={row.delta} locale={locale} />
    </span>
  );
}

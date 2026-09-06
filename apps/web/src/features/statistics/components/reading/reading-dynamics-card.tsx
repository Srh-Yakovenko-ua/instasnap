"use client";

import type {
  Nullable,
  ReadingStatisticsDynamicsSection,
  ReadingStatisticsPeriod,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import { DYNAMICS_METRICS, dynamicsPoints } from "../../model/statistics-dynamics";
import { formatDayRange } from "../../model/statistics-format";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingDynamicsChart } from "./reading-dynamics-chart";

export function ReadingDynamicsCard({
  comparisonLabel,
  currentLabel,
  dynamics,
  period,
}: {
  comparisonLabel: Nullable<string>;
  currentLabel: Nullable<string>;
  dynamics: ReadingStatisticsDynamicsSection;
  period: ReadingStatisticsPeriod;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.dynamics");
  const [metric, setMetric] = useState<DynamicsMetric>("reads");

  const points = dynamicsPoints({
    buckets: dynamics.buckets,
    comparisonBuckets: dynamics.comparisonBuckets,
    granularity: period.granularity,
    locale,
    metric,
  });
  const peak = metric === "pages" ? dynamics.peakPagesRead : dynamics.peakCompletedReads;
  const peakRange =
    peak === null ? null : formatDayRange({ from: peak.start, locale, to: peak.end });

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("metricLabel")}
          metrics={DYNAMICS_METRICS}
          onChange={setMetric}
          optionLabel={(value) => t(`metrics.${value}`)}
          value={metric}
        />
      }
      description={t(`subtitles.${period.granularity}`)}
      note={
        peak === null || peakRange === null ? null : (
          <p className="text-xs text-muted-foreground">
            {metric === "pages"
              ? t("peakPages", { pages: peak.pagesRead, range: peakRange })
              : t("peakReads", { range: peakRange, reads: peak.completedReads })}
          </p>
        )
      }
      title={t("title")}
    >
      {points.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ReadingDynamicsChart
          comparisonLabel={comparisonLabel}
          currentLabel={currentLabel}
          metric={metric}
          points={points}
        />
      )}
    </StatisticsSection>
  );
}

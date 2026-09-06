"use client";

import type { ReadingStatisticsSeriesSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { formatDayShort, formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "../tastes/taste-ranking-list";

const LIFECYCLE_KEYS = ["started", "continued", "completed", "caughtUp"] as const;

export function SeriesSection({ series }: { series: ReadingStatisticsSeriesSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");

  if (series.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState kind="unavailable" title={t("unavailable")} />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-foreground">
          {series.seriesShare === null
            ? t("shareUnknown")
            : t("share", {
                percent: formatShare(series.seriesShare, locale),
                series: series.seriesCompletedReadsCount,
                total: series.completedReadsCount,
              })}
        </span>
        <span className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(series.seriesShare ?? 0) * 100}%` }}
          />
        </span>
      </div>

      <SeriesLifecycle lifecycle={series.lifecycle} />

      {series.mostActive.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("mostActiveTitle")}
          </span>
          <TasteRankingList
            rows={series.mostActive.map((entry) => ({
              contextActions: entry.contextActions,
              key: entry.seriesId,
              label: entry.name,
              secondary: t("attributablePages", {
                pages: formatNumber(entry.attributablePagesRead, locale),
              }),
              value: entry.completedReadCycles,
              valueLabel: t("reads", { count: entry.completedReadCycles }),
            }))}
          />
        </div>
      )}

      {series.topProgress.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("topProgressTitle")}
          </span>
          <ul className="flex flex-col gap-1">
            {series.topProgress.map((entry) => (
              <li className="flex justify-between gap-3 text-sm" key={entry.seriesId}>
                <span className="truncate text-foreground">{entry.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t("firstCompletions", { count: entry.distinctFirstCompletions })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {series.marathon.availability === "unavailable" || series.marathon.data === null ? null : (
        <p className="text-xs text-muted-foreground">
          {t("marathon", {
            date: formatDayShort(series.marathon.data.endFinishedAt, locale),
            length: series.marathon.data.length,
            name: series.marathon.data.name,
          })}
        </p>
      )}
    </StatisticsSection>
  );
}

function SeriesLifecycle({
  lifecycle,
}: {
  lifecycle: ReadingStatisticsSeriesSection["lifecycle"];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.series");
  const data = lifecycle.data;

  if (lifecycle.availability === "unavailable" || data === null) {
    return (
      <StatisticsSectionState
        description={t(`reason.${lifecycle.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
        kind="unavailable"
        title={t("lifecycleUnavailable")}
      />
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LIFECYCLE_KEYS.map((key) => (
        <div
          className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5"
          key={key}
        >
          <dt className="text-xs text-muted-foreground">{t(`lifecycle.${key}`)}</dt>
          <dd className="font-heading text-base font-semibold text-ink tabular-nums">
            {formatNumber(data[key], locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

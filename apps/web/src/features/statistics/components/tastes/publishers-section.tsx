"use client";

import type { ReadingStatisticsPublishersSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

export function PublishersSection({
  publishers,
}: {
  publishers: ReadingStatisticsPublishersSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.publishers");
  const coverage = coverageCaption(publishers.coverage);

  if (publishers.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t("unavailableDescription")}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      description={t("description")}
      note={coverage === null ? null : <StatisticsNote>{t("coverage", coverage)}</StatisticsNote>}
      title={t("title")}
    >
      {publishers.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <TasteRankingList
            rows={publishers.items.map((entry) => ({
              contextActions: entry.contextActions,
              key: entry.publisherId,
              label: entry.name,
              secondary:
                entry.averageRating === null
                  ? undefined
                  : formatRatingScore(entry.averageRating, locale),
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
          />
          <p className="text-xs text-muted-foreground">
            {t("summary", { total: formatNumber(publishers.totalPublishers, locale) })}
            {publishers.topThreeConcentration === null
              ? null
              : ` · ${t("concentration", {
                  percent: formatShare(publishers.topThreeConcentration, locale),
                })}`}
          </p>
        </>
      )}
    </StatisticsSection>
  );
}

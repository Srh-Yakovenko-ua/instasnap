"use client";

import type { ReadingStatisticsGenresSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

const GENRE_MODES = ["frequency", "rated"] as const;

type GenreMode = (typeof GENRE_MODES)[number];

export function GenresSection({ genres }: { genres: ReadingStatisticsGenresSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.genres");
  const [mode, setMode] = useState<GenreMode>("frequency");
  const coverage = coverageCaption(genres.coverage);

  if (genres.availability === "unavailable") {
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
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={GENRE_MODES}
          onChange={setMode}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      description={t("description")}
      note={coverage === null ? null : <StatisticsNote>{t("coverage", coverage)}</StatisticsNote>}
      title={t("title")}
    >
      {mode === "frequency" ? (
        genres.frequency.length === 0 ? (
          <StatisticsSectionState kind="empty" title={t("empty")} />
        ) : (
          <TasteRankingList
            rows={genres.frequency.map((entry) => ({
              key: entry.genreKey,
              label: entry.genreKey,
              secondary: t("share", {
                percent: formatShare(entry.shareOfCompletedReads, locale),
              }),
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
          />
        )
      ) : genres.topRated.availability === "unavailable" ? (
        <StatisticsSectionState
          description={t(`reason.${genres.topRated.reason ?? "INSUFFICIENT_SAMPLE"}`)}
          kind="insufficient"
          title={t("ratedUnavailable")}
        />
      ) : (
        <TasteRankingList
          rows={genres.topRated.items.map((entry) => ({
            key: entry.genreKey,
            label: entry.genreKey,
            secondary: t("ratedReads", { count: entry.ratedReadCount }),
            value: entry.averageRating,
            valueLabel: formatRatingScore(entry.averageRating, locale),
          }))}
        />
      )}
    </StatisticsSection>
  );
}

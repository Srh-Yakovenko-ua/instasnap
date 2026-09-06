"use client";

import type { ReadingStatisticsAuthorsSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { coverageCaption } from "../../model/statistics-availability";
import { formatDayShort, formatRatingScore } from "../../model/statistics-format";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { TasteRankingList } from "./taste-ranking-list";

const AUTHOR_MODES = ["frequency", "rated"] as const;

type AuthorMode = (typeof AUTHOR_MODES)[number];

export function AuthorsSection({ authors }: { authors: ReadingStatisticsAuthorsSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.authors");
  const [mode, setMode] = useState<AuthorMode>("frequency");
  const coverage = coverageCaption(authors.coverage);
  const returning =
    authors.returning.availability === "unavailable" ? undefined : authors.returning.items.at(0);

  if (authors.availability === "unavailable") {
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
          metrics={AUTHOR_MODES}
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
        authors.frequency.length === 0 ? (
          <StatisticsSectionState kind="empty" title={t("empty")} />
        ) : (
          <TasteRankingList
            rows={authors.frequency.map((entry) => ({
              contextActions: entry.contextActions,
              key: entry.authorId,
              label: entry.name,
              value: entry.completedReadCount,
              valueLabel: t("reads", { count: entry.completedReadCount }),
            }))}
          />
        )
      ) : authors.topRated.availability === "unavailable" ? (
        <StatisticsSectionState
          description={t(`reason.${authors.topRated.reason ?? "INSUFFICIENT_SAMPLE"}`)}
          kind="insufficient"
          title={t("ratedUnavailable")}
        />
      ) : (
        <TasteRankingList
          rows={authors.topRated.items.map((entry) => ({
            key: entry.authorId,
            label: entry.name,
            secondary: t("ratedReads", { count: entry.ratedReadCount }),
            value: entry.averageRating,
            valueLabel: formatRatingScore(entry.averageRating, locale),
          }))}
        />
      )}

      {returning === undefined ? null : (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{t("returningTitle")}</span>
          <span className="text-sm font-medium text-foreground">{returning.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("returningMeta", {
              lastRead: formatDayShort(returning.latestFinishedAt, locale),
              reads: returning.completedReadCount,
              years: returning.distinctReadingYears,
            })}
          </span>
        </div>
      )}
    </StatisticsSection>
  );
}

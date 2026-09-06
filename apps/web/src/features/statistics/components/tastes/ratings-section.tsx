"use client";

import type { ReadingStatisticsRatingsSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import { CompletedReadCard } from "../completed-read-card";
import { StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { RatingDistribution } from "./rating-distribution";

export function RatingsSection({ ratings }: { ratings: ReadingStatisticsRatingsSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.ratings");
  const coverage = coverageCaption(ratings.coverage);

  if (ratings.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t(`reason.${ratings.reason ?? "NO_RATINGS"}`)}
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
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("averageRating")}</span>
              <span className="font-heading text-3xl font-bold text-ink tabular-nums">
                {ratings.averageRating === null
                  ? "—"
                  : t("scale", { value: formatRatingScore(ratings.averageRating, locale) })}
              </span>
            </span>
            {ratings.highRatedShare === null ? null : (
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t("highRated")}</span>
                <span className="font-heading text-lg font-semibold text-ink tabular-nums">
                  {t("highRatedValue", {
                    count: ratings.highRatedReadsCount,
                    percent: formatShare(ratings.highRatedShare, locale),
                  })}
                </span>
              </span>
            )}
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("ratedReads")}</span>
              <span className="font-heading text-lg font-semibold text-ink tabular-nums">
                {t("ratedReadsValue", {
                  rated: formatNumber(ratings.ratedReadsCount, locale),
                  total: formatNumber(ratings.completedReadsCount, locale),
                })}
              </span>
            </span>
          </div>

          <RatingDistribution distribution={ratings.distribution} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("topRatedTitle")}
          </span>
          {ratings.topRated.length === 0 ? (
            <StatisticsSectionState kind="empty" title={t("topRatedEmpty")} />
          ) : (
            <ul className="grid grid-cols-4 gap-3">
              {ratings.topRated.map((read) => (
                <li key={read.readingCycleId}>
                  <CompletedReadCard read={read} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StatisticsSection>
  );
}

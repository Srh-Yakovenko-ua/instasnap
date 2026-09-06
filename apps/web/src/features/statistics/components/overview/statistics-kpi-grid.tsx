"use client";

import type { ReadingStatisticsKpis } from "@app/shared";
import type { ReactNode } from "react";

import { BookCheck, BookOpen, CalendarCheck, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/format";

import { coverageCaption } from "../../model/statistics-availability";
import { formatRatingScore, formatShare } from "../../model/statistics-format";
import {
  StatisticsCountDelta,
  StatisticsRateDelta,
  StatisticsScoreDelta,
} from "../statistics-delta";

export function StatisticsKpiGrid({
  isLowerBound,
  kpis,
}: {
  isLowerBound: boolean;
  kpis: ReadingStatisticsKpis;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.kpi");

  const lowerBound = (value: string) => (isLowerBound ? t("lowerBoundValue", { value }) : value);
  const ratingCoverage = coverageCaption(kpis.averageRating.coverage);
  const isRatingKnown = kpis.averageRating.availability !== "unavailable";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        caption={
          <StatisticsCountDelta
            comparison={kpis.completedReads.comparison}
            current={kpis.completedReads.value}
            formatValue={(value) => t("completedReads.value", { count: value })}
          />
        }
        icon="book"
        iconSlot={<BookCheck aria-hidden />}
        label={t("completedReads.label")}
        microfact={t("completedReads.unique", { count: kpis.uniqueBooksCompleted.value })}
        size="compact"
        unit={t("completedReads.unit", { count: kpis.completedReads.value })}
        value={formatNumber(kpis.completedReads.value, locale)}
      />

      <StatCard
        caption={
          <StatisticsCountDelta
            comparison={kpis.pagesRead.comparison}
            current={kpis.pagesRead.value ?? 0}
            formatValue={(value) => t("pagesRead.value", { count: value })}
          />
        }
        icon="pages"
        iconSlot={<BookOpen aria-hidden />}
        iconTone="info"
        label={t("pagesRead.label")}
        microfact={isLowerBound ? t("lowerBoundHint") : undefined}
        size="compact"
        value={
          kpis.pagesRead.availability === "unavailable" || kpis.pagesRead.value === null ? (
            <UnavailableValue />
          ) : (
            lowerBound(formatNumber(kpis.pagesRead.value, locale))
          )
        }
      />

      <StatCard
        caption={<StatisticsScoreDelta comparison={kpis.averageRating.comparison} />}
        icon="star"
        iconSlot={<Star aria-hidden />}
        iconTone="favorite"
        label={t("averageRating.label")}
        microfact={
          kpis.averageRating.availability === "unavailable"
            ? t(`averageRating.reason.${kpis.averageRating.reason ?? "NO_RATINGS"}`)
            : ratingCoverage === null
              ? undefined
              : t("averageRating.coverage", ratingCoverage)
        }
        size="compact"
        unit={isRatingKnown ? t("averageRating.scale") : undefined}
        value={
          isRatingKnown && kpis.averageRating.value !== null ? (
            formatRatingScore(kpis.averageRating.value, locale)
          ) : (
            <UnavailableValue />
          )
        }
      />

      <StatCard
        caption={
          <StatisticsCountDelta
            comparison={kpis.activeDays.countComparison}
            current={kpis.activeDays.value}
            formatValue={(value) => t("activeDays.value", { count: value })}
          />
        }
        icon="calendar"
        iconSlot={<CalendarCheck aria-hidden />}
        iconTone="success"
        label={t("activeDays.label")}
        microfact={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>
              {t("activeDays.rate", { percent: formatShare(kpis.activeDays.rate, locale) })}
            </span>
            <StatisticsRateDelta comparison={kpis.activeDays.rateComparison} />
          </span>
        }
        size="compact"
        unit={t("activeDays.unit", { count: kpis.activeDays.value })}
        value={lowerBound(formatNumber(kpis.activeDays.value, locale))}
      />
    </div>
  );
}

function UnavailableValue(): ReactNode {
  return <span className="text-muted-foreground">—</span>;
}

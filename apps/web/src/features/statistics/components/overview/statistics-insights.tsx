"use client";

import type { ReadingStatisticsInsight, ReadingStatisticsInsightsSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { toContextActionLink } from "../../model/statistics-drilldown";
import {
  formatDayLong,
  formatRatingScore,
  formatShare,
  weekdayLabel,
} from "../../model/statistics-format";
import { toInsightView } from "../../model/statistics-insights";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

export function StatisticsInsightBody({ insight }: { insight: ReadingStatisticsInsight }) {
  const locale = useLocale();
  const t = useTranslations("statistics.insights.codes");
  const tActions = useTranslations("statistics.contextActions");
  const tLanguage = useTranslations("books.classification.languageLabels");

  const view = toInsightView(insight, {
    day: (day) => formatDayLong(day, locale),
    language: (language) => tLanguage(language),
    rating: (value) => formatRatingScore(value, locale),
    share: (ratio) => `${formatShare(ratio, locale)}%`,
    weekday: (weekday) => weekdayLabel({ locale, weekday }),
  });
  const action = insight.action === undefined ? null : toContextActionLink(insight.action);

  return (
    <div className="flex items-start gap-2.5">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-primary" name={view.icon} size={17} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm leading-relaxed text-foreground">{t(view.code, view.values)}</p>
        {action === null ? null : (
          <Link className="text-xs text-primary hover:underline" href={action.href}>
            {tActions(action.kind)}
          </Link>
        )}
      </div>
    </div>
  );
}

export function StatisticsInsights({ insights }: { insights: ReadingStatisticsInsightsSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.insights");

  return (
    <StatisticsSection
      description={t("description", { count: formatNumber(insights.items.length, locale) })}
      title={t("title")}
    >
      {insights.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible xl:grid-cols-4">
          {insights.items.map((insight) => (
            <li
              className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink"
              key={`${insight.code}-${insight.category}`}
            >
              <Card className="h-full px-4 py-3.5">
                <StatisticsInsightBody insight={insight} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </StatisticsSection>
  );
}

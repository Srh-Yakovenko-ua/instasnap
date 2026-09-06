"use client";

import type { Nullable, ReadingStatisticsHeroSection, ReadingStatisticsPeriod } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";

import { formatDayRange } from "../../model/statistics-format";
import { CompletedReadCard } from "../completed-read-card";
import { StatisticsInsightBody } from "./statistics-insights";

export function StatisticsHero({
  hero,
  period,
}: {
  hero: ReadingStatisticsHeroSection;
  period: ReadingStatisticsPeriod;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.hero");

  function heroTitle(): string {
    switch (period.kind) {
      case "all_time":
        return t("title.all_time");
      case "custom":
        return t("title.custom", { range: rangeLabel({ locale, period }) });
      case "last_12_months":
        return t("title.last_12_months");
      case "year":
        return t("title.year", { year: period.to.slice(0, 4) });
    }
  }

  return (
    <Card className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="font-heading text-2xl leading-tight font-semibold text-ink">
          {heroTitle()}
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">{t("subtitle")}</p>
        {hero.featuredInsight === null ? null : (
          <div className="mt-1 rounded-lg border border-border bg-secondary/60 px-3.5 py-3">
            <StatisticsInsightBody insight={hero.featuredInsight} />
          </div>
        )}
      </div>

      {hero.recentCompletedReads.length === 0 ? null : (
        <div className="flex min-w-0 shrink-0 flex-col gap-2 lg:w-[22rem]">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("recentTitle")}
          </span>
          <ul className="grid grid-cols-4 gap-2.5">
            {hero.recentCompletedReads.map((read) => (
              <li key={read.readingCycleId}>
                <CompletedReadCard read={read} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function rangeLabel({
  locale,
  period,
}: {
  locale: string;
  period: ReadingStatisticsPeriod;
}): string {
  const label: Nullable<string> = formatDayRange({ from: period.from, locale, to: period.to });
  return label ?? period.to;
}

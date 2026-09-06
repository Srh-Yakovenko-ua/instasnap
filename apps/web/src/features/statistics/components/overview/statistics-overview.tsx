"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { TitleLeaf } from "@/components/title-leaf";
import { cn } from "@/lib/utils";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { useReadingStatisticsOverview } from "../../api/use-reading-statistics-overview";
import { formatDayRange } from "../../model/statistics-format";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { useStatisticsParams } from "../../model/use-statistics-params";
import { StatisticsPeriodControls } from "../controls/statistics-period-controls";
import { LibraryBalanceSection } from "../progress/library-balance-section";
import { ReadingGoalCard } from "../progress/reading-goal-card";
import { RecordsSection } from "../progress/records-section";
import { SeriesSection } from "../progress/series-section";
import { ReadingCalendarCard } from "../reading/reading-calendar-card";
import { ReadingDynamicsCard } from "../reading/reading-dynamics-card";
import { StatisticsDivider } from "../statistics-section";
import {
  StatisticsError,
  StatisticsNote,
  StatisticsPeriodEmpty,
  StatisticsRefetchError,
  StatisticsRefreshingNote,
  StatisticsSectionState,
  StatisticsSkeleton,
} from "../statistics-states";
import { AuthorsSection } from "../tastes/authors-section";
import { DiscoveriesSection } from "../tastes/discoveries-section";
import { GenresSection } from "../tastes/genres-section";
import { LanguagesSection } from "../tastes/languages-section";
import { PublishersSection } from "../tastes/publishers-section";
import { RatingsSection } from "../tastes/ratings-section";
import { StatisticsHero } from "./statistics-hero";
import { StatisticsInsights } from "./statistics-insights";
import { StatisticsKpiGrid } from "./statistics-kpi-grid";

export function StatisticsOverview() {
  const t = useTranslations("statistics");
  const params = useStatisticsParams();
  const query = useReadingStatisticsOverview(params.queryParams, {
    enabled: params.isRequestable,
  });
  const scope = toStatisticsScopeState(query);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <StatisticsPeriodControls
        comparison={scope.data?.comparison ?? null}
        params={params}
        period={scope.data?.period ?? null}
      />

      {scope.isRefreshing ? <StatisticsRefreshingNote /> : null}
      {scope.isRefetchError ? <StatisticsRefetchError onRetry={scope.retry} /> : null}

      <StatisticsBody
        isRequestable={params.isRequestable}
        onShowAllTime={() => params.setPeriod("all_time")}
        scope={scope}
      />
    </div>
  );
}

function hasReadingActivity(overview: ReadingStatisticsOverview): boolean {
  return (
    overview.kpis.completedReads.value > 0 ||
    (overview.kpis.pagesRead.value ?? 0) > 0 ||
    overview.calendar.activeDays > 0
  );
}

function StatisticsBody({
  isRequestable,
  onShowAllTime,
  scope,
}: {
  isRequestable: boolean;
  onShowAllTime: () => void;
  scope: StatisticsScopeState<ReadingStatisticsOverview>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics");
  const overview = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={scope.retry} />;
  }

  if (overview === undefined) {
    return isRequestable ? (
      <StatisticsSkeleton />
    ) : (
      <StatisticsSectionState
        description={t("states.invalidRange.description")}
        kind="insufficient"
        title={t("states.invalidRange.title")}
      />
    );
  }

  const isLowerBound = overview.meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";
  const currentLabel = formatDayRange({
    from: overview.period.from,
    locale,
    to: overview.period.to,
  });
  const comparisonLabel =
    overview.comparison === null
      ? null
      : formatDayRange({
          from: overview.comparison.from,
          locale,
          to: overview.comparison.to,
        });

  const bodyClassName = cn(
    "flex flex-col gap-6 transition-opacity",
    scope.isRefreshing && "opacity-70",
  );

  if (!hasReadingActivity(overview)) {
    return (
      <div aria-busy={scope.isRefreshing} className={bodyClassName}>
        <StatisticsPeriodEmpty onShowAllTime={onShowAllTime} />
        <StatisticsDivider title={t("dividers.progress")} />
        <ReadingGoalCard goal={overview.goal} />
        <LibraryBalanceSection libraryBalance={overview.libraryBalance} />
      </div>
    );
  }

  return (
    <div aria-busy={scope.isRefreshing} className={bodyClassName}>
      {isLowerBound ? <StatisticsNote>{t("states.lowerBound")}</StatisticsNote> : null}

      <StatisticsHero hero={overview.hero} period={overview.period} />
      <StatisticsKpiGrid isLowerBound={isLowerBound} kpis={overview.kpis} />
      <StatisticsInsights insights={overview.insights} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReadingDynamicsCard
            comparisonLabel={comparisonLabel}
            currentLabel={currentLabel}
            dynamics={overview.dynamics}
            period={overview.period}
          />
        </div>
        <ReadingGoalCard goal={overview.goal} />
      </div>

      <ReadingCalendarCard calendar={overview.calendar} meta={overview.meta} />

      <StatisticsDivider title={t("dividers.tastes")} />

      <RatingsSection ratings={overview.ratings} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <GenresSection genres={overview.genres} />
        <AuthorsSection authors={overview.authors} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <PublishersSection publishers={overview.publishers} />
        <LanguagesSection languages={overview.languages} />
      </div>

      {overview.period.kind === "all_time" ? null : (
        <DiscoveriesSection discoveries={overview.discoveries} />
      )}

      <StatisticsDivider title={t("dividers.progress")} />

      <SeriesSection series={overview.series} />

      <LibraryBalanceSection libraryBalance={overview.libraryBalance} />

      <RecordsSection records={overview.records} />
    </div>
  );
}

"use client";

import type { BookOrderStatisticsView, Currency, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { resolveStatisticsDisplayCurrency } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownContext } from "../model/statistics-drilldown";
import type { DynamicsMetric } from "../model/statistics-dynamics";
import type { StatisticsScopeState } from "../model/statistics-scope-state";
import type { StoreMetric } from "../model/statistics-stores";
import type { UseStatisticsParamsResult } from "../model/use-statistics-params";

import { useActiveMoneyAge } from "../api/use-active-money-age";
import { useBookBudgets } from "../api/use-book-budgets";
import { useStatistics } from "../api/use-statistics";
import { statisticsCurrencies } from "../model/statistics-currency";
import { statisticsEmptyKind } from "../model/statistics-empty";
import { formatPeriodRange } from "../model/statistics-format";
import { toStatisticsScopeState } from "../model/statistics-scope-state";
import { STORE_METRICS } from "../model/statistics-stores";
import { hasAnyOrders } from "../model/statistics-view-model";
import { useStatisticsParams } from "../model/use-statistics-params";
import { StatisticsActiveAge } from "./statistics/statistics-active-age";
import { StatisticsBudget } from "./statistics/statistics-budget";
import { StatisticsCosts } from "./statistics/statistics-costs";
import {
  StatisticsCurrencyBadge,
  StatisticsDisplayCurrency,
} from "./statistics/statistics-display-currency";
import { StatisticsKpi } from "./statistics/statistics-kpi";
import { StatisticsLifecycle } from "./statistics/statistics-lifecycle";
import { StatisticsPulse } from "./statistics/statistics-pulse";
import { StatisticsRecords } from "./statistics/statistics-records";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics/statistics-section";
import {
  StatisticsAllTimeEmpty,
  StatisticsError,
  StatisticsPeriodEmpty,
  StatisticsRefetchError,
  StatisticsRefreshingNote,
  StatisticsSectionState,
  StatisticsSkeleton,
  StatisticsTruncationNotice,
} from "./statistics/statistics-states";
import { StatisticsStores } from "./statistics/statistics-stores";
import { StatisticsToolbar } from "./statistics/statistics-toolbar";
import { StatisticsTopOrders } from "./statistics/statistics-top-orders";

const StatisticsDynamics = dynamic(
  () => import("./statistics/statistics-dynamics").then((m) => m.StatisticsDynamics),
  { loading: () => <Skeleton className="h-[29rem] w-full rounded-xl" />, ssr: false },
);

const StatisticsStoreMap = dynamic(
  () => import("./statistics/statistics-store-map").then((m) => m.StatisticsStoreMap),
  { loading: () => <Skeleton className="h-[24rem] w-full rounded-xl" />, ssr: false },
);

const StatisticsCalendar = dynamic(
  () => import("./statistics/statistics-calendar").then((m) => m.StatisticsCalendar),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false },
);

type StatisticsBodyProps = {
  activeAgeCard: ReactNode;
  budgetCard: ReactNode;
  comparisonLabel: Nullable<string>;
  currentLabel: Nullable<string>;
  displayCurrency: Nullable<Currency>;
  drilldown: StatisticsDrilldownContext;
  metric: DynamicsMetric;
  onMetricChange: (metric: DynamicsMetric) => void;
  params: UseStatisticsParamsResult;
  period: StatisticsScopeState<BookOrderStatisticsView>;
};

export function DeliveryStatistics() {
  const t = useTranslations("delivery.statistics");
  const locale = useLocale();
  const params = useStatisticsParams();
  const [metric, setMetric] = useState<DynamicsMetric>("spend");

  const statistics = useStatistics(params.queryParams);
  const view = statistics.data;
  const comparisonPeriod = view?.meta.comparisonPeriod ?? null;

  const activeAgeQuery = useActiveMoneyAge({
    ...(params.state.currency === null ? {} : { currency: params.state.currency }),
    ...(params.state.orderState === null ? {} : { orderState: params.state.orderState }),
    ...(params.state.store.trim() === "" ? {} : { store: params.state.store.trim() }),
  });
  const budgets = useBookBudgets();

  const period = toStatisticsScopeState(statistics);
  const activeAge = toStatisticsScopeState(activeAgeQuery);
  const budgetScope = toStatisticsScopeState(budgets);

  const currencies = view === undefined ? [] : statisticsCurrencies(view);
  const storeNames = (view?.byStore ?? []).map((entry) => entry.store);
  const displayCurrency = resolveStatisticsDisplayCurrency({
    available: currencies,
    currencyFilter: params.state.currency,
    requested: params.requestedDisplayCurrency,
  });

  const filters = {
    currencyFilter: params.state.currency,
    displayCurrency,
    orderState: params.state.orderState,
    store: params.state.store.trim() === "" ? null : params.state.store.trim(),
  };
  const drilldown: StatisticsDrilldownContext = { ...filters, isStale: period.isRefreshing };
  const currentDrilldown: StatisticsDrilldownContext = {
    ...filters,
    isStale: activeAge.isRefreshing,
  };

  const currentLabel = formatPeriodRange({
    from: view?.meta.currentPeriod.from ?? null,
    locale,
    to: view?.meta.currentPeriod.to ?? null,
  });
  const comparisonLabel =
    comparisonPeriod === null
      ? null
      : formatPeriodRange({ from: comparisonPeriod.from, locale, to: comparisonPeriod.to });
  const currentSource = view?.meta.currentSource ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <StatisticsToolbar meta={view?.meta ?? null} params={params} stores={storeNames} />

      <StatisticsDisplayCurrency
        available={currencies}
        currencyFilter={params.state.currency}
        onChange={params.setDisplayCurrency}
        value={displayCurrency}
      />

      {period.isRefreshing ? <StatisticsRefreshingNote /> : null}

      {period.isRefetchError ? <StatisticsRefetchError onRetry={period.retry} /> : null}

      {currentSource !== null && currentSource.isTruncated && currentSource.maxOrders !== null ? (
        <StatisticsTruncationNotice
          loadedOrdersCount={currentSource.loadedOrdersCount}
          maxOrders={currentSource.maxOrders}
        />
      ) : null}

      <StatisticsBody
        activeAgeCard={<StatisticsActiveAge drilldown={currentDrilldown} scope={activeAge} />}
        budgetCard={
          <StatisticsBudget
            currency={params.budgetCurrency}
            onCurrencyChange={params.setBudgetCurrency}
            scope={budgetScope}
          />
        }
        comparisonLabel={comparisonLabel}
        currentLabel={currentLabel}
        displayCurrency={displayCurrency}
        drilldown={drilldown}
        metric={metric}
        onMetricChange={setMetric}
        params={params}
        period={period}
      />
    </div>
  );
}

function StatisticsBody({
  activeAgeCard,
  budgetCard,
  comparisonLabel,
  currentLabel,
  displayCurrency,
  drilldown,
  metric,
  onMetricChange: setMetric,
  params,
  period,
}: StatisticsBodyProps) {
  const t = useTranslations("delivery.statistics");
  const [highlightedBucketKey, setHighlightedBucketKey] = useState<Nullable<string>>(null);
  const [highlightedStoreKey, setHighlightedStoreKey] = useState<Nullable<string>>(null);
  const [storeMetric, setStoreMetric] = useState<StoreMetric>("spend");
  const view = period.data;

  if (period.isInitialError) {
    return (
      <div className="flex flex-col gap-6">
        <StatisticsError onRetry={period.retry} />
        {budgetCard}
        {activeAgeCard}
      </div>
    );
  }

  if (view === undefined) {
    return <StatisticsSkeleton activeAge={activeAgeCard} budget={budgetCard} />;
  }

  const emptyKind = statisticsEmptyKind({
    hasActiveFilters: params.hasActiveFilters,
    preset: params.state.period,
  });

  if (!hasAnyOrders(view)) {
    if (emptyKind === "all_time") {
      return (
        <div className="flex flex-col gap-6">
          <StatisticsAllTimeEmpty />
          {budgetCard}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {displayCurrency === null ? null : (
          <StatisticsKpi currency={displayCurrency} snapshot={view.snapshot} view={view} />
        )}
        {budgetCard}
        <StatisticsPeriodEmpty
          kind={emptyKind}
          onChangePeriod={() => params.setPeriod("all_time")}
          onResetFilters={params.clearFilters}
        />
        {activeAgeCard}
      </div>
    );
  }

  if (displayCurrency === null) {
    return (
      <div className="flex flex-col gap-6">
        <StatisticsSectionState
          description={t("displayCurrency.noneDescription")}
          kind="insufficient"
          title={t("displayCurrency.none")}
        />
        {budgetCard}
        {activeAgeCard}
      </div>
    );
  }

  return (
    <div
      aria-busy={period.isRefreshing}
      className={cn("flex flex-col gap-6 transition-opacity", period.isRefreshing && "opacity-70")}
    >
      <StatisticsKpi currency={displayCurrency} snapshot={view.snapshot} view={view} />

      {budgetCard}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid lg:col-span-2">
          <StatisticsDynamics
            comparisonLabel={comparisonLabel}
            currency={displayCurrency}
            currentLabel={currentLabel}
            drilldown={drilldown}
            dynamics={view.dynamics}
            highlightedBucketKey={highlightedBucketKey}
            metric={metric}
            onHighlightBucket={setHighlightedBucketKey}
            onMetricChange={setMetric}
          />
        </div>
        <StatisticsPulse
          comparisonLabel={comparisonLabel}
          currency={displayCurrency}
          highlightedBucketKey={highlightedBucketKey}
          insights={view.insights}
          metric={metric}
          onHighlightBucket={setHighlightedBucketKey}
          records={view.records}
        />
      </div>

      <StatisticsCosts currency={displayCurrency} view={view} />

      <StatisticsSection
        action={<StatisticsCurrencyBadge currency={displayCurrency} />}
        description={t("storesGroup.subtitle")}
        icon="cart"
        title={t("storesGroup.title")}
      >
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[45fr_55fr]">
          <div className="flex min-w-0 flex-col gap-3">
            <StatisticsMetricTabs
              label={t("stores.metricLabel")}
              metrics={STORE_METRICS}
              onChange={setStoreMetric}
              optionLabel={(value) => t(`stores.metrics.${value}`)}
              value={storeMetric}
            />
            <StatisticsStores
              bestValueStores={view.bestValueStoreByCurrency}
              currency={displayCurrency}
              drilldown={drilldown}
              highlightedStoreKey={highlightedStoreKey}
              metric={storeMetric}
              onHighlight={setHighlightedStoreKey}
              stores={view.byStore}
            />
          </div>
          <StatisticsStoreMap
            currency={displayCurrency}
            drilldown={drilldown}
            highlightedStoreKey={highlightedStoreKey}
            onHighlight={setHighlightedStoreKey}
            stores={view.byStore}
          />
        </div>
      </StatisticsSection>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <StatisticsLifecycle
          currentLabel={currentLabel}
          drilldown={drilldown}
          includeCancelled={params.state.includeCancelled}
          lifecycle={view.lifecycle}
          period={view.meta.currentPeriod}
        />
        {activeAgeCard}
      </div>

      <StatisticsCalendar
        daily={view.daily}
        drilldown={drilldown}
        isTruncated={view.meta.currentSource.isTruncated}
        period={view.meta.currentPeriod}
        today={params.today}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <StatisticsRecords
          currency={displayCurrency}
          drilldown={drilldown}
          records={view.records}
        />
        <div className="lg:col-span-2">
          <StatisticsTopOrders
            currency={displayCurrency}
            drilldown={drilldown}
            topOrdersByCurrency={view.topOrdersByCurrency}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatisticsDataQualityKind = "estimated" | "partial" | "truncated";

export type StatisticsPeriodEmptyKind = "filters" | "period";

export type StatisticsSectionStateKind = "empty" | "error" | "insufficient" | "unavailable";

const QUALITY_ICON: Record<StatisticsDataQualityKind, UiIconName> = {
  estimated: "info",
  partial: "info",
  truncated: "alert-triangle",
};

const QUALITY_TONE: Record<StatisticsDataQualityKind, string> = {
  estimated: "text-muted-foreground",
  partial: "text-muted-foreground",
  truncated: "text-favorite",
};

const SECTION_ICON: Record<StatisticsSectionStateKind, UiIconName> = {
  empty: "inbox",
  error: "alert-circle",
  insufficient: "info",
  unavailable: "alert-circle",
};

const SECTION_TONE: Record<StatisticsSectionStateKind, string> = {
  empty: "text-ink",
  error: "text-favorite",
  insufficient: "text-ink",
  unavailable: "text-favorite",
};

export function StatisticsAllTimeEmpty() {
  const t = useTranslations("delivery.statistics.states");

  const onboarding: EmptyStateEntry = {
    desc: t("allTimeEmpty.description"),
    illu: "empty-purchases",
    title: t("allTimeEmpty.title"),
  };

  return <EmptyState state={onboarding} />;
}

export function StatisticsDataQualityNote({
  children,
  kind,
}: {
  children: ReactNode;
  kind: StatisticsDataQualityKind;
}) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", QUALITY_TONE[kind])} role="status">
      <UiIcon aria-hidden className="mt-0.5 shrink-0" name={QUALITY_ICON[kind]} size={13} />
      {children}
    </p>
  );
}

export function StatisticsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("delivery.statistics.states");

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  return (
    <div aria-live="assertive" role="alert">
      <EmptyState onPrimary={onRetry} state={errorState} />
    </div>
  );
}

export function StatisticsPeriodEmpty({
  kind,
  onChangePeriod,
  onResetFilters,
}: {
  kind: StatisticsPeriodEmptyKind;
  onChangePeriod: () => void;
  onResetFilters: () => void;
}) {
  const t = useTranslations("delivery.statistics.states");
  const isFiltered = kind === "filters";
  const scope = isFiltered ? "filteredEmpty" : "periodEmpty";

  return (
    <StatisticsSectionState
      action={
        <Button
          onClick={isFiltered ? onResetFilters : onChangePeriod}
          size="sm"
          variant="secondary"
        >
          {t(`${scope}.action`)}
        </Button>
      }
      description={t(`${scope}.description`)}
      kind="empty"
      title={t(`${scope}.title`)}
    />
  );
}

export function StatisticsRefetchError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("delivery.statistics.states");

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground"
      role="status"
    >
      <span className="flex items-start gap-2">
        <UiIcon
          aria-hidden
          className="mt-0.5 shrink-0 text-favorite"
          name="alert-circle"
          size={16}
        />
        {t("refetchError")}
      </span>
      <Button className="h-7 px-2 text-xs" onClick={onRetry} size="sm" variant="secondary">
        {t("error.retry")}
      </Button>
    </div>
  );
}

export function StatisticsRefreshingNote() {
  const t = useTranslations("delivery.statistics.states");

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <UiIcon
        aria-hidden
        className="shrink-0 animate-spin motion-reduce:animate-none"
        name="refresh"
        size={13}
      />
      {t("refreshing")}
    </p>
  );
}

export function StatisticsSectionState({
  action,
  description,
  kind,
  title,
}: {
  action?: ReactNode;
  description?: string;
  kind: StatisticsSectionStateKind;
  title: string;
}) {
  return (
    <div
      className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-4 text-sm"
      role={kind === "error" || kind === "unavailable" ? "alert" : undefined}
    >
      <span className={cn("flex items-center gap-2 font-medium", SECTION_TONE[kind])}>
        <UiIcon aria-hidden name={SECTION_ICON[kind]} size={15} />
        {title}
      </span>
      {description === undefined ? null : (
        <span className="text-muted-foreground">{description}</span>
      )}
      {action}
    </div>
  );
}

export function StatisticsSkeleton({
  activeAge,
  budget,
}: {
  activeAge: ReactNode;
  budget: ReactNode;
}) {
  const t = useTranslations("delivery.statistics.states");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-6" role="status">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="statistics-skeleton-kpi"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-[8.5rem] w-full rounded-xl" key={index} />
        ))}
      </div>
      {budget}
      <div
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3"
        data-testid="statistics-skeleton-dynamics"
      >
        <Skeleton className="h-[29rem] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[25rem] w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" data-testid="statistics-skeleton-costs" />
      <div
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
        data-testid="statistics-skeleton-stores"
      >
        <Skeleton className="h-[22rem] w-full rounded-xl" />
        <Skeleton className="h-[22rem] w-full rounded-xl" />
      </div>
      <div
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
        data-testid="statistics-skeleton-lifecycle"
      >
        <Skeleton className="h-64 w-full rounded-xl" />
        {activeAge}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" data-testid="statistics-skeleton-calendar" />
      <div
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3"
        data-testid="statistics-skeleton-records"
      >
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

export function StatisticsTruncationNotice({
  loadedOrdersCount,
  maxOrders,
}: {
  loadedOrdersCount: number;
  maxOrders: number;
}) {
  const t = useTranslations("delivery.statistics.states");

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground"
      role="status"
    >
      <UiIcon
        aria-hidden
        className="mt-0.5 shrink-0 text-favorite"
        name="alert-triangle"
        size={16}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{t("truncated.title")}</span>
        <span className="text-muted-foreground">
          {t("truncated.description", { loaded: loadedOrdersCount, max: maxOrders })}
        </span>
      </span>
    </div>
  );
}

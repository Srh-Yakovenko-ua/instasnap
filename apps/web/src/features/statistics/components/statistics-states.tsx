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

export type StatisticsSectionStateKind = "empty" | "error" | "insufficient" | "unavailable";

const SECTION_ICON: Record<StatisticsSectionStateKind, UiIconName> = {
  empty: "inbox",
  error: "alert-circle",
  insufficient: "info",
  unavailable: "circle-slash",
};

const SECTION_TONE: Record<StatisticsSectionStateKind, string> = {
  empty: "text-ink",
  error: "text-favorite",
  insufficient: "text-ink",
  unavailable: "text-muted-foreground",
};

export function StatisticsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("statistics.states");

  const entry: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  return (
    <div aria-live="assertive" role="alert">
      <EmptyState onPrimary={onRetry} state={entry} />
    </div>
  );
}

export function StatisticsNote({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warning";
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs",
        tone === "warning" ? "text-favorite" : "text-muted-foreground",
      )}
      role="status"
    >
      <UiIcon aria-hidden className="mt-0.5 shrink-0" name="info" size={13} />
      <span>{children}</span>
    </p>
  );
}

export function StatisticsPeriodEmpty({ onShowAllTime }: { onShowAllTime: () => void }) {
  const t = useTranslations("statistics.states");

  const entry: EmptyStateEntry = {
    desc: t("periodEmpty.description"),
    illu: "empty-library",
    primary: { icon: "chart", label: t("periodEmpty.action") },
    title: t("periodEmpty.title"),
  };

  return <EmptyState onPrimary={onShowAllTime} state={entry} />;
}

export function StatisticsRefetchError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("statistics.states");

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
  const t = useTranslations("statistics.states");

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
      role={kind === "error" ? "alert" : undefined}
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

export function StatisticsSkeleton() {
  const t = useTranslations("statistics.states");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-6" role="status">
      <Skeleton className="h-44 w-full rounded-xl" data-testid="statistics-skeleton-hero" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="statistics-skeleton-kpi">
        {Array.from({ length: 4 }, (_unused, index) => (
          <Skeleton className="h-[8.5rem] w-full rounded-xl" key={index} />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" data-testid="statistics-skeleton-insights" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Skeleton className="h-[24rem] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[24rem] w-full rounded-xl" />
      </div>
      <Skeleton
        className="h-[26rem] w-full rounded-xl"
        data-testid="statistics-skeleton-calendar"
      />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

"use client";

import type {
  Nullable,
  NumericMetricComparison,
  RateMetricComparison,
  ScoreMetricComparison,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import { formatPercentagePoints, formatRatingScore, formatShare } from "../model/statistics-format";

const DIRECTION_ICON = { down: "arrow-down", flat: "minus", up: "arrow-up" } as const;

type DeltaDirection = keyof typeof DIRECTION_ICON;

export function StatisticsCountDelta({
  comparison,
  current,
  formatValue,
}: {
  comparison: Nullable<NumericMetricComparison>;
  current: number;
  formatValue: (value: number) => string;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (comparison.absoluteDelta === 0) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  if (comparison.percentDelta === null) {
    return (
      <DeltaShell direction={toDirection(comparison.absoluteDelta)}>
        {t("fromZero", { current: formatValue(current) })}
      </DeltaShell>
    );
  }

  return (
    <DeltaShell direction={toDirection(comparison.absoluteDelta)}>
      <span className="font-medium text-foreground tabular-nums">
        {formatShare(Math.abs(comparison.percentDelta) / 100, locale)}%
      </span>
      <span>{t("previous", { previous: formatValue(comparison.previous) })}</span>
    </DeltaShell>
  );
}

export function StatisticsRateDelta({
  comparison,
}: {
  comparison: Nullable<RateMetricComparison>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (comparison.percentagePointDelta === 0) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  return (
    <DeltaShell direction={toDirection(comparison.percentagePointDelta)}>
      <span className="font-medium text-foreground tabular-nums">
        {t("percentagePoints", {
          value: formatPercentagePoints(comparison.percentagePointDelta, locale),
        })}
      </span>
      <span>{t("previous", { previous: `${formatShare(comparison.previousRate, locale)}%` })}</span>
    </DeltaShell>
  );
}

export function StatisticsScoreDelta({
  comparison,
}: {
  comparison: Nullable<ScoreMetricComparison>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.delta");

  if (comparison === null) return null;

  if (comparison.absoluteDelta === 0) {
    return <DeltaShell direction="flat">{t("unchanged")}</DeltaShell>;
  }

  return (
    <DeltaShell direction={toDirection(comparison.absoluteDelta)}>
      <span className="font-medium text-foreground tabular-nums">
        {formatRatingScore(Math.abs(comparison.absoluteDelta), locale)}
      </span>
      <span>{t("previous", { previous: formatRatingScore(comparison.previous, locale) })}</span>
    </DeltaShell>
  );
}

function DeltaShell({ children, direction }: { children: ReactNode; direction: DeltaDirection }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted-foreground">
      <UiIcon aria-hidden className="text-icon" name={DIRECTION_ICON[direction]} size={13} />
      {children}
    </span>
  );
}

function toDirection(value: number): DeltaDirection {
  if (value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

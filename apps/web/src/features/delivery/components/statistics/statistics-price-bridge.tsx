"use client";

import type { BookOrderStatisticsLandedCost, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsDataQualityNote, StatisticsSectionState } from "./statistics-states";

const BRIDGE_LAYOUT = {
  arrow: "size-4 rotate-90 self-center justify-self-center text-icon/70 lg:rotate-0",
  factors: "flex flex-col rounded-xl border border-dashed border-border px-3.5 py-1 lg:px-4",
  grid: "grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)_auto_minmax(0,1.1fr)] lg:items-stretch lg:gap-3",
  zone: "flex flex-col gap-1 rounded-xl border border-border px-4 py-3.5",
} as const;

const COVERAGE = {
  caution: 50,
  full: 100,
} as const;

type PriceFactor = {
  hint: string;
  key: PriceFactorKey;
  label: string;
  value: number;
};

type PriceFactorKey = "adjustment" | "delivery" | "discount";

const PRICE_FACTOR = {
  badge: {
    adjustment: "bg-muted text-muted-foreground",
    delivery: "bg-accent text-primary",
    discount: "bg-success-soft text-success",
  },
  icon: {
    adjustment: "settings",
    delivery: "truck",
    discount: "tag",
  },
  value: {
    adjustment: "text-muted-foreground",
    delivery: "text-primary",
    discount: "text-success",
  },
} as const satisfies {
  badge: Record<PriceFactorKey, string>;
  icon: Record<PriceFactorKey, UiIconName>;
  value: Record<PriceFactorKey, string>;
};

export function StatisticsPriceBridge({
  landed,
  money,
}: {
  landed: Nullable<BookOrderStatisticsLandedCost>;
  money: (amount: number) => string;
}) {
  const t = useTranslations("delivery.statistics.costs");

  if (
    landed === null ||
    landed.booksWithLandedCost === 0 ||
    landed.averageEligibleRawBookPrice === null ||
    landed.averageLandedBookCost === null
  ) {
    return <StatisticsSectionState kind="insufficient" title={t("bridge.insufficient")} />;
  }

  const factors: PriceFactor[] = (
    [
      {
        hint: t("bridge.discountHint"),
        key: "discount",
        label: t("bridge.discount"),
        value: landed.averageDiscountShare ?? 0,
      },
      {
        hint: t("bridge.deliveryHint"),
        key: "delivery",
        label: t("bridge.delivery"),
        value: landed.averageDeliveryShare ?? 0,
      },
      {
        hint: t("bridge.adjustmentHint"),
        key: "adjustment",
        label: t("bridge.adjustment"),
        value: landed.averageAdjustmentShare ?? 0,
      },
    ] satisfies PriceFactor[]
  ).filter((factor) => factor.value !== 0);

  return (
    <div className="flex flex-col gap-3">
      <div className={BRIDGE_LAYOUT.grid}>
        <PriceBridgeMetric
          helper={t("bridge.perBook")}
          hint={t("bridge.basePriceHint")}
          label={t("bridge.basePrice")}
          value={money(landed.averageEligibleRawBookPrice)}
        />

        <BridgeArrow />

        <ul className={BRIDGE_LAYOUT.factors}>
          {factors.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">{t("bridge.noFactors")}</li>
          ) : (
            factors.map((factor) => (
              <PriceFactorRow factor={factor} key={factor.key} money={money} />
            ))
          )}
        </ul>

        <BridgeArrow />

        <PriceBridgeMetric
          accent
          delta={<BridgeDelta delta={landed.deltaFromEligibleRawPrice ?? 0} money={money} />}
          helper={t("bridge.perBook")}
          hint={t("bridge.actualHint")}
          label={t("bridge.actual")}
          value={money(landed.averageLandedBookCost)}
        />
      </div>

      <CoverageInfo landed={landed} />
    </div>
  );
}

function BridgeArrow() {
  return <UiIcon aria-hidden className={BRIDGE_LAYOUT.arrow} name="arrow-right" size={16} />;
}

function BridgeDelta({ delta, money }: { delta: number; money: (amount: number) => string }) {
  const t = useTranslations("delivery.statistics.costs");

  if (delta === 0) {
    return <span className="text-xs text-muted-foreground">{t("bridge.deltaFlat")}</span>;
  }

  const above = delta > 0;

  return (
    <span
      className={cn(
        "inline-flex items-start gap-1 text-xs font-medium",
        above ? "text-primary" : "text-success",
      )}
    >
      <UiIcon aria-hidden className="mt-0.5" name={above ? "arrow-up" : "arrow-down"} size={13} />
      {above
        ? t("bridge.deltaAbove", { value: money(delta) })
        : t("bridge.deltaBelow", { value: money(Math.abs(delta)) })}
    </span>
  );
}

function BridgeHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={text}
        className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
        type="button"
      >
        <UiIcon name="info" size={12} />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{text}</TooltipContent>
    </Tooltip>
  );
}

function CoverageInfo({ landed }: { landed: BookOrderStatisticsLandedCost }) {
  const t = useTranslations("delivery.statistics.costs");
  const locale = useLocale();

  const counted =
    landed.booksWithLandedCost === landed.booksInScope
      ? t("coverage.all", { total: landed.booksInScope })
      : t("coverage.partial", {
          counted: landed.booksWithLandedCost,
          percent: formatPercentValue(landed.coveragePercent, locale),
          total: landed.booksInScope,
        });

  const bar =
    landed.coveragePercent >= COVERAGE.full ? null : (
      <Progress aria-hidden className="h-1 max-w-56" value={landed.coveragePercent} />
    );

  if (landed.coveragePercent < COVERAGE.caution) {
    return (
      <div className="flex flex-col gap-1.5">
        <StatisticsDataQualityNote kind="partial">
          {t("coverage.tooFew")} · {counted}
        </StatisticsDataQualityNote>
        {bar}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {counted}
        <BridgeHint text={t("coverage.hint")} />
      </p>
      {bar}
    </div>
  );
}

function PriceBridgeMetric({
  accent = false,
  delta,
  helper,
  hint,
  label,
  value,
}: {
  accent?: boolean;
  delta?: ReactNode;
  helper: string;
  hint: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        BRIDGE_LAYOUT.zone,
        accent ? "border-accent-border bg-accent/25" : "bg-background",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <BridgeHint text={hint} />
      </span>
      <span
        className={cn(
          "font-heading font-bold text-ink tabular-nums",
          accent ? "text-2xl" : "text-xl",
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{helper}</span>
      {delta}
    </div>
  );
}

function PriceFactorRow({
  factor,
  money,
}: {
  factor: PriceFactor;
  money: (amount: number) => string;
}) {
  const sign = factor.key === "discount" || factor.value < 0 ? "−" : "+";

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
      <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            PRICE_FACTOR.badge[factor.key],
          )}
        >
          <UiIcon aria-hidden name={PRICE_FACTOR.icon[factor.key]} size={13} />
        </span>
        <span className="min-w-0">{factor.label}</span>
        <BridgeHint text={factor.hint} />
      </span>
      <span
        className={cn(
          "shrink-0 font-medium whitespace-nowrap tabular-nums",
          PRICE_FACTOR.value[factor.key],
        )}
      >
        {sign}
        {money(Math.abs(factor.value))}
      </span>
    </li>
  );
}

"use client";

import type {
  BookOrderStatisticsLandedCost,
  BookOrderStatisticsView,
  Currency,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { formatMoney } from "../../model/money-format";
import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote, StatisticsSectionState } from "./statistics-states";

const COVERAGE_BANDS = {
  caution: 50,
  neutral: 90,
} as const;

const FULL_COVERAGE = 100;

type BridgeStage = {
  hint: string;
  icon: UiIconName;
  key: string;
  label: string;
  sign: string;
  toneClass: string;
  value: number;
};

export function StatisticsCosts({
  currency,
  view,
}: {
  currency: Currency;
  view: BookOrderStatisticsView;
}) {
  const t = useTranslations("delivery.statistics.costs");
  const locale = useLocale();

  const costs = view.costs.find((entry) => entry.currency === currency) ?? null;
  const landed = view.landedCost.find((entry) => entry.currency === currency) ?? null;

  const money = (amount: number) => formatMoney({ amount, currency, locale });
  const percent = (value: number) => formatPercentValue(value, locale);

  if (costs === null && landed === null) {
    return (
      <StatisticsSection
        action={<StatisticsCurrencyBadge currency={currency} />}
        description={t("subtitle")}
        title={t("title")}
      >
        <StatisticsSectionState kind="empty" title={t("emptyForCurrency", { currency })} />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      description={t("subtitle")}
      title={t("title")}
    >
      <PriceBridge landed={landed} money={money} />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-[0.8125rem] font-semibold text-ink">{t("periodTotals")}</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CostBlock
            icon="truck"
            lines={
              costs === null || costs.deliveryTotal === 0
                ? []
                : [
                    t("delivery.orders", { count: costs.ordersWithDeliveryCount }),
                    landed?.averageDeliveryShare === null || landed === null
                      ? null
                      : t("delivery.perBook", { value: money(landed.averageDeliveryShare) }),
                    costs.deliveryShareOfSpendPercent === null
                      ? null
                      : t("delivery.shareOfSpend", {
                          value: percent(costs.deliveryShareOfSpendPercent),
                        }),
                  ]
            }
            title={t("delivery.title")}
            value={
              costs === null || costs.deliveryTotal === 0
                ? t("delivery.zero")
                : money(costs.deliveryTotal)
            }
            zeroHelper={costs === null || costs.deliveryTotal === 0 ? t("inSelectedPeriod") : null}
          />

          <CostBlock
            icon="tag"
            lines={
              costs === null || costs.discountTotal === 0
                ? []
                : [
                    t("discount.orders", { count: costs.ordersWithDiscountCount }),
                    costs.discountShareOfRawSubtotalPercent === null
                      ? null
                      : t("discount.share", {
                          value: percent(costs.discountShareOfRawSubtotalPercent),
                        }),
                  ]
            }
            title={t("discount.title")}
            value={
              costs === null || costs.discountTotal === 0
                ? t("discount.zero")
                : t("discount.saved", { value: money(costs.discountTotal) })
            }
            zeroHelper={costs === null || costs.discountTotal === 0 ? t("inSelectedPeriod") : null}
          />
        </div>
      </div>
    </StatisticsSection>
  );
}

function BridgeHint({ text }: { text: string }): ReactNode {
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

function CostBlock({
  icon,
  lines,
  title,
  value,
  zeroHelper,
}: {
  icon: UiIconName;
  lines: Nullable<string>[];
  title: string;
  value: string;
  zeroHelper: Nullable<string>;
}) {
  const visible = lines.filter((line): line is string => line !== null);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <UiIcon aria-hidden name={icon} size={14} />
        {title}
      </span>
      <span className="font-heading text-lg font-semibold text-ink tabular-nums">{value}</span>
      {zeroHelper === null ? null : (
        <span className="text-xs text-muted-foreground">{zeroHelper}</span>
      )}
      {visible.map((line) => (
        <span className="text-xs text-muted-foreground" key={line}>
          {line}
        </span>
      ))}
    </div>
  );
}

function CoverageNote({ landed }: { landed: BookOrderStatisticsLandedCost }) {
  const t = useTranslations("delivery.statistics.costs");
  const locale = useLocale();

  if (landed.booksWithLandedCost === landed.booksInScope) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("coverage.all", { total: landed.booksInScope })}
      </p>
    );
  }

  const counted = t("coverage.partial", {
    counted: landed.booksWithLandedCost,
    percent: formatPercentValue(landed.coveragePercent, locale),
    total: landed.booksInScope,
  });

  if (landed.coveragePercent < COVERAGE_BANDS.caution) {
    return (
      <StatisticsDataQualityNote kind="partial">
        {t("coverage.tooFew")} · {counted}
      </StatisticsDataQualityNote>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{counted}</p>
      {landed.coveragePercent >= COVERAGE_BANDS.neutral ? null : (
        <p className="text-xs text-muted-foreground">{t("coverage.notAllBooks")}</p>
      )}
      <Progress
        aria-hidden
        className="h-1"
        value={Math.min(landed.coveragePercent, FULL_COVERAGE)}
      />
    </div>
  );
}

function PriceBridge({
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

  const stages: BridgeStage[] = (
    [
      {
        hint: t("bridge.discountHint"),
        icon: "tag",
        key: "discount",
        label: t("bridge.discount"),
        sign: "−",
        toneClass: "text-success",
        value: landed.averageDiscountShare ?? 0,
      },
      {
        hint: t("bridge.deliveryHint"),
        icon: "truck",
        key: "delivery",
        label: t("bridge.delivery"),
        sign: "+",
        toneClass: "text-primary",
        value: landed.averageDeliveryShare ?? 0,
      },
      {
        hint: t("bridge.adjustmentHint"),
        icon: "settings",
        key: "adjustment",
        label: t("bridge.adjustment"),
        sign: (landed.averageAdjustmentShare ?? 0) < 0 ? "−" : "+",
        toneClass: "text-muted-foreground",
        value: Math.abs(landed.averageAdjustmentShare ?? 0),
      },
    ] satisfies BridgeStage[]
  ).filter((stage) => stage.value !== 0);

  const delta = landed.deltaFromEligibleRawPrice ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("bridge.basePrice")}
          <BridgeHint text={t("bridge.basePriceHint")} />
        </span>
        <span className="font-heading text-lg font-semibold text-ink tabular-nums">
          {money(landed.averageEligibleRawBookPrice)}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {stages.map((stage) => (
          <li className="flex items-center justify-between gap-3 text-sm" key={stage.key}>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <UiIcon aria-hidden name={stage.icon} size={14} />
              {stage.label}
              <BridgeHint text={stage.hint} />
            </span>
            <span className={`font-medium tabular-nums ${stage.toneClass}`}>
              {stage.sign}
              {money(stage.value)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("bridge.actual")}
          <BridgeHint text={t("bridge.actualHint")} />
        </span>
        <span className="font-heading text-xl font-bold text-ink tabular-nums">
          {money(landed.averageLandedBookCost)}
        </span>
        <span className="text-xs text-muted-foreground">
          {delta === 0
            ? t("bridge.deltaFlat")
            : delta < 0
              ? t("bridge.deltaBelow", { value: money(Math.abs(delta)) })
              : t("bridge.deltaAbove", { value: money(delta) })}
        </span>
        <CoverageNote landed={landed} />
      </div>
    </div>
  );
}

"use client";

import type { BookBudgetOverview, BookBudgetStatus, Currency, Nullable } from "@app/shared";

import { BOOK_BUDGET_RULES, CurrencySchema } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { useCancelScheduledBudget, useCancelScheduledBudgetStop } from "../../api/use-book-budgets";
import { budgetMonthInSentence, budgetMonthStandalone } from "../../model/budget-month";
import { formatMoney } from "../../model/money-format";
import { StatisticsBudgetDialog } from "./statistics-budget-dialog";
import { StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote, StatisticsSectionState } from "./statistics-states";

const BUDGET_CURRENCIES = CurrencySchema.options;

const DEFAULT_BUDGET_CURRENCY: Currency = CurrencySchema.enum.UAH;

const FULL_PERCENT = 100;

export function StatisticsBudget({
  currency,
  onCurrencyChange,
  scope,
}: {
  currency: Nullable<Currency>;
  onCurrencyChange: (currency: Currency) => void;
  scope: StatisticsScopeState<BookBudgetOverview>;
}) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const overview = scope.data;
  const active = currency ?? DEFAULT_BUDGET_CURRENCY;
  const status = overview?.budgets.find((entry) => entry.currency === active) ?? null;

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented
            label={t("currencyLabel")}
            onValueChange={(next) => onCurrencyChange(next as Currency)}
            options={BUDGET_CURRENCIES.map((entry) => ({ label: entry, value: entry }))}
            value={active}
          />
          <Button onClick={() => setDialogOpen(true)} size="lg" variant="secondary">
            {t("edit")}
          </Button>
        </div>
      }
      description={
        overview === undefined
          ? undefined
          : t("monthCaption", { month: budgetMonthStandalone(overview.month, locale) })
      }
      snapshotLabel={t("scopeBadge")}
      title={
        <span className="inline-flex items-center gap-1.5">
          {t("title")}
          <Tooltip>
            <TooltipTrigger
              aria-label={t("scopeHint")}
              className="text-muted-foreground"
              type="button"
            >
              <UiIcon name="info" size={13} />
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{t("scopeHint")}</TooltipContent>
          </Tooltip>
        </span>
      }
    >
      {scope.isInitialLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : scope.isInitialError ? (
        <StatisticsSectionState
          action={
            <Button onClick={scope.retry} size="sm" variant="secondary">
              {t("retry")}
            </Button>
          }
          kind="error"
          title={t("loadFailed")}
        />
      ) : status === null ? (
        <StatisticsSectionState
          action={<Button onClick={() => setDialogOpen(true)}>{t("emptyCta")}</Button>}
          description={t("emptyDescription")}
          kind="empty"
          title={t("unconfigured", { currency: active })}
        />
      ) : (
        <BudgetStatusBody status={status} />
      )}

      <StatisticsBudgetDialog
        onOpenChange={setDialogOpen}
        open={isDialogOpen}
        overview={overview}
      />
    </StatisticsSection>
  );
}

function BudgetOutlook({
  currentMonth,
  isZeroSpend,
  money,
}: {
  currentMonth: NonNullable<BookBudgetStatus["currentMonth"]>;
  isZeroSpend: boolean;
  money: (amount: number) => string;
}) {
  const t = useTranslations("delivery.statistics.budget");

  if (isZeroSpend) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("zeroSpend")} {t("available", { value: money(currentMonth.remaining) })}
      </p>
    );
  }

  if (currentMonth.outlook === "forecast_pending") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("forecastPending", { day: BOOK_BUDGET_RULES.forecastMinimumElapsedDays })}
      </p>
    );
  }

  const forecast = currentMonth.forecast;

  return (
    <div className="flex flex-col gap-1">
      <p
        className={
          currentMonth.outlook === "on_track"
            ? "inline-flex items-center gap-1.5 text-sm text-success"
            : "inline-flex items-center gap-1.5 text-sm text-favorite"
        }
      >
        <UiIcon
          aria-hidden
          name={currentMonth.outlook === "on_track" ? "check-circle" : "alert-circle"}
          size={14}
        />
        {t(`outlook.${currentMonth.outlook}`)}
      </p>
      {forecast === null ? null : (
        <p className="text-sm text-muted-foreground">{t("forecast", { value: money(forecast) })}</p>
      )}
      {currentMonth.outlook === "at_risk" && currentMonth.projectedOverage !== null ? (
        <p className="text-sm text-favorite">
          {t("projectedOverage", { value: money(currentMonth.projectedOverage) })}
        </p>
      ) : null}
      {currentMonth.outlook === "on_track" && currentMonth.projectedRemaining !== null ? (
        <p className="text-sm text-muted-foreground">
          {t("projectedRemaining", { value: money(currentMonth.projectedRemaining) })}
        </p>
      ) : null}
      {currentMonth.isForecastComplete ? null : (
        <StatisticsDataQualityNote kind="estimated">
          {t("forecastPartial")}
        </StatisticsDataQualityNote>
      )}
    </div>
  );
}

function BudgetStatusBody({ status }: { status: BookBudgetStatus }) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();
  const { currency, currentMonth, spendCoverage } = status;
  const money = (amount: number) => formatMoney({ amount, currency, locale });

  if (currentMonth === null) {
    return (
      <div className="flex flex-col gap-3">
        <StatisticsSectionState kind="insufficient" title={t("notActiveYet")} />
        <UpcomingChanges status={status} />
      </div>
    );
  }

  const fill = Math.min(currentMonth.usedPercent, FULL_PERCENT);
  const isZeroSpend = currentMonth.spentToDate === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-xl font-bold text-ink tabular-nums">
          {t("progress", {
            budget: money(currentMonth.budget),
            spent: money(currentMonth.spentToDate),
          })}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(currentMonth.usedPercent, locale, { maximumFractionDigits: 0 })}%
        </span>
      </div>

      <Progress
        aria-label={t("progressAria", { currency })}
        aria-valuemax={FULL_PERCENT}
        aria-valuemin={0}
        aria-valuenow={Math.round(currentMonth.usedPercent)}
        className="h-2"
        value={fill}
      />

      <p className="text-sm text-muted-foreground">
        {currentMonth.remainingSigned >= 0
          ? t("remaining", { value: money(currentMonth.remaining) })
          : t("exceededBy", { value: money(Math.abs(currentMonth.remainingSigned)) })}
      </p>

      <BudgetOutlook currentMonth={currentMonth} isZeroSpend={isZeroSpend} money={money} />

      <p className="text-xs text-muted-foreground">
        {t("elapsedDays", {
          days: currentMonth.daysInMonth,
          elapsed: currentMonth.elapsedDays,
        })}
      </p>

      {spendCoverage.ordersWithoutResolvedAmount === 0 ? null : (
        <StatisticsDataQualityNote kind="partial">
          {t("uncountedOrders", { count: spendCoverage.ordersWithoutResolvedAmount })}
        </StatisticsDataQualityNote>
      )}

      <UpcomingChanges status={status} />
    </div>
  );
}

function UpcomingChanges({ status }: { status: BookBudgetStatus }) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();
  const cancelScheduled = useCancelScheduledBudget();
  const cancelStop = useCancelScheduledBudgetStop();
  const [next, ...rest] = status.upcomingChanges;

  if (next === undefined) {
    return null;
  }

  const isStop = next.kind === "stop";
  const month = budgetMonthInSentence(next.effectiveFromMonth, locale);

  return (
    <div className="flex flex-col gap-1 rounded-md bg-accent px-2.5 py-2">
      <span className="text-[0.6875rem] font-medium tracking-wide text-icon uppercase">
        {t(isStop ? "stopTitle" : "nextChangeTitle")}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-icon">
        {isStop
          ? t("stopping", { month })
          : t("scheduled", {
              month,
              value: formatMoney({
                amount: next.monthlyAmount ?? 0,
                currency: status.currency,
                locale,
              }),
            })}
        <Button
          className="h-6 px-2 text-xs"
          disabled={cancelScheduled.isPending || cancelStop.isPending}
          onClick={() => {
            if (isStop) {
              cancelStop.mutate(status.currency);
              toast.success(t("stopCancelled"));
              return;
            }
            cancelScheduled.mutate(status.currency);
            toast.success(t("scheduledCancelled"));
          }}
          size="sm"
          variant="ghost"
        >
          {t(isStop ? "cancelStop" : "cancelScheduled")}
        </Button>
      </span>
      {rest.length === 0 ? null : (
        <span className="text-xs text-icon">{t("moreChanges", { count: rest.length })}</span>
      )}
    </div>
  );
}

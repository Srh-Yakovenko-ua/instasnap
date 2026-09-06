"use client";

import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { formatShare } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";

const FORECAST_FRACTION = { maximumFractionDigits: 1 } as const;

export function LibraryBalanceSection({
  libraryBalance,
}: {
  libraryBalance: ReadingStatisticsLibraryBalanceSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.libraryBalance");

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{t("currentTbr")}</dt>
          <dd className="font-heading text-lg font-semibold text-ink tabular-nums">
            {t("currentTbrValue", {
              total: formatNumber(libraryBalance.currentOwnedTotal, locale),
              unread: formatNumber(libraryBalance.currentTbrCount, locale),
            })}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{t("readRatio")}</dt>
          <dd className="font-heading text-lg font-semibold text-ink tabular-nums">
            {libraryBalance.readRatio === null
              ? "—"
              : `${formatShare(libraryBalance.readRatio, locale)}%`}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{t("forecast")}</dt>
          <dd className="font-heading text-lg font-semibold text-ink tabular-nums">
            {libraryBalance.forecast.data === null
              ? "—"
              : t("forecastValue", {
                  months: formatNumber(
                    libraryBalance.forecast.data.monthsRemaining,
                    locale,
                    FORECAST_FRACTION,
                  ),
                })}
          </dd>
          {libraryBalance.forecast.data === null ? null : (
            <dd className="text-[0.6875rem] text-muted-foreground">
              {t("forecastPace", {
                rate: formatNumber(
                  libraryBalance.forecast.data.readsPerMonth,
                  locale,
                  FORECAST_FRACTION,
                ),
              })}
            </dd>
          )}
        </div>
      </dl>

      {libraryBalance.flow.availability === "unavailable" || libraryBalance.flow.data === null ? (
        <StatisticsSectionState
          description={t(`flowReason.${libraryBalance.flow.reason ?? "HISTORY_NOT_TRACKED"}`)}
          kind="unavailable"
          title={t("flowUnavailable")}
        />
      ) : (
        <p className="text-sm text-foreground tabular-nums">
          {t("flow", {
            inflow: libraryBalance.flow.data.inflow,
            net: libraryBalance.flow.data.netChange,
            outflow: libraryBalance.flow.data.outflow,
          })}
        </p>
      )}

      {libraryBalance.forecast.availability === "unavailable" ? (
        <StatisticsNote>
          {t(`forecastReason.${libraryBalance.forecast.reason ?? "INSUFFICIENT_SAMPLE"}`)}
        </StatisticsNote>
      ) : null}
    </StatisticsSection>
  );
}

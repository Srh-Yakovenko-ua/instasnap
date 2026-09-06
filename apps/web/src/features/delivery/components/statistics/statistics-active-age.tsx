"use client";

import type { ActiveMoneyAgeResponse } from "@app/shared";

import { ACTIVE_MONEY_AGE_BUCKET_DAYS, STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { formatCurrencyTotals } from "../../model/money-format";
import { buildStatisticsDrilldown } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const MIN_BAR_WIDTH = 4;

const PERCENT_MULTIPLIER = 100;

const UNKNOWN_DATE = "unknown_date";

const BUCKET_ORDER = [
  "0_7",
  "8_14",
  "15_30",
  "31_plus",
  "unknown_date",
] as const satisfies readonly ("unknown_date" | keyof typeof ACTIVE_MONEY_AGE_BUCKET_DAYS)[];

export function StatisticsActiveAge({
  drilldown,
  scope,
}: {
  drilldown: StatisticsDrilldownContext;
  scope: StatisticsScopeState<ActiveMoneyAgeResponse>;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const locale = useLocale();

  const data = scope.data;
  const buckets = (data?.buckets ?? [])
    .filter((bucket) => bucket.ordersCount > 0)
    .sort((left, right) => BUCKET_ORDER.indexOf(left.key) - BUCKET_ORDER.indexOf(right.key));
  const totalOrders = buckets.reduce((count, bucket) => count + bucket.ordersCount, 0);
  const peakOrders = Math.max(...buckets.map((bucket) => bucket.ordersCount), 1);
  const dated = buckets.filter((bucket) => bucket.key !== UNKNOWN_DATE);
  const undated = buckets.find((bucket) => bucket.key === UNKNOWN_DATE) ?? null;

  return (
    <StatisticsSection
      description={t("subtitle")}
      snapshotLabel={
        data === undefined ? undefined : t("asOf", { value: formatDate(data.asOf, locale) })
      }
      title={t("title")}
    >
      {scope.isInitialLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-12 w-full rounded-lg" key={index} />
          ))}
        </div>
      ) : scope.isInitialError ? (
        <StatisticsSectionState
          action={
            <Button onClick={scope.retry} size="sm" variant="secondary">
              {t("retry")}
            </Button>
          }
          kind="error"
          title={t("error")}
        />
      ) : buckets.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dated.map((bucket) => (
            <AgeBucketRow
              bucket={bucket}
              drilldown={drilldown}
              key={bucket.key}
              peakOrders={peakOrders}
              totalOrders={totalOrders}
            />
          ))}
          {undated === null ? null : (
            <li className="mt-1 border-t border-border pt-2">
              <AgeBucketRow
                bucket={undated}
                drilldown={drilldown}
                peakOrders={peakOrders}
                totalOrders={totalOrders}
              />
            </li>
          )}
        </ul>
      )}
    </StatisticsSection>
  );
}

function AgeBucketRow({
  bucket,
  drilldown,
  peakOrders,
  totalOrders,
}: {
  bucket: ActiveMoneyAgeResponse["buckets"][number];
  drilldown: StatisticsDrilldownContext;
  peakOrders: number;
  totalOrders: number;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const locale = useLocale();
  const share = totalOrders === 0 ? 0 : (bucket.ordersCount / totalOrders) * PERCENT_MULTIPLIER;

  const href = buildStatisticsDrilldown({
    context: drilldown,
    destination: "in_transit",
    metricKind: STATISTICS_METRIC_KIND.countOrStatus,
    scope: { ageBucket: bucket.key, kind: "age_bucket" },
  });
  const rowClass =
    "flex flex-col gap-1.5 rounded-lg border border-transparent px-2.5 py-2 transition-colors outline-none hover:border-accent-border hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50";

  const body = (
    <>
      <span className="flex items-center gap-3">
        <UiIcon
          aria-hidden
          className="shrink-0 text-icon"
          name={bucket.key === UNKNOWN_DATE ? "calendar" : "clock"}
          size={15}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{t(`buckets.${bucket.key}`)}</span>
          <span className="text-xs text-muted-foreground">
            {t("counts", { books: bucket.booksCount, orders: bucket.ordersCount })}
          </span>
        </span>
        <span className="shrink-0 text-end text-sm font-semibold text-ink tabular-nums">
          {formatCurrencyTotals(bucket.totalsByCurrency, locale)}
        </span>
        {href === null ? null : (
          <UiIcon aria-hidden className="shrink-0 text-icon" name="chevron-right" size={16} />
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary/70"
            style={{
              width: `${Math.max((bucket.ordersCount / peakOrders) * PERCENT_MULTIPLIER, MIN_BAR_WIDTH)}%`,
            }}
          />
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t("shareOfActive", {
            orders: bucket.ordersCount,
            value: formatPercentValue(share, locale),
          })}
        </span>
      </span>
    </>
  );

  return href === null ? (
    <div className={rowClass}>{body}</div>
  ) : (
    <Link className={rowClass} href={href}>
      {body}
    </Link>
  );
}

"use client";

import type {
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
  Currency,
  Nullable,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";

import { formatMoney } from "../../model/money-format";
import { toOrderStatusBadge } from "../../model/order-status-badge";
import { orderDrilldownLink } from "../../model/statistics-drilldown";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const TOP_ORDERS = {
  collapsedCount: 5,
  meta: " · ",
  ranks: [
    {
      badge: "border-primary/60 bg-accent text-primary ring-4 ring-primary/10",
      rank: 1,
      sprig: "text-primary/70",
    },
    {
      badge: "border-primary/40 bg-accent/70 text-primary ring-[3px] ring-primary/10",
      rank: 2,
      sprig: "text-primary/50",
    },
    {
      badge: "border-primary/25 bg-accent/50 text-primary ring-2 ring-primary/5",
      rank: 3,
      sprig: "text-primary/40",
    },
  ],
} as const;

export function StatisticsTopOrders({
  currency,
  drilldown,
  topOrdersByCurrency,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency;
}) {
  const t = useTranslations("delivery.statistics.topOrders");
  const [isExpanded, setIsExpanded] = useState(false);

  const group = topOrdersByCurrency.find((entry) => entry.currency === currency);
  const orders = group?.orders ?? [];
  const peak = orders.at(0)?.totalAmount ?? 0;
  const visible = orders.slice(0, TOP_ORDERS.collapsedCount);
  const hidden = orders.slice(TOP_ORDERS.collapsedCount);

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      description={t("subtitle")}
      title={t("title")}
    >
      {orders.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("emptyForCurrency", { currency })} />
      ) : (
        <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
          <ol className="flex flex-col divide-y divide-border">
            {visible.map((order, index) => (
              <TopOrderRow
                drilldown={drilldown}
                key={order.id}
                order={order}
                peak={peak}
                rank={index + 1}
              />
            ))}
          </ol>

          {hidden.length === 0 ? null : (
            <>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
                <ol className="flex flex-col divide-y divide-border border-t border-border">
                  {hidden.map((order, index) => (
                    <TopOrderRow
                      drilldown={drilldown}
                      key={order.id}
                      order={order}
                      peak={peak}
                      rank={TOP_ORDERS.collapsedCount + index + 1}
                    />
                  ))}
                </ol>
              </CollapsibleContent>

              <CollapsibleTrigger className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md text-xs font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {isExpanded ? t("collapse") : t("expand", { count: hidden.length })}
                <UiIcon aria-hidden name={isExpanded ? "chevron-up" : "chevron-down"} size={14} />
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      )}
    </StatisticsSection>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style = TOP_ORDERS.ranks.find((entry) => entry.rank === rank) ?? null;

  if (style === null) {
    return (
      <span className="grid size-7 shrink-0 place-items-center self-start rounded-full border border-transparent bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
        {rank}
      </span>
    );
  }

  return (
    <span className="flex shrink-0 flex-col items-center self-start">
      <span
        className={`grid size-7 place-items-center rounded-full border text-xs font-semibold tabular-nums ${style.badge}`}
      >
        {rank}
      </span>
      <UiIcon
        aria-hidden
        className={`-mt-0.5 ${style.sprig}`}
        data-testid="rank-sprig"
        name="sprig"
        size={12}
      />
    </span>
  );
}

function shareOf({ peak, value }: { peak: number; value: Nullable<number> }): number {
  if (peak <= 0 || value === null || value <= 0) return 0;
  return Math.min(value / peak, 1);
}

function TopOrderRow({
  drilldown,
  order,
  peak,
  rank,
}: {
  drilldown: StatisticsDrilldownContext;
  order: BookOrderStatisticsTopOrder;
  peak: number;
  rank: number;
}) {
  const t = useTranslations("delivery.statistics.topOrders");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();

  const meta = [
    order.storeName,
    order.orderDate === null ? null : formatDate(order.orderDate, locale),
    t("books", { count: order.booksCount }),
  ]
    .filter((part): part is string => part !== null && part !== "")
    .join(TOP_ORDERS.meta);

  const link = orderDrilldownLink({ context: drilldown, order });
  const rowClass =
    "grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:[&_.text-ink]:text-primary";

  const body = (
    <>
      <RankBadge rank={rank} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-ink">
          {order.orderNumber ?? t("untitledOrder")}
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
        <ValueBar share={shareOf({ peak, value: order.totalAmount })} />
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold text-ink tabular-nums">
          {formatMoney({ amount: order.totalAmount, currency: order.currency, locale })}
        </span>
        <span className="opacity-80">
          <StatusBadge entry={toOrderStatusBadge(order.derivedStatus, tStatus)} />
        </span>
      </span>
    </>
  );

  return (
    <li>
      {link === null ? (
        <div className={rowClass}>{body}</div>
      ) : (
        <Link className={rowClass} href={link.href}>
          {body}
        </Link>
      )}
    </li>
  );
}

function ValueBar({ share }: { share: number }) {
  return (
    <span aria-hidden className="block h-1.5 w-full rounded-full bg-accent">
      <span
        className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        data-testid="top-order-bar"
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}

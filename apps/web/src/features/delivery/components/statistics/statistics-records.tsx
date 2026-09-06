"use client";

import type {
  BookOrderStatisticsOrderIdentity,
  BookOrderStatisticsRecords,
  Currency,
  Nullable,
} from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES, STATISTICS_METRIC_KIND } from "@app/shared";
import { endOfMonth, format, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import type {
  StatisticsDrilldownContext,
  StatisticsDrilldownLink,
} from "../../model/statistics-drilldown";
import type { StatisticsDrilldownUnit } from "./statistics-drilldown-action";

import { formatMoney } from "../../model/money-format";
import { orderDrilldownLink, statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { monthLabel } from "../../model/statistics-dynamics";
import { formatDayLong, formatPeriodRange } from "../../model/statistics-format";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsDrilldownAction } from "./statistics-drilldown-action";
import { StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote } from "./statistics-states";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const META_SEPARATOR = " · ";

type RecordAction = {
  label: string;
  links: StatisticsDrilldownLink[];
  note: string;
};

type RecordGroup = {
  key: "financial" | "quantity";
  rows: RecordRow[];
};

type RecordRow = {
  action: Nullable<RecordAction>;
  helper: Nullable<string>;
  icon: UiIconName;
  key: string;
  links: StatisticsDrilldownLink[];
  missing: Nullable<string>;
  title: string;
  unit: StatisticsDrilldownUnit;
  value: Nullable<string>;
};

export function StatisticsRecords({
  currency,
  drilldown,
  records,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  records: BookOrderStatisticsRecords;
}) {
  const t = useTranslations("delivery.statistics.records");
  const locale = useLocale();

  const { isTruncated } = records.scope;
  const money = (amount: number) => formatMoney({ amount, currency, locale });
  const orderMeta = (order: BookOrderStatisticsOrderIdentity) =>
    [
      order.storeName,
      order.orderNumber,
      t("books", { count: order.booksCount }),
      order.orderDate === null ? null : formatDate(order.orderDate, locale),
    ]
      .filter((part): part is string => part !== null && part !== "")
      .join(META_SEPARATOR);
  const scopeDescription = () => {
    const { period } = records.scope;
    const range = formatPeriodRange({ from: period.from, locale, to: period.to });
    if (range !== null) return t("scope.range", { range });
    if (period.from !== null) return t("scope.from", { value: formatDayLong(period.from, locale) });
    if (period.to !== null) return t("scope.to", { value: formatDayLong(period.to, locale) });
    return t("scope.allTime");
  };

  const recordMonth = records.recordMonthByCurrency.find((entry) => entry.currency === currency);
  const largestOrder = records.largestOrderByCurrency.find((entry) => entry.currency === currency);
  const bestValue = records.bestValueStoreByCurrency.find((entry) => entry.currency === currency);
  const mostActive = records.mostActiveStore.byOrders;
  const { mostBooksInOrder } = records;

  const exactOrderLinks = (order: BookOrderStatisticsOrderIdentity) => {
    const link = orderDrilldownLink({ context: drilldown, order });
    return link === null ? [] : [link];
  };

  const aggregateLinks = (
    breakdown: Parameters<typeof statisticsDrilldownLinks>[0]["breakdown"],
    scope: Parameters<typeof statisticsDrilldownLinks>[0]["scope"],
    metricKind: Parameters<typeof statisticsDrilldownLinks>[0]["metricKind"],
  ) =>
    isTruncated
      ? []
      : statisticsDrilldownLinks({ breakdown, context: drilldown, metricKind, scope });

  const groups: RecordGroup[] = [
    {
      key: "financial",
      rows: [
        {
          action: null,
          helper:
            recordMonth === undefined
              ? null
              : t("recordMonth.helper", {
                  books: recordMonth.booksCount,
                  orders: recordMonth.ordersCount,
                }),
          icon: "flame",
          key: "recordMonth",
          links:
            recordMonth === undefined
              ? []
              : aggregateLinks(
                  recordMonth.drilldown,
                  {
                    from: `${recordMonth.month}-01`,
                    kind: "order_date_range",
                    to: endOfIsoMonth(recordMonth.month),
                  },
                  STATISTICS_METRIC_KIND.currencySpecificMoney,
                ),
          missing: t("recordMonth.missing", { currency }),
          title: t("recordMonth.title"),
          unit: "orders",
          value:
            recordMonth === undefined
              ? null
              : `${monthLabel(recordMonth.month, locale, true)} · ${money(recordMonth.total)}`,
        },
        {
          action: null,
          helper: largestOrder === undefined ? null : orderMeta(largestOrder.order),
          icon: "trophy",
          key: "largestOrder",
          links: largestOrder === undefined ? [] : exactOrderLinks(largestOrder.order),
          missing: t("largestOrder.missing", { currency }),
          title: t("largestOrder.title"),
          unit: "orders",
          value: largestOrder === undefined ? null : money(largestOrder.order.totalAmount),
        },
        {
          action:
            bestValue === undefined
              ? null
              : {
                  label: t("bestValue.action"),
                  links: statisticsDrilldownLinks({
                    breakdown: bestValue.drilldown,
                    context: drilldown,
                    metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
                    scope: { kind: "store", store: bestValue.store },
                  }),
                  note: t("bestValue.note"),
                },
          helper:
            bestValue === undefined
              ? t("bestValue.missingHelper", {
                  count: BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks,
                })
              : t("bestValue.helper", {
                  count: bestValue.eligibleBooksCount,
                  store: bestValue.store,
                }),
          icon: "sparkles",
          key: "bestValue",
          links: [],
          missing: t("bestValue.missing"),
          title: t("bestValue.title"),
          unit: "books",
          value: bestValue === undefined ? null : money(bestValue.averageLandedBookCost),
        },
      ],
    },
    {
      key: "quantity",
      rows: [
        {
          action: null,
          helper: mostBooksInOrder === null ? null : orderMeta(mostBooksInOrder),
          icon: "library",
          key: "mostBooks",
          links: mostBooksInOrder === null ? [] : exactOrderLinks(mostBooksInOrder),
          missing: t("mostBooks.missing"),
          title: t("mostBooks.title"),
          unit: "orders",
          value:
            mostBooksInOrder === null
              ? null
              : t("mostBooks.value", { count: mostBooksInOrder.booksCount }),
        },
        {
          action: null,
          helper:
            mostActive === null ? null : t("mostActive.helper", { books: mostActive.booksCount }),
          icon: "store",
          key: "mostActive",
          links:
            mostActive === null
              ? []
              : aggregateLinks(
                  mostActive.drilldown,
                  { kind: "store", store: mostActive.store },
                  STATISTICS_METRIC_KIND.countOrStatus,
                ),
          missing: t("mostActive.missing"),
          title: t("mostActive.title"),
          unit: "orders",
          value:
            mostActive === null
              ? null
              : t("mostActive.value", { count: mostActive.ordersCount, store: mostActive.store }),
        },
      ],
    },
  ];

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      description={scopeDescription()}
      title={t("title")}
    >
      {isTruncated ? (
        <StatisticsDataQualityNote kind="truncated">
          <span>
            <span className="font-medium">{t("truncated.title")}</span> · {t("truncated.helper")}
          </span>
        </StatisticsDataQualityNote>
      ) : null}

      {groups.map((group) => (
        <section className="flex flex-col gap-1" key={group.key}>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`groups.${group.key}`)}
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {group.rows.map((row) => (
              <li className="py-2.5 first:pt-1 last:pb-0" key={row.key}>
                <RecordEntry row={row} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </StatisticsSection>
  );
}

function endOfIsoMonth(month: string): string {
  return format(endOfMonth(parseISO(`${month}-01`)), ISO_DAY_FORMAT);
}

function RecordContextAction({ action }: { action: RecordAction }) {
  const only = action.links.at(0);

  if (only === undefined) {
    return <p className="pl-11 text-xs text-muted-foreground">{action.note}</p>;
  }

  return (
    <div className="flex flex-col gap-1 pl-11">
      <p className="text-xs text-muted-foreground">{action.note}</p>
      {action.links.length === 1 ? (
        <Link
          className="w-fit text-xs text-primary underline-offset-2 hover:underline"
          href={only.href}
        >
          {action.label} →
        </Link>
      ) : (
        <StatisticsDrilldownAction
          className="w-fit text-xs text-primary underline-offset-2 hover:underline"
          label={action.label}
          links={action.links}
          unit="orders"
        >
          {action.label} →
        </StatisticsDrilldownAction>
      )}
    </div>
  );
}

function RecordEntry({ row }: { row: RecordRow }) {
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name={row.icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{row.title}</span>
        {row.value === null ? (
          <span className="text-sm text-muted-foreground">{row.missing}</span>
        ) : (
          <span className="truncate text-sm font-semibold text-ink">{row.value}</span>
        )}
        {row.helper === null ? null : (
          <span className="truncate text-xs text-muted-foreground">{row.helper}</span>
        )}
      </span>
      {row.links.length === 0 ? null : (
        <UiIcon aria-hidden className="shrink-0 text-icon" name="chevron-right" size={16} />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <StatisticsDrilldownAction
        className="flex items-center gap-3 rounded-md transition-colors outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
        label={row.title}
        links={row.links}
        unit={row.unit}
      >
        {body}
      </StatisticsDrilldownAction>
      {row.action === null ? null : <RecordContextAction action={row.action} />}
    </div>
  );
}

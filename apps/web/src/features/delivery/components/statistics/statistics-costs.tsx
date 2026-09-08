"use client";

import type { BookOrderStatisticsView, Currency, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { StatCard, StatCardFooterGrid, StatCardFooterItem } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/format";

import { formatMoney } from "../../model/money-format";
import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsPriceBridge } from "./statistics-price-bridge";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const COST_CARD = {
  delivery: { icon: "truck", tone: "primary" },
  discount: { icon: "tag", tone: "success" },
} as const satisfies Record<CostCardKey, { icon: UiIconName; tone: StatCardIconTone }>;

type CostCard = {
  caption: string;
  footer: CostFooterItem[];
  key: CostCardKey;
  value: string;
};

type CostCardKey = "delivery" | "discount";

type CostFooterItem = {
  helper: string;
  key: string;
  label: string;
  value: string;
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
  const count = (value: number) => formatNumber(value, locale);

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

  const deliveryTotal = costs?.deliveryTotal ?? 0;
  const discountTotal = costs?.discountTotal ?? 0;

  const cards: CostCard[] = [
    {
      caption: deliveryTotal === 0 ? t("delivery.zero") : t("delivery.helper"),
      footer:
        costs === null || deliveryTotal === 0
          ? []
          : presentItems([
              {
                helper: t("delivery.orders.helper"),
                key: "orders",
                label: t("delivery.orders.label", { count: costs.ordersWithDeliveryCount }),
                value: count(costs.ordersWithDeliveryCount),
              },
              landed === null || landed.averageDeliveryShare === null
                ? null
                : {
                    helper: t("delivery.perBook.helper"),
                    key: "perBook",
                    label: t("delivery.perBook.label"),
                    value: money(landed.averageDeliveryShare),
                  },
              costs.deliveryShareOfSpendPercent === null
                ? null
                : {
                    helper: t("delivery.share.helper"),
                    key: "share",
                    label: t("delivery.share.label"),
                    value: percent(costs.deliveryShareOfSpendPercent),
                  },
            ]),
      key: "delivery",
      value: money(deliveryTotal),
    },
    {
      caption: discountTotal === 0 ? t("discount.zero") : t("discount.helper"),
      footer:
        costs === null || discountTotal === 0
          ? []
          : presentItems([
              {
                helper: t("discount.orders.helper"),
                key: "orders",
                label: t("discount.orders.label", { count: costs.ordersWithDiscountCount }),
                value: count(costs.ordersWithDiscountCount),
              },
              costs.discountShareOfRawSubtotalPercent === null
                ? null
                : {
                    helper: t("discount.share.helper"),
                    key: "share",
                    label: t("discount.share.label"),
                    value: percent(costs.discountShareOfRawSubtotalPercent),
                  },
              landed === null || landed.averageDiscountShare === null
                ? null
                : {
                    helper: t("discount.perBook.helper"),
                    key: "perBook",
                    label: t("discount.perBook.label"),
                    value: money(landed.averageDiscountShare),
                  },
            ]),
      key: "discount",
      value: money(discountTotal),
    },
  ];

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      description={t("subtitle")}
      title={t("title")}
    >
      <StatisticsPriceBridge landed={landed} money={money} />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-[0.8125rem] font-semibold text-ink">{t("periodTotals")}</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <StatCard
              caption={card.caption}
              className="h-full"
              footer={
                card.footer.length === 0 ? undefined : (
                  <StatCardFooterGrid>
                    {card.footer.map((item) => (
                      <StatCardFooterItem
                        helper={item.helper}
                        key={item.key}
                        label={item.label}
                        value={item.value}
                      />
                    ))}
                  </StatCardFooterGrid>
                )
              }
              icon={COST_CARD[card.key].icon}
              iconTone={COST_CARD[card.key].tone}
              key={card.key}
              label={t(`${card.key}.title`)}
              size="compact"
              value={card.value}
            />
          ))}
        </div>
      </div>
    </StatisticsSection>
  );
}

function presentItems(items: Nullable<CostFooterItem>[]): CostFooterItem[] {
  return items.filter((item): item is CostFooterItem => item !== null);
}

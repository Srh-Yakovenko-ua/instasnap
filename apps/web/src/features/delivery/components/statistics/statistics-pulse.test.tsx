import type { BookOrderStatisticsInsights, BookOrderStatisticsPulseSignal } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import { StatisticsPulse } from "./statistics-pulse";

const QUIET_SCOPE = {
  isPeriodFiltered: true,
  isTruncated: false,
  period: { from: null, to: null },
};

const SPEND_UAH: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 4000,
  code: "spend_change",
  currency: "UAH",
  current: 14000,
  percentDelta: 39.7,
  previous: 10000,
  tone: "neutral",
};

const SPEND_EUR: BookOrderStatisticsPulseSignal = {
  absoluteDelta: -20,
  code: "spend_change",
  currency: "EUR",
  current: 80,
  percentDelta: -20,
  previous: 100,
  tone: "neutral",
};

const ORDERS_CHANGE: BookOrderStatisticsPulseSignal = {
  absoluteDelta: 3,
  code: "orders_count_change",
  current: 15,
  percentDelta: 18,
  previous: 12,
  tone: "neutral",
};

const ORDERS_BUCKET: BookOrderStatisticsPulseSignal = {
  bucketKey: "2026-07",
  code: "record_orders_bucket",
  from: "2026-07-01",
  ordersCount: 15,
  scope: QUIET_SCOPE,
  to: "2026-07-31",
  tone: "neutral",
};

const DELIVERY: BookOrderStatisticsPulseSignal = {
  code: "delivery_share",
  currency: "UAH",
  deliveryShareOfSpendPercent: 12.5,
  deliveryTotal: 800,
  tone: "attention",
};

const DISCOUNT: BookOrderStatisticsPulseSignal = {
  code: "discount_savings",
  currency: "UAH",
  discountShareOfRawSubtotalPercent: 9,
  discountTotal: 500,
  tone: "positive",
};

function insightsOf(
  overrides: Partial<BookOrderStatisticsInsights> = {},
): BookOrderStatisticsInsights {
  return { books: [], orders: [], spendByCurrency: [], ...overrides };
}

function renderPulse({
  comparisonLabel = "липень 2025" as null | string,
  currency = "UAH" as "EUR" | "UAH",
  highlightedBucketKey = null as null | string,
  insights = insightsOf({ spendByCurrency: [{ currency: "UAH", signals: [SPEND_UAH] }] }),
  metric = "spend" as DynamicsMetric,
  onHighlightBucket = vi.fn(),
} = {}) {
  return renderWithProviders(
    <StatisticsPulse
      comparisonLabel={comparisonLabel}
      currency={currency}
      highlightedBucketKey={highlightedBucketKey}
      insights={insights}
      metric={metric}
      onHighlightBucket={onHighlightBucket}
    />,
  );
}

describe("StatisticsPulse", () => {
  it("names itself after a comparison when there is one to make", () => {
    renderPulse();

    expect(screen.getByText("Що змінилося")).toBeInTheDocument();
  });

  it("names itself after the period when nothing is being compared", () => {
    renderPulse({ comparisonLabel: null });

    expect(screen.getByText("Ключове за період")).toBeInTheDocument();
  });

  it("splits an insight into a label, a number and a helper instead of one sentence", () => {
    renderPulse();

    expect(screen.getByText("Витрати")).toBeInTheDocument();
    expect(screen.getByText("+39,7%")).toBeInTheDocument();
    expect(screen.getByText("проти липень 2025")).toBeInTheDocument();
  });

  it("shows the currency the page is on and never another one's insight", () => {
    renderPulse({
      currency: "EUR",
      insights: insightsOf({
        spendByCurrency: [
          { currency: "UAH", signals: [SPEND_UAH] },
          { currency: "EUR", signals: [SPEND_EUR] },
        ],
      }),
    });

    expect(screen.getByText("−20%")).toBeInTheDocument();
    expect(screen.queryByText("+39,7%")).toBe(null);
  });

  it("follows the chart into the order metric", () => {
    renderPulse({
      insights: insightsOf({
        orders: [ORDERS_CHANGE],
        spendByCurrency: [{ currency: "UAH", signals: [SPEND_UAH] }],
      }),
      metric: "orders",
    });

    expect(screen.getByText("Замовлень")).toBeInTheDocument();
    expect(screen.queryByText("Витрати")).toBe(null);
  });

  it("reads a fall as a direction, not as bad news", () => {
    renderPulse({
      currency: "EUR",
      insights: insightsOf({ spendByCurrency: [{ currency: "EUR", signals: [SPEND_EUR] }] }),
    });

    expect(screen.getByText("−20%")).toBeInTheDocument();
    expect(document.querySelector(".text-favorite")).toBeNull();
  });

  it("flags a heavy delivery and praises a real saving", () => {
    renderPulse({
      insights: insightsOf({
        spendByCurrency: [{ currency: "UAH", signals: [DELIVERY, DISCOUNT] }],
      }),
    });

    expect(screen.getByText("Доставка")).toBeInTheDocument();
    expect(screen.getByText("12,5%")).toBeInTheDocument();
    expect(screen.getByText("Знижки")).toBeInTheDocument();
    expect(document.querySelector(".text-favorite")).not.toBeNull();
    expect(document.querySelector(".text-success")).not.toBeNull();
  });

  it("says the period held no noticeable change rather than leaving the card blank", () => {
    renderPulse({ insights: insightsOf() });

    expect(screen.getByText("Помітних змін за цей період не виявлено.")).toBeInTheDocument();
  });

  it("asks for more data when there is nothing to compare against either", () => {
    renderPulse({ comparisonLabel: null, insights: insightsOf() });

    expect(screen.getByText("Недостатньо даних для ключових висновків.")).toBeInTheDocument();
  });

  it("points the chart at the column a bucket insight is about", async () => {
    const user = userEvent.setup();
    const onHighlightBucket = vi.fn();
    renderPulse({
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
      onHighlightBucket,
    });

    await user.hover(screen.getByText("15 замовлень"));

    expect(onHighlightBucket).toHaveBeenCalledWith("2026-07");
  });

  it("marks the row the chart is pointing back at", () => {
    renderPulse({
      highlightedBucketKey: "2026-07",
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
    });

    const row = screen.getByText("15 замовлень").closest("li");
    expect(row?.className).toContain("bg-accent");
  });

  it("offers no click affordance to a row that leads nowhere", () => {
    renderPulse();

    expect(screen.queryByRole("button")).toBe(null);
  });

  it("gives a bucket insight a real control the keyboard can reach", async () => {
    const user = userEvent.setup();
    const onHighlightBucket = vi.fn();
    renderPulse({
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
      onHighlightBucket,
    });

    await user.tab();

    expect(screen.getByRole("button")).toHaveFocus();
    expect(onHighlightBucket).toHaveBeenCalledWith("2026-07");
  });
});

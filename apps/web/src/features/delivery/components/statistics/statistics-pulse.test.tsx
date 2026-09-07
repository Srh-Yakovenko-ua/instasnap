import type {
  BookOrderStatisticsInsights,
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsRecords,
} from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import { StatisticsPulse } from "./statistics-pulse";

const QUIET_SCOPE = {
  isPeriodFiltered: true,
  isTruncated: false,
  period: { from: null, to: null },
};

const ALL_TIME_SCOPE = {
  isPeriodFiltered: false,
  isTruncated: false,
  period: { from: null, to: null },
};

const EMPTY_RECORDS: BookOrderStatisticsRecords = {
  bestValueStoreByCurrency: [],
  largestOrderByCurrency: [],
  mostActiveStore: { byBooks: null, byOrders: null },
  mostBooksInOrder: null,
  recordMonthByCurrency: [],
  scope: QUIET_SCOPE,
};

const LARGEST_ORDER = {
  booksCount: 4,
  currency: "UAH" as const,
  derivedStatus: "received" as const,
  id: "order-largest",
  orderDate: "2026-03-03",
  orderNumber: "A-1",
  storeName: "Yakaboo",
  totalAmount: 5200,
};

const RICH_RECORDS: BookOrderStatisticsRecords = {
  ...EMPTY_RECORDS,
  bestValueStoreByCurrency: [
    {
      averageLandedBookCost: 620,
      currency: "UAH",
      drilldown: { targets: [] },
      eligibleBooksCount: 9,
      store: "Vivat",
      storeKey: "vivat",
    },
  ],
  largestOrderByCurrency: [{ currency: "UAH", order: LARGEST_ORDER }],
  mostActiveStore: {
    byBooks: {
      booksCount: 20,
      drilldown: { targets: [] },
      ordersCount: 9,
      store: "Yakaboo",
      storeKey: "yakaboo",
    },
    byOrders: {
      booksCount: 20,
      drilldown: { targets: [] },
      ordersCount: 9,
      store: "Yakaboo",
      storeKey: "yakaboo",
    },
  },
  mostBooksInOrder: { ...LARGEST_ORDER, booksCount: 11, id: "order-most-books" },
  recordMonthByCurrency: [
    {
      booksCount: 20,
      currency: "UAH",
      drilldown: { targets: [] },
      month: "2026-03",
      ordersCount: 9,
      total: 12000,
    },
  ],
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
  records = EMPTY_RECORDS,
} = {}) {
  return renderWithProviders(
    <StatisticsPulse
      comparisonLabel={comparisonLabel}
      currency={currency}
      highlightedBucketKey={highlightedBucketKey}
      insights={insights}
      metric={metric}
      onHighlightBucket={onHighlightBucket}
      records={records}
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
      comparisonLabel: null,
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
      onHighlightBucket,
    });

    await user.hover(screen.getByText("15 замовлень"));

    expect(onHighlightBucket).toHaveBeenCalledWith("2026-07");
  });

  it("marks the row the chart is pointing back at", () => {
    renderPulse({
      comparisonLabel: null,
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
      comparisonLabel: null,
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
      onHighlightBucket,
    });

    await user.tab();

    expect(screen.getByRole("button")).toHaveFocus();
    expect(onHighlightBucket).toHaveBeenCalledWith("2026-07");
  });
});

describe("StatisticsPulse records preview", () => {
  it("tops the period card up from the records once the insights run out", () => {
    renderPulse({ comparisonLabel: null, insights: insightsOf(), records: RICH_RECORDS });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("найбільше витрат за період")).toBeInTheDocument();
    expect(screen.getByText("Найдорожче замовлення")).toBeInTheDocument();
    expect(screen.getByText("Найнижча фактична ціна книги")).toBeInTheDocument();
  });

  it("keeps the records out of the comparison card", () => {
    renderPulse({ records: RICH_RECORDS });

    expect(screen.getByText("Витрати")).toBeInTheDocument();
    expect(screen.queryByText("Найдорожче замовлення")).toBe(null);
  });

  it("shows the period fact under the comparison title when no change crossed the threshold", () => {
    renderPulse({
      insights: insightsOf({ orders: [ORDERS_BUCKET] }),
      metric: "orders",
      records: RICH_RECORDS,
    });

    expect(screen.getByText("Що змінилося")).toBeInTheDocument();
    expect(screen.getByText("15 замовлень")).toBeInTheDocument();
    expect(screen.queryByText("Помітних змін за цей період не виявлено.")).toBe(null);
    expect(screen.queryByText("Найдорожче замовлення")).toBe(null);
  });

  it("claims an all-time record only when the payload has no period bounds", () => {
    renderPulse({
      comparisonLabel: null,
      insights: insightsOf(),
      records: { ...RICH_RECORDS, scope: ALL_TIME_SCOPE },
    });

    expect(screen.getByText("найбільше витрат за весь час")).toBeInTheDocument();
  });

  it("names the store that sold the most books when the chart is on books", () => {
    renderPulse({
      comparisonLabel: null,
      insights: insightsOf(),
      metric: "books",
      records: RICH_RECORDS,
    });

    expect(screen.getByText("Найбільше книг в одному замовленні")).toBeInTheDocument();
    expect(screen.getByText("Найбільше книг куплено в магазині")).toBeInTheDocument();
    expect(screen.getByText("20 книг")).toBeInTheDocument();
  });

  it("gives each row of a card its own glyph", () => {
    renderPulse({ comparisonLabel: null, insights: insightsOf(), records: RICH_RECORDS });

    const glyphs = screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector("svg")?.getAttribute("class"));

    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

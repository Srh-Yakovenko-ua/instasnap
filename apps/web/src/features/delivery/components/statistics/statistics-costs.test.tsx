import type { BookOrderStatisticsView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsCosts } from "./statistics-costs";

const EMPTY_STAGES = {
  active: 0,
  cancelled: 0,
  partially_received: 0,
  partially_shipped: 0,
  received: 0,
  shipped: 0,
  total: 0,
};

function renderCosts({
  currency = "UAH" as const,
  data = view(),
}: {
  budgetShare?: null | number;
  currency?: "EUR" | "UAH" | "USD";
  data?: BookOrderStatisticsView;
} = {}) {
  return renderWithProviders(<StatisticsCosts currency={currency} view={data} />);
}

const LANDED = {
  averageAdjustmentShare: 0,
  averageDeliveryShare: 10.26,
  averageDiscountShare: 11.4,
  averageEligibleRawBookPrice: 725.06,
  averageLandedBookCost: 710.87,
  booksInScope: 57,
  booksWithLandedCost: 55,
  coveragePercent: 96.5,
  currency: "UAH",
  deltaFromEligibleRawPrice: -14.19,
} satisfies BookOrderStatisticsView["landedCost"][number];

function view(overrides: Partial<BookOrderStatisticsView> = {}): BookOrderStatisticsView {
  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison: null,
    costs: [
      {
        currency: "UAH",
        deliveryCostPerBook: 10.26,
        deliveryShareOfSpendPercent: 1.5,
        deliveryTotal: 585,
        discountShareOfRawSubtotalPercent: 1.8,
        discountTotal: 650,
        ordersWithDeliveryCount: 7,
        ordersWithDiscountCount: 4,
      },
    ],
    daily: [],
    dynamics: { buckets: [], granularity: "month" },
    insights: { books: [], orders: [], spendByCurrency: [] },
    landedCost: [LANDED],
    lifecycle: { books: EMPTY_STAGES, comparison: null, orders: EMPTY_STAGES },
    meta: {
      activeSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
      comparisonPeriod: null,
      comparisonSource: null,
      currentPeriod: { from: null, to: null },
      currentSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
    },
    monthly: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: { isPeriodFiltered: false, isTruncated: false, period: { from: null, to: null } },
    },
    snapshot: {
      activeBooksCount: 0,
      activeMoneyCoverageByCurrency: [],
      activeOrdersCount: 0,
      activeShipmentsCount: 0,
      activeTotalsByCurrency: [],
    },
    summary: {
      activeBooksCount: 0,
      activeShipmentsCount: 0,
      activeTotalsByCurrency: [],
      averageBookPriceByCurrency: [{ average: 725.06, currency: "UAH" }],
      averageBooksPerOrder: null,
      averageOrderAmountByCurrency: [],
      booksCount: 0,
      cancelledOrdersCount: 0,
      cancelledTotalsByCurrency: [],
      financialCoverageByCurrency: [],
      ordersCount: 0,
      priceCoverageByCurrency: [],
      receivedBooksCount: 0,
      receivedTotalsByCurrency: [],
      shipmentsCount: 0,
      totalsByCurrency: [],
    },
    topOrders: [],
    topOrdersByCurrency: [],
    ...overrides,
  };
}

const BRIDGED = view({});

describe("StatisticsCosts", () => {
  it("names the block after the question it answers", () => {
    renderCosts();

    expect(screen.getByText("Як формується ціна книги")).toBeInTheDocument();
    expect(screen.queryByText("З чого складається вартість")).not.toBeInTheDocument();
  });

  it("bridges the starting price to what a book actually cost", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.getByText("725,06 UAH")).toBeInTheDocument();
    expect(screen.getByText("Фактично за книгу")).toBeInTheDocument();
    expect(screen.getByText("710,87 UAH")).toBeInTheDocument();
  });

  it("signs every bridge stage so the colour is never the only clue", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.getByText("−11,4 UAH")).toBeInTheDocument();
    expect(screen.getByText("+10,26 UAH")).toBeInTheDocument();
  });

  it("hides a stage that rounded to nothing", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.queryByText("Коригування замовлень")).not.toBeInTheDocument();
  });

  it("says how far the actual cost sits from the starting price", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.getByText("на 14,19 UAH дешевше за початкову середню ціну")).toBeInTheDocument();
  });

  it("counts the books the average was actually built on", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.getByText(/Розраховано для 55 із 57 книг/)).toBeInTheDocument();
  });

  it("says nothing about coverage once every book is counted", () => {
    renderCosts({
      data: view({
        landedCost: [
          {
            ...LANDED,
            booksWithLandedCost: 57,
            coveragePercent: 100,
          },
        ],
      }),
    });

    expect(screen.getByText("Розраховано для всіх 57 книг")).toBeInTheDocument();
  });

  it("refuses to price a book it has no eligible data for", () => {
    renderCosts({
      data: view({
        landedCost: [
          {
            ...LANDED,
            averageEligibleRawBookPrice: null,
            averageLandedBookCost: null,
            booksWithLandedCost: 0,
          },
        ],
      }),
    });

    expect(
      screen.getByText("Недостатньо даних для розрахунку фактичної ціни книги."),
    ).toBeInTheDocument();
  });

  it("keeps the period totals apart from the per-book bridge", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.getByText("За вибраний період")).toBeInTheDocument();
    expect(screen.getByText("585 UAH")).toBeInTheDocument();
    expect(screen.getByText("650 UAH заощаджено")).toBeInTheDocument();
  });

  it("says there was no delivery rather than showing four zeros", () => {
    renderCosts({
      data: view({
        costs: [
          {
            currency: "UAH",
            deliveryCostPerBook: null,
            deliveryShareOfSpendPercent: null,
            deliveryTotal: 0,
            discountShareOfRawSubtotalPercent: null,
            discountTotal: 0,
            ordersWithDeliveryCount: 0,
            ordersWithDiscountCount: 0,
          },
        ],
      }),
    });

    expect(screen.getByText("Без витрат на доставку")).toBeInTheDocument();
    expect(screen.getByText("Знижок не було")).toBeInTheDocument();
  });

  it("never names the budget in this block", () => {
    renderCosts({ data: BRIDGED });

    expect(screen.queryByText(/бюджету/)).not.toBeInTheDocument();
  });

  it("says a currency has no data rather than showing dashes", () => {
    renderCosts({ currency: "EUR" });

    expect(screen.getByText("Немає даних у EUR за вибраний період.")).toBeInTheDocument();
  });
});

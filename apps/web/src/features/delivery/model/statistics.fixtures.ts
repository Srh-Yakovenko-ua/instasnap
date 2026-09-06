import type {
  ActiveMoneyAgeResponse,
  BookBudgetOverview,
  BookOrderStatisticsLifecycleStageCounts,
  BookOrderStatisticsSnapshot,
  BookOrderStatisticsStore,
  BookOrderStatisticsSummary,
  BookOrderStatisticsView,
} from "@app/shared";

import { normalizeName } from "@app/shared";

const EMPTY_STAGES: BookOrderStatisticsLifecycleStageCounts = {
  active: 0,
  cancelled: 0,
  partially_received: 0,
  partially_shipped: 0,
  received: 0,
  shipped: 0,
  total: 0,
};

const SNAPSHOT: BookOrderStatisticsSnapshot = {
  activeBooksCount: 4,
  activeMoneyCoverageByCurrency: [],
  activeOrdersCount: 3,
  activeShipmentsCount: 3,
  activeTotalsByCurrency: [{ currency: "UAH", total: 1200 }],
};

const SUMMARY: BookOrderStatisticsSummary = {
  activeBooksCount: 4,
  activeShipmentsCount: 3,
  activeTotalsByCurrency: SNAPSHOT.activeTotalsByCurrency,
  averageBookPriceByCurrency: [{ average: 300, currency: "UAH" }],
  averageBooksPerOrder: 2,
  averageOrderAmountByCurrency: [{ average: 600, currency: "UAH" }],
  booksCount: 12,
  cancelledOrdersCount: 0,
  cancelledTotalsByCurrency: [],
  financialCoverageByCurrency: [],
  ordersCount: 6,
  priceCoverageByCurrency: [],
  receivedBooksCount: 8,
  receivedTotalsByCurrency: [{ currency: "UAH", total: 2400 }],
  shipmentsCount: 6,
  totalsByCurrency: [{ currency: "UAH", total: 3600 }],
};

export function makeActiveMoneyAge(
  overrides: Partial<ActiveMoneyAgeResponse> = {},
): ActiveMoneyAgeResponse {
  return {
    asOf: "2026-08-26T09:00:00.000Z",
    buckets: [],
    source: { isTruncated: false, loadedOrdersCount: 3, maxOrders: 5000 },
    ...overrides,
  };
}

export function makeBookBudgetOverview(
  overrides: Partial<BookBudgetOverview> = {},
): BookBudgetOverview {
  return { budgets: [], month: "2026-08-01", ...overrides };
}

export function makeMixedStatisticsView(
  overrides: Partial<BookOrderStatisticsView> = {},
): BookOrderStatisticsView {
  const yakaboo = makeStatisticsStore({
    averageBookPriceByCurrency: [{ average: 600, currency: "UAH" }],
    averageLandedBookCostByCurrency: [{ average: 620, currency: "UAH" }],
    averageOrderAmountByCurrency: [{ average: 3000, currency: "UAH" }],
    booksCount: 10,
    booksCountByCurrency: [{ count: 10, currency: "UAH" }],
    drilldown: { targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }] },
    landedCoverageByCurrency: [
      { booksInScope: 10, booksWithLandedCost: 9, coveragePercent: 90, currency: "UAH" },
    ],
    landedEligibleBooksCountByCurrency: [{ count: 10, currency: "UAH" }],
    ordersCount: 4,
    ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
    store: "Yakaboo",
    totalsByCurrency: [{ currency: "UAH", total: 12000 }],
  });
  const depository = makeStatisticsStore({
    averageBookPriceByCurrency: [{ average: 30, currency: "EUR" }],
    averageLandedBookCostByCurrency: [{ average: 32, currency: "EUR" }],
    averageOrderAmountByCurrency: [{ average: 60, currency: "EUR" }],
    booksCount: 6,
    booksCountByCurrency: [{ count: 6, currency: "EUR" }],
    drilldown: { targets: [{ booksCount: 6, destination: "in_transit", ordersCount: 3 }] },
    landedCoverageByCurrency: [
      { booksInScope: 6, booksWithLandedCost: 6, coveragePercent: 100, currency: "EUR" },
    ],
    landedEligibleBooksCountByCurrency: [{ count: 6, currency: "EUR" }],
    ordersCount: 3,
    ordersCountByCurrency: [{ count: 3, currency: "EUR" }],
    store: "Book Depository",
    totalsByCurrency: [{ currency: "EUR", total: 180 }],
  });

  const stages: BookOrderStatisticsLifecycleStageCounts = {
    active: 2,
    cancelled: 0,
    partially_received: 0,
    partially_shipped: 1,
    received: 4,
    shipped: 0,
    total: 7,
  };

  return makeStatisticsView({
    bestValueStoreByCurrency: [
      {
        averageLandedBookCost: 620,
        currency: "UAH",
        drilldown: {
          targets: [{ booksCount: 9, destination: "history_received", ordersCount: 4 }],
        },
        eligibleBooksCount: 9,
        store: "Yakaboo",
        storeKey: "yakaboo",
      },
    ],
    byStore: [yakaboo, depository],
    costs: [
      {
        currency: "UAH",
        deliveryCostPerBook: 45,
        deliveryShareOfSpendPercent: 3.75,
        deliveryTotal: 450,
        discountShareOfRawSubtotalPercent: 8,
        discountTotal: 1000,
        ordersWithDeliveryCount: 4,
        ordersWithDiscountCount: 2,
      },
      {
        currency: "EUR",
        deliveryCostPerBook: 2,
        deliveryShareOfSpendPercent: 6.67,
        deliveryTotal: 12,
        discountShareOfRawSubtotalPercent: null,
        discountTotal: 0,
        ordersWithDeliveryCount: 3,
        ordersWithDiscountCount: 0,
      },
    ],
    daily: [
      {
        booksCount: 10,
        date: "2026-03-03",
        drilldown: {
          targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }],
        },
        ordersCount: 4,
        totalsByCurrency: [{ currency: "UAH", total: 12000 }],
      },
      {
        booksCount: 6,
        date: "2026-05-11",
        drilldown: { targets: [{ booksCount: 6, destination: "in_transit", ordersCount: 3 }] },
        ordersCount: 3,
        totalsByCurrency: [{ currency: "EUR", total: 180 }],
      },
    ],
    dynamics: {
      buckets: [
        {
          comparison: null,
          current: {
            booksCount: 10,
            booksPerOrder: 2.5,
            from: "2026-03-01",
            ordersCount: 4,
            to: "2026-03-31",
            totalsByCurrency: [{ currency: "UAH", total: 12000 }],
          },
          drilldown: {
            targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }],
          },
          key: "2026-03",
        },
        {
          comparison: null,
          current: {
            booksCount: 6,
            booksPerOrder: 2,
            from: "2026-05-01",
            ordersCount: 3,
            to: "2026-05-31",
            totalsByCurrency: [{ currency: "EUR", total: 180 }],
          },
          drilldown: { targets: [{ booksCount: 6, destination: "in_transit", ordersCount: 3 }] },
          key: "2026-05",
        },
      ],
      granularity: "month",
    },
    landedCost: [
      {
        averageAdjustmentShare: 0,
        averageDeliveryShare: 7.25,
        averageDiscountShare: 4,
        averageEligibleRawBookPrice: 600,
        averageLandedBookCost: 620,
        booksInScope: 10,
        booksWithLandedCost: 9,
        coveragePercent: 90,
        currency: "UAH",
        deltaFromEligibleRawPrice: 20,
      },
      {
        averageAdjustmentShare: 0,
        averageDeliveryShare: 6.25,
        averageDiscountShare: 0,
        averageEligibleRawBookPrice: 30,
        averageLandedBookCost: 32,
        booksInScope: 6,
        booksWithLandedCost: 6,
        coveragePercent: 100,
        currency: "EUR",
        deltaFromEligibleRawPrice: 2,
      },
    ],
    lifecycle: { books: stages, comparison: null, orders: stages },
    monthly: [
      {
        booksCount: 10,
        month: "2026-03",
        ordersCount: 4,
        totalsByCurrency: [{ currency: "UAH", total: 12000 }],
      },
      {
        booksCount: 6,
        month: "2026-05",
        ordersCount: 3,
        totalsByCurrency: [{ currency: "EUR", total: 180 }],
      },
    ],
    records: {
      bestValueStoreByCurrency: [
        {
          averageLandedBookCost: 620,
          currency: "UAH",
          drilldown: {
            targets: [{ booksCount: 9, destination: "history_received", ordersCount: 4 }],
          },
          eligibleBooksCount: 9,
          store: "Yakaboo",
          storeKey: "yakaboo",
        },
      ],
      largestOrderByCurrency: [
        {
          currency: "UAH",
          order: {
            booksCount: 4,
            currency: "UAH",
            derivedStatus: "received",
            id: "order-uah-1",
            orderDate: "2026-03-03",
            orderNumber: "STAT-A-UAH-1",
            storeName: "Yakaboo",
            totalAmount: 5200,
          },
        },
      ],
      mostActiveStore: {
        byBooks: null,
        byOrders: {
          booksCount: 10,
          drilldown: {
            targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }],
          },
          ordersCount: 4,
          store: "Yakaboo",
          storeKey: "yakaboo",
        },
      },
      mostBooksInOrder: {
        booksCount: 4,
        currency: "UAH",
        derivedStatus: "received",
        id: "order-uah-1",
        orderDate: "2026-03-03",
        orderNumber: "STAT-A-UAH-1",
        storeName: "Yakaboo",
        totalAmount: 5200,
      },
      recordMonthByCurrency: [
        {
          booksCount: 10,
          currency: "UAH",
          drilldown: {
            targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }],
          },
          month: "2026-03",
          ordersCount: 4,
          total: 12000,
        },
      ],
      scope: {
        isPeriodFiltered: true,
        isTruncated: false,
        period: { from: "2026-01-01", to: "2026-08-26" },
      },
    },
    snapshot: {
      activeBooksCount: 6,
      activeMoneyCoverageByCurrency: [
        { currency: "EUR", ordersInScope: 3, ordersWithResolvedAmount: 3 },
      ],
      activeOrdersCount: 3,
      activeShipmentsCount: 3,
      activeTotalsByCurrency: [{ currency: "EUR", total: 180 }],
    },
    summary: {
      ...SUMMARY,
      activeBooksCount: 6,
      activeShipmentsCount: 3,
      activeTotalsByCurrency: [{ currency: "EUR", total: 180 }],
      averageBookPriceByCurrency: [
        { average: 600, currency: "UAH" },
        { average: 30, currency: "EUR" },
      ],
      averageBooksPerOrder: 2.3,
      averageOrderAmountByCurrency: [
        { average: 3000, currency: "UAH" },
        { average: 60, currency: "EUR" },
      ],
      booksCount: 16,
      financialCoverageByCurrency: [
        { currency: "UAH", ordersInScope: 4, ordersWithResolvedAmount: 4 },
        { currency: "EUR", ordersInScope: 3, ordersWithResolvedAmount: 3 },
      ],
      ordersCount: 7,
      priceCoverageByCurrency: [
        { booksInScope: 10, booksWithPrice: 9, currency: "UAH" },
        { booksInScope: 6, booksWithPrice: 6, currency: "EUR" },
      ],
      receivedBooksCount: 10,
      receivedTotalsByCurrency: [{ currency: "UAH", total: 12000 }],
      shipmentsCount: 7,
      totalsByCurrency: [
        { currency: "UAH", total: 12000 },
        { currency: "EUR", total: 180 },
      ],
    },
    topOrdersByCurrency: [
      {
        currency: "UAH",
        orders: [
          {
            booksCount: 4,
            currency: "UAH",
            derivedStatus: "received",
            id: "order-uah-1",
            orderDate: "2026-03-03",
            orderNumber: "STAT-A-UAH-1",
            storeName: "Yakaboo",
            totalAmount: 5200,
          },
        ],
      },
      {
        currency: "EUR",
        orders: [
          {
            booksCount: 2,
            currency: "EUR",
            derivedStatus: "shipped",
            id: "order-eur-1",
            orderDate: "2026-05-11",
            orderNumber: "STAT-A-EUR-1",
            storeName: "Book Depository",
            totalAmount: 72,
          },
        ],
      },
      { currency: "USD", orders: [] },
    ],
    ...overrides,
  });
}

export function makeStatisticsStore(
  overrides: Partial<BookOrderStatisticsStore> & { store: string },
): BookOrderStatisticsStore {
  return {
    averageBookPriceByCurrency: [],
    averageBooksPerOrder: null,
    averageLandedBookCostByCurrency: [],
    averageOrderAmountByCurrency: [],
    booksCount: 0,
    booksCountByCurrency: [],
    deliveryTotalByCurrency: [],
    discountTotalByCurrency: [],
    drilldown: { targets: [] },
    landedCoverageByCurrency: [],
    landedEligibleBooksCountByCurrency: [],
    ordersCount: 0,
    ordersCountByCurrency: [],
    storeKey: normalizeName(overrides.store),
    totalsByCurrency: [],
    ...overrides,
  };
}

export function makeStatisticsView(
  overrides: Partial<BookOrderStatisticsView> = {},
): BookOrderStatisticsView {
  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison: null,
    costs: [],
    daily: [],
    dynamics: { buckets: [], granularity: "month" },
    insights: { books: [], orders: [], spendByCurrency: [] },
    landedCost: [],
    lifecycle: { books: EMPTY_STAGES, comparison: null, orders: EMPTY_STAGES },
    meta: {
      activeSource: { isTruncated: false, loadedOrdersCount: 3, maxOrders: 5000 },
      comparisonPeriod: null,
      comparisonSource: null,
      currentPeriod: { from: "2026-01-01", to: "2026-08-26" },
      currentSource: { isTruncated: false, loadedOrdersCount: 6, maxOrders: 5000 },
    },
    monthly: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: {
        isPeriodFiltered: true,
        isTruncated: false,
        period: { from: "2026-01-01", to: "2026-08-26" },
      },
    },
    snapshot: SNAPSHOT,
    summary: SUMMARY,
    topOrders: [],
    topOrdersByCurrency: [],
    ...overrides,
  };
}

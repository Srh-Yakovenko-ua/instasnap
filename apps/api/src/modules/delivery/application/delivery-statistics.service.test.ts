import type { BookOrderStatisticsQuery } from "@app/shared";

import { BookOrderStatisticsViewSchema } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderStatisticsRecordsPage } from "../domain/order-statistics-page.js";
import type { OrderStatisticsRecord } from "../domain/statistics-scope.js";
import type { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

import { capOrderStatisticsIds, ORDER_STATISTICS_FETCH } from "../domain/order-statistics-page.js";
import { DeliveryStatisticsService } from "./delivery-statistics.service.js";

const USER = "user-1";
const NOW = new Date("2026-08-20T09:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

function buildOrderRecords(count: number): OrderStatisticsRecord[] {
  return Array.from({ length: count }, (_unused, index): OrderStatisticsRecord => ({
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id: `order-${index}`,
    isFree: false,
    items: [],
    orderDate: null,
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
  }));
}

function repositoryHolding(ordersCount: number): DeliveryStatisticsRepository {
  const fetchedRowsCount = Math.min(
    ordersCount,
    ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
  );

  return repositoryWithRecords(buildOrderRecords(fetchedRowsCount));
}

function repositoryWithRecords(
  records: OrderStatisticsRecord[],
  activeRecords: OrderStatisticsRecord[] = [],
): DeliveryStatisticsRepository {
  return {
    listActiveOrderRecords: vi.fn().mockResolvedValue(toPage(activeRecords)),
    listOrderRecords: vi.fn().mockResolvedValue(toPage(records)),
  } as unknown as DeliveryStatisticsRepository;
}

function repositoryWithSources({
  activeRecords = [],
  comparisonRecords = [],
  currentFrom,
  records = [],
}: {
  activeRecords?: OrderStatisticsRecord[];
  comparisonRecords?: OrderStatisticsRecord[];
  currentFrom: string;
  records?: OrderStatisticsRecord[];
}): DeliveryStatisticsRepository {
  return {
    listActiveOrderRecords: vi.fn().mockResolvedValue(toPage(activeRecords)),
    listOrderRecords: vi
      .fn()
      .mockImplementation(({ from }: { from?: string }) =>
        Promise.resolve(toPage(from === currentFrom ? records : comparisonRecords)),
      ),
  } as unknown as DeliveryStatisticsRepository;
}

function statisticsQuery(
  overrides: Partial<BookOrderStatisticsQuery> = {},
): BookOrderStatisticsQuery {
  return { includeCancelled: false, ...overrides };
}

function toPage(records: OrderStatisticsRecord[]): OrderStatisticsRecordsPage {
  const { ids, ...quality } = capOrderStatisticsIds(records.map((record) => record.id));
  return { ...quality, records: records.slice(0, ids.length) };
}

describe("DeliveryStatisticsService.statistics", () => {
  it("parses the query dates and counts in orders, not in book rows", async () => {
    const repository = repositoryWithRecords([
      {
        currency: "UAH",
        deliveryPrice: null,
        discount: null,
        id: "order-1",
        isFree: false,
        items: [
          {
            bookId: "book-a",
            bookTitle: "Alpha",
            cancelledAt: null,
            id: "item-a",
            price: 100,
            receivedAt: null,
            shipmentId: "shipment-1",
          },
          {
            bookId: "book-b",
            bookTitle: "Beta",
            cancelledAt: null,
            id: "item-b",
            price: 50,
            receivedAt: null,
            shipmentId: "shipment-1",
          },
        ],
        orderDate: new Date("2026-08-01T00:00:00.000Z"),
        orderNumber: "A-1",
        shipments: [
          { cancelledAt: null, id: "shipment-1", receivedAt: null, status: "in_transit" },
        ],
        storeName: "Bookstore",
        totalAmount: 150,
      },
    ]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: "2026-07-01", userId: USER }),
    );
    expect(result.summary.ordersCount).toBe(1);
    expect(result.summary.booksCount).toBe(2);
    expect(result.summary.shipmentsCount).toBe(1);
  });

  it("filters the read on the very same period it reports", async () => {
    const repository = repositoryWithRecords([]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01", to: "2026-07-31" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: "2026-07-01", to: "2026-07-31" }),
    );
    expect(result.meta.currentPeriod).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(result.meta.comparisonPeriod).toBeNull();
  });

  it("closes an open-ended period at today to report it, but not to read by it", async () => {
    const repository = repositoryWithRecords([]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(result.meta.currentPeriod).toEqual({ from: null, to: "2026-08-20" });
    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: undefined, to: undefined }),
    );
  });

  it("reads money in transit with the same filters and no dates at all", async () => {
    const repository = repositoryWithRecords([]);
    const service = new DeliveryStatisticsService(repository);

    await service.statistics({
      query: statisticsQuery({
        currency: "EUR",
        from: "2026-07-01",
        orderState: "shipped",
        store: "Yakaboo",
        to: "2026-07-31",
      }),
      userId: USER,
    });

    expect(vi.mocked(repository.listActiveOrderRecords).mock.calls[0]?.[0]).toEqual({
      currency: "EUR",
      orderState: "shipped",
      store: "Yakaboo",
      userId: USER,
    });
  });

  it("builds the snapshot from the active read rather than the period read", async () => {
    const stillMoving: OrderStatisticsRecord = {
      currency: "UAH",
      deliveryPrice: null,
      discount: null,
      id: "order-moving",
      isFree: false,
      items: [
        {
          bookId: "book-moving",
          bookTitle: "Still moving",
          cancelledAt: null,
          id: "item-moving",
          price: 340,
          receivedAt: null,
          shipmentId: "shipment-moving",
        },
      ],
      orderDate: new Date("2024-03-14T00:00:00.000Z"),
      orderNumber: null,
      shipments: [
        { cancelledAt: null, id: "shipment-moving", receivedAt: null, status: "in_transit" },
      ],
      storeName: "Yakaboo",
      totalAmount: 340,
    };
    const service = new DeliveryStatisticsService(repositoryWithRecords([], [stillMoving]));

    const view = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01", to: "2026-07-31" }),
      userId: USER,
    });

    expect(view.summary.ordersCount).toBe(0);
    expect(view.snapshot).toEqual({
      activeBooksCount: 1,
      activeMoneyCoverageByCurrency: [
        { currency: "UAH", ordersInScope: 1, ordersWithResolvedAmount: 1 },
      ],
      activeOrdersCount: 1,
      activeShipmentsCount: 1,
      activeTotalsByCurrency: [{ currency: "UAH", total: 340 }],
    });
  });
});

describe("DeliveryStatisticsService.statistics truncation", () => {
  it("reports a full read when one order short of the cap is stored", async () => {
    const ordersCount = ORDER_STATISTICS_FETCH.maxOrders - 1;
    const service = new DeliveryStatisticsService(repositoryHolding(ordersCount));

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta.currentSource).toEqual({
      isTruncated: false,
      loadedOrdersCount: ordersCount,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ordersCount);
  });

  it("reports a full read when exactly the cap is stored", async () => {
    const ordersCount = ORDER_STATISTICS_FETCH.maxOrders;
    const service = new DeliveryStatisticsService(repositoryHolding(ordersCount));

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta.currentSource).toEqual({
      isTruncated: false,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ordersCount);
  });

  it("reports a truncated read when one order past the cap is stored", async () => {
    const service = new DeliveryStatisticsService(
      repositoryHolding(ORDER_STATISTICS_FETCH.maxOrders + 1),
    );

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta.currentSource).toEqual({
      isTruncated: true,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ORDER_STATISTICS_FETCH.maxOrders);
  });
});

describe("DeliveryStatisticsService.statistics source quality", () => {
  const CURRENT_FROM = "2026-07-01";
  const CURRENT_TO = "2026-07-31";

  function comparedQuery(): BookOrderStatisticsQuery {
    return statisticsQuery({ compare: "previous_period", from: CURRENT_FROM, to: CURRENT_TO });
  }

  it("reports the comparison period's own completeness, not the current one's", async () => {
    const service = new DeliveryStatisticsService(
      repositoryWithSources({
        comparisonRecords: buildOrderRecords(
          ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
        ),
        currentFrom: CURRENT_FROM,
        records: buildOrderRecords(3),
      }),
    );

    const { meta } = await service.statistics({ query: comparedQuery(), userId: USER });

    expect(meta.currentSource).toEqual({
      isTruncated: false,
      loadedOrdersCount: 3,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(meta.comparisonSource).toEqual({
      isTruncated: true,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
  });

  it("keeps a truncated current period from claiming the comparison was cut too", async () => {
    const service = new DeliveryStatisticsService(
      repositoryWithSources({
        comparisonRecords: buildOrderRecords(4),
        currentFrom: CURRENT_FROM,
        records: buildOrderRecords(
          ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
        ),
      }),
    );

    const { meta } = await service.statistics({ query: comparedQuery(), userId: USER });

    expect(meta.currentSource.isTruncated).toBe(true);
    expect(meta.comparisonSource).toEqual({
      isTruncated: false,
      loadedOrdersCount: 4,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
  });

  it("leaves the comparison quality absent when no comparison was asked for", async () => {
    const service = new DeliveryStatisticsService(repositoryWithRecords(buildOrderRecords(2)));

    const { meta } = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(meta.comparisonPeriod).toBeNull();
    expect(meta.comparisonSource).toBeNull();
  });

  it("says the active snapshot was cut short instead of stopping at the cap in silence", async () => {
    const service = new DeliveryStatisticsService(
      repositoryWithSources({
        activeRecords: buildOrderRecords(
          ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
        ),
        currentFrom: CURRENT_FROM,
        records: buildOrderRecords(2),
      }),
    );

    const { meta } = await service.statistics({ query: comparedQuery(), userId: USER });

    expect(meta.activeSource).toEqual({
      isTruncated: true,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(meta.currentSource.isTruncated).toBe(false);
  });

  it("reports the same completeness for the standalone active-age read", async () => {
    const service = new DeliveryStatisticsService(
      repositoryWithSources({
        activeRecords: buildOrderRecords(
          ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
        ),
        currentFrom: CURRENT_FROM,
      }),
    );

    const { source } = await service.activeMoneyAge({ query: {}, userId: USER });

    expect(source).toEqual({
      isTruncated: true,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
  });
});

describe("DeliveryStatisticsService.statistics contract", () => {
  it("returns a truncated read that still satisfies the shared response contract", async () => {
    const service = new DeliveryStatisticsService(
      repositoryHolding(ORDER_STATISTICS_FETCH.maxOrders + 1),
    );

    const view = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(BookOrderStatisticsViewSchema.parse(view).meta.currentSource.isTruncated).toBe(true);
    expect(BookOrderStatisticsViewSchema.parse(view).records.scope.isTruncated).toBe(true);
  });

  it("returns an empty read as empty arrays and null scalars, not as placeholder rows", async () => {
    const service = new DeliveryStatisticsService(repositoryWithRecords([]));

    const view = BookOrderStatisticsViewSchema.parse(
      await service.statistics({ query: statisticsQuery(), userId: USER }),
    );

    expect({
      byStore: view.byStore,
      comparison: view.comparison,
      costs: view.costs,
      daily: view.daily,
      insights: view.insights,
      landedCost: view.landedCost,
      monthly: view.monthly,
      topOrdersByCurrency: view.topOrdersByCurrency,
    }).toEqual({
      byStore: [],
      comparison: null,
      costs: [],
      daily: [],
      insights: { books: [], orders: [], spendByCurrency: [] },
      landedCost: [],
      monthly: [],
      topOrdersByCurrency: [],
    });
  });
});

describe("DeliveryStatisticsService.statistics query shape", () => {
  it("reads the orders once, never once per store or per bucket", async () => {
    const repository = repositoryWithRecords(buildOrderRecords(50));
    const service = new DeliveryStatisticsService(repository);

    const view = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(vi.mocked(repository.listOrderRecords)).toHaveBeenCalledTimes(1);
    expect(view.summary.ordersCount).toBe(50);
  });

  it("adds exactly one more read when a comparison period is asked for", async () => {
    const repository = repositoryWithRecords(buildOrderRecords(10));
    const service = new DeliveryStatisticsService(repository);

    await service.statistics({
      query: statisticsQuery({ compare: "previous_period", from: "2026-07-01", to: "2026-07-31" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repository.listOrderRecords).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ from: "2026-06-01", to: "2026-06-30" }),
    );
  });
});

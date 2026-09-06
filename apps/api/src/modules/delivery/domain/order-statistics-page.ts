import type { StatisticsSourceQuality } from "@app/shared";

import type { OrderStatisticsRecord } from "./statistics-scope.js";

export const ORDER_STATISTICS_FETCH = Object.freeze({
  maxOrders: 5000,
  overshootRows: 1,
});

export type OrderStatisticsIdsPage = StatisticsSourceQuality & {
  ids: string[];
};

export type OrderStatisticsRecordsPage = StatisticsSourceQuality & {
  records: OrderStatisticsRecord[];
};

export function capOrderStatisticsIds(fetchedIds: string[]): OrderStatisticsIdsPage {
  const isTruncated = fetchedIds.length > ORDER_STATISTICS_FETCH.maxOrders;
  const ids = isTruncated ? fetchedIds.slice(0, ORDER_STATISTICS_FETCH.maxOrders) : fetchedIds;

  return {
    ids,
    isTruncated,
    loadedOrdersCount: ids.length,
    maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
  };
}

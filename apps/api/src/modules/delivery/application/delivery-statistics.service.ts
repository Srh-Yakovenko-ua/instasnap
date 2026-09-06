import type {
  ActiveMoneyAgeQuery,
  ActiveMoneyAgeResponse,
  BookOrderStatisticsQuery,
  BookOrderStatisticsView,
  Nullable,
  StatisticsComparisonPeriod,
  StatisticsPeriod,
  StatisticsSourceQuality,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { OrderStatisticsRecordsPage } from "../domain/order-statistics-page.js";

import { buildActiveMoneyAge } from "../domain/active-age.js";
import {
  computeBookOrderStatistics,
  ORDER_STATISTICS_TOP_LIMIT,
} from "../domain/order-statistics.js";
import { resolveStatisticsPeriods } from "../domain/statistics-period.js";
import { classifyOrder } from "../domain/statistics-scope.js";
import { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

@Injectable()
export class DeliveryStatisticsService {
  constructor(private readonly deliveryStatisticsRepository: DeliveryStatisticsRepository) {}

  async activeMoneyAge({
    query,
    userId,
  }: {
    query: ActiveMoneyAgeQuery;
    userId: string;
  }): Promise<ActiveMoneyAgeResponse> {
    const now = new Date();
    const page = await this.deliveryStatisticsRepository.listActiveOrderRecords({
      currency: query.currency,
      orderState: query.orderState,
      store: query.store,
      userId,
    });

    return {
      ...buildActiveMoneyAge({
        now,
        orders: page.records.map((record) => classifyOrder({ includeCancelled: false, record })),
      }),
      source: toSourceQuality(page),
    };
  }

  async statistics({
    query,
    userId,
  }: {
    query: BookOrderStatisticsQuery;
    userId: string;
  }): Promise<BookOrderStatisticsView> {
    const { comparisonPeriod, currentPeriod, requestedPeriod } = resolveStatisticsPeriods({
      compare: query.compare,
      from: query.from,
      now: new Date(),
      to: query.to,
    });

    const [page, activePage, comparisonPage] = await Promise.all([
      this.deliveryStatisticsRepository.listOrderRecords({
        currency: query.currency,
        from: requestedPeriod.from,
        orderState: query.orderState,
        store: query.store,
        to: requestedPeriod.to,
        userId,
      }),
      this.deliveryStatisticsRepository.listActiveOrderRecords({
        currency: query.currency,
        orderState: query.orderState,
        store: query.store,
        userId,
      }),
      this.loadComparisonPage({ comparisonPeriod, query, userId }),
    ]);

    return {
      ...computeBookOrderStatistics({
        activeRecords: activePage.records,
        comparisonPeriod: toComparisonPeriod(comparisonPeriod),
        includeCancelled: query.includeCancelled,
        previousRecords: comparisonPage === null ? null : comparisonPage.records,
        records: page.records,
        scope: {
          isPeriodFiltered: isPeriodFiltered(query),
          isTruncated: page.isTruncated,
          period: currentPeriod,
        },
        topLimit: ORDER_STATISTICS_TOP_LIMIT,
      }),
      meta: {
        activeSource: toSourceQuality(activePage),
        comparisonPeriod,
        comparisonSource: comparisonPage === null ? null : toSourceQuality(comparisonPage),
        currentPeriod,
        currentSource: toSourceQuality(page),
      },
    };
  }

  private async loadComparisonPage({
    comparisonPeriod,
    query,
    userId,
  }: {
    comparisonPeriod: Nullable<StatisticsComparisonPeriod>;
    query: BookOrderStatisticsQuery;
    userId: string;
  }): Promise<Nullable<OrderStatisticsRecordsPage>> {
    if (comparisonPeriod === null) {
      return null;
    }

    return this.deliveryStatisticsRepository.listOrderRecords({
      currency: query.currency,
      from: comparisonPeriod.from,
      orderState: query.orderState,
      store: query.store,
      to: comparisonPeriod.to,
      userId,
    });
  }
}

function isPeriodFiltered(query: BookOrderStatisticsQuery): boolean {
  return (
    query.from !== undefined ||
    query.to !== undefined ||
    query.currency !== undefined ||
    query.orderState !== undefined ||
    query.store !== undefined
  );
}

function toComparisonPeriod(
  comparisonPeriod: Nullable<StatisticsComparisonPeriod>,
): Nullable<StatisticsPeriod> {
  return comparisonPeriod === null
    ? null
    : { from: comparisonPeriod.from, to: comparisonPeriod.to };
}

function toSourceQuality({
  isTruncated,
  loadedOrdersCount,
  maxOrders,
}: OrderStatisticsRecordsPage): StatisticsSourceQuality {
  return { isTruncated, loadedOrdersCount, maxOrders };
}

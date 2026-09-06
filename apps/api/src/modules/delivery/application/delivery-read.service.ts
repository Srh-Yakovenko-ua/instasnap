import type {
  BookOrderHistoryFacetsQuery,
  BookOrderHistoryFacetsView,
  BookOrderHistoryOutcomeView,
  BookOrderHistoryQuery,
  BookOrderHistorySummaryView,
  BookOrderItemRowView,
  BookPreview,
  DeliveryBookPreview,
  DeliveryFacetEntry,
  InTransitFacetsView,
  InTransitImpactView,
  InTransitQuery,
  InTransitSummaryView,
  LatestReceiptView,
  NextShipmentView,
  PaginatedOrderHistoryGroups,
  Paginator,
  ReceivedUnreadView,
} from "@app/shared";

import {
  HISTORY_RECEIPT_LIMITS,
  NEXT_SHIPMENT_LIMITS,
  normalizeSearch,
  OwnershipStatusSchema,
  ReadingStatusSchema,
  resolveBookOrderHistorySort,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  BookOrderItemRow,
  DeliveryBookPreviewRow,
  LatestReceiptData,
  NextShipmentData,
} from "../infrastructure/delivery-read.repository.js";
import type {
  ReceivedUnreadCounts,
  ReceivedUnreadPreviewRow,
} from "../infrastructure/history-outcome.repository.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { MediaService } from "../../media/index.js";
import { buildInTransitSummaryView } from "../domain/delivery-summary.js";
import { deliveryDateBounds } from "../domain/delivery-ui-status.js";
import { buildInTransitImpact } from "../domain/in-transit-impact.js";
import { toLatestReceiptView } from "../domain/latest-receipt.mapper.js";
import { toNextShipmentView } from "../domain/next-shipment.mapper.js";
import { toOrderHistoryGroups } from "../domain/order-history-group.mapper.js";
import { buildOrderHistorySummaryView } from "../domain/order-history-summary.js";
import { toBookOrderItemRowView } from "../domain/order-item-row.mapper.js";
import { buildReceivedSeriesInsights } from "../domain/received-series-insight.js";
import { DeliveryImpactRepository } from "../infrastructure/delivery-impact.repository.js";
import { DeliveryReadRepository } from "../infrastructure/delivery-read.repository.js";
import { HistoryOutcomeRepository } from "../infrastructure/history-outcome.repository.js";

@Injectable()
export class DeliveryReadService {
  constructor(
    private readonly deliveryImpactRepository: DeliveryImpactRepository,
    private readonly deliveryReadRepository: DeliveryReadRepository,
    private readonly historyOutcomeRepository: HistoryOutcomeRepository,
    private readonly mediaService: MediaService,
  ) {}

  async historyFacets({
    query,
    userId,
  }: {
    query: BookOrderHistoryFacetsQuery;
    userId: string;
  }): Promise<BookOrderHistoryFacetsView> {
    const rows = await this.deliveryReadRepository.historyFacets({ tab: query.tab, userId });

    return {
      services: sortFacetEntries(rows.services),
      stores: sortFacetEntries(rows.stores),
    };
  }

  async historyList({
    query,
    userId,
  }: {
    query: BookOrderHistoryQuery;
    userId: string;
  }): Promise<PaginatedOrderHistoryGroups> {
    const { today } = deliveryDateBounds(new Date());
    const filter = {
      booksMax: query.booksMax,
      booksMin: query.booksMin,
      cancelledFrom: query.cancelledFrom,
      cancelledTo: query.cancelledTo,
      currency: query.currency,
      from: query.from,
      orderId: query.orderId,
      orderState: query.orderState,
      priceCurrency: query.priceCurrency,
      priceMax: query.priceMax,
      priceMin: query.priceMin,
      receivedFrom: query.receivedFrom,
      receivedTo: query.receivedTo,
      search: normalizeSearch(query.search),
      service: query.service,
      store: query.store,
      tab: query.tab,
      to: query.to,
      userId,
    };

    const [rows, counts] = await Promise.all([
      this.deliveryReadRepository.listHistory({
        ...filter,
        sort: resolveBookOrderHistorySort({ currency: query.currency, sort: query.sort }),
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryReadRepository.countHistory(filter),
    ]);

    return {
      ...buildPaginator({
        items: toOrderHistoryGroups(rows.map((row) => this.toRowView({ row, today }))),
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        totalCount: counts.totalCount,
      }),
      totalBooksCount: counts.totalBooksCount,
    };
  }

  async historyOutcome({ userId }: { userId: string }): Promise<BookOrderHistoryOutcomeView> {
    const [hasReceivedBooks, counts, seriesRows] = await Promise.all([
      this.historyOutcomeRepository.hasReceivedBooks(userId),
      this.historyOutcomeRepository.receivedUnreadCounts(userId),
      this.historyOutcomeRepository.listReceivedSeriesRows(userId),
    ]);

    return {
      seriesInsights: buildReceivedSeriesInsights(seriesRows),
      unreadReceived: hasReceivedBooks ? await this.toReceivedUnreadView(counts, userId) : null,
    };
  }

  async historySummary(userId: string): Promise<BookOrderHistorySummaryView> {
    const [data, latestReceipt] = await Promise.all([
      this.deliveryReadRepository.historySummary(userId),
      this.deliveryReadRepository.latestReceipt({
        bookPreviewsMax: HISTORY_RECEIPT_LIMITS.bookPreviewsMax,
        userId,
      }),
    ]);

    return buildOrderHistorySummaryView({
      ...data,
      latestReceipt: latestReceipt === null ? null : this.toLatestReceiptView(latestReceipt),
    });
  }

  async inTransitFacets({ userId }: { userId: string }): Promise<InTransitFacetsView> {
    const rows = await this.deliveryReadRepository.inTransitFacets(userId);

    return {
      services: sortFacetEntries(rows.services),
      stores: sortFacetEntries(rows.stores),
    };
  }

  async inTransitImpact({ userId }: { userId: string }): Promise<InTransitImpactView> {
    const { today } = deliveryDateBounds(new Date());

    const [seriesRows, queueRows, goalRows] = await Promise.all([
      this.deliveryImpactRepository.listSeriesRows(userId),
      this.deliveryImpactRepository.listQueueRows(userId),
      this.deliveryImpactRepository.listGoalRows({ today, userId }),
    ]);

    return { items: buildInTransitImpact({ goalRows, queueRows, seriesRows }) };
  }

  async inTransitList({
    query,
    userId,
  }: {
    query: InTransitQuery;
    userId: string;
  }): Promise<Paginator<BookOrderItemRowView>> {
    const bounds = deliveryDateBounds(new Date());
    const filter = {
      ageBucket: query.ageBucket,
      booksMax: query.booksMax,
      booksMin: query.booksMin,
      bounds,
      currency: query.currency,
      expectedFrom: query.expectedFrom,
      expectedTo: query.expectedTo,
      filter: query.filter,
      orderedFrom: query.orderedFrom,
      orderedTo: query.orderedTo,
      orderId: query.orderId,
      orderState: query.orderState,
      priceCurrency: query.priceCurrency,
      priceMax: query.priceMax,
      priceMin: query.priceMin,
      search: normalizeSearch(query.search),
      service: query.service,
      store: query.store,
      structure: query.structure,
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.deliveryReadRepository.listInTransit({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryReadRepository.countInTransit(filter),
    ]);

    return buildPaginator({
      items: rows.map((row) => this.toRowView({ row, today: bounds.today })),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async inTransitSummary({ userId }: { userId: string }): Promise<InTransitSummaryView> {
    const bounds = deliveryDateBounds(new Date());

    const [data, nextShipment] = await Promise.all([
      this.deliveryReadRepository.inTransitSummary({ bounds, userId }),
      this.deliveryReadRepository.nextShipment({
        bookPreviewsMax: NEXT_SHIPMENT_LIMITS.bookPreviewsMax,
        today: bounds.today,
        userId,
      }),
    ]);

    return buildInTransitSummaryView({
      ...data,
      nextShipment: nextShipment === null ? null : this.toNextShipmentView(nextShipment),
      today: bounds.today,
    });
  }

  private toBookPreview(book: BookOrderItemRow["book"]): BookPreview {
    return {
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      firstAuthorName: book.firstAuthorName,
      genres: book.genres,
      id: book.id,
      originalTitle: book.originalTitle,
      ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
      publisher:
        book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
      readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      series:
        book.series === null
          ? null
          : {
              id: book.series.id,
              name: book.series.name,
              partNumber: book.partNumber,
              totalBooks: book.series.totalBooks,
            },
      tags: book.tags.map((bookTag) => bookTag.tag.name),
      title: book.title,
    };
  }

  private toDeliveryBookPreview(item: DeliveryBookPreviewRow): DeliveryBookPreview {
    return {
      authorName: item.book.firstAuthorName,
      cover: this.mediaService.buildViewOrNull(item.book.coverMedia),
      id: item.book.id,
      title: item.book.title,
    };
  }

  private toLatestReceiptView(data: LatestReceiptData): LatestReceiptView {
    return toLatestReceiptView({
      bookPreviews: data.bookPreviews.map((item) => this.toDeliveryBookPreview(item)),
      event: data.event,
    });
  }

  private toNextShipmentView(data: NextShipmentData): NextShipmentView {
    return toNextShipmentView({
      bookPreviews: data.bookPreviews.map((item) => this.toDeliveryBookPreview(item)),
      booksCount: data.booksCount,
      sameDayCount: data.sameDayCount,
      shipment: data.shipment,
    });
  }

  private async toReceivedUnreadView(
    counts: ReceivedUnreadCounts,
    userId: string,
  ): Promise<ReceivedUnreadView> {
    const previews =
      counts.booksCount === 0
        ? []
        : await this.historyOutcomeRepository.receivedUnreadPreviews({
            limit: HISTORY_RECEIPT_LIMITS.bookPreviewsMax,
            userId,
          });

    return {
      bookPreviews: previews.map((book) => this.toUnreadBookPreview(book)),
      booksCount: counts.booksCount,
      inQueueCount: counts.inQueueCount,
    };
  }

  private toRowView({ row, today }: { row: BookOrderItemRow; today: Date }): BookOrderItemRowView {
    return toBookOrderItemRowView({ book: this.toBookPreview(row.book), row, today });
  }

  private toUnreadBookPreview(book: ReceivedUnreadPreviewRow): DeliveryBookPreview {
    return {
      authorName: book.firstAuthorName,
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      id: book.id,
      title: book.title,
    };
  }
}

function sortFacetEntries(entries: DeliveryFacetEntry[]): DeliveryFacetEntry[] {
  return [...entries].sort(
    (left, right) => right.count - left.count || UKRAINIAN_COLLATION.compare(left.name, right.name),
  );
}

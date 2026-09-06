import { z } from "zod";

import type { BookOrderDerivedStatus, Currency } from "./book-enums.js";

import {
  ActiveShipmentStatusSchema,
  BookOrderDerivedStatusSchema,
  CurrencySchema,
  DeliveryUiStatusSchema,
  ShipmentStatusSchema,
} from "./book-enums.js";
import { BookPreviewSchema } from "./book-preview.js";
import { BulkBookIdsSchema } from "./books.js";
import {
  createPaginatedSchema,
  CurrencyAverageSchema,
  CurrencyTotalSchema,
  LIST_PAGE_SIZE_MAX,
  paginationQueryFields,
} from "./common.js";
import { DeliveryServiceSchema } from "./delivery-services.js";
import {
  CancelReasonSchema,
  CountSchema,
  EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
  isExpectedNotBeforeOrder,
  isoDay,
  notInFutureDate,
  OwnershipNoteSchema,
  OwnershipOrderNumberSchema,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
  QueryBooleanWithDefaultSchema,
  queryStringArray,
  TrackingNumberSchema,
} from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { ORDER_FINANCIAL_MESSAGES, validateOrderInvariant } from "./order-financials.js";
import {
  ActiveMoneyAgeBucketSchema,
  BookOrderStatisticsBestValueStoreByCurrencySchema,
  BookOrderStatisticsCompareModeSchema,
  BookOrderStatisticsComparisonSchema,
  BookOrderStatisticsCostsSchema,
  BookOrderStatisticsDailySchema,
  BookOrderStatisticsFinancialCoverageSchema,
  BookOrderStatisticsInsightsSchema,
  BookOrderStatisticsLandedCoverageSchema,
  BookOrderStatisticsLandedSchema,
  BookOrderStatisticsMetaSchema,
  BookOrderStatisticsPriceCoverageSchema,
  BookOrderStatisticsRecordScopeSchema,
  BookOrderStatisticsSnapshotSchema,
  CurrencyCountSchema,
  StatisticsDrilldownBreakdownSchema,
  StatisticsDynamicsSchema,
} from "./order-statistics.js";
import { ReadingGoalRiskLevelSchema } from "./reading-goals.js";

export { EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE, isExpectedNotBeforeOrder } from "./internal.js";

export const BOOK_ORDER_LIMITS = {
  booksCountMax: 1000,
  itemsMax: 100,
  pageSizeDefault: 10,
  searchMax: 100,
  shipmentsMax: 20,
  storeMax: 200,
} as const;

export const DELIVERY_ERROR_CODES = {
  bookAlreadyOrdered: "DELIVERY_BOOK_ALREADY_ORDERED",
  bookNotOrderable: "DELIVERY_BOOK_NOT_ORDERABLE",
  expectedBeforeOrderDate: "DELIVERY_EXPECTED_BEFORE_ORDER_DATE",
  itemAlreadyCancelled: "DELIVERY_ITEM_ALREADY_CANCELLED",
  itemAlreadyReceived: "DELIVERY_ITEM_ALREADY_RECEIVED",
  itemNoLongerActive: "DELIVERY_ITEM_NO_LONGER_ACTIVE",
  itemsNotMovable: "DELIVERY_ITEMS_NOT_MOVABLE",
  sharedOrder: "DELIVERY_SHARED_ORDER",
  sharedShipment: "DELIVERY_SHARED_SHIPMENT",
  shipmentNotActive: "DELIVERY_SHIPMENT_NOT_ACTIVE",
} as const;

const BOOK_ORDER_MESSAGES = {
  duplicateMovedItem: "The same order item cannot be moved twice in one request",
  duplicateOrderItem: "The same book cannot be ordered twice in one order",
  duplicateShipmentBook: "The same book cannot be listed twice in one shipment",
  duplicateShipmentItem: "The same order item cannot be listed twice in one shipment",
  priceCurrencyOutsideSelection: "The order total currency must be one of the selected currencies",
  priceRangeNeedsCurrency: "An order total range needs the currency it is measured in",
  priceRangeNeedsOneCurrency: "An order total range needs exactly one currency",
  shipmentBookNotOrdered: "A shipment can only carry books from this order",
  shipmentBookReused: "A book cannot be placed in two shipments",
  storeNameRequired: "Store name is required",
  terminalDateOffTab: (tab: string): string =>
    `This date range only applies to the ${tab} tab of the order history`,
} as const;

const PositiveCountSchema = z.number().int().positive();

const hasUniqueValues = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const ORDER_FINANCIAL_ISSUE_PATHS = {
  [ORDER_FINANCIAL_MESSAGES.currencyRequired]: ["currency"],
  [ORDER_FINANCIAL_MESSAGES.freeOrderCarriesAmounts]: ["isFree"],
  [ORDER_FINANCIAL_MESSAGES.negativeTotal]: ["discount"],
} as const;

const orderFinancialIssuePath = (message: string): string[] => [
  ...(ORDER_FINANCIAL_ISSUE_PATHS[message as keyof typeof ORDER_FINANCIAL_ISSUE_PATHS] ?? [
    "totalAmount",
  ]),
];

export const ShipmentDeliveryServiceViewSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
});

export type ShipmentDeliveryServiceView = z.infer<typeof ShipmentDeliveryServiceViewSchema>;

export const ShipmentViewSchema = z.object({
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.string(),
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  orderId: z.string(),
  pickupUntil: z.string().nullable(),
  receivedAt: z.string().nullable(),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  updatedAt: z.string(),
});

export type ShipmentView = z.infer<typeof ShipmentViewSchema>;

export const BookOrderItemViewSchema = z.object({
  bookId: z.string(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  id: z.string(),
  orderId: z.string(),
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
  shipmentId: z.string().nullable(),
});

export type BookOrderItemView = z.infer<typeof BookOrderItemViewSchema>;

export const BookOrderViewSchema = z.object({
  createdAt: z.string(),
  currency: CurrencySchema.nullable(),
  deliveryPrice: z.number().nullable(),
  derivedStatus: BookOrderDerivedStatusSchema,
  discount: z.number().nullable(),
  id: z.string(),
  isFree: z.boolean().describe("The order was received for free, so its canonical total is zero."),
  items: z.array(BookOrderItemViewSchema),
  note: z.string().nullable(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  shipments: z.array(ShipmentViewSchema),
  storeName: z.string(),
  totalAmount: z.number().nullable(),
  updatedAt: z.string(),
});

export type BookOrderView = z.infer<typeof BookOrderViewSchema>;

export const BookOrderItemInputSchema = z.object({
  bookId: z.uuid(),
  price: OwnershipPriceSchema.optional(),
});

export type BookOrderItemInput = z.infer<typeof BookOrderItemInputSchema>;

export const BookOrderShipmentInputSchema = z
  .object({
    bookIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    deliveryService: DeliveryServiceSchema.optional(),
    expectedDeliveryDate: isoDay().optional(),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: isoDay().optional(),
    status: ActiveShipmentStatusSchema.optional(),
    trackingNumber: TrackingNumberSchema.optional(),
    trackingUrl: OwnershipStoreUrlSchema.optional(),
  })
  .refine((shipment) => hasUniqueValues(shipment.bookIds), {
    error: BOOK_ORDER_MESSAGES.duplicateShipmentBook,
    path: ["bookIds"],
  });

export type BookOrderShipmentInput = z.infer<typeof BookOrderShipmentInputSchema>;

const BookOrderStoreNameSchema = OwnershipStoreNameSchema.pipe(
  z.string().min(1, BOOK_ORDER_MESSAGES.storeNameRequired),
);

const BookOrderDraftSchema = z.object({
  currency: CurrencySchema,
  deliveryPrice: OwnershipPriceSchema.optional(),
  discount: OwnershipPriceSchema.optional(),
  isFree: z.boolean().default(false),
  items: z.array(BookOrderItemInputSchema).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
  note: OwnershipNoteSchema.optional(),
  orderDate: notInFutureDate("Order date must not be in the future").optional(),
  orderNumber: OwnershipOrderNumberSchema.optional(),
  shipments: z.array(BookOrderShipmentInputSchema).max(BOOK_ORDER_LIMITS.shipmentsMax).optional(),
  storeName: BookOrderStoreNameSchema,
  totalAmount: OwnershipPriceSchema.optional(),
});

type BookOrderDraft = z.infer<typeof BookOrderDraftSchema>;

const draftShipmentBookIds = (draft: BookOrderDraft): string[] =>
  (draft.shipments ?? []).flatMap((shipment) => shipment.bookIds);

const hasUniqueOrderedBooks = (draft: BookOrderDraft): boolean =>
  new Set(draft.items.map((item) => item.bookId)).size === draft.items.length;

const shipsOnlyOrderedBooks = (draft: BookOrderDraft): boolean => {
  const orderedBookIds = new Set(draft.items.map((item) => item.bookId));
  return draftShipmentBookIds(draft).every((bookId) => orderedBookIds.has(bookId));
};

const shipsEachBookOnce = (draft: BookOrderDraft): boolean =>
  hasUniqueValues(draftShipmentBookIds(draft));

const expectsDeliveryNotBeforeOrderDate = (draft: BookOrderDraft): boolean =>
  (draft.shipments ?? []).every((shipment) =>
    isExpectedNotBeforeOrder({
      expectedDeliveryDate: shipment.expectedDeliveryDate,
      orderDate: draft.orderDate,
    }),
  );

export const CreateBookOrderInputSchema = BookOrderDraftSchema.refine(hasUniqueOrderedBooks, {
  error: BOOK_ORDER_MESSAGES.duplicateOrderItem,
  path: ["items"],
})
  .refine(shipsOnlyOrderedBooks, {
    error: BOOK_ORDER_MESSAGES.shipmentBookNotOrdered,
    path: ["shipments"],
  })
  .refine(shipsEachBookOnce, {
    error: BOOK_ORDER_MESSAGES.shipmentBookReused,
    path: ["shipments"],
  })
  .refine(expectsDeliveryNotBeforeOrderDate, {
    error: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
    path: ["shipments"],
  })
  .superRefine((draft, context) => {
    const validation = validateOrderInvariant({
      currency: draft.currency,
      deliveryPrice: draft.deliveryPrice,
      discount: draft.discount,
      isFree: draft.isFree,
      itemPrices: draft.items.map((item) => item.price ?? null),
      totalAmount: draft.totalAmount,
    });
    if (validation.error !== null) {
      context.addIssue({
        code: "custom",
        message: validation.error,
        path: orderFinancialIssuePath(validation.error),
      });
    }
  });

export type CreateBookOrderInput = z.infer<typeof CreateBookOrderInputSchema>;

export const UpdateBookOrderInputSchema = z.object({
  currency: CurrencySchema.optional(),
  deliveryPrice: OwnershipPriceSchema.nullable().optional(),
  discount: OwnershipPriceSchema.nullable().optional(),
  isFree: z.boolean().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  orderDate: notInFutureDate("Order date must not be in the future").nullable().optional(),
  orderNumber: OwnershipOrderNumberSchema.nullable().optional(),
  storeName: BookOrderStoreNameSchema.optional(),
  totalAmount: OwnershipPriceSchema.nullable().optional(),
});

export type UpdateBookOrderInput = z.infer<typeof UpdateBookOrderInputSchema>;

export const CreateShipmentInputSchema = z
  .object({
    deliveryService: DeliveryServiceSchema.optional(),
    expectedDeliveryDate: isoDay().optional(),
    itemIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: isoDay().optional(),
    status: ActiveShipmentStatusSchema.optional(),
    trackingNumber: TrackingNumberSchema.optional(),
    trackingUrl: OwnershipStoreUrlSchema.optional(),
  })
  .refine((shipment) => hasUniqueValues(shipment.itemIds), {
    error: BOOK_ORDER_MESSAGES.duplicateShipmentItem,
    path: ["itemIds"],
  });

export type CreateShipmentInput = z.infer<typeof CreateShipmentInputSchema>;

export const UpdateShipmentInputSchema = z.object({
  deliveryService: DeliveryServiceSchema.nullable().optional(),
  expectedDeliveryDate: isoDay().nullable().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  pickupUntil: isoDay().nullable().optional(),
  status: ActiveShipmentStatusSchema.optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
  trackingUrl: OwnershipStoreUrlSchema.nullable().optional(),
});

export type UpdateShipmentInput = z.infer<typeof UpdateShipmentInputSchema>;

export const MarkShipmentInTransitInputSchema = z.object({
  expectedDeliveryDate: isoDay().nullable().optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
});

export type MarkShipmentInTransitInput = z.infer<typeof MarkShipmentInTransitInputSchema>;

export const MarkShipmentReadyForPickupInputSchema = z.object({
  pickupUntil: isoDay().nullable().optional(),
});

export type MarkShipmentReadyForPickupInput = z.infer<typeof MarkShipmentReadyForPickupInputSchema>;

export const ReceiveShipmentInputSchema = z.object({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type ReceiveShipmentInput = z.infer<typeof ReceiveShipmentInputSchema>;

export const CancelShipmentInputSchema = z.object({
  cancelReason: CancelReasonSchema.nullable().optional(),
  keepAsWantToBuy: z.boolean().default(true),
});

export type CancelShipmentInput = z.infer<typeof CancelShipmentInputSchema>;

export const CancelBookOrderItemInputSchema = z.object({
  cancelReason: CancelReasonSchema.nullable().optional(),
  keepAsWantToBuy: z.boolean().default(true),
});

export type CancelBookOrderItemInput = z.infer<typeof CancelBookOrderItemInputSchema>;

export const MoveBookOrderItemsInputSchema = z
  .object({
    itemIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    shipmentId: z.uuid().nullable(),
  })
  .refine((move) => hasUniqueValues(move.itemIds), {
    error: BOOK_ORDER_MESSAGES.duplicateMovedItem,
    path: ["itemIds"],
  });

export type MoveBookOrderItemsInput = z.infer<typeof MoveBookOrderItemsInputSchema>;

export const BulkReceiveOrderItemsInputSchema = BulkBookIdsSchema.extend({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type BulkReceiveOrderItemsInput = z.infer<typeof BulkReceiveOrderItemsInputSchema>;

export const BulkReceiveOrderItemSkipReasonSchema = z.enum(["not_active", "not_found"]);

export type BulkReceiveOrderItemSkipReason = z.infer<typeof BulkReceiveOrderItemSkipReasonSchema>;

export const BulkReceiveOrderItemsResultViewSchema = z.object({
  receivedBookIds: z.array(z.string()),
  skipped: z.array(z.object({ bookId: z.string(), reason: BulkReceiveOrderItemSkipReasonSchema })),
});

export type BulkReceiveOrderItemsResultView = z.infer<typeof BulkReceiveOrderItemsResultViewSchema>;

export const ReceiveShipmentsInputSchema = z.object({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
  shipmentIds: z.array(z.uuid()).min(1).max(LIST_PAGE_SIZE_MAX),
});

export type ReceiveShipmentsInput = z.infer<typeof ReceiveShipmentsInputSchema>;

export const ReceiveShipmentsSkipReasonSchema = z.enum(["not_active", "not_found"]);

export type ReceiveShipmentsSkipReason = z.infer<typeof ReceiveShipmentsSkipReasonSchema>;

export const ReceiveShipmentsResultViewSchema = z.object({
  receivedShipmentIds: z.array(z.string()),
  skipped: z.array(z.object({ reason: ReceiveShipmentsSkipReasonSchema, shipmentId: z.string() })),
});

export type ReceiveShipmentsResultView = z.infer<typeof ReceiveShipmentsResultViewSchema>;

export const IN_TRANSIT_ATTENTION_THRESHOLDS = {
  awaitingDispatchDays: 7,
  pickupExpiringDays: 2,
} as const;

export const InTransitFilterSchema = z.enum([
  "all",
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "arriving_soon",
  "this_week",
  "delayed",
  "pickup_expiring",
  "awaiting_dispatch",
  "unassigned",
  "no_delivery_date",
  "has_tracking_number",
  "without_tracking_number",
  "has_tracking_url",
  "without_tracking_url",
  "has_price",
  "without_price",
]);

export type InTransitFilter = z.infer<typeof InTransitFilterSchema>;

export const InTransitAttentionReasonSchema = z.enum([
  "pickup_expiring",
  "delayed",
  "awaiting_dispatch",
  "without_tracking",
  "without_expected_date",
  "unassigned_books",
]);

export type InTransitAttentionReason = z.infer<typeof InTransitAttentionReasonSchema>;

export const InTransitAttentionSchema = z.discriminatedUnion("reason", [
  z.object({
    count: CountSchema,
    expiredCount: CountSchema,
    nearestPickupUntil: isoDay()
      .nullable()
      .describe(
        "The soonest pickup deadline that has not passed yet. Null when every expiring parcel is already past its deadline.",
      ),
    reason: z.literal("pickup_expiring"),
  }),
  z.object({
    count: CountSchema,
    maxDelayDays: z.number().int().positive(),
    reason: z.literal("delayed"),
  }),
  z.object({
    count: CountSchema,
    maxWaitingDays: z.number().int().positive(),
    reason: z.literal("awaiting_dispatch"),
  }),
  z.object({
    count: CountSchema,
    reason: z.literal("without_tracking"),
  }),
  z.object({
    count: CountSchema,
    reason: z.literal("without_expected_date"),
  }),
  z.object({
    count: CountSchema,
    ordersCount: CountSchema,
    reason: z.literal("unassigned_books"),
    revealOrderId: z
      .uuid()
      .nullable()
      .describe("The affected order when exactly one order is affected, null otherwise."),
  }),
]);

export type InTransitAttention = z.infer<typeof InTransitAttentionSchema>;

export const IN_TRANSIT_ATTENTION_FILTER = {
  awaiting_dispatch: "awaiting_dispatch",
  delayed: "delayed",
  pickup_expiring: "pickup_expiring",
  unassigned_books: "unassigned",
  without_expected_date: "no_delivery_date",
  without_tracking: "without_tracking_number",
} as const satisfies Record<InTransitAttentionReason, InTransitFilter>;

export const IN_TRANSIT_IMPACT_LIMITS = {
  visible: 3,
} as const;

export const InTransitImpactKindSchema = z.enum([
  "series_completed",
  "series_ownership_gaps",
  "queue_available",
  "series_next_step",
  "goal_books",
]);

export type InTransitImpactKind = z.infer<typeof InTransitImpactKindSchema>;

export const InTransitImpactSchema = z.discriminatedUnion("kind", [
  z.object({
    booksCount: PositiveCountSchema,
    kind: z.literal("series_completed"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    kind: z.literal("series_ownership_gaps"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    highPriorityCount: CountSchema,
    kind: z.literal("queue_available"),
  }),
  z.object({
    kind: z.literal("series_next_step"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    goalsCount: PositiveCountSchema,
    kind: z.literal("goal_books"),
  }),
]);

export type InTransitImpact = z.infer<typeof InTransitImpactSchema>;

export const InTransitImpactViewSchema = z.object({
  items: z
    .array(InTransitImpactSchema)
    .describe(
      "What receiving the books in active deliveries would change, ordered by semantic value. Empty when nothing meaningful would change.",
    ),
});

export type InTransitImpactView = z.infer<typeof InTransitImpactViewSchema>;

export const InTransitSortSchema = z.enum([
  "closest_delivery",
  "newest_orders",
  "oldest_orders",
  "delayed_first",
  "store",
  "service",
  "title",
  "author",
  "price",
]);

export type InTransitSort = z.infer<typeof InTransitSortSchema>;

export const IN_TRANSIT_DATE_GROUPS = ["overdue", "today", "upcoming", "no_expected_date"] as const;

export type InTransitDateGroup = (typeof IN_TRANSIT_DATE_GROUPS)[number];

type ExpectedDateOrder = {
  groups: readonly InTransitDateGroup[];
  overdue: "newest_first" | "oldest_first";
};

type ExpectedDateSort = Extract<InTransitSort, "closest_delivery" | "delayed_first">;

export const IN_TRANSIT_EXPECTED_DATE_ORDER = {
  closest_delivery: {
    groups: ["today", "upcoming", "overdue", "no_expected_date"],
    overdue: "newest_first",
  },
  delayed_first: {
    groups: ["overdue", "today", "upcoming", "no_expected_date"],
    overdue: "oldest_first",
  },
} as const satisfies Record<ExpectedDateSort, ExpectedDateOrder>;

export const InTransitDeliveryStructureSchema = z.enum([
  "no_shipment",
  "single_shipment",
  "multiple_shipments",
]);

export type InTransitDeliveryStructure = z.infer<typeof InTransitDeliveryStructureSchema>;

export const InTransitQuerySchema = z.object({
  ageBucket: ActiveMoneyAgeBucketSchema.optional(),
  booksMax: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
  booksMin: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
  currency: queryStringArray(CurrencySchema),
  expectedFrom: isoDay().optional(),
  expectedTo: isoDay().optional(),
  filter: InTransitFilterSchema.default("all"),
  orderedFrom: isoDay().optional(),
  orderedTo: isoDay().optional(),
  orderId: z
    .uuid()
    .optional()
    .describe(
      "Opens exactly one order by identity. Statistics navigates here instead of searching for an order number, which is a display label and not a key.",
    ),
  orderState: BookOrderDerivedStatusSchema.optional().describe(
    "Keeps only orders in one derived lifecycle state. A state no in-transit order can hold yields an empty list rather than being quietly ignored.",
  ),
  ...paginationQueryFields({ pageSizeDefault: BOOK_ORDER_LIMITS.pageSizeDefault }),
  priceCurrency: CurrencySchema.optional().describe(
    "Gates the canonical order total range. The range is ignored unless exactly one currency is named here.",
  ),
  priceMax: z.coerce.number().nonnegative().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  search: z.string().trim().max(BOOK_ORDER_LIMITS.searchMax).optional(),
  service: queryStringArray(DeliveryServiceSchema),
  sort: InTransitSortSchema.default("closest_delivery"),
  store: queryStringArray(z.string().trim().max(BOOK_ORDER_LIMITS.storeMax)),
  structure: queryStringArray(InTransitDeliveryStructureSchema),
});

export type InTransitQuery = z.infer<typeof InTransitQuerySchema>;

export const DeliveryFacetEntrySchema = z.object({ count: CountSchema, name: z.string() });

export type DeliveryFacetEntry = z.infer<typeof DeliveryFacetEntrySchema>;

export const InTransitFacetsViewSchema = z.object({
  services: z
    .array(DeliveryFacetEntrySchema)
    .describe(
      "Delivery services carrying an active shipment of an order that still has books on their way, with how many such orders each one carries.",
    ),
  stores: z
    .array(DeliveryFacetEntrySchema)
    .describe("Stores of the orders that still have books on their way, with their order counts."),
});

export type InTransitFacetsView = z.infer<typeof InTransitFacetsViewSchema>;

export const BookOrderHistoryTabSchema = z.enum(["all", "active", "received", "cancelled"]);

export type BookOrderHistoryTab = z.infer<typeof BookOrderHistoryTabSchema>;

export const BookOrderHistorySortSchema = z.enum([
  "newest_orders",
  "oldest_orders",
  "recently_updated",
  "store",
  "price_asc",
  "price_desc",
]);

export type BookOrderHistorySort = z.infer<typeof BookOrderHistorySortSchema>;

export const BOOK_ORDER_HISTORY_SORT = {
  default: "newest_orders",
  priceSorts: ["price_asc", "price_desc"],
} as const satisfies { default: BookOrderHistorySort; priceSorts: readonly BookOrderHistorySort[] };

export function comparesOneCurrency(currency: Currency[] | undefined): boolean {
  return currency !== undefined && currency.length === 1;
}

export function comparesOrderPrices(sort: BookOrderHistorySort): boolean {
  return BOOK_ORDER_HISTORY_SORT.priceSorts.some((priceSort) => priceSort === sort);
}

export function resolveBookOrderHistorySort({
  currency,
  sort,
}: {
  currency: Currency[] | undefined;
  sort: BookOrderHistorySort;
}): BookOrderHistorySort {
  return comparesOrderPrices(sort) && !comparesOneCurrency(currency)
    ? BOOK_ORDER_HISTORY_SORT.default
    : sort;
}

export const BookOrderHistoryTerminalTabSchema = BookOrderHistoryTabSchema.extract([
  "received",
  "cancelled",
]);

export type BookOrderHistoryTerminalTab = z.infer<typeof BookOrderHistoryTerminalTabSchema>;

export const BOOK_ORDER_HISTORY_TERMINAL_DATE_FIELDS = {
  cancelled: ["cancelledFrom", "cancelledTo"],
  received: ["receivedFrom", "receivedTo"],
} as const satisfies Record<BookOrderHistoryTerminalTab, readonly string[]>;

export const BookOrderHistoryFacetsQuerySchema = z.object({
  tab: BookOrderHistoryTerminalTabSchema,
});

export type BookOrderHistoryFacetsQuery = z.infer<typeof BookOrderHistoryFacetsQuerySchema>;

export const BookOrderHistoryFacetsViewSchema = z.object({
  services: z
    .array(DeliveryFacetEntrySchema)
    .describe(
      "Delivery services that carried a parcel holding a book of the requested tab, with how many orders each one carries. The list answers only to the tab, so picking another filter never makes an option disappear.",
    ),
  stores: z
    .array(DeliveryFacetEntrySchema)
    .describe(
      "Stores of the orders holding a book of the requested tab, with their order counts. The list answers only to the tab.",
    ),
});

export type BookOrderHistoryFacetsView = z.infer<typeof BookOrderHistoryFacetsViewSchema>;

export const BookOrderHistoryQuerySchema = z
  .object({
    booksMax: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
    booksMin: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
    cancelledFrom: isoDay().optional(),
    cancelledTo: isoDay().optional(),
    currency: queryStringArray(CurrencySchema),
    from: isoDay().optional(),
    orderId: z
      .uuid()
      .optional()
      .describe(
        "Opens exactly one order by identity. Statistics navigates here instead of searching for an order number, which is a display label and not a key.",
      ),
    orderState: BookOrderDerivedStatusSchema.optional().describe(
      "Keeps only orders in one derived lifecycle state, so a drill-down reproduces the very subset a statistic was built from.",
    ),
    ...paginationQueryFields({ pageSizeDefault: BOOK_ORDER_LIMITS.pageSizeDefault }),
    priceCurrency: CurrencySchema.optional().describe(
      "Gates the canonical order total range. The range is ignored unless exactly one currency is named here.",
    ),
    priceMax: z.coerce.number().nonnegative().optional(),
    priceMin: z.coerce.number().nonnegative().optional(),
    receivedFrom: isoDay().optional(),
    receivedTo: isoDay().optional(),
    search: z.string().trim().max(BOOK_ORDER_LIMITS.searchMax).optional(),
    service: queryStringArray(DeliveryServiceSchema),
    sort: BookOrderHistorySortSchema.default(BOOK_ORDER_HISTORY_SORT.default),
    store: queryStringArray(z.string().trim().max(BOOK_ORDER_LIMITS.storeMax)),
    tab: BookOrderHistoryTabSchema.default("all"),
    to: isoDay().optional(),
  })
  .superRefine((query, context) => {
    for (const [tab, fields] of Object.entries(BOOK_ORDER_HISTORY_TERMINAL_DATE_FIELDS)) {
      if (query.tab === tab) continue;

      for (const field of fields) {
        if (query[field] === undefined) continue;
        context.addIssue({
          code: "custom",
          message: BOOK_ORDER_MESSAGES.terminalDateOffTab(tab),
          path: [field],
        });
      }
    }

    if (query.priceCurrency === undefined) {
      if (query.priceMin !== undefined || query.priceMax !== undefined) {
        context.addIssue({
          code: "custom",
          message: BOOK_ORDER_MESSAGES.priceRangeNeedsCurrency,
          path: ["priceCurrency"],
        });
      }
      return;
    }

    if (query.currency !== undefined && !query.currency.includes(query.priceCurrency)) {
      context.addIssue({
        code: "custom",
        message: BOOK_ORDER_MESSAGES.priceCurrencyOutsideSelection,
        path: ["priceCurrency"],
      });
    }

    if (query.currency !== undefined && query.currency.length > 1) {
      context.addIssue({
        code: "custom",
        message: BOOK_ORDER_MESSAGES.priceRangeNeedsOneCurrency,
        path: ["currency"],
      });
    }
  });

export type BookOrderHistoryQuery = z.infer<typeof BookOrderHistoryQuerySchema>;

export const HISTORY_RECEIPT_LIMITS = {
  bookPreviewsMax: 3,
} as const;

export const DeliveryBookPreviewSchema = z.object({
  authorName: z.string(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export type DeliveryBookPreview = z.infer<typeof DeliveryBookPreviewSchema>;

export const LatestReceiptViewSchema = z
  .object({
    bookPreviews: z
      .array(DeliveryBookPreviewSchema)
      .max(HISTORY_RECEIPT_LIMITS.bookPreviewsMax)
      .describe(
        "At most three books, enough to render one book in full or a stack of covers. booksCount carries the real size.",
      ),
    booksCount: PositiveCountSchema.describe("How many books this receipt event delivered."),
    deliveryService: ShipmentDeliveryServiceViewSchema.nullable().describe(
      "Null when the books were received without a parcel, which is a valid way to record a receipt.",
    ),
    orderId: z.uuid(),
    receivedAt: z.string().describe("When the books of this event were received."),
    sameDayCount: CountSchema.describe(
      "How many OTHER receipt events happened on the same day. Zero when this one stands alone.",
    ),
    shipmentId: z.uuid().nullable(),
    storeName: z.string(),
  })
  .describe(
    "The most recent receipt event, keyed by the latest received_at across the books the history list renders. Books received into the same parcel on the same day form one event; books received without a parcel form one event per order and day. A parcel that is still only partly received still produces an event, so the sidebar never contradicts the received tab.",
  );

export type LatestReceiptView = z.infer<typeof LatestReceiptViewSchema>;

export const ReceivedUnreadViewSchema = z
  .object({
    bookPreviews: z
      .array(DeliveryBookPreviewSchema)
      .max(HISTORY_RECEIPT_LIMITS.bookPreviewsMax)
      .describe(
        "Reading-queue members first, in queue order, then the rest newest by receipt. Empty when booksCount is zero.",
      ),
    booksCount: CountSchema.describe(
      "Received books that are still not_started or want_to_read. Zero means every received book has been picked up.",
    ),
    inQueueCount: CountSchema.describe("How many of those books already sit in the reading queue."),
  })
  .describe("The received books still waiting to be read.");

export type ReceivedUnreadView = z.infer<typeof ReceivedUnreadViewSchema>;

export const ReceivedSeriesInsightKindSchema = z.enum([
  "series_completed",
  "series_gaps_closed",
  "series_topped_up",
]);

export type ReceivedSeriesInsightKind = z.infer<typeof ReceivedSeriesInsightKindSchema>;

export const ReceivedSeriesInsightSchema = z.object({
  booksCount: PositiveCountSchema.describe("Received books behind this insight."),
  kind: ReceivedSeriesInsightKindSchema,
  seriesCount: PositiveCountSchema,
});

export type ReceivedSeriesInsight = z.infer<typeof ReceivedSeriesInsightSchema>;

export const RECEIVED_SERIES_INSIGHT_LIMITS = {
  visible: 3,
} as const;

export const BookOrderHistoryOutcomeViewSchema = z
  .object({
    seriesInsights: z
      .array(ReceivedSeriesInsightSchema)
      .max(RECEIVED_SERIES_INSIGHT_LIMITS.visible)
      .describe(
        "What the received books already changed in the series, strongest first: series_completed, series_gaps_closed, series_topped_up. A series is counted once, under its strongest insight. Empty when no series was completed and no ownership gap was closed, because a plain top-up count is what the history summary card already carries.",
      ),
    unreadReceived: ReceivedUnreadViewSchema.nullable().describe(
      "Null when nothing has been received at all, which is the signal to leave the block out entirely.",
    ),
  })
  .describe(
    "What receiving the books already changed, scoped all-time over the books the history list renders and untouched by the list filters.",
  );

export type BookOrderHistoryOutcomeView = z.infer<typeof BookOrderHistoryOutcomeViewSchema>;

export const CANCELLED_FOLLOW_UP_LIMITS = {
  visible: 3,
} as const;

export const CancelledFollowUpBookSchema = DeliveryBookPreviewSchema.extend({
  cancelledAt: z.string().describe("The latest cancellation recorded for this book."),
  cancelReason: z.string().nullable(),
});

export type CancelledFollowUpBook = z.infer<typeof CancelledFollowUpBookSchema>;

export const CancelledPlanContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("queue") }),
  z.object({
    goalName: z.string().nullable().describe("Set only when the book sits in exactly one goal."),
    goalsCount: PositiveCountSchema,
    kind: z.literal("goal"),
    riskLevel: ReadingGoalRiskLevelSchema.describe(
      "The strongest risk level across the goals this book belongs to. Existing goal context, not a consequence of the cancellation.",
    ),
  }),
  z.object({ kind: z.literal("series_next") }),
]);

export type CancelledPlanContext = z.infer<typeof CancelledPlanContextSchema>;

export const CancelledPlanBookSchema = DeliveryBookPreviewSchema.extend({
  contexts: z
    .array(CancelledPlanContextSchema)
    .min(1)
    .describe("Every plan this one book touches, so a book is rendered once however many it hits."),
});

export type CancelledPlanBook = z.infer<typeof CancelledPlanBookSchema>;

export const CANCELLED_OUTCOMES = [
  "inLibrary",
  "reordered",
  "wishlist",
  "borrowed",
  "unresolved",
] as const;

export const CancelledOutcomeSchema = z.enum(CANCELLED_OUTCOMES);

export type CancelledOutcome = z.infer<typeof CancelledOutcomeSchema>;

export const CancelledOutcomeCountsSchema = z
  .object({
    borrowed: CountSchema.describe("Borrowed from someone instead of bought."),
    inLibrary: CountSchema.describe(
      "Received later, or owned outright, or owned and currently lent to someone.",
    ),
    reordered: CountSchema.describe("Waiting in a new order that is still on its way."),
    totalBooksCount: CountSchema.describe(
      "Distinct live books that carry a cancellation, which is the sum of the five outcomes.",
    ),
    unresolved: CountSchema.describe(
      "Left without a next acquisition step, the same set the decision block acts on.",
    ),
    wishlist: CountSchema.describe("Back on the wishlist, waiting to be ordered again."),
  })
  .describe(
    "Where every cancelled book stands today. The five outcomes partition the set, so they always add up to totalBooksCount.",
  );

export type CancelledOutcomeCounts = z.infer<typeof CancelledOutcomeCountsSchema>;

export const CancelledFollowUpViewSchema = z
  .object({
    outcomes: CancelledOutcomeCountsSchema.nullable().describe(
      "Null when the reader has never had a book cancelled.",
    ),
    plans: z
      .object({
        books: z.array(CancelledPlanBookSchema).max(CANCELLED_FOLLOW_UP_LIMITS.visible),
        booksCount: PositiveCountSchema.describe(
          "Distinct unresolved books tied to a reading plan, counted once even when they hit several.",
        ),
      })
      .nullable()
      .describe(
        "Null when no unresolved book sits in the reading queue, in an active goal or next in its series.",
      ),
    unresolved: z
      .object({
        books: z.array(CancelledFollowUpBookSchema).max(CANCELLED_FOLLOW_UP_LIMITS.visible),
        booksCount: PositiveCountSchema,
      })
      .nullable()
      .describe("Null when every cancelled book already carries a next acquisition state."),
  })
  .describe(
    "Cancelled books left without a next acquisition step, and the subset of them that active reading plans still count on. All-time and untouched by the history list filters.",
  );

export type CancelledFollowUpView = z.infer<typeof CancelledFollowUpViewSchema>;

export const CancelledFollowUpWishlistResultSchema = z.object({
  updatedCount: CountSchema.describe(
    "Books moved to the wishlist. The set is resolved on the server at mutation time, so a book that gained a next step meanwhile is simply not part of it.",
  ),
});

export type CancelledFollowUpWishlistResult = z.infer<typeof CancelledFollowUpWishlistResultSchema>;

export const BookOrderHistorySummaryViewSchema = z
  .object({
    cancelledBooksCount: CountSchema.describe("Books whose order item was cancelled."),
    cancelledOrdersCount: CountSchema.describe(
      "Distinct orders holding at least one cancelled book.",
    ),
    completedOrdersCount: CountSchema.describe(
      "Orders whose every book has reached a terminal state - received or cancelled - and that hold at least one book. An order still carrying an ordered, in-transit or ready-for-pickup book is not counted.",
    ),
    completedWithCancellationsCount: CountSchema.describe(
      "Completed orders holding at least one cancelled book, partial cancellations and fully cancelled orders alike.",
    ),
    completedWithoutCancellationsCount: CountSchema.describe(
      "Completed orders whose every book was received.",
    ),
    latestReceipt: LatestReceiptViewSchema.nullable().describe(
      "The most recent receipt event, or null when nothing has been received yet.",
    ),
    receivedBooksCount: CountSchema.describe("Books whose order item was received."),
    receivedOrdersCount: CountSchema.describe(
      "Distinct orders holding at least one received book.",
    ),
    receivedSeriesBooksCount: CountSchema.describe(
      "Received books belonging to a series that still exists.",
    ),
    receivedSeriesCount: CountSchema.describe(
      "Distinct still-existing series a received book belongs to, counted once per series however many of its books arrived.",
    ),
    receivedShipmentsCount: CountSchema.describe(
      "Distinct parcels the received books arrived in. A received book recorded without a parcel adds nothing to this number.",
    ),
    receivedStandaloneBooksCount: CountSchema.describe(
      "Received books outside any still-existing series, including books whose series was moved to the trash.",
    ),
  })
  .describe(
    "All-time overview of the finished part of the delivery history. Every number is scoped to books that are not in the trash, which is the same scope the history list itself renders.",
  );

export type BookOrderHistorySummaryView = z.infer<typeof BookOrderHistorySummaryViewSchema>;

export const BookOrderItemRowOrderViewSchema = z.object({
  currency: CurrencySchema.nullable(),
  deliveryPrice: z.number().nullable(),
  derivedStatus: BookOrderDerivedStatusSchema,
  discount: z.number().nullable(),
  effectiveTotalAmount: z
    .number()
    .nullable()
    .describe(
      "What the whole order costs, resolved by resolveOrderFinancials over every one of its books - not only the ones on this page. Null only for a legacy order left behind by the backfill.",
    ),
  id: z.string(),
  isFree: z.boolean().describe("The order was received for free, so its canonical total is zero."),
  itemsCount: CountSchema.describe("How many books the whole order holds, page and filter aside."),
  note: z.string().nullable().describe("The comment the user left on the whole order."),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  pricedItemsCount: CountSchema.describe("How many of those books carry a price of their own."),
  storeName: z.string(),
  totalAmount: z.number().nullable(),
});

export type BookOrderItemRowOrderView = z.infer<typeof BookOrderItemRowOrderViewSchema>;

export const BookOrderItemRowShipmentViewSchema = z.object({
  activeItemsCount: CountSchema.describe(
    "How many books of this parcel are still on their way - not received, not cancelled, book not trashed. Counted over the whole parcel, not only the books on this page.",
  ),
  cancelledAt: z.string().nullable().describe("When the whole parcel was cancelled."),
  cancelReason: z
    .string()
    .nullable()
    .describe("Why the whole parcel was cancelled, as opposed to a reason carried by one book."),
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  pickupUntil: z.string().nullable(),
  receivedAt: z.string().nullable().describe("When the whole parcel was received."),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
});

export type BookOrderItemRowShipmentView = z.infer<typeof BookOrderItemRowShipmentViewSchema>;

export const BookOrderItemRowViewSchema = z.object({
  book: BookPreviewSchema,
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  id: z.string(),
  order: BookOrderItemRowOrderViewSchema,
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
  shipment: BookOrderItemRowShipmentViewSchema.nullable(),
  uiStatus: DeliveryUiStatusSchema.nullable(),
});

export type BookOrderItemRowView = z.infer<typeof BookOrderItemRowViewSchema>;

export const PaginatedBookOrderItemRowsSchema = createPaginatedSchema(BookOrderItemRowViewSchema);

export type PaginatedBookOrderItemRows = z.infer<typeof PaginatedBookOrderItemRowsSchema>;

export const OrderHistoryBookViewSchema = z.object({
  book: BookPreviewSchema,
  cancelledAt: z.string().nullable(),
  cancelReason: z
    .string()
    .nullable()
    .describe(
      "Why this single book was cancelled, which can differ from the reason of its parcel.",
    ),
  id: z.string(),
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
});

export type OrderHistoryBookView = z.infer<typeof OrderHistoryBookViewSchema>;

export const OrderHistoryShipmentViewSchema = z.object({
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  pickupUntil: z.string().nullable(),
  receivedAt: z.string().nullable(),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
});

export type OrderHistoryShipmentView = z.infer<typeof OrderHistoryShipmentViewSchema>;

export const OrderHistoryShipmentGroupViewSchema = z.object({
  books: z
    .array(OrderHistoryBookViewSchema)
    .describe(
      "The books of this parcel that belong to the requested tab. Never narrowed by the page boundary.",
    ),
  shipment: OrderHistoryShipmentViewSchema.nullable().describe(
    "Null for the books that were settled before they ever reached a parcel.",
  ),
});

export type OrderHistoryShipmentGroupView = z.infer<typeof OrderHistoryShipmentGroupViewSchema>;

export const OrderHistoryGroupViewSchema = z.object({
  booksCount: CountSchema.describe(
    "How many books of this order the requested tab and the active filters render, which is the sum over its parcel groups.",
  ),
  order: BookOrderItemRowOrderViewSchema,
  shipments: z
    .array(OrderHistoryShipmentGroupViewSchema)
    .describe(
      "Dispatched parcels first, the never-dispatched books last. A parcel that carries no book of the requested tab is left out.",
    ),
});

export type OrderHistoryGroupView = z.infer<typeof OrderHistoryGroupViewSchema>;

export const PaginatedOrderHistoryGroupsSchema = createPaginatedSchema(
  OrderHistoryGroupViewSchema,
).extend({
  totalBooksCount: CountSchema.describe(
    "How many books the whole selection holds, not only the orders on this page. totalCount counts orders instead.",
  ),
});

export type PaginatedOrderHistoryGroups = z.infer<typeof PaginatedOrderHistoryGroupsSchema>;

export const NEXT_SHIPMENT_LIMITS = {
  bookPreviewsMax: 3,
} as const;

export const NextShipmentStatusSchema = ShipmentStatusSchema.extract(["ordered", "in_transit"]);

export type NextShipmentStatus = z.infer<typeof NextShipmentStatusSchema>;

export const NextShipmentViewSchema = z.object({
  bookPreviews: z
    .array(DeliveryBookPreviewSchema)
    .max(NEXT_SHIPMENT_LIMITS.bookPreviewsMax)
    .describe(
      "At most three books, enough to render one book in full or a stack of covers. booksCount carries the real size.",
    ),
  booksCount: CountSchema,
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: isoDay(),
  orderId: z.string(),
  sameDayCount: CountSchema.describe(
    "How many OTHER qualifying shipments share this expected date. Zero when this one stands alone.",
  ),
  shipmentId: z.string(),
  status: NextShipmentStatusSchema,
  storeName: z.string(),
  trackingNumber: z.string().nullable(),
});

export type NextShipmentView = z.infer<typeof NextShipmentViewSchema>;

export const InTransitSummaryViewSchema = z.object({
  activeBooksCount: CountSchema,
  activeBooksTotalByCurrency: z.array(CurrencyTotalSchema),
  activeOrdersAverageByCurrency: z
    .array(CurrencyAverageSchema)
    .describe(
      "The mean canonical total of one active order, kept per currency and never converted across them.",
    ),
  activeOrdersCount: CountSchema,
  activeOrdersTotalByCurrency: z.array(CurrencyTotalSchema),
  activeShipmentsCount: CountSchema,
  arrivingSoonCount: CountSchema,
  attention: z
    .array(InTransitAttentionSchema)
    .describe(
      "Cases that ask the reader to act, ordered by severity: pickup_expiring, delayed, awaiting_dispatch, without_tracking, without_expected_date, unassigned_books. A case with a zero count is left out, and each case counts in its own unit - parcels, orders or books.",
    ),
  delayedCount: CountSchema,
  expectedThisWeekCount: CountSchema,
  inTransitCount: CountSchema,
  nextExpectedDelivery: z.string().nullable(),
  nextExpectedThisWeek: z.string().nullable(),
  nextShipment: NextShipmentViewSchema.nullable().describe(
    "The soonest shipment still awaiting arrival: status ordered or in_transit, an expected date of today or later, and at least one active book. Null when nothing qualifies.",
  ),
  orderedCount: CountSchema,
  readyForPickupCount: CountSchema,
  splitOrdersCount: CountSchema,
  uniqueStoresCount: CountSchema,
  withoutExpectedDateCount: CountSchema,
  withoutPriceCount: CountSchema,
  withoutTrackingCount: CountSchema,
});

export type InTransitSummaryView = z.infer<typeof InTransitSummaryViewSchema>;

export const BookOrderStatisticsQuerySchema = z.object({
  compare: BookOrderStatisticsCompareModeSchema.optional(),
  currency: CurrencySchema.optional(),
  from: isoDay().optional(),
  includeCancelled: QueryBooleanWithDefaultSchema,
  orderState: BookOrderDerivedStatusSchema.optional().describe(
    "Narrows the dataset to orders sitting in one derived lifecycle state. It is the same state the lifecycle chart counts and the same one a drill-down carries to a destination page, so a statistic and the list it opens can never disagree.",
  ),
  store: z.string().trim().max(BOOK_ORDER_LIMITS.storeMax).optional(),
  to: isoDay().optional(),
});

export type BookOrderStatisticsQuery = z.infer<typeof BookOrderStatisticsQuerySchema>;

export const BookOrderStatisticsSummarySchema = z.object({
  activeBooksCount: CountSchema,
  activeShipmentsCount: CountSchema,
  activeTotalsByCurrency: z.array(CurrencyTotalSchema),
  averageBookPriceByCurrency: z.array(CurrencyAverageSchema),
  averageBooksPerOrder: z.number().nullable(),
  averageOrderAmountByCurrency: z.array(CurrencyAverageSchema),
  booksCount: CountSchema,
  cancelledOrdersCount: CountSchema,
  cancelledTotalsByCurrency: z.array(CurrencyTotalSchema),
  financialCoverageByCurrency: z.array(BookOrderStatisticsFinancialCoverageSchema),
  ordersCount: CountSchema,
  priceCoverageByCurrency: z.array(BookOrderStatisticsPriceCoverageSchema),
  receivedBooksCount: CountSchema,
  receivedTotalsByCurrency: z.array(CurrencyTotalSchema),
  shipmentsCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsSummary = z.infer<typeof BookOrderStatisticsSummarySchema>;

export const BookOrderStatisticsStoreSchema = z.object({
  averageBookPriceByCurrency: z.array(CurrencyAverageSchema),
  averageBooksPerOrder: z.number().nullable(),
  averageLandedBookCostByCurrency: z.array(CurrencyAverageSchema),
  averageOrderAmountByCurrency: z.array(CurrencyAverageSchema),
  booksCount: CountSchema,
  booksCountByCurrency: z.array(CurrencyCountSchema),
  deliveryTotalByCurrency: z.array(CurrencyTotalSchema),
  discountTotalByCurrency: z.array(CurrencyTotalSchema),
  drilldown: StatisticsDrilldownBreakdownSchema,
  landedCoverageByCurrency: z.array(BookOrderStatisticsLandedCoverageSchema),
  landedEligibleBooksCountByCurrency: z.array(CurrencyCountSchema),
  ordersCount: CountSchema,
  ordersCountByCurrency: z.array(CurrencyCountSchema),
  store: z.string(),
  storeKey: z
    .string()
    .describe(
      "A stable key for the same store across blocks. There is no store entity, so this is the canonical name normalized, and it is what shared highlighting and drill-downs match on rather than the display name.",
    ),
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsStore = z.infer<typeof BookOrderStatisticsStoreSchema>;

export const BookOrderStatisticsMonthSchema = z.object({
  booksCount: CountSchema,
  month: z.string(),
  ordersCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsMonth = z.infer<typeof BookOrderStatisticsMonthSchema>;

export const BookOrderStatisticsOrderIdentitySchema = z
  .object({
    booksCount: CountSchema,
    currency: CurrencySchema.nullable(),
    derivedStatus: BookOrderDerivedStatusSchema,
    id: z.string(),
    orderDate: z.string().nullable(),
    orderNumber: z.string().nullable(),
    storeName: z.string(),
    totalAmount: z.number().nullable(),
  })
  .describe(
    "One order named by its id, which is what navigation uses. orderNumber is a label a user may never have filled in and never decides whether the order can be opened.",
  );

export type BookOrderStatisticsOrderIdentity = z.infer<
  typeof BookOrderStatisticsOrderIdentitySchema
>;

export const BookOrderStatisticsTopOrderSchema = BookOrderStatisticsOrderIdentitySchema.extend({
  totalAmount: z.number(),
});

export type BookOrderStatisticsTopOrder = z.infer<typeof BookOrderStatisticsTopOrderSchema>;

export const BookOrderStatisticsCurrencyTopOrdersSchema = z.object({
  currency: CurrencySchema,
  orders: z.array(BookOrderStatisticsTopOrderSchema),
});

export type BookOrderStatisticsCurrencyTopOrders = z.infer<
  typeof BookOrderStatisticsCurrencyTopOrdersSchema
>;

export const BookOrderStatisticsTopOrdersByCurrencySchema = z.array(
  BookOrderStatisticsCurrencyTopOrdersSchema,
);

export type BookOrderStatisticsTopOrdersByCurrency = z.infer<
  typeof BookOrderStatisticsTopOrdersByCurrencySchema
>;

const lifecycleStageCountFields: { [Stage in BookOrderDerivedStatus]: typeof CountSchema } = {
  active: CountSchema,
  cancelled: CountSchema,
  partially_received: CountSchema,
  partially_shipped: CountSchema,
  received: CountSchema,
  shipped: CountSchema,
};

export const BookOrderStatisticsLifecycleStageCountsSchema = z.object({
  ...lifecycleStageCountFields,
  total: CountSchema,
});

export type BookOrderStatisticsLifecycleStageCounts = z.infer<
  typeof BookOrderStatisticsLifecycleStageCountsSchema
>;

const lifecycleStageDeltaFields: { [Stage in BookOrderDerivedStatus]: z.ZodNumber } = {
  active: z.number().int(),
  cancelled: z.number().int(),
  partially_received: z.number().int(),
  partially_shipped: z.number().int(),
  received: z.number().int(),
  shipped: z.number().int(),
};

export const BookOrderStatisticsLifecycleStageDeltasSchema = z
  .object({ ...lifecycleStageDeltaFields, total: z.number().int() })
  .describe("Current stage count minus the comparison period's, so a decline reads as negative.");

export type BookOrderStatisticsLifecycleStageDeltas = z.infer<
  typeof BookOrderStatisticsLifecycleStageDeltasSchema
>;

export const BookOrderStatisticsLifecycleStageComparisonSchema = z.object({
  delta: BookOrderStatisticsLifecycleStageDeltasSchema,
  previous: BookOrderStatisticsLifecycleStageCountsSchema,
});

export type BookOrderStatisticsLifecycleStageComparison = z.infer<
  typeof BookOrderStatisticsLifecycleStageComparisonSchema
>;

export const BookOrderStatisticsLifecycleComparisonSchema = z.object({
  books: BookOrderStatisticsLifecycleStageComparisonSchema,
  orders: BookOrderStatisticsLifecycleStageComparisonSchema,
});

export type BookOrderStatisticsLifecycleComparison = z.infer<
  typeof BookOrderStatisticsLifecycleComparisonSchema
>;

export const BookOrderStatisticsLifecycleSchema = z
  .object({
    books: BookOrderStatisticsLifecycleStageCountsSchema,
    comparison: BookOrderStatisticsLifecycleComparisonSchema.nullable().describe(
      "Per-stage previous count and signed delta. Null unless the request asked for a comparison period.",
    ),
    orders: BookOrderStatisticsLifecycleStageCountsSchema,
  })
  .describe(
    "Distribution over the canonical derived order statuses. Orders mode and books mode stay separate objects so a consumer can never render a mixed-unit view.",
  );

export type BookOrderStatisticsLifecycle = z.infer<typeof BookOrderStatisticsLifecycleSchema>;

export const BookOrderStatisticsRecordMonthSchema = z
  .object({
    booksCount: CountSchema,
    currency: CurrencySchema,
    drilldown: StatisticsDrilldownBreakdownSchema,
    month: z.string(),
    ordersCount: CountSchema,
    total: z.number(),
  })
  .describe(
    "The heaviest month inside one currency. Its order and book counts are counted in that same currency, so a month that also holds orders in another currency never inflates them.",
  );

export type BookOrderStatisticsRecordMonth = z.infer<typeof BookOrderStatisticsRecordMonthSchema>;

export const BookOrderStatisticsCurrencyLargestOrderSchema = z.object({
  currency: CurrencySchema,
  order: BookOrderStatisticsTopOrderSchema,
});

export type BookOrderStatisticsCurrencyLargestOrder = z.infer<
  typeof BookOrderStatisticsCurrencyLargestOrderSchema
>;

export const BookOrderStatisticsStoreLeaderSchema = z.object({
  booksCount: CountSchema,
  drilldown: StatisticsDrilldownBreakdownSchema,
  ordersCount: CountSchema,
  store: z.string(),
  storeKey: z.string(),
});

export type BookOrderStatisticsStoreLeader = z.infer<typeof BookOrderStatisticsStoreLeaderSchema>;

export const BookOrderStatisticsMostActiveStoreSchema = z.object({
  byBooks: BookOrderStatisticsStoreLeaderSchema.nullable(),
  byOrders: BookOrderStatisticsStoreLeaderSchema.nullable(),
});

export type BookOrderStatisticsMostActiveStore = z.infer<
  typeof BookOrderStatisticsMostActiveStoreSchema
>;

export const BookOrderStatisticsRecordsSchema = z.object({
  bestValueStoreByCurrency: BookOrderStatisticsBestValueStoreByCurrencySchema,
  largestOrderByCurrency: z.array(BookOrderStatisticsCurrencyLargestOrderSchema),
  mostActiveStore: BookOrderStatisticsMostActiveStoreSchema,
  mostBooksInOrder: BookOrderStatisticsOrderIdentitySchema.nullable(),
  recordMonthByCurrency: z.array(BookOrderStatisticsRecordMonthSchema),
  scope: BookOrderStatisticsRecordScopeSchema,
});

export type BookOrderStatisticsRecords = z.infer<typeof BookOrderStatisticsRecordsSchema>;

export const BookOrderStatisticsViewSchema = z.object({
  bestValueStoreByCurrency: BookOrderStatisticsBestValueStoreByCurrencySchema,
  byStore: z.array(BookOrderStatisticsStoreSchema),
  comparison: BookOrderStatisticsComparisonSchema.nullable(),
  costs: BookOrderStatisticsCostsSchema,
  daily: BookOrderStatisticsDailySchema,
  dynamics: StatisticsDynamicsSchema,
  insights: BookOrderStatisticsInsightsSchema,
  landedCost: BookOrderStatisticsLandedSchema,
  lifecycle: BookOrderStatisticsLifecycleSchema,
  meta: BookOrderStatisticsMetaSchema,
  monthly: z.array(BookOrderStatisticsMonthSchema),
  records: BookOrderStatisticsRecordsSchema,
  snapshot: BookOrderStatisticsSnapshotSchema,
  summary: BookOrderStatisticsSummarySchema,
  topOrders: z.array(BookOrderStatisticsTopOrderSchema),
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrencySchema,
});

export type BookOrderStatisticsView = z.infer<typeof BookOrderStatisticsViewSchema>;

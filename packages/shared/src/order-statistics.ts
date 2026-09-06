import { z } from "zod";

import type { BookOrderDerivedStatus, Currency } from "./book-enums.js";
import type { OrderTotalSource } from "./order-financials.js";

import { BookOrderDerivedStatusSchema, CurrencySchema } from "./book-enums.js";
import { CurrencyTotalSchema, type Nullable, type ValueOf } from "./common.js";
import { CountSchema, isoDay } from "./internal.js";

export const BookOrderStatisticsCompareModeSchema = z.enum([
  "previous_period",
  "same_period_last_year",
]);

export type BookOrderStatisticsCompareMode = z.infer<typeof BookOrderStatisticsCompareModeSchema>;

export const StatisticsPeriodSchema = z.object({
  from: isoDay().nullable(),
  to: isoDay().nullable(),
});

export type StatisticsPeriod = z.infer<typeof StatisticsPeriodSchema>;

export const StatisticsComparisonPeriodSchema = z.object({
  from: isoDay(),
  mode: BookOrderStatisticsCompareModeSchema,
  to: isoDay(),
});

export type StatisticsComparisonPeriod = z.infer<typeof StatisticsComparisonPeriodSchema>;

export const StatisticsSourceQualitySchema = z
  .object({
    isTruncated: z.boolean(),
    loadedOrdersCount: CountSchema,
    maxOrders: z.number().int().positive().nullable(),
  })
  .describe(
    "How much of one source dataset the aggregates behind it actually saw. isTruncated means the safety cap cut the detail rows, so every total built on that source is a floor rather than the real number. It says nothing about whether a single metric had enough eligible rows: that is metric coverage, which stays a separate counter.",
  );

export type StatisticsSourceQuality = z.infer<typeof StatisticsSourceQualitySchema>;

export const BookOrderStatisticsMetaSchema = z
  .object({
    activeSource: StatisticsSourceQualitySchema,
    comparisonPeriod: StatisticsComparisonPeriodSchema.nullable(),
    comparisonSource: StatisticsSourceQualitySchema.nullable(),
    currentPeriod: StatisticsPeriodSchema,
    currentSource: StatisticsSourceQualitySchema,
  })
  .describe(
    "Each source the response was built from reports its own completeness. One flag for the whole response would hide the case where the current period was read in full but the comparison period was cut, or the other way round.",
  );

export type BookOrderStatisticsMeta = z.infer<typeof BookOrderStatisticsMetaSchema>;

export const NumericDeltaSchema = z.object({
  absoluteDelta: z.number().nullable(),
  current: z.number().nullable(),
  percentDelta: z.number().nullable(),
  previous: z.number().nullable(),
});

export type NumericDelta = z.infer<typeof NumericDeltaSchema>;

export const CurrencyDeltaSchema = NumericDeltaSchema.extend({ currency: CurrencySchema });

export type CurrencyDelta = z.infer<typeof CurrencyDeltaSchema>;

export const OrderTotalSourceSchema = z.enum([
  "free",
  "manual",
  "calculated",
  "unknown",
]) satisfies z.ZodType<OrderTotalSource>;

export const CurrencyCountSchema = z.object({ count: CountSchema, currency: CurrencySchema });

export type CurrencyCount = z.infer<typeof CurrencyCountSchema>;

export const BookOrderStatisticsFinancialCoverageSchema = z
  .object({
    currency: CurrencySchema,
    ordersInScope: CountSchema,
    ordersWithResolvedAmount: CountSchema,
  })
  .describe(
    "How many of the orders in one currency the money totals could actually see. An order whose amount stayed unknown is counted in ordersInScope and left out of every sum, never folded in as a zero.",
  );

export type BookOrderStatisticsFinancialCoverage = z.infer<
  typeof BookOrderStatisticsFinancialCoverageSchema
>;

export const BookOrderStatisticsPriceCoverageSchema = z
  .object({
    booksInScope: CountSchema,
    booksWithPrice: CountSchema,
    currency: CurrencySchema,
  })
  .describe("How many books of one currency carry a recorded price at all.");

export type BookOrderStatisticsPriceCoverage = z.infer<
  typeof BookOrderStatisticsPriceCoverageSchema
>;

export const BookOrderStatisticsSnapshotSchema = z
  .object({
    activeBooksCount: CountSchema,
    activeMoneyCoverageByCurrency: z.array(BookOrderStatisticsFinancialCoverageSchema),
    activeOrdersCount: CountSchema,
    activeShipmentsCount: CountSchema,
    activeTotalsByCurrency: z.array(CurrencyTotalSchema),
  })
  .describe(
    "Money that is still on its way right now. This block deliberately ignores the historical from/to period filter, so it stays a current snapshot and never turns into a period-bound number. No comparison is emitted for it.",
  );

export type BookOrderStatisticsSnapshot = z.infer<typeof BookOrderStatisticsSnapshotSchema>;

export const BookOrderStatisticsComparisonSchema = z.object({
  averageBookPriceByCurrency: z.array(CurrencyDeltaSchema),
  averageBooksPerOrder: NumericDeltaSchema,
  averageOrderAmountByCurrency: z.array(CurrencyDeltaSchema),
  booksCount: NumericDeltaSchema,
  ordersCount: NumericDeltaSchema,
  receivedBooksCount: NumericDeltaSchema,
  shipmentsCount: NumericDeltaSchema,
  totalsByCurrency: z.array(CurrencyDeltaSchema),
});

export type BookOrderStatisticsComparison = z.infer<typeof BookOrderStatisticsComparisonSchema>;

export const BookOrderStatisticsCurrencyCostsSchema = z
  .object({
    currency: CurrencySchema,
    deliveryCostPerBook: z.number().nullable(),
    deliveryShareOfSpendPercent: z.number().nullable(),
    deliveryTotal: z.number(),
    discountShareOfRawSubtotalPercent: z.number().nullable(),
    discountTotal: z.number(),
    ordersWithDeliveryCount: CountSchema,
    ordersWithDiscountCount: CountSchema,
  })
  .describe(
    "Cost composition inside one currency. A null share or per-book value means the denominator was zero or unknown, never that the value is missing from the response.",
  );

export type BookOrderStatisticsCurrencyCosts = z.infer<
  typeof BookOrderStatisticsCurrencyCostsSchema
>;

export const BookOrderStatisticsCostsSchema = z.array(BookOrderStatisticsCurrencyCostsSchema);

export type BookOrderStatisticsCosts = z.infer<typeof BookOrderStatisticsCostsSchema>;

export const BookOrderStatisticsLandedCoverageSchema = z.object({
  booksInScope: CountSchema.describe(
    "Every book of this currency the period counted, whether or not its cost could be broken down. This is the denominator of coveragePercent.",
  ),
  booksWithLandedCost: CountSchema.describe(
    "The books whose cost the allocation could actually explain, so they carry a landed cost. This is the numerator of coveragePercent and can never exceed booksInScope.",
  ),
  coveragePercent: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "booksWithLandedCost over booksInScope. It is 0, never null, when nothing was in scope.",
    ),
  currency: CurrencySchema,
});

export type BookOrderStatisticsLandedCoverage = z.infer<
  typeof BookOrderStatisticsLandedCoverageSchema
>;

export const BookOrderStatisticsLandedCostSchema = BookOrderStatisticsLandedCoverageSchema.extend({
  averageAdjustmentShare: z
    .number()
    .nullable()
    .describe(
      "The part of a book's cost the base price, discount and delivery do not explain: the residual that makes the bridge reconcile with averageLandedBookCost. It is zero whenever the order invariant holds, because an order whose books are all priced may not carry a total that disagrees with them, and an order with an unpriced book is left out of the eligible set entirely. A non-zero value here means a rounding residual, not a real adjustment.",
    ),
  averageDeliveryShare: z.number().nullable(),
  averageDiscountShare: z.number().nullable(),
  averageEligibleRawBookPrice: z
    .number()
    .nullable()
    .describe(
      "The starting price of exactly the books that received a landed cost, so the bridge from it to averageLandedBookCost compares one population with itself. A book whose price was never recorded contributes zero here and its whole cost shows up in the adjustment stage.",
    ),
  averageLandedBookCost: z.number().nullable(),
  deltaFromEligibleRawPrice: z
    .number()
    .nullable()
    .describe(
      "averageLandedBookCost minus averageEligibleRawBookPrice. Negative means a book ended up cheaper than its listed price.",
    ),
});

export type BookOrderStatisticsLandedCost = z.infer<typeof BookOrderStatisticsLandedCostSchema>;

export const BookOrderStatisticsLandedSchema = z.array(BookOrderStatisticsLandedCostSchema);

export type BookOrderStatisticsLanded = z.infer<typeof BookOrderStatisticsLandedSchema>;

export const StatisticsDrilldownDestinationSchema = z.enum([
  "in_transit",
  "history_received",
  "history_cancelled",
]);

export type StatisticsDrilldownDestination = z.infer<typeof StatisticsDrilldownDestinationSchema>;

export const StatisticsDrilldownTargetSchema = z.object({
  booksCount: CountSchema,
  destination: StatisticsDrilldownDestinationSchema,
  ordersCount: CountSchema,
});

export type StatisticsDrilldownTarget = z.infer<typeof StatisticsDrilldownTargetSchema>;

export const StatisticsDrilldownBreakdownSchema = z
  .object({ targets: z.array(StatisticsDrilldownTargetSchema) })
  .describe(
    "Where the very orders behind one aggregate now live, counted on that same subset. Only non-zero destinations are listed, so an empty array means the aggregate has nowhere exact to open. Both units travel because one block can switch between orders and books.",
  );

export type StatisticsDrilldownBreakdown = z.infer<typeof StatisticsDrilldownBreakdownSchema>;

export const BOOK_ORDER_BEST_VALUE_STORE_RULES = {
  minimumEligibleBooks: 2,
  tieBreakOrder: [
    "lowest_average_landed_book_cost",
    "most_landed_eligible_books",
    "store_name_ascending",
  ],
} as const;

export const BookOrderStatisticsBestValueStoreSchema = z
  .object({
    averageLandedBookCost: z.number(),
    currency: CurrencySchema,
    drilldown: StatisticsDrilldownBreakdownSchema.describe(
      "Where this store's orders in this currency live. The record itself counts only books whose real cost is known, so this is context navigation and never an exact drill-down.",
    ),
    eligibleBooksCount: CountSchema.min(BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks),
    store: z.string(),
    storeKey: z.string(),
  })
  .describe(
    "One winner per currency, never across currencies. A candidate needs at least two landed-eligible books; ties break by the most landed-eligible books, then by store name ascending.",
  );

export type BookOrderStatisticsBestValueStore = z.infer<
  typeof BookOrderStatisticsBestValueStoreSchema
>;

export const BookOrderStatisticsBestValueStoreByCurrencySchema = z.array(
  BookOrderStatisticsBestValueStoreSchema,
);

export type BookOrderStatisticsBestValueStoreByCurrency = z.infer<
  typeof BookOrderStatisticsBestValueStoreByCurrencySchema
>;

export const BookOrderStatisticsRecordScopeSchema = z
  .object({
    isPeriodFiltered: z.boolean(),
    isTruncated: z.boolean(),
    period: StatisticsPeriodSchema,
  })
  .describe(
    "Bounds of a record fact. When isPeriodFiltered or isTruncated is true the record holds only inside this scope and must not be presented as an all-time record.",
  );

export type BookOrderStatisticsRecordScope = z.infer<typeof BookOrderStatisticsRecordScopeSchema>;

export const BookOrderStatisticsPulseToneSchema = z.enum(["neutral", "positive", "attention"]);

export type BookOrderStatisticsPulseTone = z.infer<typeof BookOrderStatisticsPulseToneSchema>;

export const StatisticsInsightBucketSchema = z.object({
  bucketKey: z
    .string()
    .describe(
      "The key of the dynamics bucket this insight is about, so the chart and the insight can point at the same column without matching display labels.",
    ),
  from: isoDay(),
  to: isoDay(),
});

export const BookOrderStatisticsPulseSignalSchema = z.discriminatedUnion("code", [
  CurrencyDeltaSchema.extend({
    code: z.literal("spend_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  NumericDeltaSchema.extend({
    code: z.literal("orders_count_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  NumericDeltaSchema.extend({
    code: z.literal("books_count_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("avg_book_price_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("avg_landed_cost_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  NumericDeltaSchema.extend({
    code: z.literal("average_books_per_order_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    booksCount: CountSchema,
    code: z.literal("record_month"),
    currency: CurrencySchema,
    month: z.string(),
    ordersCount: CountSchema,
    scope: BookOrderStatisticsRecordScopeSchema,
    tone: BookOrderStatisticsPulseToneSchema,
    total: z.number(),
  }),
  StatisticsInsightBucketSchema.extend({
    code: z.literal("record_orders_bucket"),
    ordersCount: CountSchema,
    scope: BookOrderStatisticsRecordScopeSchema,
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  StatisticsInsightBucketSchema.extend({
    booksCount: CountSchema,
    code: z.literal("record_books_bucket"),
    scope: BookOrderStatisticsRecordScopeSchema,
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("store_movement"),
    store: z.string(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    code: z.literal("delivery_share"),
    currency: CurrencySchema,
    deliveryShareOfSpendPercent: z.number(),
    deliveryTotal: z.number(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    code: z.literal("discount_savings"),
    currency: CurrencySchema,
    discountShareOfRawSubtotalPercent: z.number().nullable(),
    discountTotal: z.number(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
]);

export type BookOrderStatisticsPulseSignal = z.infer<typeof BookOrderStatisticsPulseSignalSchema>;

export const BookOrderStatisticsPulseSchema = z
  .array(BookOrderStatisticsPulseSignalSchema)
  .describe(
    "One already selected and ordered group of insights. The backend owns the business selection: the array is short, ranked best first, and holds at most one signal of each family, so the frontend renders it as it arrives and never re-ranks or truncates it.",
  );

export type BookOrderStatisticsPulse = z.infer<typeof BookOrderStatisticsPulseSchema>;

export const BookOrderStatisticsInsightsSchema = z
  .object({
    books: BookOrderStatisticsPulseSchema,
    orders: BookOrderStatisticsPulseSchema,
    spendByCurrency: z.array(
      z.object({ currency: CurrencySchema, signals: BookOrderStatisticsPulseSchema }),
    ),
  })
  .describe(
    "Insights grouped by the context that is selected on the page. Spend is grouped per currency so a page showing UAH never receives a EUR record, and the count metrics have their own groups so switching the chart switches the insights with it.",
  );

export type BookOrderStatisticsInsights = z.infer<typeof BookOrderStatisticsInsightsSchema>;

export const BOOK_ORDER_STATISTICS_LIMITS = {
  storeMax: 200,
} as const;

export const ActiveMoneyAgeBucketSchema = z.enum([
  "0_7",
  "8_14",
  "15_30",
  "31_plus",
  "unknown_date",
]);

export type ActiveMoneyAgeBucket = z.infer<typeof ActiveMoneyAgeBucketSchema>;

export const ACTIVE_MONEY_AGE_BUCKET_DAYS = {
  "0_7": { maxDays: 7, minDays: 0 },
  "31_plus": { maxDays: null, minDays: 31 },
  "8_14": { maxDays: 14, minDays: 8 },
  "15_30": { maxDays: 30, minDays: 15 },
} as const satisfies Record<
  Exclude<ActiveMoneyAgeBucket, "unknown_date">,
  { maxDays: Nullable<number>; minDays: number }
>;

export const ActiveMoneyAgeQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  orderState: BookOrderDerivedStatusSchema.optional().describe(
    "The same derived lifecycle state the rest of the page filters by. A state no active order can hold returns empty buckets rather than being ignored.",
  ),
  store: z.string().trim().max(BOOK_ORDER_STATISTICS_LIMITS.storeMax).optional(),
});

export type ActiveMoneyAgeQuery = z.infer<typeof ActiveMoneyAgeQuerySchema>;

export const ActiveMoneyAgeBucketRowSchema = z.object({
  booksCount: CountSchema,
  key: ActiveMoneyAgeBucketSchema,
  ordersCount: CountSchema,
  shipmentsCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type ActiveMoneyAgeBucketRow = z.infer<typeof ActiveMoneyAgeBucketRowSchema>;

export const ActiveMoneyAgeResponseSchema = z
  .object({
    asOf: z.iso.datetime(),
    buckets: z.array(ActiveMoneyAgeBucketRowSchema),
    source: StatisticsSourceQualitySchema,
  })
  .describe(
    "Age of money committed to still-active orders, measured from orderDate against asOf. It ignores the historical from/to filter. The 31_plus bucket is an age fact and carries no delivery-date judgement.",
  );

export type ActiveMoneyAgeResponse = z.infer<typeof ActiveMoneyAgeResponseSchema>;

export const STATISTICS_DYNAMICS_RULES = {
  weeklyMaxDays: 45,
} as const;

export const StatisticsDynamicsGranularitySchema = z.enum(["week", "month"]);

export type StatisticsDynamicsGranularity = z.infer<typeof StatisticsDynamicsGranularitySchema>;

export const StatisticsDynamicsFactsSchema = z
  .object({
    booksCount: CountSchema,
    booksPerOrder: z.number().nullable(),
    from: isoDay(),
    ordersCount: CountSchema,
    to: isoDay(),
    totalsByCurrency: z.array(CurrencyTotalSchema),
  })
  .describe(
    "What one bucket actually covers. from and to are the real bounds after clipping to the period, so a bucket that starts mid-month says so instead of claiming the whole month.",
  );

export type StatisticsDynamicsFacts = z.infer<typeof StatisticsDynamicsFactsSchema>;

export const StatisticsDynamicsBucketSchema = z
  .object({
    comparison: StatisticsDynamicsFactsSchema.nullable(),
    current: StatisticsDynamicsFactsSchema,
    drilldown: StatisticsDrilldownBreakdownSchema,
    key: z.string(),
  })
  .describe(
    "One paired column of the chart. The pairing is decided here, so the frontend never lines up two sparse arrays by index. A bucket with no purchases is still present with zero counts; comparison is null only when the comparison period has no bucket at this position.",
  );

export type StatisticsDynamicsBucket = z.infer<typeof StatisticsDynamicsBucketSchema>;

export const StatisticsDynamicsSchema = z.object({
  buckets: z.array(StatisticsDynamicsBucketSchema),
  granularity: StatisticsDynamicsGranularitySchema,
});

export type StatisticsDynamics = z.infer<typeof StatisticsDynamicsSchema>;

export const BookOrderStatisticsDaySchema = z.object({
  booksCount: CountSchema,
  date: isoDay(),
  drilldown: StatisticsDrilldownBreakdownSchema,
  ordersCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsDay = z.infer<typeof BookOrderStatisticsDaySchema>;

export const BookOrderStatisticsDailySchema = z
  .array(BookOrderStatisticsDaySchema)
  .describe(
    "Sparse ascending series: only days that carry at least one counted order are present, days with no activity are omitted rather than sent as zero rows, and the frontend fills the gaps visually.",
  );

export type BookOrderStatisticsDaily = z.infer<typeof BookOrderStatisticsDailySchema>;

const DRILLDOWN_DESTINATION_BY_STATE = {
  active: "in_transit",
  cancelled: "history_cancelled",
  partially_received: "in_transit",
  partially_shipped: "in_transit",
  received: "history_received",
  shipped: "in_transit",
} as const satisfies Record<BookOrderDerivedStatus, StatisticsDrilldownDestination>;

export function statisticsDrilldownDestinationOf(
  state: BookOrderDerivedStatus,
): StatisticsDrilldownDestination {
  return DRILLDOWN_DESTINATION_BY_STATE[state];
}

export const STATISTICS_METRIC_KIND = {
  countOrStatus: "count_or_status",
  currencySpecificMoney: "currency_specific_money",
} as const;

export type StatisticsDrilldownScope =
  | { ageBucket: ActiveMoneyAgeBucket; kind: "age_bucket" }
  | { from: Nullable<string>; kind: "order_date_range"; to: Nullable<string> }
  | { from: Nullable<string>; kind: "store_and_period"; store: string; to: Nullable<string> }
  | { kind: "order"; orderId: string }
  | { kind: "store"; store: string };

export type StatisticsMetricKind = ValueOf<typeof STATISTICS_METRIC_KIND>;

export function resolveStatisticsDisplayCurrency({
  available,
  currencyFilter,
  requested,
}: {
  available: readonly Currency[];
  currencyFilter: Nullable<Currency>;
  requested: Nullable<Currency>;
}): Nullable<Currency> {
  if (currencyFilter !== null) {
    return currencyFilter;
  }
  if (requested !== null && available.includes(requested)) {
    return requested;
  }
  return available[0] ?? null;
}

export function resolveStatisticsDrilldownCurrency({
  currencyFilter,
  displayCurrency,
  metricKind,
}: {
  currencyFilter: Nullable<Currency>;
  displayCurrency: Nullable<Currency>;
  metricKind: StatisticsMetricKind;
}): Nullable<Currency> {
  return metricKind === STATISTICS_METRIC_KIND.currencySpecificMoney
    ? displayCurrency
    : currencyFilter;
}

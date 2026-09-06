import type { InTransitAttentionReason, InTransitSummaryView, Nullable } from "@app/shared";

import {
  ActiveMoneyAgeBucketSchema,
  IN_TRANSIT_ATTENTION_FILTER,
  InTransitAttentionReasonSchema,
} from "@app/shared";
import {
  type inferParserType,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type {
  DeliveryReadControllerInTransitListParams,
  DeliveryReadControllerInTransitListPriceCurrency,
} from "@/shared/api/generated/model";

import {
  isInvertedDayRange,
  isStorableDay,
  isStorableOrderId,
} from "@/features/books/model/filter-chips";
import {
  DeliveryReadControllerInTransitListCurrencyItem,
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListOrderState,
  DeliveryReadControllerInTransitListSort,
  DeliveryReadControllerInTransitListStructureItem,
} from "@/shared/api/generated/model";

export const DELIVERY_PAGE_SIZE = 24;
export const DELIVERY_FILTER_DEFAULT = DeliveryReadControllerInTransitListFilter.all;
export const DELIVERY_SORT_DEFAULT = DeliveryReadControllerInTransitListSort.closest_delivery;

export const DELIVERY_PRIMARY_FILTERS = [
  DeliveryReadControllerInTransitListFilter.all,
  DeliveryReadControllerInTransitListFilter.ordered,
  DeliveryReadControllerInTransitListFilter.in_transit,
  DeliveryReadControllerInTransitListFilter.ready_for_pickup,
  DeliveryReadControllerInTransitListFilter.delayed,
] as const satisfies readonly DeliveryReadControllerInTransitListFilter[];

export const DELIVERY_CURRENCY_VALUES = Object.values(
  DeliveryReadControllerInTransitListCurrencyItem,
);
export const DELIVERY_STRUCTURE_VALUES = Object.values(
  DeliveryReadControllerInTransitListStructureItem,
);
export const DELIVERY_ORDER_STATE_VALUES = Object.values(
  DeliveryReadControllerInTransitListOrderState,
);

export type DeliveryFilterCounts = Record<DeliveryPrimaryFilter, number>;

export type DeliveryPrimaryFilter = (typeof DELIVERY_PRIMARY_FILTERS)[number];

export const DELIVERY_SORT_ORDER = Object.values(DeliveryReadControllerInTransitListSort);

const filterValues = Object.values(DeliveryReadControllerInTransitListFilter);
const sortValues = Object.values(DeliveryReadControllerInTransitListSort);

export const DELIVERY_AGE_BUCKETS = ActiveMoneyAgeBucketSchema.options;

export const deliveryQueryParsers = {
  ageBucket: parseAsStringLiteral(DELIVERY_AGE_BUCKETS),
  booksMax: parseAsInteger,
  booksMin: parseAsInteger,
  currency: parseAsArrayOf(parseAsStringLiteral(DELIVERY_CURRENCY_VALUES)).withDefault([]),
  expectedFrom: parseAsString,
  expectedTo: parseAsString,
  filter: parseAsStringLiteral(filterValues).withDefault(DELIVERY_FILTER_DEFAULT),
  orderedFrom: parseAsString,
  orderedTo: parseAsString,
  orderId: parseAsString,
  orderState: parseAsStringLiteral(DELIVERY_ORDER_STATE_VALUES),
  priceMax: parseAsFloat,
  priceMin: parseAsFloat,
  q: parseAsString.withDefault(""),
  service: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(sortValues).withDefault(DELIVERY_SORT_DEFAULT),
  store: parseAsArrayOf(parseAsString).withDefault([]),
  structure: parseAsArrayOf(parseAsStringLiteral(DELIVERY_STRUCTURE_VALUES)).withDefault([]),
};

export type DeliveryAdvancedState = Omit<DeliveryQueryState, "filter" | "q" | "sort">;

export type DeliveryListParams = Omit<DeliveryReadControllerInTransitListParams, "pageNumber">;

export type DeliveryQueryState = inferParserType<typeof deliveryQueryParsers>;

type DeliveryRangeFlags = {
  books: boolean;
  expected: boolean;
  ordered: boolean;
  price: boolean;
};

export const DELIVERY_ADVANCED_RESET = {
  ageBucket: null,
  booksMax: null,
  booksMin: null,
  currency: null,
  expectedFrom: null,
  expectedTo: null,
  orderedFrom: null,
  orderedTo: null,
  orderId: null,
  orderState: null,
  priceMax: null,
  priceMin: null,
  service: null,
  store: null,
  structure: null,
} satisfies Record<keyof DeliveryAdvancedState, null>;

export const DELIVERY_ADVANCED_EMPTY: DeliveryAdvancedState = {
  ageBucket: null,
  booksMax: null,
  booksMin: null,
  currency: [],
  expectedFrom: null,
  expectedTo: null,
  orderedFrom: null,
  orderedTo: null,
  orderId: null,
  orderState: null,
  priceMax: null,
  priceMin: null,
  service: [],
  store: [],
  structure: [],
};

export function canSortByOrderTotal(state: Pick<DeliveryQueryState, "currency">): boolean {
  return state.currency.length === 1;
}

export function countActiveDeliveryDimensions(state: DeliveryAdvancedState): number {
  return [
    state.ageBucket !== null,
    isStorableOrderId(state.orderId),
    state.orderState !== null,
    state.store.length > 0,
    state.orderedFrom !== null || state.orderedTo !== null,
    state.booksMin !== null || state.booksMax !== null,
    state.service.length > 0,
    state.expectedFrom !== null || state.expectedTo !== null,
    state.structure.length > 0,
    state.currency.length > 0,
    resolveDeliveryPriceCurrency(state) !== null,
  ].filter(Boolean).length;
}

export function deliveryRangeFlags(state: DeliveryAdvancedState): DeliveryRangeFlags {
  return {
    books: isInvertedNumberRange(state.booksMin, state.booksMax),
    expected: isInvertedDayRange(state.expectedFrom, state.expectedTo),
    ordered: isInvertedDayRange(state.orderedFrom, state.orderedTo),
    price: isInvertedNumberRange(state.priceMin, state.priceMax),
  };
}

export function hasActiveDeliveryFilters(state: DeliveryQueryState): boolean {
  return state.filter !== DELIVERY_FILTER_DEFAULT || countActiveDeliveryDimensions(state) > 0;
}

export function hasActiveDeliverySearch(state: DeliveryQueryState): boolean {
  return state.q.trim() !== "";
}

export function hasInvalidDeliveryRange(state: DeliveryAdvancedState): boolean {
  const flags = deliveryRangeFlags(state);
  return flags.books || flags.expected || flags.ordered || flags.price;
}

export function isDeliveryPrimaryFilter(
  filter: DeliveryReadControllerInTransitListFilter,
): filter is DeliveryPrimaryFilter {
  return DELIVERY_PRIMARY_FILTERS.some((value) => value === filter);
}

export function resolveDeliveryPriceCurrency(
  state: Pick<DeliveryAdvancedState, "currency" | "priceMax" | "priceMin">,
): Nullable<DeliveryReadControllerInTransitListPriceCurrency> {
  const [only] = state.currency;
  if (only === undefined || state.currency.length > 1) return null;
  if (state.priceMin === null && state.priceMax === null) return null;
  if (isInvertedNumberRange(state.priceMin, state.priceMax)) return null;
  return only;
}

export function resolveDeliverySort(
  state: Pick<DeliveryQueryState, "currency" | "sort">,
): DeliveryQueryState["sort"] {
  if (state.sort !== DeliveryReadControllerInTransitListSort.price) return state.sort;
  return canSortByOrderTotal(state) ? state.sort : DELIVERY_SORT_DEFAULT;
}

export function toDeliveryAttentionReason(
  filter: DeliveryReadControllerInTransitListFilter,
): Nullable<InTransitAttentionReason> {
  return (
    InTransitAttentionReasonSchema.options.find(
      (reason) => IN_TRANSIT_ATTENTION_FILTER[reason] === filter,
    ) ?? null
  );
}

export function toDeliveryFilterCounts(summary: InTransitSummaryView): DeliveryFilterCounts {
  return {
    all: summary.activeBooksCount,
    delayed: summary.delayedCount,
    in_transit: summary.inTransitCount,
    ordered: summary.orderedCount,
    ready_for_pickup: summary.readyForPickupCount,
  };
}

export function toDeliveryListParams(state: DeliveryQueryState): DeliveryListParams {
  const search = state.q.trim();
  const flags = deliveryRangeFlags(state);
  const priceCurrency = resolveDeliveryPriceCurrency(state);

  return {
    currency: state.currency,
    filter: state.filter,
    ...(state.ageBucket === null ? {} : { ageBucket: state.ageBucket }),
    ...(isStorableOrderId(state.orderId) ? { orderId: state.orderId } : {}),
    ...(state.orderState === null ? {} : { orderState: state.orderState }),
    pageSize: DELIVERY_PAGE_SIZE,
    service: state.service,
    sort: resolveDeliverySort(state),
    store: state.store,
    structure: state.structure,
    ...(search === "" ? {} : { search }),
    ...(flags.ordered ? {} : dayBound("orderedFrom", state.orderedFrom)),
    ...(flags.ordered ? {} : dayBound("orderedTo", state.orderedTo)),
    ...(flags.expected ? {} : dayBound("expectedFrom", state.expectedFrom)),
    ...(flags.expected ? {} : dayBound("expectedTo", state.expectedTo)),
    ...(flags.books || state.booksMin === null ? {} : { booksMin: state.booksMin }),
    ...(flags.books || state.booksMax === null ? {} : { booksMax: state.booksMax }),
    ...(priceCurrency === null
      ? {}
      : {
          priceCurrency,
          ...(state.priceMin === null ? {} : { priceMin: state.priceMin }),
          ...(state.priceMax === null ? {} : { priceMax: state.priceMax }),
        }),
  };
}

function dayBound(
  key: "expectedFrom" | "expectedTo" | "orderedFrom" | "orderedTo",
  value: Nullable<string>,
): Partial<DeliveryListParams> {
  return isStorableDay(value) ? { [key]: value } : {};
}

function isInvertedNumberRange(min: Nullable<number>, max: Nullable<number>): boolean {
  if (min === null || max === null) return false;
  return min > max;
}

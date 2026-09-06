import type { Nullable } from "@app/shared";

import {
  type inferParserType,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type {
  DeliveryReadControllerHistoryListParams,
  DeliveryReadControllerHistoryListPriceCurrency,
} from "@/shared/api/generated/model";

import {
  isInvertedDayRange,
  isStorableDay,
  isStorableOrderId,
  storableDay,
} from "@/features/books/model/filter-chips";
import {
  DeliveryReadControllerHistoryListCurrencyItem,
  DeliveryReadControllerHistoryListOrderState,
  DeliveryReadControllerHistoryListSort,
  DeliveryReadControllerHistoryListTab,
} from "@/shared/api/generated/model";

export const DELIVERY_HISTORY_PAGE_SIZE = 10;
export const DELIVERY_HISTORY_PANEL_ID = "delivery-history-results";
export const DELIVERY_HISTORY_SORT_DEFAULT = DeliveryReadControllerHistoryListSort.newest_orders;

export const DELIVERY_HISTORY_TABS = [
  DeliveryReadControllerHistoryListTab.received,
  DeliveryReadControllerHistoryListTab.cancelled,
] as const satisfies readonly DeliveryReadControllerHistoryListTab[];

export type DeliveryHistoryTab = (typeof DELIVERY_HISTORY_TABS)[number];

export const DELIVERY_HISTORY_TAB_DEFAULT: DeliveryHistoryTab =
  DeliveryReadControllerHistoryListTab.received;

export const DELIVERY_HISTORY_SORT_ORDER = Object.values(DeliveryReadControllerHistoryListSort);

export const DELIVERY_HISTORY_PRICE_SORTS = [
  DeliveryReadControllerHistoryListSort.price_asc,
  DeliveryReadControllerHistoryListSort.price_desc,
] as const satisfies readonly DeliveryReadControllerHistoryListSort[];

export const DELIVERY_HISTORY_CURRENCY_VALUES = Object.values(
  DeliveryReadControllerHistoryListCurrencyItem,
);

export const DELIVERY_HISTORY_ORDER_STATE_VALUES = Object.values(
  DeliveryReadControllerHistoryListOrderState,
);

export const deliveryHistoryRetiredParsers = {
  hasTrackingNumber: parseAsString,
  hasTrackingUrl: parseAsString,
};

const sortValues = Object.values(DeliveryReadControllerHistoryListSort);

export const deliveryHistoryParsers = {
  booksMax: parseAsInteger,
  booksMin: parseAsInteger,
  cancelledFrom: parseAsString,
  cancelledTo: parseAsString,
  currency: parseAsArrayOf(parseAsStringLiteral(DELIVERY_HISTORY_CURRENCY_VALUES)).withDefault([]),
  from: parseAsString,
  orderId: parseAsString,
  orderState: parseAsStringLiteral(DELIVERY_HISTORY_ORDER_STATE_VALUES),
  priceMax: parseAsFloat,
  priceMin: parseAsFloat,
  q: parseAsString.withDefault(""),
  receivedFrom: parseAsString,
  receivedTo: parseAsString,
  service: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(sortValues).withDefault(DELIVERY_HISTORY_SORT_DEFAULT),
  store: parseAsArrayOf(parseAsString).withDefault([]),
  tab: parseAsStringLiteral(DELIVERY_HISTORY_TABS).withDefault(DELIVERY_HISTORY_TAB_DEFAULT),
  to: parseAsString,
};

export type DeliveryHistoryAdvancedState = Omit<DeliveryHistoryQueryState, "q" | "sort" | "tab">;

export type DeliveryHistoryListParams = Omit<DeliveryReadControllerHistoryListParams, "pageNumber">;

export type DeliveryHistoryQueryState = inferParserType<typeof deliveryHistoryParsers>;

type DeliveryHistoryRangeFlags = {
  books: boolean;
  cancelled: boolean;
  ordered: boolean;
  price: boolean;
  received: boolean;
};

export const DELIVERY_HISTORY_ADVANCED_RESET = {
  booksMax: null,
  booksMin: null,
  cancelledFrom: null,
  cancelledTo: null,
  currency: null,
  from: null,
  orderId: null,
  orderState: null,
  priceMax: null,
  priceMin: null,
  receivedFrom: null,
  receivedTo: null,
  service: null,
  store: null,
  to: null,
} satisfies Record<keyof DeliveryHistoryAdvancedState, null>;

export const DELIVERY_HISTORY_ADVANCED_EMPTY: DeliveryHistoryAdvancedState = {
  booksMax: null,
  booksMin: null,
  cancelledFrom: null,
  cancelledTo: null,
  currency: [],
  from: null,
  orderId: null,
  orderState: null,
  priceMax: null,
  priceMin: null,
  receivedFrom: null,
  receivedTo: null,
  service: [],
  store: [],
  to: null,
};

export function canSortByHistoryTotal(state: Pick<DeliveryHistoryQueryState, "currency">): boolean {
  return state.currency.length === 1;
}

export function comparesHistoryPrices(sort: DeliveryReadControllerHistoryListSort): boolean {
  return DELIVERY_HISTORY_PRICE_SORTS.some((priceSort) => priceSort === sort);
}

export function countActiveHistoryDimensions({
  state,
  tab,
}: {
  state: DeliveryHistoryAdvancedState;
  tab: DeliveryHistoryTab;
}): number {
  const terminal = historyTerminalRange({ state, tab });

  return [
    isStorableOrderId(state.orderId),
    state.orderState !== null,
    state.store.length > 0,
    state.from !== null || state.to !== null,
    state.booksMin !== null || state.booksMax !== null,
    state.service.length > 0,
    terminal.from !== null || terminal.to !== null,
    state.currency.length > 0,
    resolveHistoryPriceCurrency(state) !== null,
  ].filter(Boolean).length;
}

export function hasActiveHistoryFilters({
  state,
  tab,
}: {
  state: DeliveryHistoryAdvancedState;
  tab: DeliveryHistoryTab;
}): boolean {
  return countActiveHistoryDimensions({ state, tab }) > 0;
}

export function hasActiveHistorySearch(state: Pick<DeliveryHistoryQueryState, "q">): boolean {
  return state.q.trim() !== "";
}

export function hasInvalidHistoryRange(state: DeliveryHistoryAdvancedState): boolean {
  return Object.values(historyRangeFlags(state)).some(Boolean);
}

export function historyRangeFlags(state: DeliveryHistoryAdvancedState): DeliveryHistoryRangeFlags {
  return {
    books: isInvertedNumberRange(state.booksMin, state.booksMax),
    cancelled: isInvertedDayRange(state.cancelledFrom, state.cancelledTo),
    ordered: isInvertedDayRange(state.from, state.to),
    price: isInvertedNumberRange(state.priceMin, state.priceMax),
    received: isInvertedDayRange(state.receivedFrom, state.receivedTo),
  };
}

export function historyTerminalRange({
  state,
  tab,
}: {
  state: DeliveryHistoryAdvancedState;
  tab: DeliveryHistoryTab;
}): { from: Nullable<string>; isInverted: boolean; to: Nullable<string> } {
  const flags = historyRangeFlags(state);

  if (tab === DeliveryReadControllerHistoryListTab.cancelled) {
    return {
      from: storableDay(state.cancelledFrom),
      isInverted: flags.cancelled,
      to: storableDay(state.cancelledTo),
    };
  }

  return {
    from: storableDay(state.receivedFrom),
    isInverted: flags.received,
    to: storableDay(state.receivedTo),
  };
}

export function isKnownHistorySort(value: string): boolean {
  return sortValues.some((sort) => sort === value);
}

export function isKnownHistoryTab(value: string): boolean {
  return DELIVERY_HISTORY_TABS.some((tab) => tab === value);
}

export function resolveHistoryPriceCurrency(
  state: Pick<DeliveryHistoryAdvancedState, "currency" | "priceMax" | "priceMin">,
): Nullable<DeliveryReadControllerHistoryListPriceCurrency> {
  const [only] = state.currency;
  if (only === undefined || state.currency.length > 1) return null;
  if (state.priceMin === null && state.priceMax === null) return null;
  if (isInvertedNumberRange(state.priceMin, state.priceMax)) return null;
  return only;
}

export function resolveHistorySort(
  state: Pick<DeliveryHistoryQueryState, "currency" | "sort">,
): DeliveryReadControllerHistoryListSort {
  if (!comparesHistoryPrices(state.sort)) return state.sort;
  return canSortByHistoryTotal(state) ? state.sort : DELIVERY_HISTORY_SORT_DEFAULT;
}

export function toDeliveryHistoryListParams(
  state: DeliveryHistoryQueryState,
): DeliveryHistoryListParams {
  const search = state.q.trim();
  const flags = historyRangeFlags(state);
  const terminal = historyTerminalRange({ state, tab: state.tab });
  const priceCurrency = resolveHistoryPriceCurrency(state);
  const terminalKeys = TERMINAL_RANGE_KEYS[state.tab];

  return {
    currency: state.currency,
    ...(isStorableOrderId(state.orderId) ? { orderId: state.orderId } : {}),
    ...(state.orderState === null ? {} : { orderState: state.orderState }),
    pageSize: DELIVERY_HISTORY_PAGE_SIZE,
    service: state.service,
    sort: resolveHistorySort(state),
    store: state.store,
    tab: state.tab,
    ...(search === "" ? {} : { search }),
    ...(flags.ordered ? {} : dayBound("from", state.from)),
    ...(flags.ordered ? {} : dayBound("to", state.to)),
    ...(terminal.isInverted ? {} : dayBound(terminalKeys.from, terminal.from)),
    ...(terminal.isInverted ? {} : dayBound(terminalKeys.to, terminal.to)),
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

const TERMINAL_RANGE_KEYS = {
  cancelled: { from: "cancelledFrom", to: "cancelledTo" },
  received: { from: "receivedFrom", to: "receivedTo" },
} as const satisfies Record<
  DeliveryHistoryTab,
  { from: keyof DeliveryHistoryListParams; to: keyof DeliveryHistoryListParams }
>;

function dayBound(
  key: "cancelledFrom" | "cancelledTo" | "from" | "receivedFrom" | "receivedTo" | "to",
  value: Nullable<string>,
): Partial<DeliveryHistoryListParams> {
  return isStorableDay(value) ? { [key]: value } : {};
}

function isInvertedNumberRange(min: Nullable<number>, max: Nullable<number>): boolean {
  if (min === null || max === null) return false;
  return min > max;
}

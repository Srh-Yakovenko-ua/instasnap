import type { Nullable, QuotesFacetsQuery, QuotesQuery } from "@app/shared";

import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { isInvertedDayRange, storableDay } from "@/features/books/model/filter-chips";

import { QUOTE_FILTER_VALUES, QUOTE_SORT_VALUES } from "./quote-options";

export type QuotesFacetsParams = QuotesFacetsQuery;
export type QuotesListParams = Omit<QuotesQuery, "pageNumber">;

export const QUOTES_PAGE_SIZE = 12;
export const QUOTES_FILTER_DEFAULT = "all";
export const QUOTES_SORT_DEFAULT = "newest";

export const QUOTE_VIEW_MODES = ["grid", "list"] as const;
export type QuotesViewMode = (typeof QUOTE_VIEW_MODES)[number];
export const QUOTES_VIEW_DEFAULT: QuotesViewMode = "grid";

export const quotesQueryParsers = {
  author: parseAsArrayOf(parseAsString).withDefault([]),
  book: parseAsArrayOf(parseAsString).withDefault([]),
  bookId: parseAsString,
  createdFrom: parseAsString,
  createdTo: parseAsString,
  filter: parseAsStringLiteral(QUOTE_FILTER_VALUES).withDefault(QUOTES_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(QUOTE_SORT_VALUES).withDefault(QUOTES_SORT_DEFAULT),
  view: parseAsStringLiteral(QUOTE_VIEW_MODES).withDefault(QUOTES_VIEW_DEFAULT),
};

export type QuotesQueryState = inferParserType<typeof quotesQueryParsers>;

export const QUOTES_FILTERS_RESET = {
  author: null,
  book: null,
  bookId: null,
  createdFrom: null,
  createdTo: null,
  filter: null,
  q: null,
} satisfies Partial<Record<keyof QuotesQueryState, null>>;

export function activeQuoteFilterCount(state: QuotesQueryState): number {
  return [
    quoteBookIds(state).length > 0,
    state.author.length > 0,
    quoteCreatedRange(state) !== null,
  ].filter(Boolean).length;
}

export function hasActiveQuotesFilters(state: QuotesQueryState): boolean {
  return (
    state.q.trim() !== "" ||
    state.filter !== QUOTES_FILTER_DEFAULT ||
    activeQuoteFilterCount(state) > 0
  );
}

export function hasInvalidQuotesRange(state: {
  createdFrom: Nullable<string>;
  createdTo: Nullable<string>;
}): boolean {
  return isInvertedDayRange(state.createdFrom, state.createdTo);
}

export function quoteBookIds(state: Pick<QuotesQueryState, "book" | "bookId">): string[] {
  return [...new Set([...state.book, ...(state.bookId === null ? [] : [state.bookId])])];
}

export function quoteCreatedRange(state: {
  createdFrom: Nullable<string>;
  createdTo: Nullable<string>;
}): Nullable<{ from: Nullable<string>; to: Nullable<string> }> {
  if (hasInvalidQuotesRange(state)) {
    return null;
  }
  const from = storableDay(state.createdFrom);
  const to = storableDay(state.createdTo);
  return from === null && to === null ? null : { from, to };
}

export function quotesListIdentity(params: QuotesListParams): string {
  return [
    params.q ?? "",
    (params.book ?? []).join(","),
    (params.author ?? []).join(","),
    params.createdFrom ?? "",
    params.createdTo ?? "",
    params.filter,
    params.sort,
  ].join("|");
}

export function toQuotesFacetsParams(state: QuotesQueryState): QuotesFacetsParams {
  const search = state.q.trim();
  const books = quoteBookIds(state);
  const range = quoteCreatedRange(state);
  const from = range === null ? null : range.from;
  const to = range === null ? null : range.to;

  return {
    ...(search === "" ? {} : { q: search }),
    ...(books.length === 0 ? {} : { book: books }),
    ...(state.author.length === 0 ? {} : { author: state.author }),
    ...(from === null ? {} : { createdFrom: from }),
    ...(to === null ? {} : { createdTo: to }),
  };
}

export function toQuotesListParams(state: QuotesQueryState): QuotesListParams {
  return {
    ...toQuotesFacetsParams(state),
    filter: state.filter,
    pageSize: QUOTES_PAGE_SIZE,
    sort: state.sort,
  };
}

import type { QuotesQuery } from "@app/shared";

import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { QUOTE_FILTER_OPTIONS, QUOTE_SORT_OPTIONS } from "./quote-options";

export type QuotesListParams = Omit<QuotesQuery, "pageNumber">;

export const QUOTES_PAGE_SIZE = 12;
export const QUOTES_FILTER_DEFAULT = "all";
export const QUOTES_SORT_DEFAULT = "newest";

export const QUOTE_VIEW_MODES = ["grid", "list"] as const;
export type QuotesViewMode = (typeof QUOTE_VIEW_MODES)[number];
export const QUOTES_VIEW_DEFAULT: QuotesViewMode = "grid";

export const quotesQueryParsers = {
  bookId: parseAsString,
  filter: parseAsStringLiteral(QUOTE_FILTER_OPTIONS).withDefault(QUOTES_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(QUOTE_SORT_OPTIONS).withDefault(QUOTES_SORT_DEFAULT),
  view: parseAsStringLiteral(QUOTE_VIEW_MODES).withDefault(QUOTES_VIEW_DEFAULT),
};

export type QuotesQueryState = inferParserType<typeof quotesQueryParsers>;

export const QUOTES_FILTERS_RESET = {
  bookId: null,
  filter: null,
  q: null,
  sort: null,
} satisfies Partial<Record<keyof QuotesQueryState, null>>;

export function hasActiveQuotesFilters(state: QuotesQueryState): boolean {
  return (
    state.q.trim() !== "" ||
    state.bookId !== null ||
    state.filter !== QUOTES_FILTER_DEFAULT ||
    state.sort !== QUOTES_SORT_DEFAULT
  );
}

export function quotesListIdentity(params: QuotesListParams): string {
  return [params.q ?? "", params.bookId ?? "", params.filter, params.sort].join("|");
}

export function toQuotesListParams(state: QuotesQueryState): QuotesListParams {
  const search = state.q.trim();

  return {
    filter: state.filter,
    pageSize: QUOTES_PAGE_SIZE,
    sort: state.sort,
    ...(search === "" ? {} : { q: search }),
    ...(state.bookId === null ? {} : { bookId: state.bookId }),
  };
}

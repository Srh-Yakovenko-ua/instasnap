import type { QuoteFilter, QuotesFacetsView, QuoteSort } from "@app/shared";

export type QuoteFilterCounts = Record<QuoteFilter, number>;

export const QUOTE_FILTER_VALUES = [
  "all",
  "no_spoiler",
  "with_spoiler",
  "favorites",
  "with_comment",
  "without_comment",
] as const satisfies readonly QuoteFilter[];

const QUOTE_FILTER_VISIBLE_OPTIONS = [
  "all",
  "favorites",
  "with_comment",
  "no_spoiler",
  "with_spoiler",
] as const satisfies readonly QuoteFilter[];

export function quoteFilterCounts(facets: QuotesFacetsView): QuoteFilterCounts {
  return {
    all: facets.totalCount,
    favorites: facets.favoritesCount,
    no_spoiler: facets.withoutSpoilerCount,
    with_comment: facets.withCommentCount,
    with_spoiler: facets.spoilerCount,
    without_comment: facets.withoutCommentCount,
  };
}

export function resolveQuoteFilterOptions(filter: QuoteFilter): readonly QuoteFilter[] {
  if (QUOTE_FILTER_VISIBLE_OPTIONS.some((option) => option === filter)) {
    return QUOTE_FILTER_VISIBLE_OPTIONS;
  }
  return [...QUOTE_FILTER_VISIBLE_OPTIONS, filter];
}

export const QUOTE_SORT_VALUES = [
  "newest",
  "oldest",
  "book_title",
  "book_author",
  "page",
  "favorites_first",
  "no_spoiler_first",
  "with_spoiler_first",
] as const satisfies readonly QuoteSort[];

const QUOTE_SORT_VISIBLE_OPTIONS = [
  "newest",
  "oldest",
  "book_title",
  "book_author",
  "page",
] as const satisfies readonly QuoteSort[];

export function resolveQuoteSortOptions(sort: QuoteSort): readonly QuoteSort[] {
  if (QUOTE_SORT_VISIBLE_OPTIONS.some((option) => option === sort)) {
    return QUOTE_SORT_VISIBLE_OPTIONS;
  }
  return [...QUOTE_SORT_VISIBLE_OPTIONS, sort];
}

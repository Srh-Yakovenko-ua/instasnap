import type { QuoteFilter, QuoteSort } from "@app/shared";

export const QUOTE_FILTER_OPTIONS = [
  "all",
  "no_spoiler",
  "with_spoiler",
  "favorites",
  "with_comment",
  "without_comment",
] as const satisfies readonly QuoteFilter[];

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

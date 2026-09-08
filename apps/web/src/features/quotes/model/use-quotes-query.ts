"use client";

import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  QuotesFacetsParams,
  QuotesListParams,
  QuotesQueryState,
  QuotesViewMode,
} from "./quotes-query";

import {
  activeQuoteFilterCount,
  hasActiveQuotesFilters,
  QUOTES_FILTERS_RESET,
  quotesQueryParsers,
  toQuotesFacetsParams,
  toQuotesListParams,
} from "./quotes-query";

export type QuotesAdvancedPatch = {
  author: string[];
  book: string[];
  createdFrom: Nullable<string>;
  createdTo: Nullable<string>;
};

export type UseQuotesQueryResult = {
  activeFilterCount: number;
  applyAdvanced: (patch: QuotesAdvancedPatch) => void;
  clearFilters: () => void;
  facetsParams: QuotesFacetsParams;
  hasActiveFilters: boolean;
  listParams: QuotesListParams;
  setFilter: (value: QuoteFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: QuoteSort) => void;
  setView: (value: QuotesViewMode) => void;
  state: QuotesQueryState;
};

export function useQuotesQuery(): UseQuotesQueryResult {
  const [state, setState] = useQueryStates(quotesQueryParsers);

  return {
    activeFilterCount: activeQuoteFilterCount(state),
    applyAdvanced: ({ author, book, createdFrom, createdTo }) =>
      void setState({
        author: author.length === 0 ? null : author,
        book: book.length === 0 ? null : book,
        bookId: null,
        createdFrom,
        createdTo,
      }),
    clearFilters: () => void setState(QUOTES_FILTERS_RESET),
    facetsParams: toQuotesFacetsParams(state),
    hasActiveFilters: hasActiveQuotesFilters(state),
    listParams: toQuotesListParams(state),
    setFilter: (filter) => void setState({ filter }),
    setSearch: (q) => void setState({ q }),
    setSort: (sort) => void setState({ sort }),
    setView: (view) => void setState({ view }),
    state,
  };
}

"use client";

import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { QuotesListParams, QuotesQueryState, QuotesViewMode } from "./quotes-query";

import {
  hasActiveQuotesFilters,
  QUOTES_FILTERS_RESET,
  quotesQueryParsers,
  toQuotesListParams,
} from "./quotes-query";

export type UseQuotesQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  listParams: QuotesListParams;
  setBookId: (value: Nullable<string>) => void;
  setFilter: (value: QuoteFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: QuoteSort) => void;
  setView: (value: QuotesViewMode) => void;
  state: QuotesQueryState;
};

export function useQuotesQuery(): UseQuotesQueryResult {
  const [state, setState] = useQueryStates(quotesQueryParsers);

  return {
    clearFilters: () => void setState(QUOTES_FILTERS_RESET),
    hasActiveFilters: hasActiveQuotesFilters(state),
    listParams: toQuotesListParams(state),
    setBookId: (bookId) => void setState({ bookId }),
    setFilter: (filter) => void setState({ filter }),
    setSearch: (q) => void setState({ q }),
    setSort: (sort) => void setState({ sort }),
    setView: (view) => void setState({ view }),
    state,
  };
}

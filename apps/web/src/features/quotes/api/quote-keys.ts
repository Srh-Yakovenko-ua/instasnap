import type { QuotesFacetsParams, QuotesListParams } from "../model/quotes-query";

const QUOTES_ROOT = "/api/quotes";

export const quoteKeys = {
  facets: (params: QuotesFacetsParams) => [QUOTES_ROOT, "facets", params] as const,
  forBook: (bookId: string) => [QUOTES_ROOT, "book", bookId] as const,
  list: (params: QuotesListParams) => [QUOTES_ROOT, "list", params] as const,
  root: [QUOTES_ROOT] as const,
  summary: [QUOTES_ROOT, "summary"] as const,
};

import type { z } from "zod";

import { PaginatedQuotesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { quotesControllerList } from "@/shared/api/generated/endpoints/quotes/quotes";

import type { QuotesListParams } from "../model/quotes-query";

import { quoteKeys } from "./quote-keys";

export type QuotesPage = z.infer<typeof PaginatedQuotesSchema>;

const MAX_PAGES = 10;

export function useQuotes(params: QuotesListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: QuotesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    getPreviousPageParam: (firstPage: QuotesPage) =>
      firstPage.page > 1 ? firstPage.page - 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<QuotesPage> =>
      PaginatedQuotesSchema.parse(
        await quotesControllerList({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: quoteKeys.list(params),
  });
}

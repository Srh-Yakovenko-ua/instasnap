import type { QuotesFacetsView } from "@app/shared";

import { QuotesFacetsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { quotesControllerFacets } from "@/shared/api/generated/endpoints/quotes/quotes";

import type { QuotesFacetsParams } from "../model/quotes-query";

import { quoteKeys } from "./quote-keys";

export function useQuotesFacets(params: QuotesFacetsParams) {
  return useQuery({
    queryFn: async ({ signal }): Promise<QuotesFacetsView> =>
      QuotesFacetsViewSchema.parse(await quotesControllerFacets(params, { signal })),
    queryKey: quoteKeys.facets(params),
  });
}

import type { LoanContactListItemView, LoanContactsView } from "@app/shared";

import { LoanContactsViewSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { loanContactsControllerList } from "@/shared/api/generated/endpoints/loans/loans";
import { LoanContactsControllerListStatus } from "@/shared/api/generated/model";

import { loanKeys } from "./loan-keys";

const LOAN_CONTACTS_SEARCH_PAGE_SIZE = 20;

type LoanContactsSearchOptions = {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  items: LoanContactListItemView[];
};

export function useLoanContacts(search: string): LoanContactsSearchOptions {
  const trimmed = search.trim();

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: LoanContactsView) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LoanContactsView> => {
      const response = await loanContactsControllerList({
        pageNumber: pageParam,
        pageSize: LOAN_CONTACTS_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
        status: LoanContactsControllerListStatus.active,
      });
      return LoanContactsViewSchema.parse(response);
    },
    queryKey: loanKeys.contacts.search(trimmed),
  });

  return {
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

import type { BookBudgetOverview, Currency, SaveBookBudgetsInput } from "@app/shared";

import { BookBudgetOverviewSchema } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookBudgetsControllerCancelScheduled,
  bookBudgetsControllerCancelScheduledStop,
  bookBudgetsControllerOverview,
  bookBudgetsControllerSave,
} from "@/shared/api/generated/endpoints/book-budgets/book-budgets";

export const BOOK_BUDGETS_QUERY_KEY = "/api/delivery/budgets";

export function useBookBudgets() {
  return useQuery({
    queryFn: async (): Promise<BookBudgetOverview> =>
      BookBudgetOverviewSchema.parse(await bookBudgetsControllerOverview()),
    queryKey: [BOOK_BUDGETS_QUERY_KEY],
  });
}

export function useCancelScheduledBudget() {
  const sync = useBudgetSync();

  return useMutation({
    mutationFn: async (currency: Currency): Promise<BookBudgetOverview> =>
      BookBudgetOverviewSchema.parse(await bookBudgetsControllerCancelScheduled(currency)),
    onSuccess: sync,
  });
}

export function useCancelScheduledBudgetStop() {
  const sync = useBudgetSync();

  return useMutation({
    mutationFn: async (currency: Currency): Promise<BookBudgetOverview> =>
      BookBudgetOverviewSchema.parse(await bookBudgetsControllerCancelScheduledStop(currency)),
    onSuccess: sync,
  });
}

export function useSaveBookBudgets() {
  const sync = useBudgetSync();

  return useMutation({
    mutationFn: async (input: SaveBookBudgetsInput): Promise<BookBudgetOverview> =>
      BookBudgetOverviewSchema.parse(await bookBudgetsControllerSave(input)),
    onSuccess: sync,
  });
}

function useBudgetSync() {
  const queryClient = useQueryClient();
  return (overview: BookBudgetOverview) => {
    queryClient.setQueryData([BOOK_BUDGETS_QUERY_KEY], overview);
  };
}

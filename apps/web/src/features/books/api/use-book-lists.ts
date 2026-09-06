import type { BookListsView, NewListInput } from "@app/shared";

import { BookListsViewSchema, CustomListCardSchema } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listKeys } from "@/features/lists/api/list-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import {
  bookListsControllerGetLists,
  bookListsControllerSetLists,
} from "@/shared/api/generated/endpoints/books/books";
import { listsControllerCreate } from "@/shared/api/generated/endpoints/lists/lists";

import { bookKeys } from "./book-keys";

export function useBookLists(bookId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<BookListsView> =>
      BookListsViewSchema.parse(await bookListsControllerGetLists(bookId)),
    queryKey: bookListsKey(bookId),
  });
}

export function useSetBookLists(bookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listIds,
      newLists,
    }: {
      listIds: string[];
      newLists: NewListInput[];
    }): Promise<BookListsView> => {
      const createdIds = await Promise.all(
        newLists.map(
          async (draft) => CustomListCardSchema.parse(await listsControllerCreate(draft)).id,
        ),
      );
      return BookListsViewSchema.parse(
        await bookListsControllerSetLists(bookId, { listIds: [...listIds, ...createdIds] }),
      );
    },
    onSuccess: (result) => {
      queryClient.setQueryData(bookListsKey(bookId), result);
      void queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

function bookListsKey(bookId: string) {
  return [...bookKeys.detail(bookId), "lists"] as const;
}

import type { BookView, OwnershipStatus, ReadingStatus } from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { BulkActionResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { listKeys } from "@/features/lists/api/list-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import {
  booksControllerDelete,
  booksControllerUpdate,
  bulkBooksControllerDelete,
  bulkBooksControllerFavorite,
  bulkBooksControllerLists,
  bulkBooksControllerOwnershipStatus,
  bulkBooksControllerReadingQueue,
  bulkBooksControllerReadingStatus,
  bulkBooksControllerTags,
} from "@/shared/api/generated/endpoints/books/books";
import { getReadingQueueControllerGetQueueQueryKey } from "@/shared/api/generated/endpoints/reading-queue/reading-queue";

import type { ListDraft } from "../model/book-organization-fields";
import type { LibraryBooksPage } from "./use-books";

import { bookKeys, matchesBooksExceptDetail } from "./book-keys";

const LIST_KEY = ["/api/books", "list"];

type FavoriteContext = {
  snapshot: [QueryKey, InfiniteData<LibraryBooksPage> | undefined][];
};

export function useBulkAddTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; tags: string[] }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerTags(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useBulkAddToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; listIds: string[]; newLists: ListDraft[] }) =>
      BulkActionResultSchema.parse(
        await bulkBooksControllerLists({
          bookIds: input.bookIds,
          listIds: input.listIds,
          newLists: input.newLists,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

export function useBulkAddToReadingQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookIds: string[]) =>
      BulkActionResultSchema.parse(await bulkBooksControllerReadingQueue({ bookIds })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}

export function useBulkDeleteBooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookIds: string[]) =>
      BulkActionResultSchema.parse(await bulkBooksControllerDelete({ bookIds })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

export function useBulkOwnershipStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; ownershipStatus: OwnershipStatus }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerOwnershipStatus(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

export function useBulkReadingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; readingStatus: ReadingStatus }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerReadingStatus(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

export function useBulkSetFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; isFavorite: boolean }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerFavorite(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

export function useRemoveFromReadingQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksControllerUpdate(id, { addToReadingQueue: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({
        queryKey: getReadingQueueControllerGetQueueQueryKey(),
      });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: string; isFavorite: boolean }, FavoriteContext>({
    mutationFn: ({ id, isFavorite }) => booksControllerUpdate(id, { isFavorite }),
    onError: (_error, _input, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      const snapshot = queryClient.getQueriesData<InfiniteData<LibraryBooksPage>>({
        queryKey: LIST_KEY,
      });
      for (const [key, data] of snapshot) {
        if (data === undefined) continue;
        queryClient.setQueryData<InfiniteData<LibraryBooksPage>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((book) => (book.id === id ? { ...book, isFavorite } : book)),
          })),
        });
      }
      return { snapshot };
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(id) });
    },
    onSuccess: (_data, { id, isFavorite }) => {
      const detailKey = bookKeys.detail(id);
      const cached = queryClient.getQueryData<BookView>(detailKey);
      if (cached !== undefined) {
        queryClient.setQueryData<BookView>(detailKey, { ...cached, isFavorite });
      }
    },
  });
}

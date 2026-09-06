import type { BookView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { seriesKeys } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";

import { bookKeys, matchesBooksExceptDetail } from "./book-keys";
import { matchesReadingQueueKey } from "./reading-queue-keys";

export function useBookMutationSync() {
  const queryClient = useQueryClient();

  return (book: BookView) => {
    queryClient.setQueryData(bookKeys.detail(book.id), book);
    void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(book.id) });
    void queryClient.invalidateQueries({ predicate: matchesReadingQueueKey });
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === `/api/books/${book.id}/reading-history`,
    });
    void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/delivery"),
    });
    void invalidateStatisticsQueries(queryClient);
  };
}

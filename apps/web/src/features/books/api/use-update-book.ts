import type { UpdateBookInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { listKeys } from "@/features/lists/api/list-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

import { matchesReadingQueueKey } from "./reading-queue-keys";

export function useUpdateBook(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBookInput) => booksControllerUpdate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void queryClient.invalidateQueries({ predicate: matchesReadingQueueKey });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { seriesControllerDelete } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export function useDeleteSeries(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seriesControllerDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

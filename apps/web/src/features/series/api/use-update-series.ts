import type { SeriesView, UpdateSeriesInput } from "@app/shared";

import { SeriesViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateSeriesInputDto } from "@/shared/api/generated/model";

import { bookKeys } from "@/features/books/api/book-keys";
import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { seriesControllerUpdate } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export function useUpdateSeries(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSeriesInput): Promise<SeriesView> => {
      const response = await seriesControllerUpdate(id, input as UpdateSeriesInputDto);
      return SeriesViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

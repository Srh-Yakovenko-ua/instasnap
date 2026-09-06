import type { NewSeriesInput, SeriesView } from "@app/shared";

import { SeriesViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { NewSeriesInputDto } from "@/shared/api/generated/model";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { seriesControllerCreate } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys } from "./series-keys";

export function useCreateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewSeriesInput): Promise<SeriesView> => {
      const response = await seriesControllerCreate(input as NewSeriesInputDto);
      return SeriesViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

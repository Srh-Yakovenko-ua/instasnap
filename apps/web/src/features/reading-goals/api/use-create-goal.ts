import type { CreateReadingGoalInput, ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { ApiError } from "@/lib/http-client";
import { readingGoalsControllerCreate } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

const CONFLICT_STATUS = 409;

type CreateGoalVariables = {
  input: CreateReadingGoalInput;
  listId: string;
};

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, listId }: CreateGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerCreate(listId, input);
      return ReadingGoalViewSchema.parse(response);
    },
    onError: (error, { listId }) => {
      if (!(error instanceof ApiError) || error.status !== CONFLICT_STATUS) return;
      void queryClient.invalidateQueries({ queryKey: goalKeys.forList(listId) });
    },
    onSuccess: (_goal, { listId }) => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.forList(listId) });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}

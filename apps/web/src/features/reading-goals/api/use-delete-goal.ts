import type { Nullable } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { readingGoalsControllerDelete } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

type DeleteGoalVariables = {
  goalId: string;
  listId: Nullable<string>;
};

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: DeleteGoalVariables): Promise<void> => {
      await readingGoalsControllerDelete(goalId);
    },
    onSuccess: (_result, { goalId, listId }) => {
      queryClient.removeQueries({ queryKey: goalKeys.detail(goalId) });
      void invalidateStatisticsQueries(queryClient);
      if (listId === null) return;
      void queryClient.invalidateQueries({ queryKey: goalKeys.forList(listId) });
    },
  });
}

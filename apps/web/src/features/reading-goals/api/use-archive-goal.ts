import type { ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { readingGoalsControllerArchive } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

type ArchiveGoalVariables = {
  goalId: string;
};

export function useArchiveGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: ArchiveGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerArchive(goalId);
      return ReadingGoalViewSchema.parse(response);
    },
    onSuccess: (goal) => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.detail(goal.id) });
      void invalidateStatisticsQueries(queryClient);
      if (goal.list === null) return;
      void queryClient.invalidateQueries({ queryKey: goalKeys.forList(goal.list.id) });
    },
  });
}

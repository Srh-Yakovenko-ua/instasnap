import type { ReadingGoalView, UpdateReadingGoalInput } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { readingGoalsControllerUpdate } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

type UpdateGoalVariables = {
  goalId: string;
  input: UpdateReadingGoalInput;
};

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, input }: UpdateGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerUpdate(goalId, input);
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

import type { LoanHistoryDetailView, UpdateLoanHistoryInput } from "@app/shared";

import { LoanHistoryDetailViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { loanHistoryControllerCorrect } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useCorrectLoanHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      loanId: string;
      payload: UpdateLoanHistoryInput;
    }): Promise<LoanHistoryDetailView> =>
      LoanHistoryDetailViewSchema.parse(
        await loanHistoryControllerCorrect(input.loanId, input.payload),
      ),
    onSuccess: (_detail, input) => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.history.lists });
      void queryClient.invalidateQueries({ queryKey: loanKeys.history.overviews });
      void queryClient.invalidateQueries({ queryKey: loanKeys.history.peoples });
      void queryClient.invalidateQueries({ queryKey: loanKeys.history.detail(input.loanId) });
    },
  });
}

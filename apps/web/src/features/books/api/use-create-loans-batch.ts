import type { CreateLoansBatchInput, CreateLoansBatchResult } from "@app/shared";

import { CreateLoansBatchResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesLoans } from "@/features/loans/api/loan-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { bookLoanBatchControllerCreateLoans } from "@/shared/api/generated/endpoints/books/books";

import { BOOKS_ROOT } from "./book-keys";
import { matchesReadingQueueKey } from "./reading-queue-keys";

export function useCreateLoansBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLoansBatchInput): Promise<CreateLoansBatchResult> =>
      CreateLoansBatchResultSchema.parse(await bookLoanBatchControllerCreateLoans(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === BOOKS_ROOT,
      });
      void queryClient.invalidateQueries({ predicate: matchesReadingQueueKey });
      void queryClient.invalidateQueries({ predicate: matchesLoans });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    },
  });
}

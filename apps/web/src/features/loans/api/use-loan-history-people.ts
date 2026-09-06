import type { LoanHistoryPeopleView } from "@app/shared";

import { LoanHistoryPeopleViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { LoanHistoryControllerPeopleParams } from "@/shared/api/generated/model";

import { loanHistoryControllerPeople } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoanHistoryPeople(params: LoanHistoryControllerPeopleParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LoanHistoryPeopleView> =>
      LoanHistoryPeopleViewSchema.parse(await loanHistoryControllerPeople(params)),
    queryKey: loanKeys.history.people(params),
  });
}

"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import type { LoanContactsQueryState } from "./loan-contacts-query";
import type { UseLoanContactsQueryResult } from "./use-loan-contacts-query";

import { LOAN_CONTACTS_STATUS_DEFAULT } from "./loan-contacts-query";

type UseLoanContactsFilterChipsOptions = {
  setState: UseLoanContactsQueryResult["setState"];
  state: LoanContactsQueryState;
};

export function useLoanContactsFilterChips({
  setState,
  state,
}: UseLoanContactsFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("books.library.activeFilters");
  const tFilters = useTranslations("loans.contactsPage.filters");

  const chips: ActiveFilterChip[] = [];

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => void setState({ q: null }),
    });
  }

  if (state.status !== LOAN_CONTACTS_STATUS_DEFAULT) {
    chips.push({
      key: `status:${state.status}`,
      label: tFilters(`statusOptions.${state.status}`),
      onRemove: () => void setState({ status: null }),
    });
  }

  return chips;
}

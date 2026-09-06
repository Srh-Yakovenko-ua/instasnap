"use client";

import type { LoanDirection, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { rangeLabel, storableDay } from "@/features/books/model/filter-chips";
import { formatDate } from "@/lib/format";

import type { LoansAdvancedState } from "./loans-query";

import { loanRangeFlags } from "./loans-query";

type UseLoansFilterChipsOptions = {
  contactName: Nullable<string>;
  direction: LoanDirection;
  onApplyAdvanced: (draft: LoansAdvancedState) => void;
  onClearSearch: () => void;
  search: string;
  state: LoansAdvancedState;
};

export function useLoansFilterChips({
  contactName,
  direction,
  onApplyAdvanced,
  onClearSearch,
  search,
  state,
}: UseLoansFilterChipsOptions): ActiveFilterChip[] {
  const locale = useLocale();
  const t = useTranslations("loans.activeFilters");

  const chips: ActiveFilterChip[] = [];
  const isInverted = loanRangeFlags(state);
  const trimmedSearch = search.trim();

  if (trimmedSearch !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: trimmedSearch }),
      onRemove: onClearSearch,
    });
  }

  if (state.contactId !== "") {
    chips.push({
      key: "contact",
      label: t(`person.${direction}`, { name: contactName ?? t("personUnknown") }),
      onRemove: () => onApplyAdvanced({ ...state, contactId: "" }),
    });
  }

  const loanLabel = isInverted.loan
    ? null
    : rangeLabel({
        from: (value) => t(`loanDateFrom.${direction}`, { value: formatDate(value, locale) }),
        max: storableDay(state.loanTo),
        min: storableDay(state.loanFrom),
        range: (min, max) =>
          t(`loanDateRange.${direction}`, {
            from: formatDate(min, locale),
            to: formatDate(max, locale),
          }),
        to: (value) => t(`loanDateTo.${direction}`, { value: formatDate(value, locale) }),
      });
  if (loanLabel !== null) {
    chips.push({
      key: "loanDate",
      label: loanLabel,
      onRemove: () => onApplyAdvanced({ ...state, loanFrom: null, loanTo: null }),
    });
  }

  const dueLabel = isInverted.due
    ? null
    : rangeLabel({
        from: (value) => t("dueDateFrom", { value: formatDate(value, locale) }),
        max: storableDay(state.dueTo),
        min: storableDay(state.dueFrom),
        range: (min, max) =>
          t("dueDateRange", { from: formatDate(min, locale), to: formatDate(max, locale) }),
        to: (value) => t("dueDateTo", { value: formatDate(value, locale) }),
      });
  if (dueLabel !== null) {
    chips.push({
      key: "dueDate",
      label: dueLabel,
      onRemove: () => onApplyAdvanced({ ...state, dueFrom: null, dueTo: null }),
    });
  }

  if (state.reminder !== null) {
    chips.push({
      key: "reminder",
      label: t(`reminder.${state.reminder}`),
      onRemove: () => onApplyAdvanced({ ...state, reminder: null }),
    });
  }

  if (state.hasNote !== null) {
    chips.push({
      key: "hasNote",
      label: t(state.hasNote ? "noteWith" : "noteWithout"),
      onRemove: () => onApplyAdvanced({ ...state, hasNote: null }),
    });
  }

  return chips;
}

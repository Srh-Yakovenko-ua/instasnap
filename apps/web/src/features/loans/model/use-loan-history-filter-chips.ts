"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { rangeLabel, storableDay } from "@/features/books/model/filter-chips";
import { formatDate } from "@/lib/format";

import type { LoanHistoryAdvancedState } from "./loan-history-query";

import { useLoanContact } from "../api/use-loan-contact";
import {
  loanHistoryPeriodPresets,
  loanHistoryRangeFlags,
  resolveLoanHistoryPeriodPreset,
} from "./loan-history-query";

type UseLoanHistoryFilterChipsOptions = {
  onApplyAdvanced: (draft: LoanHistoryAdvancedState) => void;
  onClearSearch: () => void;
  search: string;
  state: LoanHistoryAdvancedState;
};

export function useLoanHistoryFilterChips({
  onApplyAdvanced,
  onClearSearch,
  search,
  state,
}: UseLoanHistoryFilterChipsOptions): ActiveFilterChip[] {
  const locale = useLocale();
  const t = useTranslations("loans.history.activeFilters");
  const contact = useLoanContact(state.contactId === "" ? null : state.contactId);

  const chips: ActiveFilterChip[] = [];
  const isInverted = loanHistoryRangeFlags(state);
  const direction = state.type ?? "all";
  const trimmedSearch = search.trim();

  function returnedChipLabel(): Nullable<string> {
    if (isInverted.returned) return null;

    const preset = resolveLoanHistoryPeriodPreset(
      { from: state.from, to: state.to },
      loanHistoryPeriodPresets(new Date()),
    );
    if (preset === "lastYear" || preset === "thisYear") return t(`returnedPreset.${preset}`);

    return rangeLabel({
      from: (value) => t("returnedFrom", { value: formatDate(value, locale) }),
      max: storableDay(state.to),
      min: storableDay(state.from),
      range: (min, max) =>
        t("returnedRange", { from: formatDate(min, locale), to: formatDate(max, locale) }),
      to: (value) => t("returnedTo", { value: formatDate(value, locale) }),
    });
  }

  if (trimmedSearch !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: trimmedSearch }),
      onRemove: onClearSearch,
    });
  }

  if (state.type !== null) {
    chips.push({
      key: "type",
      label: t(`direction.${state.type}`),
      onRemove: () => onApplyAdvanced({ ...state, type: null }),
    });
  }

  if (state.contactId !== "") {
    chips.push({
      key: "contact",
      label: t("person", { name: contact.data?.name ?? t("personUnknown") }),
      onRemove: () => onApplyAdvanced({ ...state, contactId: "" }),
    });
  }

  const returnedLabel = returnedChipLabel();
  if (returnedLabel !== null) {
    chips.push({
      key: "returned",
      label: returnedLabel,
      onRemove: () => onApplyAdvanced({ ...state, from: "", to: "" }),
    });
  }

  const loanLabel = isInverted.loanDate
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

  return chips;
}

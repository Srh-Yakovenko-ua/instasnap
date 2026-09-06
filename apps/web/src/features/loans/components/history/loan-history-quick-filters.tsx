"use client";

import type { LoanHistoryResultCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LoanHistoryControllerListResult } from "@/shared/api/generated/model";

import { ChipGroup } from "@/components/ui/chip-group";

import type { LoanHistoryQuickFilterKey } from "../../model/loan-history-quick-filters";

import { LOAN_HISTORY_QUICK_FILTER_KEYS } from "../../model/loan-history-quick-filters";

type LoanHistoryQuickFiltersProps = {
  counts?: LoanHistoryResultCounts;
  onSelect: (key: LoanHistoryQuickFilterKey) => void;
  value: LoanHistoryControllerListResult;
};

export function LoanHistoryQuickFilters({ counts, onSelect, value }: LoanHistoryQuickFiltersProps) {
  const t = useTranslations("loans.history.quickFilters");
  const options = LOAN_HISTORY_QUICK_FILTER_KEYS.map((key) => ({
    count: counts?.[key],
    label: t(key),
    value: key,
  }));

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        label={t("label")}
        mode="single"
        onValueChange={(next) => {
          const match = LOAN_HISTORY_QUICK_FILTER_KEYS.find((key) => key === next);
          if (match !== undefined) onSelect(match);
        }}
        options={options}
        size="sm"
        value={value}
      />
    </div>
  );
}

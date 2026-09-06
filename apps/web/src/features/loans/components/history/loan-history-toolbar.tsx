"use client";

import { useTranslations } from "next-intl";

import type { LoanHistoryControllerListSort } from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LoanHistoryAdvancedState } from "../../model/loan-history-query";

import {
  LOAN_HISTORY_SORT_DEFAULT,
  LOAN_HISTORY_SORT_VALUES,
} from "../../model/loan-history-query";
import { LoanHistoryAdvancedFilters } from "./loan-history-advanced-filters";

type LoanHistorySortDirection = "all" | NonNullable<LoanHistoryAdvancedState["type"]>;

type LoanHistoryToolbarProps = {
  advanced: LoanHistoryAdvancedState;
  advancedCount: number;
  onApplyAdvanced: (draft: LoanHistoryAdvancedState) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: LoanHistoryControllerListSort) => void;
  search: string;
  sort: LoanHistoryControllerListSort;
};

type SortGroupKey = "book" | "duration" | "loan" | "person" | "returned";

const SORT_GROUP_BY_VALUE = {
  duration_desc: "duration",
  loan_date_desc: "loan",
  person_asc: "person",
  returned_asc: "returned",
  returned_desc: "returned",
  title_asc: "book",
} as const satisfies Record<LoanHistoryControllerListSort, SortGroupKey>;

export function LoanHistoryToolbar({
  advanced,
  advancedCount,
  onApplyAdvanced,
  onSearchChange,
  onSearchClear,
  onSortChange,
  search,
  sort,
}: LoanHistoryToolbarProps) {
  const t = useTranslations("loans.history.toolbar");
  const tCommon = useTranslations("common");
  const direction = advanced.type ?? "all";
  const tSort = useTranslations(`loans.history.sort.options.${direction}`);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="lg:flex-1">
        <DebouncedSearchInput
          clearLabel={t("searchClear")}
          label={t("searchLabel")}
          onClear={onSearchClear}
          onSearch={onSearchChange}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
        <LoanHistorySortSheet
          className="sm:hidden"
          direction={direction}
          label={t("sortLabel")}
          onChange={onSortChange}
          value={sort}
        />

        <LoanHistoryAdvancedFilters
          activeCount={advancedCount}
          onApply={onApplyAdvanced}
          state={advanced}
        />

        <div className="hidden sm:block sm:w-80">
          <Select
            onValueChange={(next) => onSortChange(next as LoanHistoryControllerListSort)}
            value={sort}
          >
            <SelectTrigger
              aria-label={t("sortLabel")}
              className="h-10 w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              isClearable={sort !== LOAN_HISTORY_SORT_DEFAULT}
              onClear={() => onSortChange(LOAN_HISTORY_SORT_DEFAULT)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_HISTORY_SORT_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tSort(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function LoanHistorySortSheet({
  className,
  direction,
  label,
  onChange,
  value,
}: {
  className?: string;
  direction: LoanHistorySortDirection;
  label: string;
  onChange: (value: LoanHistoryControllerListSort) => void;
  value: LoanHistoryControllerListSort;
}) {
  const t = useTranslations("loans.history.sort.mobile");
  const tOptions = useTranslations(`loans.history.sort.options.${direction}`);

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => tOptions(option),
        values: LOAN_HISTORY_SORT_VALUES,
      })}
      id="loan-history-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}

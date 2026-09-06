"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LoansControllerListSort } from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LoanDirection } from "../model/loan-pages";
import type { LoansAdvancedState } from "../model/loans-query";

import { LOANS_SORT_DEFAULT, LOANS_SORT_VALUES } from "../model/loans-query";
import { LoansAdvancedFilters } from "./loans-advanced-filters";
import { LoansSortSheet } from "./loans-sort-sheet";

type LoansToolbarProps = {
  advanced: LoansAdvancedState;
  advancedCount: number;
  contactName: Nullable<string>;
  direction: LoanDirection;
  onApplyAdvanced: (draft: LoansAdvancedState) => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSortChange: (value: LoansControllerListSort) => void;
  search: string;
  sort: LoansControllerListSort;
};

export function LoansToolbar({
  advanced,
  advancedCount,
  contactName,
  direction,
  onApplyAdvanced,
  onSearchChange,
  onSearchClear,
  onSortChange,
  search,
  sort,
}: LoansToolbarProps) {
  const t = useTranslations("loans.toolbar");
  const tCommon = useTranslations("common");
  const tSort = useTranslations(`loans.sort.${direction}`);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="lg:flex-1">
        <DebouncedSearchInput
          clearLabel={t("searchClear")}
          label={t(`searchLabel.${direction}`)}
          onClear={onSearchClear}
          onSearch={onSearchChange}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2.5">
        <LoansSortSheet
          className="sm:hidden"
          direction={direction}
          label={t("sortLabel")}
          onChange={onSortChange}
          value={sort}
        />

        <LoansAdvancedFilters
          activeCount={advancedCount}
          contactName={contactName}
          direction={direction}
          onApply={onApplyAdvanced}
          state={advanced}
        />

        <div className="hidden sm:block sm:w-80">
          <ToolbarSelect
            clearable={sort !== LOANS_SORT_DEFAULT}
            clearLabel={tCommon("clear")}
            label={t("sortLabel")}
            onChange={onSortChange}
            onClear={() => onSortChange(LOANS_SORT_DEFAULT)}
            options={LOANS_SORT_VALUES.map((value) => ({ label: tSort(value), value }))}
            value={sort}
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  clearable = false,
  clearLabel,
  label,
  onChange,
  onClear,
  options,
  value,
}: {
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className="w-full">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full data-[size=default]:h-10"
          clearLabel={clearLabel}
          isClearable={clearable}
          onClear={onClear}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

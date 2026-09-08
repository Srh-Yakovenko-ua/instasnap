"use client";

import type { QuoteFilter, QuotesFacetsView, QuoteSort } from "@app/shared";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";

import type { QuoteFilterCounts } from "../model/quote-options";
import type { QuotesQueryState, QuotesViewMode } from "../model/quotes-query";
import type { QuotesAdvancedPatch } from "../model/use-quotes-query";

import { resolveQuoteFilterOptions, resolveQuoteSortOptions } from "../model/quote-options";
import { QUOTES_FILTER_DEFAULT, QUOTES_SORT_DEFAULT } from "../model/quotes-query";
import { QuotesAdvancedFilters } from "./quotes-advanced-filters";
import { QuotesSortSheet } from "./quotes-sort-sheet";

type QuotesToolbarProps = {
  activeFilterCount: number;
  chips: ActiveFilterChip[];
  counter?: string;
  counts?: QuoteFilterCounts;
  facets: QuotesFacetsView | undefined;
  filter: QuoteFilter;
  onApplyAdvanced: (patch: QuotesAdvancedPatch) => void;
  onClearAll: () => void;
  onFilterChange: (filter: QuoteFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (sort: QuoteSort) => void;
  onViewChange: (view: QuotesViewMode) => void;
  search: string;
  sort: QuoteSort;
  state: QuotesQueryState;
  view: QuotesViewMode;
};

export function QuotesToolbar({
  activeFilterCount,
  chips,
  counter,
  counts,
  facets,
  filter,
  onApplyAdvanced,
  onClearAll,
  onFilterChange,
  onSearch,
  onSortChange,
  onViewChange,
  search,
  sort,
  state,
  view,
}: QuotesToolbarProps) {
  const t = useTranslations("quotes.toolbar");
  const tCommon = useTranslations("common");
  const tFilter = useTranslations("quotes.filter");
  const tSort = useTranslations("quotes.sort");
  const tView = useTranslations("quotes.view");

  const filterOptions = resolveQuoteFilterOptions(filter);
  const sortOptions = resolveQuoteSortOptions(sort);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => onSearch("")}
            onSearch={onSearch}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </div>

        <QuotesSortSheet
          className="max-w-[9.5rem] sm:hidden"
          label={t("sortLabel")}
          onChange={onSortChange}
          value={sort}
        />
      </div>

      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <QuotesAdvancedFilters
          activeCount={activeFilterCount}
          facets={facets}
          onApply={onApplyAdvanced}
          state={state}
        />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden sm:block sm:w-80">
            <Select
              onValueChange={(next) => {
                const match = sortOptions.find((option) => option === next);
                if (match !== undefined) onSortChange(match);
              }}
              value={sort}
            >
              <SelectTrigger
                aria-label={t("sortLabel")}
                className="w-full data-[size=default]:h-10"
                clearLabel={tCommon("clear")}
                isClearable={sort !== QUOTES_SORT_DEFAULT}
                onClear={() => onSortChange(QUOTES_SORT_DEFAULT)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tSort(`options.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Segmented
            className="ml-auto h-10 shrink-0 items-stretch sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
            label={tView("label")}
            onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
            options={[
              {
                icon: <LayoutGrid />,
                label: <span className="max-sm:sr-only">{tView("grid")}</span>,
                value: "grid",
              },
              {
                icon: <List />,
                label: <span className="max-sm:sr-only">{tView("list")}</span>,
                value: "list",
              },
            ]}
            value={view}
          />
        </div>
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filterLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = filterOptions.find((option) => option === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={filterOptions.map((option) => ({
            count: counts?.[option],
            label: tFilter(option),
            value: option,
          }))}
          size="sm"
          value={filter}
        />
      </div>

      <LibraryActiveFilters chips={chips} onClearAll={onClearAll} />

      {counter === undefined ? null : (
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {counter}
        </p>
      )}
    </div>
  );
}

export function QuotesToolbarSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-10 min-w-0 flex-1 rounded-md" />
        <Skeleton className="h-10 w-[9.5rem] shrink-0 rounded-md sm:hidden" />
      </div>
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:w-28" />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Skeleton className="hidden h-10 rounded-md sm:block sm:w-80" />
          <Skeleton className="h-10 w-20 shrink-0 rounded-full sm:w-40" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from(
          { length: resolveQuoteFilterOptions(QUOTES_FILTER_DEFAULT).length },
          (_, index) => (
            <Skeleton className="h-8 w-24 rounded-full" key={index} />
          ),
        )}
      </div>
    </div>
  );
}

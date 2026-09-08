"use client";

import type { Nullable, QuoteFilter, QuoteSort } from "@app/shared";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";
import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { QuoteBookOption } from "../model/quote-book";
import type { QuotesViewMode } from "../model/quotes-query";

import { QUOTE_FILTER_OPTIONS, QUOTE_SORT_OPTIONS } from "../model/quote-options";
import { QUOTES_SORT_DEFAULT } from "../model/quotes-query";
import { BookPicker } from "./book-picker";

type QuotesToolbarProps = {
  book: Nullable<QuoteBookOption>;
  filter: QuoteFilter;
  onBookChange: (bookId: Nullable<string>) => void;
  onFilterChange: (filter: QuoteFilter) => void;
  onSearch: (value: string) => void;
  onSortChange: (sort: QuoteSort) => void;
  onViewChange: (view: QuotesViewMode) => void;
  search: string;
  sort: QuoteSort;
  view: QuotesViewMode;
};

export function QuotesToolbar({
  book,
  filter,
  onBookChange,
  onFilterChange,
  onSearch,
  onSortChange,
  onViewChange,
  search,
  sort,
  view,
}: QuotesToolbarProps) {
  const t = useTranslations("quotes.toolbar");
  const tCommon = useTranslations("common");
  const tFilter = useTranslations("quotes.filter");
  const tSort = useTranslations("quotes.sort");
  const tSortMobile = useTranslations("quotes.sortMobile");
  const tView = useTranslations("quotes.view");

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

        <MobileSortSheet
          className="max-w-[9.5rem] sm:hidden"
          closeLabel={tSortMobile("close")}
          description={tSortMobile("description")}
          groups={[
            {
              key: "sort",
              options: QUOTE_SORT_OPTIONS.map((value) => ({ label: tSort(value), value })),
            },
          ]}
          id="quotes-sort"
          label={t("sortLabel")}
          onChange={onSortChange}
          title={tSortMobile("title")}
          triggerLabel={tSortMobile(`trigger.${sort}`)}
          value={sort}
        />
      </div>

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filterLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = QUOTE_FILTER_OPTIONS.find((option) => option === next);
            if (match !== undefined) onFilterChange(match);
          }}
          options={QUOTE_FILTER_OPTIONS.map((option) => ({
            label: tFilter(option),
            value: option,
          }))}
          size="sm"
          value={filter}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:flex-col sm:items-stretch sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
          <BookPicker
            id="quotes-book-filter"
            onChange={(next) => onBookChange(next?.id ?? null)}
            placeholder={t("bookPlaceholder")}
            value={book}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden sm:block sm:w-56">
            <Select
              onValueChange={(next) => {
                const match = QUOTE_SORT_OPTIONS.find((option) => option === next);
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
                {QUOTE_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tSort(option)}
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
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: QUOTE_FILTER_OPTIONS.length }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 sm:flex-col sm:items-stretch sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Skeleton className="h-10 min-w-0 flex-1 rounded-md sm:w-64 sm:flex-none" />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Skeleton className="hidden h-10 rounded-md sm:block sm:w-56" />
          <Skeleton className="h-10 w-20 shrink-0 rounded-full sm:w-40" />
        </div>
      </div>
    </div>
  );
}

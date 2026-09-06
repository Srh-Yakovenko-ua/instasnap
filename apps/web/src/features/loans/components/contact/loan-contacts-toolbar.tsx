"use client";

import type { LoanContactCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { LibraryActiveFilters } from "@/features/books";

import type { UseLoanContactsQueryResult } from "../../model/use-loan-contacts-query";

import { useLoanContactsFilterChips } from "../../model/use-loan-contacts-filter-chips";
import { LoanContactsAdvancedFilters } from "./loan-contacts-advanced-filters";

type LoanContactsToolbarProps = {
  counts?: LoanContactCounts;
  query: UseLoanContactsQueryResult;
};

export function LoanContactsToolbar({ counts, query }: LoanContactsToolbarProps) {
  const t = useTranslations("loans.contactsPage.toolbar");
  const chips = useLoanContactsFilterChips({ setState: query.setState, state: query.state });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => query.setSearch("")}
            onSearch={query.setSearch}
            placeholder={t("searchPlaceholder")}
            value={query.state.q}
          />
        </div>

        <LoanContactsAdvancedFilters
          activeCount={query.activeFilterCount}
          counts={counts}
          setState={query.setState}
          status={query.status}
        />
      </div>

      <LibraryActiveFilters chips={chips} onClearAll={query.clearQuery} />
    </div>
  );
}

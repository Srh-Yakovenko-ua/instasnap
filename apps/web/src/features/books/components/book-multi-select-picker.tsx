"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { LibraryListParams } from "../model/library-query";

import { useLibraryBooks } from "../api/use-books";
import { BOOK_PICKER_SCROLL_AREA, BookPickerResults, BookPickerSelected } from "./book-picker";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 24;

export type BookMultiSelectPickerLabels = {
  clear: string;
  empty: string;
  emptySelected: string;
  library: string;
  loadMore: string;
  removeSelected: string;
  search: string;
  selected: (count: number) => string;
  selectLoaded?: (count: number) => string;
};

export function BookMultiSelectPicker({
  baseParams,
  labels,
  onSelectedChange,
  renderEmpty,
  selected,
}: {
  baseParams?: Partial<LibraryListParams>;
  labels: BookMultiSelectPickerLabels;
  onSelectedChange: (books: BookView[]) => void;
  renderEmpty?: (searched: boolean) => ReactNode;
  selected: BookView[];
}) {
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("books.readingStatus.options");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const query = useLibraryBooks(libraryParams(baseParams, debouncedSearch));
  const selectedIds = new Set(selected.map((book) => book.id));
  const results = (query.data?.pages ?? []).flatMap((page) => page.items);
  const selectableResults = results.filter((book) => !selectedIds.has(book.id));
  const searched = debouncedSearch.trim().length > 0;

  function toggle(book: BookView) {
    onSelectedChange(
      selectedIds.has(book.id)
        ? selected.filter((entry) => entry.id !== book.id)
        : [...selected, book],
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="text-sm font-medium text-ink">{labels.library}</h3>
        <div className="relative flex items-center">
          <UiIcon
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted-foreground"
            name="search"
            size={18}
          />
          <Input
            aria-label={labels.search}
            autoComplete="off"
            className="h-10 pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.search}
            value={search}
          />
        </div>
        {results.length === 0 || labels.selectLoaded === undefined ? null : (
          <Button
            className="self-start"
            disabled={selectableResults.length === 0}
            onClick={() => onSelectedChange([...selected, ...selectableResults])}
            size="sm"
            variant="ghost"
          >
            <UiIcon name="check-check" size={16} />
            {labels.selectLoaded(selectableResults.length)}
          </Button>
        )}
        <ScrollArea className={cn("h-72", BOOK_PICKER_SCROLL_AREA)}>
          <BookPickerResults
            emptyLabel={renderEmpty === undefined ? labels.empty : renderEmpty(searched)}
            isPending={query.isPending}
            loadingLabel={tCommon("loading")}
            onToggle={toggle}
            readingLabel={(status) => tStatus(status)}
            results={results}
            selectedIds={selectedIds}
          />
          {query.hasNextPage ? (
            <div className="px-2 pb-2">
              <Button
                className="w-full"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                size="sm"
                variant="outline"
              >
                {labels.loadMore}
              </Button>
            </div>
          ) : null}
        </ScrollArea>
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">{labels.selected(selected.length)}</h3>
          {selected.length > 0 ? (
            <Button onClick={() => onSelectedChange([])} size="sm" variant="ghost">
              {labels.clear}
            </Button>
          ) : null}
        </div>
        <ScrollArea className={cn("h-72", BOOK_PICKER_SCROLL_AREA)}>
          <BookPickerSelected
            books={selected}
            emptyLabel={labels.emptySelected}
            onRemove={toggle}
            removeLabel={labels.removeSelected}
          />
        </ScrollArea>
      </section>
    </div>
  );
}

function libraryParams(
  baseParams: Partial<LibraryListParams> | undefined,
  search: string,
): LibraryListParams {
  const q = search.trim();
  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    owner: [],
    pageSize: PAGE_SIZE,
    publisher: [],
    status: [],
    tag: [],
    ...baseParams,
    ...(q === "" ? {} : { q }),
  };
}

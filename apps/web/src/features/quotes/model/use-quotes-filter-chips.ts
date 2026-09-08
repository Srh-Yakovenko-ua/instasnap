"use client";

import type { QuotesFacetsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { rangeLabel } from "@/features/books/model/filter-chips";
import { formatDate } from "@/lib/format";

import type { QuotesAdvancedPatch } from "./use-quotes-query";

import { quoteBookIds, quoteCreatedRange, type QuotesQueryState } from "./quotes-query";

type UseQuotesFilterChipsOptions = {
  facets: QuotesFacetsView | undefined;
  onApplyAdvanced: (patch: QuotesAdvancedPatch) => void;
  onSearch: (value: string) => void;
  state: QuotesQueryState;
};

export function useQuotesFilterChips({
  facets,
  onApplyAdvanced,
  onSearch,
  state,
}: UseQuotesFilterChipsOptions): ActiveFilterChip[] {
  const locale = useLocale();
  const t = useTranslations("books.library.activeFilters");
  const tQuotes = useTranslations("quotes.activeFilters");

  const chips: ActiveFilterChip[] = [];
  const books = quoteBookIds(state);
  const titleById = new Map((facets?.books ?? []).map((book) => [book.id, book.title]));
  const nameById = new Map((facets?.authors ?? []).map((author) => [author.id, author.name]));

  function applyAdvanced(patch: Partial<QuotesAdvancedPatch>): void {
    onApplyAdvanced({
      author: state.author,
      book: books,
      createdFrom: state.createdFrom,
      createdTo: state.createdTo,
      ...patch,
    });
  }

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => onSearch(""),
    });
  }

  for (const bookId of books) {
    chips.push({
      key: `book:${bookId}`,
      label: tQuotes("book", { title: titleById.get(bookId) ?? t("unknown") }),
      onRemove: () => applyAdvanced({ book: books.filter((item) => item !== bookId) }),
    });
  }

  for (const authorId of state.author) {
    chips.push({
      key: `author:${authorId}`,
      label: t("author", { name: nameById.get(authorId) ?? t("unknown") }),
      onRemove: () => applyAdvanced({ author: state.author.filter((item) => item !== authorId) }),
    });
  }

  const range = quoteCreatedRange(state);
  const createdLabel =
    range === null
      ? null
      : rangeLabel({
          from: (value) => tQuotes("createdFrom", { value: formatDate(value, locale) }),
          max: range.to,
          min: range.from,
          range: (min, max) =>
            tQuotes("createdRange", {
              from: formatDate(min, locale),
              to: formatDate(max, locale),
            }),
          to: (value) => tQuotes("createdTo", { value: formatDate(value, locale) }),
        });
  if (createdLabel !== null) {
    chips.push({
      key: "created",
      label: createdLabel,
      onRemove: () => applyAdvanced({ createdFrom: null, createdTo: null }),
    });
  }

  return chips;
}

"use client";

import type { QuotesFacetsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { FacetOption } from "@/components/facet-multiselect";

import { FacetMultiselect } from "@/components/facet-multiselect";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSection } from "@/components/ui/filter-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BookDateField } from "@/features/books/components/book-date-field";
import { cn } from "@/lib/utils";

import type { QuotesAdvancedPatch } from "../model/use-quotes-query";

import { hasInvalidQuotesRange, quoteBookIds } from "../model/quotes-query";

const EMPTY_ADVANCED: QuotesAdvancedPatch = {
  author: [],
  book: [],
  createdFrom: null,
  createdTo: null,
};

type QuotesAdvancedFiltersProps = {
  activeCount: number;
  facets: QuotesFacetsView | undefined;
  onApply: (patch: QuotesAdvancedPatch) => void;
  state: {
    author: string[];
    book: string[];
    bookId: null | string;
    createdFrom: null | string;
    createdTo: null | string;
  };
};

export function QuotesAdvancedFilters({
  activeCount,
  facets,
  onApply,
  state,
}: QuotesAdvancedFiltersProps) {
  const t = useTranslations("quotes.advancedFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuotesAdvancedPatch>(() => draftFromState(state));

  const bookOptions: FacetOption[] = (facets?.books ?? []).map((book) => ({
    count: book.count,
    label: book.title,
    value: book.id,
  }));
  const authorOptions: FacetOption[] = (facets?.authors ?? []).map((author) => ({
    count: author.count,
    label: author.name,
    value: author.id,
  }));

  const rangeIsInverted = hasInvalidQuotesRange(draft);

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(draftFromState(state));
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn("h-10", activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0")}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("sections.books")}>
            <FacetMultiselect
              emptyText={t("books.empty")}
              label={t("sections.books")}
              onValueChange={(book) => setDraft((prev) => ({ ...prev, book }))}
              options={bookOptions}
              placeholder={t("books.placeholder")}
              searchPlaceholder={t("books.search")}
              selectedText={(count) => t("books.selected", { count })}
              value={draft.book}
            />
          </FilterSection>

          <FilterSection title={t("sections.authors")}>
            <FacetMultiselect
              emptyText={t("authors.empty")}
              label={t("sections.authors")}
              onValueChange={(author) => setDraft((prev) => ({ ...prev, author }))}
              options={authorOptions}
              placeholder={t("authors.placeholder")}
              searchPlaceholder={t("authors.search")}
              selectedText={(count) => t("authors.selected", { count })}
              value={draft.author}
            />
          </FilterSection>

          <FilterSection title={t("sections.created")}>
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="quotes-filter-created-from"
                invalid={rangeIsInverted}
                onChange={(value) => setDraft((prev) => ({ ...prev, createdFrom: value ?? null }))}
                placeholder={t("range.from")}
                value={draft.createdFrom}
              />
              <BookDateField
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="quotes-filter-created-to"
                invalid={rangeIsInverted}
                onChange={(value) => setDraft((prev) => ({ ...prev, createdTo: value ?? null }))}
                placeholder={t("range.to")}
                value={draft.createdTo}
              />
            </div>
            {rangeIsInverted ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button onClick={() => setDraft(EMPTY_ADVANCED)} type="button" variant="ghost">
            {t("clear")}
          </Button>
          <Button
            disabled={rangeIsInverted}
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function draftFromState(state: QuotesAdvancedFiltersProps["state"]): QuotesAdvancedPatch {
  return {
    author: state.author,
    book: quoteBookIds(state),
    createdFrom: state.createdFrom,
    createdTo: state.createdTo,
  };
}

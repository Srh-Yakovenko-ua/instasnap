"use client";

import type { QuoteSort } from "@app/shared";

import { useTranslations } from "next-intl";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import { resolveQuoteSortOptions } from "../model/quote-options";

type QuotesSortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: QuoteSort) => void;
  value: QuoteSort;
};

type SortGroupKey = "added" | "book" | "legacy" | "page";

const SORT_GROUP_BY_VALUE: Record<QuoteSort, SortGroupKey> = {
  book_author: "book",
  book_title: "book",
  favorites_first: "legacy",
  newest: "added",
  no_spoiler_first: "legacy",
  oldest: "added",
  page: "page",
  with_spoiler_first: "legacy",
};

export function QuotesSortSheet({ className, label, onChange, value }: QuotesSortSheetProps) {
  const t = useTranslations("quotes.sort.mobile");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => t(`options.${option}`),
        values: resolveQuoteSortOptions(value),
      })}
      id="quotes-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}

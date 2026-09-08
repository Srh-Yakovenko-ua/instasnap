"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { LibrarySummaryMobile } from "@/features/books/components/library-summary-mobile";
import { useRouter } from "@/i18n/navigation";

import { useQuoteBook } from "../api/use-quote-book";
import { useQuotes } from "../api/use-quotes";
import { useQuotesSummary } from "../api/use-quotes-summary";
import { toQuoteBookOption } from "../model/quote-book";
import { quotesListIdentity } from "../model/quotes-query";
import { useQuotesQuery } from "../model/use-quotes-query";
import { QuoteDialog } from "./quote-dialog";
import { QuotesContent } from "./quotes-content";
import { QuotesOverviewPanel } from "./quotes-overview-panel";
import { QuotesSidebar } from "./quotes-sidebar";
import { QuotesToolbar, QuotesToolbarSkeleton } from "./quotes-toolbar";

const QUOTES_MOBILE_TILE_COUNT = 3;

type QuoteSummaryKey =
  "favorites" | "spoilers" | "topAuthor" | "topBook" | "total" | "withComment" | "withoutSpoilers";

export function QuotesView() {
  const t = useTranslations("quotes");
  const tActions = useTranslations("quotes.actions");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const {
    clearFilters,
    hasActiveFilters,
    listParams,
    setBookId,
    setFilter,
    setSearch,
    setSort,
    setView,
    state,
  } = useQuotesQuery();

  const quotes = useQuotes(listParams);
  const summary = useQuotesSummary();
  const filterBook = useQuoteBook(state.bookId);

  const quoteItems = (quotes.data?.pages ?? []).flatMap((page) => page.items);

  const selectedBook = filterBook.data === undefined ? null : toQuoteBookOption(filterBook.data);
  const showSidebar = !quotes.isError;

  const stats = summary.data;
  const topBook = stats?.topBook ?? null;
  const topAuthor = stats?.topAuthor ?? null;

  const summaryLabels = (key: QuoteSummaryKey) => ({
    label: t(`summary.mobile.detailed.${key}`),
    mobileLabels: {
      compact: t(`summary.mobile.compact.${key}`),
      detailed: t(`summary.mobile.detailed.${key}`),
    },
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      ...summaryLabels("total"),
      icon: "quote",
      iconTone: "primary",
      value: stats?.totalCount ?? 0,
    },
    {
      ...summaryLabels("favorites"),
      icon: "heart",
      iconTone: "favorite",
      value: stats?.favoritesCount ?? 0,
    },
    {
      ...summaryLabels("withComment"),
      icon: "note",
      iconTone: "info",
      value: stats?.withCommentCount ?? 0,
    },
    {
      ...summaryLabels("spoilers"),
      icon: "eye-off",
      iconTone: "tag",
      value: stats?.spoilerCount ?? 0,
    },
    {
      ...summaryLabels("withoutSpoilers"),
      icon: "eye",
      iconTone: "success",
      value: stats?.withoutSpoilerCount ?? 0,
    },
    {
      ...summaryLabels("topBook"),
      icon: "book",
      iconTone: "ink",
      value: topBook === null ? t("summary.empty") : topBook.title,
      valueClassName: "text-lg leading-snug line-clamp-2",
    },
    {
      ...summaryLabels("topAuthor"),
      icon: "user",
      iconTone: "genre",
      value: topAuthor === null ? t("summary.empty") : topAuthor.name,
      valueClassName: "text-lg leading-snug line-clamp-2",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
                {t("title")}
              </h1>
              <TitleLeaf />
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("subtitle")}
            </p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setAddOpen(true)}>
            <UiIcon name="plus" size={16} />
            {tActions("add")}
          </Button>
        </div>
      </header>

      {showSidebar ? (
        <LibrarySummaryMobile
          action={
            <QuotesOverviewPanel
              isLoading={summary.isPending}
              onAddQuote={() => setAddOpen(true)}
              onClearFilters={clearFilters}
              onShowFavorites={() => setFilter("favorites")}
              onShowRecent={() => setSort("newest")}
              onShowWithComment={() => setFilter("with_comment")}
              summaryCards={summaryCards}
            />
          }
          cards={summaryCards.slice(0, QUOTES_MOBILE_TILE_COUNT)}
          className="sm:hidden"
          isLoading={summary.isPending}
        />
      ) : null}

      <ToolbarSlot
        isError={quotes.isError}
        isPending={quotes.isPending}
        toolbar={
          <QuotesToolbar
            book={selectedBook}
            filter={state.filter}
            onBookChange={setBookId}
            onFilterChange={setFilter}
            onSearch={setSearch}
            onSortChange={setSort}
            onViewChange={setView}
            search={state.q}
            sort={state.sort}
            view={state.view}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <QuotesContent
            hasActiveFilters={hasActiveFilters}
            hasNextPage={quotes.hasNextPage}
            isError={quotes.isError}
            isFetchingNextPage={quotes.isFetchingNextPage}
            isLoadMoreError={quotes.isFetchNextPageError}
            isPending={quotes.isPending}
            listIdentity={quotesListIdentity(listParams)}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onLoadMore={() => void quotes.fetchNextPage()}
            onOpenBooks={() => router.push("/books")}
            onRetry={() => void quotes.refetch()}
            quotes={quoteItems}
            view={state.view}
          />
        </div>

        {showSidebar ? (
          <QuotesSidebar
            isLoading={summary.isPending}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onShowFavorites={() => setFilter("favorites")}
            onShowRecent={() => setSort("newest")}
            onShowWithComment={() => setFilter("with_comment")}
            summary={summary.data}
          />
        ) : null}
      </div>

      <QuoteDialog mode="createWithBookPicker" onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}

function ToolbarSlot({
  isError,
  isPending,
  toolbar,
}: {
  isError: boolean;
  isPending: boolean;
  toolbar: ReactNode;
}) {
  if (isError) return null;
  if (isPending) return <QuotesToolbarSkeleton />;
  return toolbar;
}

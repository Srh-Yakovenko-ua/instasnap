"use client";

import type { QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { QuotesViewMode } from "../model/quotes-query";

import { QuoteCard } from "./quote-card";

const SKELETON_COUNT = 6;

type QuotesContentProps = {
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  isPending: boolean;
  listIdentity: string;
  onAddQuote: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onOpenBooks: () => void;
  onRetry: () => void;
  quotes: QuoteView[];
  view: QuotesViewMode;
};

export function QuotesContent({
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoadMoreError,
  isPending,
  listIdentity,
  onAddQuote,
  onClearFilters,
  onLoadMore,
  onOpenBooks,
  onRetry,
  quotes,
  view,
}: QuotesContentProps) {
  const t = useTranslations("quotes");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("actions.retry") },
      title: t("error.load"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return <QuotesSkeleton view={view} />;
  }

  if (quotes.length === 0 && !hasActiveFilters) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-quotes",
      primary: { icon: "plus", label: t("actions.add") },
      secondary: { icon: "book", label: t("empty.secondary") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddQuote} onSecondary={onOpenBooks} state={emptyState} />;
  }

  if (quotes.length === 0) {
    const noResultsState: EmptyStateEntry = {
      desc: t("noResults.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("noResults.clear") },
      title: t("noResults.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={noResultsState} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul
        className={cn("grid grid-cols-1 gap-4", view === "grid" && "md:grid-cols-2")}
        key={listIdentity}
      >
        {quotes.map((quote) => (
          <li className="flex min-w-0" key={quote.id}>
            <QuoteCard quote={quote} variant="archive" />
          </li>
        ))}
      </ul>

      <LoadMoreFooter
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoadMoreError={isLoadMoreError}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("quotes");

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {hasNextPage ? (
        <>
          {isLoadMoreError ? (
            <p className="text-sm text-error" role="alert">
              {t("loadMoreError")}
            </p>
          ) : null}
          <Button
            disabled={isFetchingNextPage}
            loading={isFetchingNextPage}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("allShown")}</p>
      )}
    </div>
  );
}

function QuotesSkeleton({ view }: { view: QuotesViewMode }) {
  const t = useTranslations("quotes");

  return (
    <div
      aria-busy
      className={cn("grid grid-cols-1 gap-4", view === "grid" && "md:grid-cols-2")}
      role="status"
    >
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-accent-border bg-accent/25 p-4"
          key={index}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="aspect-[3/4] w-10 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

"use client";

import type { LoanListItemView, LoanType, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";
import type {
  LoansControllerListFilter,
  LoansControllerListReminder,
} from "@/shared/api/generated/model";

import { EmptyState } from "@/components/empty-state";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";
import { todayIso } from "@/features/books/model/reading-progress";
import { useRouter } from "@/i18n/navigation";

import type { LoanDirection } from "../model/loan-pages";
import type { LoanAttentionKey, LoansAttention, LoansPeople } from "./loans-sidebar";

import { useLoanContact } from "../api/use-loan-contact";
import { useLoansList } from "../api/use-loans-list";
import { useLoansSummary } from "../api/use-loans-summary";
import { LOAN_PAGES } from "../model/loan-pages";
import { loansQuickFilterCounts } from "../model/loans-quick-filters";
import { useLoanContactDrawer } from "../model/use-loan-contact-drawer";
import { useLoansFilterChips } from "../model/use-loans-filter-chips";
import { useLoansQuery } from "../model/use-loans-query";
import { LoanContactDrawer } from "./contact/loan-contact-drawer";
import { EditLoanDialog } from "./edit-loan-dialog";
import { LoanRow } from "./loan-row";
import { LoansOverviewPanel } from "./loans-overview-panel";
import { LoansQuickFilters } from "./loans-quick-filters";
import { LoansSidebar } from "./loans-sidebar";
import { LoansListSkeleton } from "./loans-skeleton";
import { LoansSummaryCards, useLoansSummaryCards } from "./loans-summary-cards";
import { LoansToolbar } from "./loans-toolbar";
import { ReturnLoanDialog } from "./return-loan-dialog";

type LoansContentProps = {
  direction: LoanDirection;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  isError: boolean;
  isPending: boolean;
  items: LoanListItemView[];
  onAddBook: () => void;
  onClearFilters: () => void;
  onEdit: (loan: LoanListItemView) => void;
  onOpenContact: (loan: LoanListItemView) => void;
  onOpenLibrary: () => void;
  onOpenOtherPage: () => void;
  onRetry: () => void;
  onReturn: (loan: LoanListItemView) => void;
  otherTypeCount: number;
  today: string;
};

export function LoansView({ type }: { type: LoanType }) {
  const page = LOAN_PAGES[type];
  const t = useTranslations("loans");
  const router = useRouter();
  const query = useLoansQuery(type);
  const summary = useLoansSummary();
  const list = useLoansList(query.listParams);
  const selectedContact = useLoanContact(query.contactId === "" ? null : query.contactId);
  const contactName = selectedContact.data?.name ?? null;
  const filterChips = useLoansFilterChips({
    contactName,
    direction: page.direction,
    onApplyAdvanced: query.applyAdvanced,
    onClearSearch: query.clearSearch,
    search: query.state.q,
    state: query.advanced,
  });

  const [editTarget, setEditTarget] = useState<LoanListItemView | null>(null);
  const [returnTarget, setReturnTarget] = useState<LoanListItemView | null>(null);
  const contactDrawer = useLoanContactDrawer();

  const loadedPages = list.data?.pages ?? [];
  const items = loadedPages.flatMap((loadedPage) => loadedPage.items);
  const totalCount = loadedPages[0]?.totalCount ?? items.length;
  const today = todayIso();

  const summaryCards = useLoansSummaryCards(summary.data, type);
  const directionSummary = summary.data?.[page.direction];

  const activeOfThisType = summary.data?.[page.direction].totalCount ?? 0;
  const activeOfOtherType = summary.data?.[LOAN_PAGES[page.otherType].direction].totalCount ?? 0;
  const hasAnyLoans = activeOfThisType + activeOfOtherType > 0 || items.length > 0;
  const showChrome = !list.isError && (list.isPending || hasAnyLoans);
  const showSummaryCards = summary.isPending || summary.isError || activeOfThisType > 0;

  const attention: Nullable<LoansAttention> = summary.isError
    ? null
    : {
        activeKey: activeAttentionKey(query.filter, query.reminder),
        onSelect: (key) => {
          if (key === "without_reminder") {
            query.setReminder("off");
            return;
          }
          query.setFilter(key);
        },
        stats: directionSummary ?? null,
      };

  const people: LoansPeople = {
    activeContactId: query.contactId,
    items: summary.isError ? [] : (directionSummary?.topPeople ?? []),
    onPersonOpen: contactDrawer.openContact,
    onPersonSelect: (contactId) =>
      query.setContactId(contactId === query.contactId ? "" : contactId),
  };

  const loansContent = (
    <LoansContent
      direction={page.direction}
      hasActiveFilters={query.hasActiveFilters}
      hasActiveSearch={query.hasActiveSearch}
      isError={list.isError}
      isPending={list.isPending}
      items={items}
      onAddBook={() => router.push("/books/new")}
      onClearFilters={query.clearFilters}
      onEdit={setEditTarget}
      onOpenContact={(loan) => contactDrawer.openContact(loan.loanContactId)}
      onOpenLibrary={() => router.push("/books")}
      onOpenOtherPage={() => router.push(LOAN_PAGES[page.otherType].href)}
      onRetry={() => void list.refetch()}
      onReturn={setReturnTarget}
      otherTypeCount={activeOfOtherType}
      today={today}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t(`pages.${page.direction}.title`)}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {t(`pages.${page.direction}.subtitle`)}
          </p>
        </div>

        {showSummaryCards ? (
          <LoansSummaryCards
            cards={summaryCards}
            isError={summary.isError}
            isLoading={summary.isPending}
            mobileAction={
              <LoansOverviewPanel
                attention={attention}
                direction={page.direction}
                isLoading={summary.isPending}
                longHeldLoans={directionSummary?.longHeldLoans ?? []}
                people={people}
                summaryCards={summaryCards}
                upcomingReturns={directionSummary?.upcomingReturns ?? []}
              />
            }
            onRetry={() => void summary.refetch()}
          />
        ) : null}
      </header>

      {showChrome ? (
        <div className="flex flex-col gap-4">
          <LoansToolbar
            advanced={query.advanced}
            advancedCount={query.advancedCount}
            contactName={contactName}
            direction={page.direction}
            onApplyAdvanced={query.applyAdvanced}
            onSearchChange={query.setSearch}
            onSearchClear={query.clearSearch}
            onSortChange={query.setSort}
            search={query.state.q}
            sort={query.sort}
          />

          <LoansQuickFilters
            counts={
              directionSummary === undefined ? undefined : loansQuickFilterCounts(directionSummary)
            }
            onSelect={query.setFilter}
            value={query.filter}
          />

          <LibraryActiveFilters chips={filterChips} onClearAll={query.clearFilters} />

          <p className="text-sm text-muted-foreground" role="status">
            {list.isPending || directionSummary === undefined
              ? ""
              : t("shownCount", { shown: totalCount, total: directionSummary.totalCount })}
          </p>

          <div className="mt-2 flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {loansContent}

              {items.length > 0 && list.hasNextPage ? (
                <LoansLoadMore
                  isFetchingNextPage={list.isFetchingNextPage}
                  isLoadMoreError={list.isFetchNextPageError}
                  onLoadMore={() => void list.fetchNextPage()}
                />
              ) : null}
            </div>

            <LoansSidebar
              attention={attention}
              direction={page.direction}
              isLoading={summary.isPending}
              longHeldLoans={directionSummary?.longHeldLoans ?? []}
              people={people}
              upcomingReturns={directionSummary?.upcomingReturns ?? []}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-6">{loansContent}</div>
        </div>
      )}

      {editTarget ? (
        <EditLoanDialog
          loan={editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          open
        />
      ) : null}

      <LoanContactDrawer {...contactDrawer.drawerProps} />

      {returnTarget ? (
        <ReturnLoanDialog
          loan={returnTarget}
          onOpenChange={(open) => {
            if (!open) setReturnTarget(null);
          }}
          open
        />
      ) : null}
    </div>
  );
}

function activeAttentionKey(
  filter: LoansControllerListFilter,
  reminder: Nullable<LoansControllerListReminder>,
): Nullable<LoanAttentionKey> {
  if (reminder === "off") return "without_reminder";
  if (filter === "overdue" || filter === "no_return_date") return filter;
  return null;
}

function LoansContent({
  direction,
  hasActiveFilters,
  hasActiveSearch,
  isError,
  isPending,
  items,
  onAddBook,
  onClearFilters,
  onEdit,
  onOpenContact,
  onOpenLibrary,
  onOpenOtherPage,
  onRetry,
  onReturn,
  otherTypeCount,
  today,
}: LoansContentProps) {
  const t = useTranslations("loans.states");
  const tLoans = useTranslations("loans");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return (
      <>
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <LoansListSkeleton />
      </>
    );
  }

  if (items.length === 0) {
    if (hasActiveFilters || hasActiveSearch) {
      const noResults: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearFilters} state={noResults} />;
    }

    const typeEmpty: EmptyStateEntry = {
      desc: t(`typeEmpty.${direction}.description`),
      illu: "empty-borrowed",
      title: t(`typeEmpty.${direction}.title`),
    };

    if (otherTypeCount === 0) {
      return (
        <EmptyState
          onPrimary={onAddBook}
          onSecondary={onOpenLibrary}
          state={{
            ...typeEmpty,
            primary: { icon: "plus", label: t("empty.cta") },
            secondary: { icon: "book", label: t("empty.secondary") },
          }}
        />
      );
    }

    return (
      <EmptyState
        onPrimary={onOpenOtherPage}
        state={{
          ...typeEmpty,
          primary: { icon: "swap", label: t(`typeEmpty.${direction}.openOther`) },
        }}
      />
    );
  }

  return (
    <>
      <h2 className="sr-only">{tLoans(`pages.${direction}.listHeading`)}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((loan) => (
          <li key={loan.id}>
            <LoanRow
              loan={loan}
              onEdit={() => onEdit(loan)}
              onOpenContact={() => onOpenContact(loan)}
              onReturn={() => onReturn(loan)}
              today={today}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function LoansLoadMore({
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: {
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("loans");

  return (
    <div className="flex flex-col items-center gap-2">
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
    </div>
  );
}

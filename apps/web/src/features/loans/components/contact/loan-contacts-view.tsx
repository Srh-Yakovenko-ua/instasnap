"use client";

import type { LoanContactCounts, LoanContactView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { LoanContactResolution } from "./create-loan-contact-form";

import { useLoanContactsList } from "../../api/use-loan-contacts-list";
import { useLoanContactDrawer } from "../../model/use-loan-contact-drawer";
import { useLoanContactsQuery } from "../../model/use-loan-contacts-query";
import { CreateLoanContactDialog } from "./create-loan-contact-dialog";
import { LoanContactDrawer } from "./loan-contact-drawer";
import { LoanContactListRow } from "./loan-contact-list-row";
import { LoanContactsToolbar } from "./loan-contacts-toolbar";

export function LoanContactsView() {
  const t = useTranslations("loans.contactsPage");
  const query = useLoanContactsQuery();
  const list = useLoanContactsList(query.listParams);
  const contactDrawer = useLoanContactDrawer();
  const [isCreating, setIsCreating] = useState(false);

  const loadedPages = list.data?.pages ?? [];
  const items = loadedPages.flatMap((page) => page.items);
  const counts: Nullable<LoanContactCounts> = loadedPages[0]?.counts ?? null;

  function handleResolved({ contact, kind }: LoanContactResolution) {
    setIsCreating(false);
    if (kind === "existing") {
      contactDrawer.openContact(contact.id);
      return;
    }
    toast.success(kind === "created" ? t("create.success") : t("create.restored"));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{t("subtitle")}</p>
        </div>

        <Button className="shrink-0 max-sm:w-full" onClick={() => setIsCreating(true)}>
          <UiIcon name="plus" size={18} />
          {t("create.cta")}
        </Button>
      </header>

      <LoanContactsToolbar counts={counts ?? undefined} query={query} />

      <LoanContactsContent
        hasActiveQuery={query.hasActiveQuery}
        isError={list.isError}
        isPending={list.isPending}
        items={items}
        onClearQuery={query.clearQuery}
        onCreate={() => setIsCreating(true)}
        onOpenContact={contactDrawer.openContact}
        onRetry={() => void list.refetch()}
      />

      {items.length > 0 && list.hasNextPage ? (
        <div className="flex flex-col items-center gap-2">
          {list.isFetchNextPageError ? (
            <p className="text-sm text-error" role="alert">
              {t("loadMoreError")}
            </p>
          ) : null}
          <Button
            disabled={list.isFetchingNextPage}
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}

      <CreateLoanContactDialog
        conflictAction="open"
        onOpenChange={setIsCreating}
        onResolved={handleResolved}
        open={isCreating}
      />

      <LoanContactDrawer {...contactDrawer.drawerProps} />
    </div>
  );
}

function LoanContactsContent({
  hasActiveQuery,
  isError,
  isPending,
  items,
  onClearQuery,
  onCreate,
  onOpenContact,
  onRetry,
}: {
  hasActiveQuery: boolean;
  isError: boolean;
  isPending: boolean;
  items: LoanContactView[];
  onClearQuery: () => void;
  onCreate: () => void;
  onOpenContact: (contactId: string) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("loans.contactsPage.states");

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
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-[4.25rem] w-full rounded-xl" key={index} />
          ))}
        </div>
      </>
    );
  }

  if (items.length === 0) {
    if (hasActiveQuery) {
      const noResults: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearQuery} state={noResults} />;
    }

    return (
      <EmptyState
        onPrimary={onCreate}
        state={{
          desc: t("empty.description"),
          illu: "empty-borrowed",
          primary: { icon: "plus", label: t("empty.cta") },
          title: t("empty.title"),
        }}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((contact) => (
        <li key={contact.id}>
          <LoanContactListRow contact={contact} onOpen={() => onOpenContact(contact.id)} />
        </li>
      ))}
    </ul>
  );
}

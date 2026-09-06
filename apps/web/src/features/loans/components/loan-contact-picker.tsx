"use client";

import type { LoanContactListItemView, LoanContactView, LoanDirection } from "@app/shared";

import { normalizeName } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

import type { LoanContactSelection } from "../model/loan-contact-selection";

import { useLoanContacts } from "../api/use-loan-contacts";

type LoanContactOptionProps = {
  contact: LoanContactListItemView;
  direction: LoanDirection;
  onSelect: () => void;
};

type LoanContactPickerProps = {
  describedBy?: string;
  direction: LoanDirection;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (selection: LoanContactSelection | null) => void;
  onRequestCreate?: (name: string) => void;
  opensOnFocus?: boolean;
  placeholder: string;
  value: LoanContactSelection | null;
};

const SEARCH_DEBOUNCE_MS = 250;

export function LoanContactPicker({
  describedBy,
  direction,
  id,
  invalid,
  label,
  onChange,
  onRequestCreate,
  opensOnFocus = true,
  placeholder,
  value,
}: LoanContactPickerProps) {
  const t = useTranslations("loans.contactPicker");
  const anchorRef = useRef<HTMLDivElement>(null);
  const selectedName = value?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [trackedName, setTrackedName] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    items: contacts,
  } = useLoanContacts(debouncedQuery);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: contacts.length,
    onLoadMore: fetchNextPage,
  });

  if (selectedName !== trackedName) {
    setTrackedName(selectedName);
    if (selectedName.length > 0 || query === trackedName) setQuery(selectedName);
  }

  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeName(trimmedQuery);
  const isLoadingResults = isFetching && !isFetchingNextPage;
  const searchSettled = !isLoadingResults && debouncedQuery.trim() === trimmedQuery;
  const matchesExistingContact = contacts.some(
    (contact) => normalizeName(contact.name) === normalizedQuery,
  );
  const showCreateOption =
    onRequestCreate !== undefined &&
    trimmedQuery.length > 0 &&
    searchSettled &&
    !matchesExistingContact;
  const showClear = value !== null || query.length > 0;

  function pickContact(contact: LoanContactView) {
    onChange({ contactId: contact.id, kind: "picked", name: contact.name });
    setQuery(contact.name);
    setTrackedName(contact.name);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setTrackedName("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <CommandPrimitive label={label} shouldFilter={false}>
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverAnchor asChild>
            <div className="relative flex items-center" ref={anchorRef}>
              <UiIcon
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-3",
                  invalid ? "text-destructive" : "text-muted-foreground",
                )}
                name="user"
                size={18}
              />
              <CommandPrimitive.Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                aria-required="true"
                autoComplete="off"
                className={cn(
                  "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                  showClear ? "pr-10" : "pr-3",
                  invalid &&
                    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                )}
                id={id}
                onClick={() => setOpen(true)}
                onFocus={() => {
                  if (opensOnFocus) setOpen(true);
                }}
                onValueChange={(next) => {
                  setQuery(next);
                  setOpen(true);
                  if (value !== null) onChange(null);
                }}
                placeholder={placeholder}
                value={query}
              />
              {showClear ? (
                <button
                  aria-label={t("clear")}
                  className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={handleClear}
                  type="button"
                >
                  <UiIcon name="x" size={16} />
                </button>
              ) : null}
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) p-1"
            onInteractOutside={(event) => {
              const target = event.detail.originalEvent.target;
              if (target instanceof Node && anchorRef.current?.contains(target)) {
                event.preventDefault();
              }
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            sideOffset={6}
          >
            <CommandList onScroll={onScroll} ref={scrollRef}>
              {isLoadingResults && contacts.length === 0 ? (
                <CommandEmpty>{t("searching")}</CommandEmpty>
              ) : null}
              {!isLoadingResults && contacts.length === 0 && !showCreateOption ? (
                <CommandEmpty>{t("empty")}</CommandEmpty>
              ) : null}
              {contacts.length > 0 ? (
                <CommandGroup heading={t("contactsHeading")}>
                  {contacts.map((contact) => (
                    <LoanContactOption
                      contact={contact}
                      direction={direction}
                      key={contact.id}
                      onSelect={() => pickContact(contact)}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {isFetchingNextPage ? (
                <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                  {t("searching")}
                </div>
              ) : null}
              {showCreateOption ? (
                <CommandGroup heading={t("createHeading")}>
                  <CommandItem
                    className="cursor-pointer"
                    onSelect={() => {
                      setOpen(false);
                      onRequestCreate?.(trimmedQuery);
                    }}
                    value={`create-${trimmedQuery}`}
                  >
                    <UiIcon className="text-primary" name="plus" size={16} />
                    <span className="min-w-0 truncate">
                      {t("createAction", { name: trimmedQuery })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
    </div>
  );
}

function LoanContactOption({ contact, direction, onSelect }: LoanContactOptionProps) {
  const t = useTranslations("loans.contactPicker");
  const activeCount = direction === "lent" ? contact.activeLentCount : contact.activeBorrowedCount;

  return (
    <CommandItem className="cursor-pointer" onSelect={onSelect} value={contact.id}>
      <UiIcon className="shrink-0 text-muted-foreground" name="user" size={16} />
      <span className="min-w-0 truncate">{contact.name}</span>
      {activeCount > 0 ? (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {t(direction === "lent" ? "activeLentCount" : "activeBorrowedCount", {
            count: activeCount,
          })}
        </span>
      ) : null}
    </CommandItem>
  );
}

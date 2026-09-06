"use client";

import type { LoanHistoryPersonOption } from "@app/shared";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { LoanHistoryControllerPeopleParams } from "@/shared/api/generated/model";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { useLoanContact } from "../../api/use-loan-contact";
import { useLoanHistoryPeople } from "../../api/use-loan-history-people";

type LoanHistoryPersonPickerProps = {
  contactId: string;
  id: string;
  onChange: (contactId: string) => void;
  scope: LoanHistoryControllerPeopleParams;
};

const SEARCH_DEBOUNCE_MS = 250;

export function LoanHistoryPersonPicker({
  contactId,
  id,
  onChange,
  scope,
}: LoanHistoryPersonPickerProps) {
  const t = useTranslations("loans.history.person");
  const anchorRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [trackedName, setTrackedName] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const search = debouncedQuery.trim();
  const people = useLoanHistoryPeople({ ...scope, ...(search === "" ? {} : { search }) });
  const contact = useLoanContact(contactId === "" ? null : contactId);
  const items = people.data?.items ?? [];
  const selectedName =
    contact.data?.name ?? items.find((person) => person.contactId === contactId)?.personName ?? "";

  if (selectedName !== trackedName) {
    setTrackedName(selectedName);
    if (selectedName.length > 0 || query === trackedName) setQuery(selectedName);
  }

  const isLoadingResults = people.isFetching;
  const showClear = contactId !== "" || query.length > 0;

  function pickPerson(person: LoanHistoryPersonOption) {
    onChange(person.contactId);
    setQuery(person.personName);
    setTrackedName(person.personName);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setTrackedName("");
    setOpen(false);
  }

  return (
    <CommandPrimitive label={t("label")} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center" ref={anchorRef}>
            <UiIcon
              aria-hidden
              className="pointer-events-none absolute left-3 text-muted-foreground"
              name="user"
              size={18}
            />
            <CommandPrimitive.Input
              aria-label={t("label")}
              autoComplete="off"
              className={cn(
                "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                showClear ? "pr-10" : "pr-3",
              )}
              id={id}
              onClick={() => setOpen(true)}
              onValueChange={(next) => {
                setQuery(next);
                setOpen(true);
                if (contactId !== "") onChange("");
              }}
              placeholder={t("placeholder")}
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
          <CommandList>
            {isLoadingResults && items.length === 0 ? (
              <CommandEmpty>{t("searching")}</CommandEmpty>
            ) : null}
            {!isLoadingResults && items.length === 0 ? (
              <CommandEmpty>{t("empty")}</CommandEmpty>
            ) : null}
            {items.length > 0 ? (
              <CommandGroup heading={t("heading")}>
                {items.map((person) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={person.contactId}
                    onSelect={() => pickPerson(person)}
                    value={person.contactId}
                  >
                    <UiIcon className="shrink-0 text-muted-foreground" name="user" size={16} />
                    <span className="min-w-0 truncate">{person.personName}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t("count", { count: person.totalCount })}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}

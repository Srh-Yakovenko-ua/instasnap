"use client";

import type { LoanDirection, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
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
import { LoansControllerListReminder } from "@/shared/api/generated/model";

import type { LoanContactSelection } from "../model/loan-contact-selection";
import type { LoansAdvancedState } from "../model/loans-query";

import { hasInvalidLoanRange, loanRangeFlags, LOANS_ADVANCED_EMPTY } from "../model/loans-query";
import { LoanContactPicker } from "./loan-contact-picker";

type LoansAdvancedFiltersProps = {
  activeCount: number;
  contactName: Nullable<string>;
  direction: LoanDirection;
  onApply: (draft: LoansAdvancedState) => void;
  state: LoansAdvancedState;
};

const NOTE_OPTIONS = ["any", "with", "without"] as const;

const REMINDER_OPTIONS = [
  "any",
  LoansControllerListReminder.on,
  LoansControllerListReminder.off,
] as const;

export function LoansAdvancedFilters({
  activeCount,
  contactName,
  direction,
  onApply,
  state,
}: LoansAdvancedFiltersProps) {
  const t = useTranslations("loans.advancedFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LoansAdvancedState>(state);
  const [draftContactName, setDraftContactName] = useState(contactName ?? "");

  const rangeFlags = loanRangeFlags(draft);
  const noteValue = draft.hasNote === null ? "any" : draft.hasNote ? "with" : "without";
  const contactSelection: LoanContactSelection | null =
    draft.contactId === ""
      ? null
      : { contactId: draft.contactId, kind: "picked", name: draftContactName };

  function patch(next: Partial<LoansAdvancedState>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) {
          setDraft(state);
          setDraftContactName(contactName ?? "");
        }
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
          <FilterSection title={t(`sections.person.${direction}`)}>
            <LoanContactPicker
              direction={direction}
              id="loans-filter-contact"
              invalid={false}
              label={t(`sections.person.${direction}`)}
              onChange={(selection) => {
                patch({ contactId: selection?.kind === "picked" ? selection.contactId : "" });
                setDraftContactName(selection?.kind === "picked" ? selection.name : "");
              }}
              opensOnFocus={false}
              placeholder={t("person.placeholder")}
              value={contactSelection}
            />
          </FilterSection>

          <FilterSection title={t(`sections.loanDate.${direction}`)}>
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="loans-filter-loan-from"
                onChange={(value) => patch({ loanFrom: value ?? null })}
                placeholder={t("range.from")}
                value={draft.loanFrom}
              />
              <BookDateField
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="loans-filter-loan-to"
                onChange={(value) => patch({ loanTo: value ?? null })}
                placeholder={t("range.to")}
                value={draft.loanTo}
              />
            </div>
            {rangeFlags.loan ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.dueDate")}>
            <div className="grid gap-2.5">
              <BookDateField
                allowFuture
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="loans-filter-due-from"
                onChange={(value) => patch({ dueFrom: value ?? null })}
                placeholder={t("range.from")}
                value={draft.dueFrom}
              />
              <BookDateField
                allowFuture
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="loans-filter-due-to"
                onChange={(value) => patch({ dueTo: value ?? null })}
                placeholder={t("range.to")}
                value={draft.dueTo}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("dueDate.hint")}</p>
            {rangeFlags.due ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.reminder")}>
            <ChipGroup
              label={t("sections.reminder")}
              mode="single"
              onValueChange={(next) => {
                const match = REMINDER_OPTIONS.find((option) => option === next);
                if (match !== undefined) patch({ reminder: match === "any" ? null : match });
              }}
              options={REMINDER_OPTIONS.map((value) => ({
                label: t(`reminderOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.reminder ?? "any"}
            />
          </FilterSection>

          <FilterSection title={t("sections.note")}>
            <ChipGroup
              label={t("sections.note")}
              mode="single"
              onValueChange={(next) => {
                const match = NOTE_OPTIONS.find((option) => option === next);
                if (match !== undefined) patch({ hasNote: toHasNote(match) });
              }}
              options={NOTE_OPTIONS.map((value) => ({ label: t(`noteOptions.${value}`), value }))}
              size="sm"
              value={noteValue}
            />
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => {
              setDraft(LOANS_ADVANCED_EMPTY);
              setDraftContactName("");
            }}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            disabled={hasInvalidLoanRange(draft)}
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

function toHasNote(value: (typeof NOTE_OPTIONS)[number]): Nullable<boolean> {
  if (value === "any") return null;
  return value === "with";
}

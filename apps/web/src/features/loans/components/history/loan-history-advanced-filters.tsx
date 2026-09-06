"use client";

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

import type {
  LoanHistoryAdvancedState,
  LoanHistoryPeriodPreset,
} from "../../model/loan-history-query";

import {
  hasInvalidLoanHistoryRange,
  LOAN_HISTORY_ADVANCED_EMPTY,
  LOAN_HISTORY_PERIOD_PRESETS,
  LOAN_HISTORY_TYPE_VALUES,
  loanHistoryPeriodPresets,
  loanHistoryRangeFlags,
  resolveLoanHistoryPeriodPreset,
  toLoanHistoryPeopleParams,
} from "../../model/loan-history-query";
import { LoanHistoryPersonPicker } from "./loan-history-person-picker";

type DirectionOption = "all" | (typeof LOAN_HISTORY_TYPE_VALUES)[number];

type LoanHistoryAdvancedFiltersProps = {
  activeCount: number;
  onApply: (draft: LoanHistoryAdvancedState) => void;
  state: LoanHistoryAdvancedState;
};

const DIRECTION_OPTIONS = [
  "all",
  ...LOAN_HISTORY_TYPE_VALUES,
] as const satisfies readonly DirectionOption[];

export function LoanHistoryAdvancedFilters({
  activeCount,
  onApply,
  state,
}: LoanHistoryAdvancedFiltersProps) {
  const t = useTranslations("loans.history.advancedFilters");
  const tDirection = useTranslations("loans.history.direction");
  const tPeriod = useTranslations("loans.history.period");
  const presets = loanHistoryPeriodPresets(new Date());

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LoanHistoryAdvancedState>(state);
  const [returnedPreset, setReturnedPreset] = useState<LoanHistoryPeriodPreset>(() =>
    resolveLoanHistoryPeriodPreset({ from: state.from, to: state.to }, presets),
  );

  const rangeFlags = loanHistoryRangeFlags(draft);

  function patch(next: Partial<LoanHistoryAdvancedState>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function selectReturnedPreset(next: string) {
    const preset = LOAN_HISTORY_PERIOD_PRESETS.find((candidate) => candidate === next);
    if (preset === undefined) return;

    setReturnedPreset(preset);
    if (preset !== "custom") patch(presets[preset]);
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) {
          setDraft(state);
          setReturnedPreset(
            resolveLoanHistoryPeriodPreset({ from: state.from, to: state.to }, presets),
          );
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
          <FilterSection title={t("sections.direction")}>
            <ChipGroup
              label={t("sections.direction")}
              mode="single"
              onValueChange={(next) => {
                const match = DIRECTION_OPTIONS.find((option) => option === next);
                if (match !== undefined) patch({ type: match === "all" ? null : match });
              }}
              options={DIRECTION_OPTIONS.map((value) => ({ label: tDirection(value), value }))}
              size="sm"
              value={draft.type ?? "all"}
            />
          </FilterSection>

          <FilterSection title={t("sections.person")}>
            <LoanHistoryPersonPicker
              contactId={draft.contactId}
              id="loan-history-filter-contact"
              onChange={(contactId) => patch({ contactId })}
              scope={toLoanHistoryPeopleParams(draft)}
            />
          </FilterSection>

          <FilterSection title={t("sections.returned")}>
            <ChipGroup
              label={t("sections.returned")}
              mode="single"
              onValueChange={selectReturnedPreset}
              options={LOAN_HISTORY_PERIOD_PRESETS.map((value) => ({
                label: tPeriod(value),
                value,
              }))}
              size="sm"
              value={returnedPreset}
            />
            {returnedPreset === "custom" ? (
              <div className="grid gap-2.5">
                <BookDateField
                  ariaLabel={tPeriod("from")}
                  className="h-9 text-sm"
                  id="loan-history-filter-returned-from"
                  invalid={rangeFlags.returned}
                  onChange={(value) => patch({ from: value ?? "" })}
                  placeholder={tPeriod("from")}
                  value={draft.from}
                />
                <BookDateField
                  ariaLabel={tPeriod("to")}
                  className="h-9 text-sm"
                  id="loan-history-filter-returned-to"
                  invalid={rangeFlags.returned}
                  onChange={(value) => patch({ to: value ?? "" })}
                  placeholder={tPeriod("to")}
                  value={draft.to}
                />
              </div>
            ) : null}
            {rangeFlags.returned ? (
              <p className="text-xs text-destructive" role="alert">
                {tPeriod("invalidRange")}
              </p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.loanDate")}>
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="loan-history-filter-loan-from"
                invalid={rangeFlags.loanDate}
                onChange={(value) => patch({ loanFrom: value ?? null })}
                placeholder={t("range.from")}
                value={draft.loanFrom}
              />
              <BookDateField
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="loan-history-filter-loan-to"
                invalid={rangeFlags.loanDate}
                onChange={(value) => patch({ loanTo: value ?? null })}
                placeholder={t("range.to")}
                value={draft.loanTo}
              />
            </div>
            {rangeFlags.loanDate ? (
              <p className="text-xs text-destructive" role="alert">
                {t("range.invalid")}
              </p>
            ) : null}
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => {
              setDraft(LOAN_HISTORY_ADVANCED_EMPTY);
              setReturnedPreset("all");
            }}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            disabled={hasInvalidLoanHistoryRange(draft)}
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

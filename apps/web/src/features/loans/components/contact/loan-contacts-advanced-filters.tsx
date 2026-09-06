"use client";

import type { LoanContactCounts } from "@app/shared";

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

import type { UseLoanContactsQueryResult } from "../../model/use-loan-contacts-query";

import {
  LOAN_CONTACTS_STATUS_DEFAULT,
  LOAN_CONTACTS_STATUS_VALUES,
} from "../../model/loan-contacts-query";

type LoanContactsAdvancedFiltersProps = {
  activeCount: number;
  counts?: LoanContactCounts;
  setState: UseLoanContactsQueryResult["setState"];
  status: UseLoanContactsQueryResult["status"];
};

export function LoanContactsAdvancedFilters({
  activeCount,
  counts,
  setState,
  status,
}: LoanContactsAdvancedFiltersProps) {
  const t = useTranslations("loans.contactsPage.filters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(status);

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(status);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button className="h-10 shrink-0 max-sm:w-full" type="button" variant="secondary">
          <UiIcon name="funnel" size={16} />
          {t("trigger")}
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
          <FilterSection title={t("sections.status")}>
            <ChipGroup
              label={t("sections.status")}
              mode="single"
              onValueChange={(next) => {
                const match = LOAN_CONTACTS_STATUS_VALUES.find((value) => value === next);
                if (match !== undefined) setDraft(match);
              }}
              options={LOAN_CONTACTS_STATUS_VALUES.map((value) => ({
                count: counts?.[value],
                label: t(`statusOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft}
            />
            <p className="text-xs text-muted-foreground">{t("statusHint")}</p>
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={draft === LOAN_CONTACTS_STATUS_DEFAULT}
            onClick={() => setDraft(LOAN_CONTACTS_STATUS_DEFAULT)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              void setState({
                status: draft === LOAN_CONTACTS_STATUS_DEFAULT ? null : draft,
              });
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

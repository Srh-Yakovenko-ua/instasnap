"use client";

import type { ActiveMoneyAgeBucket, DeliveryFacetEntry, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { Multiselect } from "@/components/ui/multiselect";
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
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { DeliveryAdvancedState } from "../model/in-transit-params";

import { useInTransitFacets } from "../api/use-in-transit-facets";
import {
  DELIVERY_ADVANCED_EMPTY,
  DELIVERY_AGE_BUCKETS,
  DELIVERY_CURRENCY_VALUES,
  DELIVERY_STRUCTURE_VALUES,
  deliveryRangeFlags,
  hasInvalidDeliveryRange,
} from "../model/in-transit-params";

type DeliveryAdvancedFiltersProps = {
  activeCount: number;
  onApply: (draft: DeliveryAdvancedState) => void;
  state: DeliveryAdvancedState;
};

export function DeliveryAdvancedFilters({
  activeCount,
  onApply,
  state,
}: DeliveryAdvancedFiltersProps) {
  const t = useTranslations("delivery.advancedFilters");
  const tAge = useTranslations("delivery.statistics.activeAge.buckets");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeliveryAdvancedState>(state);
  const facets = useInTransitFacets(open);

  const rangeFlags = deliveryRangeFlags(draft);
  const priceIsDisabled = draft.currency.length !== 1;

  function patch(next: Partial<DeliveryAdvancedState>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(state);
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
          <FilterSection title={t("sections.store")}>
            <Multiselect
              emptyText={t("store.empty")}
              onValueChange={(next) => patch({ store: next })}
              options={toOptions(facets.data?.stores, draft.store)}
              placeholder={t("store.placeholder")}
              searchPlaceholder={t("store.search")}
              value={draft.store}
            />
          </FilterSection>

          <FilterSection title={t("sections.orderDate")}>
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="delivery-filter-ordered-from"
                onChange={(value) => patch({ orderedFrom: value ?? null })}
                placeholder={t("range.from")}
                value={draft.orderedFrom}
              />
              <BookDateField
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="delivery-filter-ordered-to"
                onChange={(value) => patch({ orderedTo: value ?? null })}
                placeholder={t("range.to")}
                value={draft.orderedTo}
              />
            </div>
            {rangeFlags.ordered ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.orderAge")}>
            <ChipGroup
              mode="single"
              onValueChange={(value) =>
                patch({ ageBucket: value === "" ? null : (value as ActiveMoneyAgeBucket) })
              }
              options={DELIVERY_AGE_BUCKETS.map((bucket) => ({
                label: tAge(bucket),
                value: bucket,
              }))}
              value={draft.ageBucket ?? ""}
            />
            <p className="text-xs text-muted-foreground">{t("orderAgeHint")}</p>
          </FilterSection>

          <FilterSection title={t("sections.booksCount")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("booksCount.min")}
                inputMode="numeric"
                min={0}
                onChange={(event) => patch({ booksMin: parseIntegerValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.booksMin ?? ""}
              />
              <Input
                aria-label={t("booksCount.max")}
                inputMode="numeric"
                min={0}
                onChange={(event) => patch({ booksMax: parseIntegerValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.booksMax ?? ""}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("booksCount.hint")}</p>
            {rangeFlags.books ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.service")}>
            <Multiselect
              emptyText={t("service.empty")}
              onValueChange={(next) => patch({ service: next })}
              options={toOptions(facets.data?.services, draft.service)}
              placeholder={t("service.placeholder")}
              searchPlaceholder={t("service.search")}
              value={draft.service}
            />
          </FilterSection>

          <FilterSection title={t("sections.expectedDate")}>
            <div className="grid gap-2.5">
              <BookDateField
                allowFuture
                ariaLabel={t("range.from")}
                className="h-9 text-sm"
                id="delivery-filter-expected-from"
                onChange={(value) => patch({ expectedFrom: value ?? null })}
                placeholder={t("range.from")}
                value={draft.expectedFrom}
              />
              <BookDateField
                allowFuture
                ariaLabel={t("range.to")}
                className="h-9 text-sm"
                id="delivery-filter-expected-to"
                onChange={(value) => patch({ expectedTo: value ?? null })}
                placeholder={t("range.to")}
                value={draft.expectedTo}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("expectedDate.hint")}</p>
            {rangeFlags.expected ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.structure")}>
            <ChipGroup
              label={t("sections.structure")}
              mode="multi"
              onValueChange={(next) =>
                patch({ structure: DELIVERY_STRUCTURE_VALUES.filter((v) => next.includes(v)) })
              }
              options={DELIVERY_STRUCTURE_VALUES.map((value) => ({
                label: t(`structure.${value}`),
                value,
              }))}
              size="sm"
              value={draft.structure}
            />
          </FilterSection>

          <FilterSection title={t("sections.currency")}>
            <ChipGroup
              label={t("sections.currency")}
              mode="multi"
              onValueChange={(next) =>
                patch({ currency: DELIVERY_CURRENCY_VALUES.filter((v) => next.includes(v)) })
              }
              options={DELIVERY_CURRENCY_VALUES.map((value) => ({ label: value, value }))}
              size="sm"
              value={draft.currency}
            />
          </FilterSection>

          <FilterSection title={t("sections.orderTotal")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("orderTotal.min")}
                disabled={priceIsDisabled}
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMin: parseAmountValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.priceMin ?? ""}
              />
              <Input
                aria-label={t("orderTotal.max")}
                disabled={priceIsDisabled}
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMax: parseAmountValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.priceMax ?? ""}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {priceIsDisabled ? t("orderTotal.pickCurrency") : t("orderTotal.hint")}
            </p>
            {rangeFlags.price ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button onClick={() => setDraft(DELIVERY_ADVANCED_EMPTY)} type="button" variant="ghost">
            {t("clear")}
          </Button>
          <Button
            disabled={hasInvalidDeliveryRange(draft)}
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

function parseAmountValue(raw: string): Nullable<number> {
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntegerValue(raw: string): Nullable<number> {
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toOptions(facet: DeliveryFacetEntry[] | undefined, selected: string[]) {
  const names = [...(facet ?? []).map((entry) => entry.name)];
  for (const name of selected) {
    if (!names.includes(name)) names.push(name);
  }
  return names.map((name) => ({ label: name, value: name }));
}

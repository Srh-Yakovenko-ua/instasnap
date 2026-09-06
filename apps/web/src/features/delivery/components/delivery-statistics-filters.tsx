"use client";

import type { Currency, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { BookOrdersControllerStatisticsOrderState } from "@/shared/api/generated/model";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Multiselect } from "@/components/ui/multiselect";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

import type { DeliveryStatisticsQueryState } from "../model/statistics-params";
import type { StatisticsFilterPatch } from "../model/use-statistics-params";

import {
  DELIVERY_STATISTICS_CURRENCIES,
  DELIVERY_STATISTICS_ORDER_STATES,
} from "../model/statistics-params";

type DeliveryStatisticsFiltersProps = {
  filterCount: number;
  includeCancelled: boolean;
  onApply: (patch: StatisticsFilterPatch) => void;
  onIncludeCancelledChange: (value: boolean) => void;
  onReset: () => void;
  state: DeliveryStatisticsQueryState;
  stores: readonly string[];
};

type FilterDraft = {
  currency: Nullable<Currency>;
  orderState: Nullable<BookOrdersControllerStatisticsOrderState>;
  store: string;
};

export function DeliveryStatisticsFilters({
  filterCount,
  includeCancelled,
  onApply,
  onIncludeCancelledChange,
  onReset,
  state,
  stores,
}: DeliveryStatisticsFiltersProps) {
  const t = useTranslations("delivery.statistics.filters");
  const tOrderState = useTranslations("delivery.statistics.orderStatus");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(state));

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(state));
    setOpen(next);
  }

  function patch(next: Partial<FilterDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetTrigger asChild>
        <Button className="relative" variant="secondary">
          <UiIcon name="funnel" size={16} />
          {t("label")}
          {filterCount > 0 ? (
            <Badge className="ms-1" variant="secondary">
              {filterCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("label")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <FilterSection title={t("currency")}>
            <ChipGroup
              mode="single"
              onValueChange={(value) => patch({ currency: (value as Currency) || null })}
              options={DELIVERY_STATISTICS_CURRENCIES.map((currency) => ({
                label: currency,
                value: currency,
              }))}
              value={draft.currency ?? ""}
            />
          </FilterSection>

          <FilterSection title={t("status")}>
            <ChipGroup
              mode="single"
              onValueChange={(value) =>
                patch({
                  orderState: (value as BookOrdersControllerStatisticsOrderState) || null,
                })
              }
              options={DELIVERY_STATISTICS_ORDER_STATES.map((orderState) => ({
                label: tOrderState(orderState),
                value: orderState,
              }))}
              value={draft.orderState ?? ""}
            />
          </FilterSection>

          <FilterSection title={t("store")}>
            <Multiselect
              emptyText={t("storeEmpty")}
              onValueChange={(value) => patch({ store: value.at(0) ?? "" })}
              options={stores.map((store) => ({ label: store, value: store }))}
              placeholder={t("storePlaceholder")}
              searchPlaceholder={t("storeSearch")}
              value={draft.store === "" ? [] : [draft.store]}
            />
          </FilterSection>

          <FilterSection title={t("cancelled")}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <Switch checked={includeCancelled} onCheckedChange={onIncludeCancelledChange} />
              {t("includeCancelled")}
            </label>
          </FilterSection>
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2">
          <Button
            onClick={() => {
              onReset();
              setOpen(false);
            }}
            size="sm"
            variant="ghost"
          >
            {t("reset")}
          </Button>
          <Button
            onClick={() => {
              onApply(toPatch(draft));
              setOpen(false);
            }}
            size="sm"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function toDraft(state: DeliveryStatisticsQueryState): FilterDraft {
  return { currency: state.currency, orderState: state.orderState, store: state.store };
}

function toPatch(draft: FilterDraft): StatisticsFilterPatch {
  return { currency: draft.currency, orderState: draft.orderState, store: draft.store.trim() };
}

"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import type { DeliveryStatisticsQueryState } from "./statistics-params";
import type { StatisticsFilterPatch } from "./use-statistics-params";

type UseStatisticsFilterChipsOptions = {
  onIncludeCancelledChange: (value: boolean) => void;
  onPatch: (patch: StatisticsFilterPatch) => void;
  state: DeliveryStatisticsQueryState;
};

export function useStatisticsFilterChips({
  onIncludeCancelledChange,
  onPatch,
  state,
}: UseStatisticsFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("delivery.statistics.filters");
  const tOrderState = useTranslations("delivery.statistics.orderStatus");
  const chips: ActiveFilterChip[] = [];

  if (state.currency !== null) {
    chips.push({
      key: "currency",
      label: t("chips.currency", { value: state.currency }),
      onRemove: () => onPatch({ currency: null }),
    });
  }

  if (state.orderState !== null) {
    chips.push({
      key: "orderState",
      label: t("chips.status", { value: tOrderState(state.orderState) }),
      onRemove: () => onPatch({ orderState: null }),
    });
  }

  const store = state.store.trim();
  if (store !== "") {
    chips.push({
      key: "store",
      label: t("chips.store", { value: store }),
      onRemove: () => onPatch({ store: "" }),
    });
  }

  if (state.includeCancelled) {
    chips.push({
      key: "includeCancelled",
      label: t("chips.includeCancelled"),
      onRemove: () => onIncludeCancelledChange(false),
    });
  }

  return chips;
}

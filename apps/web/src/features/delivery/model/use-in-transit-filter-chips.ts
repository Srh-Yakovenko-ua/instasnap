"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";
import type { DeliveryReadControllerInTransitListFilter } from "@/shared/api/generated/model";

import { isStorableOrderId, rangeLabel, storableDay } from "@/features/books/model/filter-chips";
import { formatDate } from "@/lib/format";

import type { DeliveryAdvancedState } from "./in-transit-params";

import {
  DELIVERY_FILTER_DEFAULT,
  deliveryRangeFlags,
  isDeliveryPrimaryFilter,
  resolveDeliveryPriceCurrency,
  toDeliveryAttentionReason,
} from "./in-transit-params";

type UseInTransitFilterChipsOptions = {
  filter: DeliveryReadControllerInTransitListFilter;
  onApplyAdvanced: (draft: DeliveryAdvancedState) => void;
  onFilterChange: (value: DeliveryReadControllerInTransitListFilter) => void;
  state: DeliveryAdvancedState;
};

export function useInTransitFilterChips({
  filter,
  onApplyAdvanced,
  onFilterChange,
  state,
}: UseInTransitFilterChipsOptions): ActiveFilterChip[] {
  const locale = useLocale();
  const t = useTranslations("delivery.activeFilters");
  const tAdvanced = useTranslations("delivery.advancedFilters");
  const tAttention = useTranslations("delivery.attention.chip");
  const tAge = useTranslations("delivery.statistics.activeAge.buckets");
  const tState = useTranslations("delivery.statistics.orderStatus");

  const chips: ActiveFilterChip[] = [];
  const isInverted = deliveryRangeFlags(state);

  const attentionReason = isDeliveryPrimaryFilter(filter)
    ? null
    : toDeliveryAttentionReason(filter);
  if (attentionReason !== null) {
    chips.push({
      key: "attention",
      label: t("attention", { label: tAttention(attentionReason) }),
      onRemove: () => onFilterChange(DELIVERY_FILTER_DEFAULT),
    });
  }

  if (isStorableOrderId(state.orderId)) {
    chips.push({
      key: "orderId",
      label: t("orderId"),
      onRemove: () => onApplyAdvanced({ ...state, orderId: null }),
    });
  }

  if (state.orderState !== null) {
    chips.push({
      key: "orderState",
      label: t("orderState", { value: tState(state.orderState) }),
      onRemove: () => onApplyAdvanced({ ...state, orderState: null }),
    });
  }

  if (state.ageBucket !== null) {
    chips.push({
      key: "ageBucket",
      label: t("ageBucket", { value: tAge(state.ageBucket) }),
      onRemove: () => onApplyAdvanced({ ...state, ageBucket: null }),
    });
  }

  for (const value of state.store) {
    chips.push({
      key: `store:${value}`,
      label: t("store", { value }),
      onRemove: () =>
        onApplyAdvanced({ ...state, store: state.store.filter((item) => item !== value) }),
    });
  }

  for (const value of state.service) {
    chips.push({
      key: `service:${value}`,
      label: t("service", { value }),
      onRemove: () =>
        onApplyAdvanced({ ...state, service: state.service.filter((item) => item !== value) }),
    });
  }

  const orderedLabel = isInverted.ordered
    ? null
    : rangeLabel({
        from: (value) => t("orderedFrom", { value: formatDate(value, locale) }),
        max: storableDay(state.orderedTo),
        min: storableDay(state.orderedFrom),
        range: (min, max) =>
          t("orderedRange", { from: formatDate(min, locale), to: formatDate(max, locale) }),
        to: (value) => t("orderedTo", { value: formatDate(value, locale) }),
      });
  if (orderedLabel !== null) {
    chips.push({
      key: "ordered",
      label: orderedLabel,
      onRemove: () => onApplyAdvanced({ ...state, orderedFrom: null, orderedTo: null }),
    });
  }

  const booksLabel = isInverted.books
    ? null
    : rangeLabel({
        from: (value) => t("booksFrom", { min: value }),
        max: state.booksMax,
        min: state.booksMin,
        range: (min, max) => t("booksRange", { max, min }),
        to: (value) => t("booksTo", { max: value }),
      });
  if (booksLabel !== null) {
    chips.push({
      key: "books",
      label: booksLabel,
      onRemove: () => onApplyAdvanced({ ...state, booksMax: null, booksMin: null }),
    });
  }

  const expectedLabel = isInverted.expected
    ? null
    : rangeLabel({
        from: (value) => t("expectedFrom", { value: formatDate(value, locale) }),
        max: storableDay(state.expectedTo),
        min: storableDay(state.expectedFrom),
        range: (min, max) =>
          t("expectedRange", { from: formatDate(min, locale), to: formatDate(max, locale) }),
        to: (value) => t("expectedTo", { value: formatDate(value, locale) }),
      });
  if (expectedLabel !== null) {
    chips.push({
      key: "expected",
      label: expectedLabel,
      onRemove: () => onApplyAdvanced({ ...state, expectedFrom: null, expectedTo: null }),
    });
  }

  for (const value of state.structure) {
    chips.push({
      key: `structure:${value}`,
      label: tAdvanced(`structure.${value}`),
      onRemove: () =>
        onApplyAdvanced({ ...state, structure: state.structure.filter((item) => item !== value) }),
    });
  }

  for (const value of state.currency) {
    chips.push({
      key: `currency:${value}`,
      label: value,
      onRemove: () =>
        onApplyAdvanced({ ...state, currency: state.currency.filter((item) => item !== value) }),
    });
  }

  const priceCurrency = resolveDeliveryPriceCurrency(state);
  const priceRangeLabel =
    priceCurrency === null
      ? null
      : rangeLabel({
          from: (value) => t("priceFrom", { currency: priceCurrency, min: value }),
          max: state.priceMax,
          min: state.priceMin,
          range: (min, max) => t("priceRange", { currency: priceCurrency, max, min }),
          to: (value) => t("priceTo", { currency: priceCurrency, max: value }),
        });
  if (priceRangeLabel !== null) {
    chips.push({
      key: "total",
      label: priceRangeLabel,
      onRemove: () => onApplyAdvanced({ ...state, priceMax: null, priceMin: null }),
    });
  }

  return chips;
}

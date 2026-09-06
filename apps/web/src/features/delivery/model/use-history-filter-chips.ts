"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { isStorableOrderId, rangeLabel, storableDay } from "@/features/books/model/filter-chips";
import { formatDate } from "@/lib/format";

import type { DeliveryHistoryAdvancedState, DeliveryHistoryTab } from "./history-params";

import {
  historyRangeFlags,
  historyTerminalRange,
  resolveHistoryPriceCurrency,
} from "./history-params";

type UseHistoryFilterChipsOptions = {
  onApplyAdvanced: (draft: DeliveryHistoryAdvancedState) => void;
  state: DeliveryHistoryAdvancedState;
  tab: DeliveryHistoryTab;
};

export function useHistoryFilterChips({
  onApplyAdvanced,
  state,
  tab,
}: UseHistoryFilterChipsOptions): ActiveFilterChip[] {
  const locale = useLocale();
  const t = useTranslations("delivery.history.activeFilters");
  const tState = useTranslations("delivery.statistics.orderStatus");

  const chips: ActiveFilterChip[] = [];
  const isInverted = historyRangeFlags(state);
  const isCancelledTab = tab === "cancelled";

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

  for (const value of state.store) {
    chips.push({
      key: `store:${value}`,
      label: t("store", { value }),
      onRemove: () =>
        onApplyAdvanced({ ...state, store: state.store.filter((item) => item !== value) }),
    });
  }

  const orderedLabel = isInverted.ordered
    ? null
    : rangeLabel({
        from: (value) => t("orderedFrom", { value: formatDate(value, locale) }),
        max: storableDay(state.to),
        min: storableDay(state.from),
        range: (min, max) =>
          t("orderedRange", { from: formatDate(min, locale), to: formatDate(max, locale) }),
        to: (value) => t("orderedTo", { value: formatDate(value, locale) }),
      });
  if (orderedLabel !== null) {
    chips.push({
      key: "ordered",
      label: orderedLabel,
      onRemove: () => onApplyAdvanced({ ...state, from: null, to: null }),
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

  for (const value of state.service) {
    chips.push({
      key: `service:${value}`,
      label: t("service", { value }),
      onRemove: () =>
        onApplyAdvanced({ ...state, service: state.service.filter((item) => item !== value) }),
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

  const priceCurrency = resolveHistoryPriceCurrency(state);
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

  const terminal = historyTerminalRange({ state, tab });
  const terminalPrefix = isCancelledTab ? "cancelled" : "received";
  const terminalLabel = terminal.isInverted
    ? null
    : rangeLabel({
        from: (value) => t(`${terminalPrefix}From`, { value: formatDate(value, locale) }),
        max: terminal.to,
        min: terminal.from,
        range: (min, max) =>
          t(`${terminalPrefix}Range`, {
            from: formatDate(min, locale),
            to: formatDate(max, locale),
          }),
        to: (value) => t(`${terminalPrefix}To`, { value: formatDate(value, locale) }),
      });
  if (terminalLabel !== null) {
    chips.push({
      key: "terminal",
      label: terminalLabel,
      onRemove: () =>
        onApplyAdvanced(
          isCancelledTab
            ? { ...state, cancelledFrom: null, cancelledTo: null }
            : { ...state, receivedFrom: null, receivedTo: null },
        ),
    });
  }

  return chips;
}

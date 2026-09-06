"use client";

import type { Currency, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StatisticsCurrencyBadge({ currency }: { currency: Currency }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
      {currency}
    </span>
  );
}

export function StatisticsDisplayCurrency({
  available,
  currencyFilter,
  onChange,
  value,
}: {
  available: readonly Currency[];
  currencyFilter: Nullable<Currency>;
  onChange: (currency: Currency) => void;
  value: Nullable<Currency>;
}) {
  const t = useTranslations("delivery.statistics.displayCurrency");

  if (value === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-ink">{t("label")}</span>
      <Tooltip>
        <TooltipTrigger
          aria-label={t("help")}
          className="cursor-pointer text-muted-foreground"
          type="button"
        >
          <UiIcon name="info" size={14} />
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{t("help")}</TooltipContent>
      </Tooltip>
      {currencyFilter === null ? (
        <SelectableCurrency available={available} onChange={onChange} value={value} />
      ) : (
        <span className="text-sm text-muted-foreground">
          {t("fixedByFilter", { currency: currencyFilter })}
        </span>
      )}
    </div>
  );
}

function SelectableCurrency({
  available,
  onChange,
  value,
}: {
  available: readonly Currency[];
  onChange: (currency: Currency) => void;
  value: Currency;
}) {
  const t = useTranslations("delivery.statistics.displayCurrency");

  if (available.length < 2) {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }

  return (
    <Segmented
      label={t("label")}
      onValueChange={(next) => onChange(next as Currency)}
      options={available.map((currency) => ({ label: currency, value: currency }))}
      value={value}
    />
  );
}

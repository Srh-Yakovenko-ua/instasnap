"use client";

import type { BookBudgetOverview, BookBudgetStatus, Currency, Nullable } from "@app/shared";

import { BOOK_BUDGET_RULES, CurrencySchema } from "@app/shared";
import { addYears, endOfYear, format, isBefore, parseISO, startOfMonth } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { MonthPicker } from "@/components/ui/month-picker";
import { dateFnsLocale, parseIsoDay } from "@/lib/format";

import { useSaveBookBudgets } from "../../api/use-book-budgets";

const CURRENCIES: readonly Currency[] = CurrencySchema.options;

const BUDGET_MONTH = {
  fieldId: "budget-month",
  hintId: "budget-month-hint",
  isoFormat: "yyyy-MM-dd",
  sentenceFormat: "MMMM yyyy",
  yearsAhead: 5,
} as const;

type BudgetDraft = {
  amounts: Record<Currency, string>;
  edited: Record<Currency, boolean>;
  month: string;
};

export function StatisticsBudgetDialog({
  onOpenChange,
  open,
  overview,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  overview: BookBudgetOverview | undefined;
}) {
  const t = useTranslations("delivery.statistics.budget.dialog");
  const locale = useLocale();
  const save = useSaveBookBudgets();
  const now = new Date();
  const currentMonth = toMonthStartIso(now);
  const [draft, setDraft] = useState<BudgetDraft>(() => toDraft(overview, currentMonth));

  const isSaving = save.isPending;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(overview, currentMonth));
    onOpenChange(next);
  }

  function handleMonthChange(month: string) {
    setDraft((prev) => ({
      amounts: mapCurrencies((currency) =>
        prev.edited[currency] ? prev.amounts[currency] : amountAt({ currency, month, overview }),
      ),
      edited: prev.edited,
      month,
    }));
  }

  async function submit() {
    const entries = CURRENCIES.map((currency) => ({
      currency,
      monthlyAmount: Number(draft.amounts[currency]),
      raw: draft.amounts[currency].trim(),
    }));

    const invalid = entries.find(
      (entry) =>
        entry.raw !== "" &&
        (!Number.isFinite(entry.monthlyAmount) ||
          entry.monthlyAmount < BOOK_BUDGET_RULES.monthlyAmountMin ||
          entry.monthlyAmount > BOOK_BUDGET_RULES.monthlyAmountMax),
    );
    if (invalid !== undefined) {
      toast.error(t("invalidAmount", { currency: invalid.currency }));
      return;
    }

    const written = entries.filter((entry) => entry.raw !== "");
    const stopped = entries.filter(
      (entry) =>
        entry.raw === "" &&
        amountAt({ currency: entry.currency, month: draft.month, overview }) !== "",
    );
    if (written.length === 0 && stopped.length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      await save.mutateAsync({
        changes: [
          ...written.map((entry) => ({
            action: "set" as const,
            currency: entry.currency,
            monthlyAmount: entry.monthlyAmount,
          })),
          ...stopped.map((entry) => ({ action: "stop" as const, currency: entry.currency })),
        ],
        effectiveFromMonth: draft.month,
      });
      toast.success(t("saved"));
      onOpenChange(false);
    } catch {
      toast.error(t("failed"));
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-ink">{t("amounts")}</legend>
          {CURRENCIES.map((currency) => (
            <InputGroup className="h-10" key={currency}>
              <InputGroupAddon className="pr-2.5">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {currency}
                </span>
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t("amount", { currency })}
                className="[appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                inputMode="decimal"
                min={BOOK_BUDGET_RULES.monthlyAmountMin}
                onChange={(event) =>
                  setDraft((prev) => ({
                    amounts: { ...prev.amounts, [currency]: event.target.value },
                    edited: { ...prev.edited, [currency]: true },
                    month: prev.month,
                  }))
                }
                placeholder={t("notConfigured")}
                step="0.01"
                type="number"
                value={draft.amounts[currency]}
              />
            </InputGroup>
          ))}
          <p className="text-xs text-muted-foreground">{t("amountsHint")}</p>
        </fieldset>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label htmlFor={BUDGET_MONTH.fieldId}>{t("effectiveFrom")}</Label>
          <MonthPicker
            ariaLabel={t("effectiveFrom")}
            describedBy={BUDGET_MONTH.hintId}
            id={BUDGET_MONTH.fieldId}
            max={toMonthStartIso(endOfYear(addYears(now, BUDGET_MONTH.yearsAhead)))}
            min={currentMonth}
            nextYearLabel={t("nextYear")}
            onChange={handleMonthChange}
            previousYearLabel={t("previousYear")}
            value={draft.month}
          />
          <div
            className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
            id={BUDGET_MONTH.hintId}
            role="status"
          >
            <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium">
                {t("appliesFrom", {
                  month: format(parseIsoDay(draft.month), BUDGET_MONTH.sentenceFormat, {
                    locale: dateFnsLocale(locale),
                  }),
                })}
              </p>
              <p>{t("earlierMonthsKeep")}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t("cancel")}
          </Button>
          <Button disabled={isSaving} onClick={() => void submit()}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function amountAt({
  currency,
  month,
  overview,
}: {
  currency: Currency;
  month: string;
  overview: BookBudgetOverview | undefined;
}): string {
  const status = overview?.budgets.find((entry) => entry.currency === currency);
  if (status === undefined) return "";

  const version = versionCovering({ month, status });
  return version === null ? "" : String(version);
}

function covers({ asked, validToMonth }: { asked: Date; validToMonth: Nullable<string> }): boolean {
  return validToMonth === null || isBefore(asked, parseISO(validToMonth));
}

function mapCurrencies(read: (currency: Currency) => string): Record<Currency, string> {
  return { EUR: read("EUR"), UAH: read("UAH"), USD: read("USD") };
}

function toDraft(overview: BookBudgetOverview | undefined, month: string): BudgetDraft {
  return {
    amounts: mapCurrencies((currency) => amountAt({ currency, month, overview })),
    edited: { EUR: false, UAH: false, USD: false },
    month,
  };
}

function toMonthStartIso(date: Date): string {
  return format(startOfMonth(date), BUDGET_MONTH.isoFormat);
}

function versionCovering({
  month,
  status,
}: {
  month: string;
  status: BookBudgetStatus;
}): Nullable<number> {
  const { currentMonth, upcomingChanges } = status;
  const scheduled = upcomingChanges.find((change) => change.kind !== "stop") ?? null;
  const asked = parseIsoDay(month);

  if (scheduled !== null && !isBefore(asked, parseISO(scheduled.effectiveFromMonth))) {
    return scheduled.monthlyAmount;
  }
  if (currentMonth === null) return null;
  return covers({ asked, validToMonth: currentMonth.validToMonth }) ? currentMonth.budget : null;
}

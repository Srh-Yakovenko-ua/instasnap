import type { BookBudgetOutlook, BookBudgetProgress, Nullable } from "@app/shared";

import { BOOK_BUDGET_RULES, BookBudgetOutlookSchema, toBudgetMonth } from "@app/shared";
import {
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  lastDayOfMonth,
  parseISO,
} from "date-fns";

import { toIsoDate } from "../../../core/iso-date.js";
import { fromMinorUnits, toMinorUnits } from "./money-minor-units.js";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const OUTLOOK = BookBudgetOutlookSchema.enum;

const BUDGET_ARITHMETIC = Object.freeze({
  emptyDenominator: 0,
  firstElapsedDay: 1,
  fullyUsedPercent: 100,
  percentMultiplier: 100,
  zeroFloor: 0,
});

export type BudgetMonthWindow = {
  daysInMonth: number;
  elapsedDays: number;
  lastDay: string;
  month: string;
};

export function computeBudgetProgress({
  budget,
  deliverySpentToDate,
  isSpendComplete,
  now,
  spentToDate,
}: {
  budget: number;
  deliverySpentToDate: number;
  isSpendComplete: boolean;
  now: Date;
  spentToDate: number;
}): BookBudgetProgress {
  const monthWindow = resolveBudgetMonthWindow(now);
  const forecast = forecastMonthSpend({ monthWindow, spentToDate });
  const remainingSigned = roundMoney(budget - spentToDate);

  return {
    budget,
    daysInMonth: monthWindow.daysInMonth,
    deliveryShareOfBudgetPercent: toShareOfBudgetPercent({ budget, part: deliverySpentToDate }),
    elapsedDays: monthWindow.elapsedDays,
    forecast,
    isForecastComplete: isSpendComplete,
    outlook: toOutlook({ budget, forecast, spentToDate }),
    projectedOverage:
      forecast === null
        ? null
        : roundMoney(Math.max(forecast - budget, BUDGET_ARITHMETIC.zeroFloor)),
    projectedRemaining:
      forecast === null
        ? null
        : roundMoney(Math.max(budget - forecast, BUDGET_ARITHMETIC.zeroFloor)),
    remaining: Math.max(remainingSigned, BUDGET_ARITHMETIC.zeroFloor),
    remainingSigned,
    spentToDate,
    usedPercent: toUsedPercent({ budget, spentToDate }),
  };
}

export function resolveBudgetMonthWindow(now: Date): BudgetMonthWindow {
  const month = toBudgetMonth(now);
  const monthStart = parseISO(month);
  const today = parseISO(toIsoDate(now));

  return {
    daysInMonth: getDaysInMonth(monthStart),
    elapsedDays: differenceInCalendarDays(today, monthStart) + BUDGET_ARITHMETIC.firstElapsedDay,
    lastDay: format(lastDayOfMonth(monthStart), ISO_DAY_FORMAT),
    month,
  };
}

function forecastMonthSpend({
  monthWindow,
  spentToDate,
}: {
  monthWindow: BudgetMonthWindow;
  spentToDate: number;
}): Nullable<number> {
  if (monthWindow.elapsedDays < BOOK_BUDGET_RULES.forecastMinimumElapsedDays) {
    return null;
  }
  return roundMoney((spentToDate / monthWindow.elapsedDays) * monthWindow.daysInMonth);
}

function roundMoney(value: number): number {
  return fromMinorUnits(toMinorUnits(value));
}

function toOutlook({
  budget,
  forecast,
  spentToDate,
}: {
  budget: number;
  forecast: Nullable<number>;
  spentToDate: number;
}): BookBudgetOutlook {
  if (spentToDate > budget) {
    return OUTLOOK.exceeded;
  }
  if (forecast === null) {
    return OUTLOOK.forecast_pending;
  }
  return forecast > budget ? OUTLOOK.at_risk : OUTLOOK.on_track;
}

function toShareOfBudgetPercent({
  budget,
  part,
}: {
  budget: number;
  part: number;
}): Nullable<number> {
  if (budget <= BUDGET_ARITHMETIC.emptyDenominator) {
    return null;
  }
  return (part / budget) * BUDGET_ARITHMETIC.percentMultiplier;
}

function toUsedPercent({ budget, spentToDate }: { budget: number; spentToDate: number }): number {
  if (budget <= BUDGET_ARITHMETIC.emptyDenominator) {
    return spentToDate > BUDGET_ARITHMETIC.zeroFloor
      ? BUDGET_ARITHMETIC.fullyUsedPercent
      : BUDGET_ARITHMETIC.zeroFloor;
  }
  return (spentToDate / budget) * BUDGET_ARITHMETIC.percentMultiplier;
}

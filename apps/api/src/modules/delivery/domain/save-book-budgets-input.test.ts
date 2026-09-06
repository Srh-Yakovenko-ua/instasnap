import { BOOK_BUDGET_MESSAGE, BOOK_BUDGET_RULES, SaveBookBudgetsInputSchema } from "@app/shared";
import { addMonths, format, startOfMonth } from "date-fns";
import { describe, expect, it } from "vitest";

const MONTH_FORMAT = "yyyy-MM-dd";

function monthsFromNow(count: number): string {
  return format(addMonths(startOfMonth(new Date()), count), MONTH_FORMAT);
}

function parseSave(overrides: Record<string, unknown>) {
  return SaveBookBudgetsInputSchema.safeParse({
    changes: [{ action: "set", currency: "UAH", monthlyAmount: 25_000 }],
    effectiveFromMonth: monthsFromNow(0),
    ...overrides,
  });
}

describe("SaveBookBudgetsInputSchema", () => {
  it("accepts a set and a stop in one save", () => {
    const result = parseSave({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 9000 },
        { action: "stop", currency: "EUR" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a save scheduled for a future month", () => {
    expect(parseSave({ effectiveFromMonth: monthsFromNow(2) }).success).toBe(true);
  });

  it("rejects a month that already passed", () => {
    expect(parseSave({ effectiveFromMonth: monthsFromNow(-1) }).success).toBe(false);
  });

  it("rejects a month that is not the first day", () => {
    expect(parseSave({ effectiveFromMonth: "2099-03-14" }).success).toBe(false);
  });

  it("rejects an empty change set", () => {
    const result = parseSave({ changes: [] });

    expect(result.error?.issues.at(0)?.message).toBe(BOOK_BUDGET_MESSAGE.noChanges);
  });

  it("rejects two changes for the same currency", () => {
    const result = parseSave({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 9000 },
        { action: "stop", currency: "UAH" },
      ],
    });

    expect(result.error?.issues.at(0)?.message).toBe(BOOK_BUDGET_MESSAGE.duplicateCurrency);
  });

  it("rejects an amount at or below zero", () => {
    expect(
      parseSave({ changes: [{ action: "set", currency: "UAH", monthlyAmount: 0 }] }).success,
    ).toBe(false);
  });

  it("rejects an amount above the allowed maximum", () => {
    const monthlyAmount = BOOK_BUDGET_RULES.monthlyAmountMax + 1;

    expect(
      parseSave({ changes: [{ action: "set", currency: "UAH", monthlyAmount }] }).success,
    ).toBe(false);
  });

  it("accepts a stop that carries no amount", () => {
    expect(parseSave({ changes: [{ action: "stop", currency: "USD" }] }).success).toBe(true);
  });
});

import { isBefore, isFirstDayOfMonth, parseISO } from "date-fns";
import { z } from "zod";

import { CurrencySchema } from "./book-enums.js";
import { CountSchema, isoDay } from "./internal.js";

const BUDGET_MONTH_ISO = {
  firstDaySuffix: "-01",
  monthPrefixLength: 7,
} as const;

export const BOOK_BUDGET_RULES = {
  forecastMinimumElapsedDays: 3,
  monthlyAmountMax: 99_999_999.99,
  monthlyAmountMin: 0.01,
} as const;

export const BOOK_BUDGET_MESSAGE = {
  amountTooLarge: `Monthly budget must be at most ${BOOK_BUDGET_RULES.monthlyAmountMax}`,
  amountTooSmall: "Monthly budget must be greater than zero",
  backdatedMonth: "A budget can start no earlier than the current month",
  duplicateCurrency: "Each currency can carry only one change per save",
  firstDayOfMonth: "A budget month must be the first day of a month",
  noBudgetToStop: "This currency has no budget to stop from that month",
  noChanges: "A save must carry at least one currency change",
  noScheduledStop: "This currency has no scheduled stop to cancel",
  noScheduledVersion: "There is no scheduled budget version to cancel",
  versionConflict: "This budget was changed somewhere else at the same time, please try again",
} as const;

export const BookBudgetMonthSchema = isoDay().refine(
  isFirstDayOfMonthIso,
  BOOK_BUDGET_MESSAGE.firstDayOfMonth,
);

const EffectiveFromMonthSchema = BookBudgetMonthSchema.refine(
  isNotBeforeCurrentMonth,
  BOOK_BUDGET_MESSAGE.backdatedMonth,
);

export const StopBookBudgetInputSchema = z.object({
  effectiveFromMonth: EffectiveFromMonthSchema.describe(
    "The first month this currency stops having a budget. Earlier months keep theirs.",
  ),
});

export type StopBookBudgetInput = z.infer<typeof StopBookBudgetInputSchema>;

export const MonthlyBudgetAmountSchema = z
  .number()
  .min(BOOK_BUDGET_RULES.monthlyAmountMin, BOOK_BUDGET_MESSAGE.amountTooSmall)
  .max(BOOK_BUDGET_RULES.monthlyAmountMax, BOOK_BUDGET_MESSAGE.amountTooLarge);

export const UpsertBookBudgetInputSchema = z.object({
  currency: CurrencySchema,
  effectiveFromMonth: EffectiveFromMonthSchema,
  monthlyAmount: MonthlyBudgetAmountSchema,
});

export type UpsertBookBudgetInput = z.infer<typeof UpsertBookBudgetInputSchema>;

export const SaveBookBudgetsChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    currency: CurrencySchema,
    monthlyAmount: MonthlyBudgetAmountSchema,
  }),
  z.object({ action: z.literal("stop"), currency: CurrencySchema }),
]);

export type SaveBookBudgetsChange = z.infer<typeof SaveBookBudgetsChangeSchema>;

export const SaveBookBudgetsInputSchema = z
  .object({
    changes: z.array(SaveBookBudgetsChangeSchema).min(1, BOOK_BUDGET_MESSAGE.noChanges),
    effectiveFromMonth: EffectiveFromMonthSchema,
  })
  .refine(carriesOneChangePerCurrency, {
    message: BOOK_BUDGET_MESSAGE.duplicateCurrency,
    path: ["changes"],
  })
  .describe(
    "Every currency the dialog actually changed, saved as one atomic write from the same month. A currency the user left alone is simply absent, so an untouched budget can never be rewritten by a save it was not part of.",
  );

export type SaveBookBudgetsInput = z.infer<typeof SaveBookBudgetsInputSchema>;

export const BookBudgetVersionSchema = z.object({
  monthlyAmount: z.number(),
  validFromMonth: BookBudgetMonthSchema,
  validToMonth: BookBudgetMonthSchema.nullable().describe(
    "The first month this version no longer covers. Null while the version is open ended.",
  ),
});

export type BookBudgetVersion = z.infer<typeof BookBudgetVersionSchema>;

export const BookBudgetOutlookSchema = z
  .enum(["on_track", "at_risk", "exceeded", "forecast_pending"])
  .describe(
    "Where the month is heading. on_track and at_risk both mean the budget still holds today and differ only in where the pace points; exceeded means it already broke; forecast_pending means too few days have elapsed to project anything.",
  );

export type BookBudgetOutlook = z.infer<typeof BookBudgetOutlookSchema>;

export const BookBudgetSpendCoverageSchema = z
  .object({
    ordersCount: CountSchema,
    ordersWithoutResolvedAmount: CountSchema,
    ordersWithResolvedAmount: CountSchema,
  })
  .describe(
    "How much of this month's spend the budget could actually see. An order whose amount is unknown is counted here and left out of the spend, never folded in as a zero.",
  );

export type BookBudgetSpendCoverage = z.infer<typeof BookBudgetSpendCoverageSchema>;

export const BookBudgetUpcomingChangeKindSchema = z.enum(["set", "change", "stop"]);

export type BookBudgetUpcomingChangeKind = z.infer<typeof BookBudgetUpcomingChangeKindSchema>;

export const BookBudgetUpcomingChangeSchema = z
  .object({
    effectiveFromMonth: BookBudgetMonthSchema,
    kind: BookBudgetUpcomingChangeKindSchema,
    monthlyAmount: z.number().nullable().describe("Null exactly when kind is stop."),
  })
  .describe(
    "One scheduled future move of this currency's budget, ascending by month. set opens a budget where there was none, change replaces a running one, stop ends it.",
  );

export type BookBudgetUpcomingChange = z.infer<typeof BookBudgetUpcomingChangeSchema>;

export const BookBudgetProgressSchema = z.object({
  budget: z.number(),
  daysInMonth: CountSchema,
  deliveryShareOfBudgetPercent: z
    .number()
    .nullable()
    .describe(
      "Delivery spend of the current month against the configured budget. Null when the budget cannot act as a denominator.",
    ),
  elapsedDays: CountSchema,
  forecast: z
    .number()
    .nullable()
    .describe(
      "Month-end spend projected from the pace so far. Null means insufficient data, which is every month before its third day.",
    ),
  isForecastComplete: z
    .boolean()
    .describe(
      "False when an order of this month carried no resolved amount, so the pace behind the forecast was measured on partial spend.",
    ),
  outlook: BookBudgetOutlookSchema,
  projectedOverage: z.number().nullable(),
  projectedRemaining: z
    .number()
    .nullable()
    .describe("What the pace leaves unspent by month end, floored at zero. Null while pending."),
  remaining: z.number(),
  remainingSigned: z
    .number()
    .describe("Budget minus spend without a floor, so an overage reads as a negative number."),
  spentToDate: z.number(),
  usedPercent: z.number(),
});

export type BookBudgetProgress = z.infer<typeof BookBudgetProgressSchema>;

export const BookBudgetCurrentMonthSchema = BookBudgetProgressSchema.extend({
  month: BookBudgetMonthSchema,
  validFromMonth: BookBudgetMonthSchema,
  validToMonth: BookBudgetMonthSchema.nullable().describe(
    "The first month this budget no longer covers. Null while it runs open ended.",
  ),
});

export type BookBudgetCurrentMonth = z.infer<typeof BookBudgetCurrentMonthSchema>;

export const BookBudgetStatusSchema = z.object({
  currency: CurrencySchema,
  currentMonth: BookBudgetCurrentMonthSchema.nullable(),
  spendCoverage: BookBudgetSpendCoverageSchema,
  upcomingChanges: z
    .array(BookBudgetUpcomingChangeSchema)
    .describe(
      "Every move already scheduled for this currency, ascending by month. More than one can be waiting, so none of them is silently dropped.",
    ),
});

export type BookBudgetStatus = z.infer<typeof BookBudgetStatusSchema>;

export const BookBudgetOverviewSchema = z.object({
  budgets: z
    .array(BookBudgetStatusSchema)
    .describe("Only currencies the user has configured. An unconfigured currency is absent."),
  month: BookBudgetMonthSchema,
});

export type BookBudgetOverview = z.infer<typeof BookBudgetOverviewSchema>;

export function toBudgetMonth(date: Date): string {
  const monthPrefix = date.toISOString().slice(0, BUDGET_MONTH_ISO.monthPrefixLength);
  return `${monthPrefix}${BUDGET_MONTH_ISO.firstDaySuffix}`;
}

function carriesOneChangePerCurrency({ changes }: { changes: SaveBookBudgetsChange[] }): boolean {
  return new Set(changes.map((change) => change.currency)).size === changes.length;
}

function isFirstDayOfMonthIso(value: string): boolean {
  return isFirstDayOfMonth(parseISO(value));
}

function isNotBeforeCurrentMonth(value: string): boolean {
  return !isBefore(parseISO(value), parseISO(toBudgetMonth(new Date())));
}

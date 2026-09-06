import type { Nullable } from "@app/shared";

import { endOfYear, format, startOfYear, subYears } from "date-fns";
import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type {
  LoanHistoryControllerListParams,
  LoanHistoryControllerOverviewParams,
  LoanHistoryControllerPeopleParams,
} from "@/shared/api/generated/model";

import { isInvertedDayRange, isStorableDay } from "@/features/books/model/filter-chips";
import { ISO_DATE_FORMAT } from "@/features/books/model/reading-progress";
import {
  LoanHistoryControllerListResult,
  LoanHistoryControllerListSort,
  LoanHistoryControllerListType,
} from "@/shared/api/generated/model";

import { parseAsContactId } from "./contact-id-param";

export const LOAN_HISTORY_PAGE_SIZE = 10;

export const LOAN_HISTORY_RESULT_DEFAULT = LoanHistoryControllerListResult.all;
export const LOAN_HISTORY_SORT_DEFAULT = LoanHistoryControllerListSort.returned_desc;

export const LOAN_HISTORY_RESULT_VALUES = Object.values(LoanHistoryControllerListResult);
export const LOAN_HISTORY_SORT_VALUES = Object.values(LoanHistoryControllerListSort);
export const LOAN_HISTORY_TYPE_VALUES = Object.values(LoanHistoryControllerListType);

export const loanHistoryQueryParsers = {
  contactId: parseAsContactId,
  from: parseAsString.withDefault(""),
  loanFrom: parseAsString,
  loanTo: parseAsString,
  q: parseAsString.withDefault(""),
  result: parseAsStringLiteral(LOAN_HISTORY_RESULT_VALUES).withDefault(LOAN_HISTORY_RESULT_DEFAULT),
  sort: parseAsStringLiteral(LOAN_HISTORY_SORT_VALUES).withDefault(LOAN_HISTORY_SORT_DEFAULT),
  to: parseAsString.withDefault(""),
  type: parseAsStringLiteral(LOAN_HISTORY_TYPE_VALUES),
};

export type LoanHistoryAdvancedState = Omit<LoanHistoryQueryState, "q" | "result" | "sort">;

export type LoanHistoryListParams = Omit<LoanHistoryControllerListParams, "pageNumber">;

export type LoanHistoryPeriod = {
  from: string;
  to: string;
};

export type LoanHistoryPeriodPreset = "custom" | LoanHistoryRangePreset;

export type LoanHistoryPeriodPresets = Record<LoanHistoryRangePreset, LoanHistoryPeriod>;

export type LoanHistoryQueryState = inferParserType<typeof loanHistoryQueryParsers>;

export type LoanHistoryRangePreset = "all" | "lastYear" | "thisYear";

type LoanHistoryDayBoundKey = "loanDateFrom" | "loanDateTo" | "returnedFrom" | "returnedTo";

type LoanHistoryRangeFlags = {
  loanDate: boolean;
  returned: boolean;
};

type LoanHistoryScopeParams = Pick<
  LoanHistoryControllerPeopleParams,
  "loanDateFrom" | "loanDateTo" | "returnedFrom" | "returnedTo" | "type"
>;

export const LOAN_HISTORY_RANGE_PRESETS = [
  "all",
  "thisYear",
  "lastYear",
] as const satisfies readonly LoanHistoryRangePreset[];

export const LOAN_HISTORY_PERIOD_PRESETS = [
  ...LOAN_HISTORY_RANGE_PRESETS,
  "custom",
] as const satisfies readonly LoanHistoryPeriodPreset[];

export const LOAN_HISTORY_ADVANCED_EMPTY: LoanHistoryAdvancedState = {
  contactId: "",
  from: "",
  loanFrom: null,
  loanTo: null,
  to: "",
  type: null,
};

export const LOAN_HISTORY_ADVANCED_RESET = {
  contactId: null,
  from: null,
  loanFrom: null,
  loanTo: null,
  to: null,
  type: null,
} satisfies Record<keyof LoanHistoryAdvancedState, null>;

export const LOAN_HISTORY_FILTERS_RESET = {
  ...LOAN_HISTORY_ADVANCED_RESET,
  q: null,
  result: null,
} satisfies Partial<Record<keyof LoanHistoryQueryState, null>>;

export function countActiveLoanHistoryFilters(state: LoanHistoryAdvancedState): number {
  const flags = loanHistoryRangeFlags(state);

  return [
    state.type !== null,
    state.contactId !== "",
    !flags.returned && (state.from !== "" || state.to !== ""),
    !flags.loanDate && (state.loanFrom !== null || state.loanTo !== null),
  ].filter(Boolean).length;
}

export function hasActiveLoanHistoryFilters(state: LoanHistoryQueryState): boolean {
  return state.result !== LOAN_HISTORY_RESULT_DEFAULT || countActiveLoanHistoryFilters(state) > 0;
}

export function hasActiveLoanHistorySearch(state: LoanHistoryQueryState): boolean {
  return state.q.trim() !== "";
}

export function hasInvalidLoanHistoryRange(state: LoanHistoryAdvancedState): boolean {
  const flags = loanHistoryRangeFlags(state);
  return flags.loanDate || flags.returned;
}

export function loanHistoryPeriodPresets(reference: Date): LoanHistoryPeriodPresets {
  return {
    all: { from: "", to: "" },
    lastYear: yearPeriod(subYears(reference, 1)),
    thisYear: yearPeriod(reference),
  };
}

export function loanHistoryRangeFlags(state: LoanHistoryAdvancedState): LoanHistoryRangeFlags {
  return {
    loanDate: isInvertedDayRange(state.loanFrom, state.loanTo),
    returned: isInvertedDayRange(state.from, state.to),
  };
}

export function resolveLoanHistoryPeriodPreset(
  period: LoanHistoryPeriod,
  presets: LoanHistoryPeriodPresets,
): LoanHistoryPeriodPreset {
  const match = LOAN_HISTORY_RANGE_PRESETS.find(
    (preset) => presets[preset].from === period.from && presets[preset].to === period.to,
  );

  return match ?? "custom";
}

export function toLoanHistoryListParams(state: LoanHistoryQueryState): LoanHistoryListParams {
  const search = state.q.trim();

  return {
    ...toLoanHistoryOverviewParams(state),
    pageSize: LOAN_HISTORY_PAGE_SIZE,
    result: state.result,
    sort: state.sort,
    ...(search === "" ? {} : { search }),
  };
}

export function toLoanHistoryOverviewParams(
  state: LoanHistoryAdvancedState,
): LoanHistoryControllerOverviewParams {
  const { loanDateFrom, loanDateTo, returnedFrom, returnedTo, type } =
    toLoanHistoryPeopleParams(state);

  return {
    ...(state.contactId === "" ? {} : { contactId: state.contactId }),
    ...(type === undefined ? {} : { type }),
    ...(returnedFrom === undefined ? {} : { returnedFrom }),
    ...(returnedTo === undefined ? {} : { returnedTo }),
    ...(loanDateFrom === undefined ? {} : { loanDateFrom }),
    ...(loanDateTo === undefined ? {} : { loanDateTo }),
  };
}

export function toLoanHistoryPeopleParams(state: LoanHistoryAdvancedState): LoanHistoryScopeParams {
  const flags = loanHistoryRangeFlags(state);

  return {
    ...(state.type === null ? {} : { type: state.type }),
    ...(flags.returned ? {} : dayBound("returnedFrom", state.from)),
    ...(flags.returned ? {} : dayBound("returnedTo", state.to)),
    ...(flags.loanDate ? {} : dayBound("loanDateFrom", state.loanFrom)),
    ...(flags.loanDate ? {} : dayBound("loanDateTo", state.loanTo)),
  };
}

function dayBound(
  key: LoanHistoryDayBoundKey,
  value: Nullable<string>,
): Partial<LoanHistoryScopeParams> {
  return isStorableDay(value) ? { [key]: value } : {};
}

function yearPeriod(reference: Date): LoanHistoryPeriod {
  return {
    from: format(startOfYear(reference), ISO_DATE_FORMAT),
    to: format(endOfYear(reference), ISO_DATE_FORMAT),
  };
}

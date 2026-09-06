import { format, parseISO } from "date-fns";

import { dateFnsLocale } from "@/lib/format";

const MONTH_KEY_LENGTH = 7;

const MONTH_FORMAT = {
  inSentence: "MMMM yyyy",
  standalone: "LLLL yyyy",
} as const;

export function budgetMonthInSentence(month: string, locale: string): string {
  return formatMonth({ locale, month, pattern: MONTH_FORMAT.inSentence });
}

export function budgetMonthStandalone(month: string, locale: string): string {
  return formatMonth({ locale, month, pattern: MONTH_FORMAT.standalone });
}

function formatMonth({
  locale,
  month,
  pattern,
}: {
  locale: string;
  month: string;
  pattern: string;
}): string {
  return format(parseISO(`${month.slice(0, MONTH_KEY_LENGTH)}-01`), pattern, {
    locale: dateFnsLocale(locale),
  });
}

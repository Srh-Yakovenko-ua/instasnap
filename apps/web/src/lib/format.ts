import type { Locale } from "date-fns";

import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
} from "date-fns";
import { enUS, uk } from "date-fns/locale";

type RelativeTimeStep = {
  difference: (target: Date, reference: Date) => number;
  limit: number;
  unit: Intl.RelativeTimeFormatUnit;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const RELATIVE_TIME_STEPS = [
  { difference: differenceInSeconds, limit: 60, unit: "second" },
  { difference: differenceInMinutes, limit: 60, unit: "minute" },
  { difference: differenceInHours, limit: 24, unit: "hour" },
  { difference: differenceInCalendarDays, limit: 31, unit: "day" },
  { difference: differenceInCalendarMonths, limit: 12, unit: "month" },
] as const satisfies readonly RelativeTimeStep[];

const DATE_FNS_LOCALES: Record<string, Locale> = { en: enUS, uk };

export function dateFnsLocale(locale: string): Locale {
  return DATE_FNS_LOCALES[locale] ?? uk;
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseIsoDay(iso));
}

export function formatDateLong(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseIsoDay(iso));
}

export function formatDateShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(parseIsoDay(iso));
}

export function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(parseIsoDay(iso));
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTime(iso: string, locale: string): string {
  const target = new Date(iso);
  const now = new Date();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const { difference, limit, unit } of RELATIVE_TIME_STEPS) {
    const value = difference(target, now);
    if (Math.abs(value) < limit) return relative.format(value, unit);
  }

  return relative.format(differenceInCalendarYears(target, now), "year");
}

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} · ${time}`;
}

export function parseIsoDay(iso: string): Date {
  const match = DATE_ONLY_PATTERN.exec(iso);
  if (match === null) return new Date(iso);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

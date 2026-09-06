import type { Nullable } from "@app/shared";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toDate } from "date-fns-tz";

const UTC_TIME_ZONE = "UTC";
const ISO_DATE_FORMAT = "yyyy-MM-dd";

export function addDaysToIsoDate(isoDate: string, days: number): string {
  return format(addDays(parseISO(isoDate), days), ISO_DATE_FORMAT);
}

export function daysBetweenIsoDates({
  endIsoDate,
  startIsoDate,
}: {
  endIsoDate: string;
  startIsoDate: string;
}): number {
  return differenceInCalendarDays(parseISO(endIsoDate), parseISO(startIsoDate));
}

export function parseIsoDate(value: string): Date {
  return fromZonedTime(`${value}T00:00:00.000`, UTC_TIME_ZONE);
}

export function startOfUtcDay(date: Date): Date {
  return parseIsoDate(toIsoDate(date));
}

export function toCreateDate(value: Nullable<string> | undefined): Nullable<Date> {
  return value === undefined || value === null ? null : parseIsoDate(value);
}

export function toIsoDate(date: Date): string {
  return formatInTimeZone(date, UTC_TIME_ZONE, ISO_DATE_FORMAT);
}

export function toIsoDateFromIsoString(value: string): string {
  return toIsoDate(toDate(value, { timeZone: UTC_TIME_ZONE }));
}

export function toNullableIsoDate(value: Nullable<Date>): Nullable<string> {
  return value === null ? null : toIsoDate(value);
}

export function toNullableIsoDateTime(value: Nullable<Date>): Nullable<string> {
  return value === null ? null : value.toISOString();
}

export function toUpdateDate(value: Nullable<string> | undefined): Nullable<Date> | undefined {
  return value === undefined || value === null ? value : parseIsoDate(value);
}

export function toZonedIsoDate({ instant, timeZone }: { instant: Date; timeZone: string }): string {
  return formatInTimeZone(instant, timeZone, ISO_DATE_FORMAT);
}

import type { Nullable } from "@app/shared";

import { isAfter, isValid, parseISO } from "date-fns";
import { z } from "zod";

const OrderIdSchema = z.uuid();

export function isInvertedDayRange(from: Nullable<string>, to: Nullable<string>): boolean {
  if (!isStorableDay(from) || !isStorableDay(to)) return false;
  return isAfter(parseISO(from), parseISO(to));
}

export function isStorableDay(value: Nullable<string>): value is string {
  return value !== null && isValid(parseISO(value));
}

export function isStorableOrderId(value: Nullable<string>): value is string {
  return value !== null && OrderIdSchema.safeParse(value).success;
}

export function rangeLabel<TValue>({
  from,
  max,
  min,
  range,
  to,
}: {
  from: (value: TValue) => string;
  max: Nullable<TValue>;
  min: Nullable<TValue>;
  range: (min: TValue, max: TValue) => string;
  to: (value: TValue) => string;
}): Nullable<string> {
  if (min !== null && max !== null) return range(min, max);
  if (min !== null) return from(min);
  if (max !== null) return to(max);
  return null;
}

export function storableDay(value: Nullable<string>): Nullable<string> {
  return isStorableDay(value) ? value : null;
}

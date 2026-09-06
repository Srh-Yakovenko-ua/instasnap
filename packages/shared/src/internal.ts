import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { z } from "zod";

import {
  collapseHorizontalSpaces,
  collapseSpaces,
  LIST_PAGE_SIZE_MAX,
  noHtmlTags,
  type Nullable,
} from "./common.js";

export const NoHtmlString = z.string().refine(noHtmlTags, "HTML tags are not allowed");

export const CountSchema = z.number().int().nonnegative();

export const BOOK_RATING = {
  max: 10,
  min: 0.5,
  step: 0.5,
} as const;

export const ratingBound = () =>
  z.coerce.number().min(BOOK_RATING.min).max(BOOK_RATING.max).multipleOf(BOOK_RATING.step);

export const ratingAverage = () => z.number().min(BOOK_RATING.min).max(BOOK_RATING.max);

const UTC_DAY = {
  isoDateLength: 10,
  skewToleranceDays: 1,
  startOf: (date: Date): Date =>
    new Date(`${date.toISOString().slice(0, UTC_DAY.isoDateLength)}T00:00:00.000Z`),
} as const;

const isNotInFuture = (value: string): boolean => {
  const latestAcceptable = addDays(UTC_DAY.startOf(new Date()), UTC_DAY.skewToleranceDays);
  return !isAfter(new Date(`${value}T00:00:00.000Z`), latestAcceptable);
};

const EARLIEST_STORABLE_DAY = "0001-01-01";
const EARLIEST_STORABLE_DAY_MESSAGE = `Date must not be earlier than ${EARLIEST_STORABLE_DAY}`;

const isStorableDay = (value: string): boolean =>
  !isBefore(parseISO(value), parseISO(EARLIEST_STORABLE_DAY));

export const isoDay = () => z.iso.date().refine(isStorableDay, EARLIEST_STORABLE_DAY_MESSAGE);

export const notInFutureDate = (message: string) => isoDay().refine(isNotInFuture, message);

export const HTTPS_PROTOCOL = /^https$/;

export const HTTP_OR_HTTPS_PROTOCOL = /^https?$/;

export const boundedUrlSchema = (options: {
  maxLength: number;
  protocol: RegExp;
  urlError: string;
}) =>
  z
    .string()
    .trim()
    .max(options.maxLength, `URL must be at most ${options.maxLength} characters long`)
    .refine(noHtmlTags, "HTML tags are not allowed")
    .pipe(z.url({ error: options.urlError, protocol: options.protocol }));

export const RECENT_USED_LIMIT_DEFAULT = 8;
export const RECENT_USED_LIMIT_MAX = 20;

const coerceQueryStringArray = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const entries = Array.isArray(value) ? value : [value];
  const parts = entries.flatMap((entry) => (typeof entry === "string" ? entry.split(",") : entry));
  const cleaned = parts
    .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    .filter((entry) => entry !== "");
  return cleaned.length === 0 ? undefined : cleaned;
};

export const queryStringArray = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(coerceQueryStringArray, z.array(schema).max(LIST_PAGE_SIZE_MAX).optional());

export const QueryBooleanWithDefaultSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const OWNERSHIP_STORE_NAME_MAX = 100;
const OWNERSHIP_STORE_URL_MAX = 300;
const OWNERSHIP_ORDER_NUMBER_MAX = 100;
const OWNERSHIP_NOTE_MAX = 300;
const OWNERSHIP_PRICE_MIN = 0;
const OWNERSHIP_PRICE_MAX = 99999999.99;
const TRACKING_NUMBER_MAX = 100;
const CANCEL_REASON_MAX = 500;

export const OwnershipStoreNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(OWNERSHIP_STORE_NAME_MAX, "Store name must be at most 100 characters long"),
  );

export const OwnershipStoreUrlSchema = boundedUrlSchema({
  maxLength: OWNERSHIP_STORE_URL_MAX,
  protocol: HTTP_OR_HTTPS_PROTOCOL,
  urlError: "Enter a valid link",
});

export const OwnershipOrderNumberSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(
      OWNERSHIP_ORDER_NUMBER_MAX,
      "Order number must be at most 100 characters long",
    ),
  );

export const OwnershipNoteSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(OWNERSHIP_NOTE_MAX, "Note must be at most 300 characters long"));

export const OwnershipPriceSchema = z
  .number()
  .min(OWNERSHIP_PRICE_MIN, "Price cannot be negative")
  .max(OWNERSHIP_PRICE_MAX, "Price must be at most 99999999.99");

export const TrackingNumberSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(TRACKING_NUMBER_MAX, "Tracking number must be at most 100 characters long"),
  );

export const CancelReasonSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(CANCEL_REASON_MAX, "Cancel reason must be at most 500 characters long"))
  .transform((value) => (value.length === 0 ? null : value));

export const EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE =
  "Expected delivery cannot be before the order date";

export const isExpectedNotBeforeOrder = (value: {
  expectedDeliveryDate?: Nullable<string>;
  orderDate?: Nullable<string>;
}): boolean => {
  const { expectedDeliveryDate, orderDate } = value;
  if (
    orderDate === undefined ||
    orderDate === null ||
    expectedDeliveryDate === undefined ||
    expectedDeliveryDate === null
  ) {
    return true;
  }
  return !isBefore(parseISO(expectedDeliveryDate), parseISO(orderDate));
};

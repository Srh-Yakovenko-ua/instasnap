import { z } from "zod";

import { CurrencySchema } from "./book-enums.js";

export type ApiError = {
  code?: string;
  details?: Record<string, unknown>;
  message: string;
  requestId?: string;
};

export type ApiErrorResult = {
  errorsMessages: FieldError[];
};

export type ApiHealth = {
  postgres: "down" | "ok";
  redis: "down" | "ok";
  status: "degraded" | "down" | "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type FieldError = {
  code?: string;
  field: string;
  message: string;
  meta?: Record<string, string>;
};

export type Nullable<T> = null | T;

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export type ValueOf<T> = T[keyof T];

export const LIST_PAGE_SIZE_MAX = 100;

export const PAGE_NUMBER_MAX = 21474836;

export const READING_POSITION_INT_MAX = 2147483647;

const readingPositionUnit = () =>
  z.coerce.number().int().min(0).max(READING_POSITION_INT_MAX).optional();

export const ReadingPositionSchema = z.object({
  audioSeconds: readingPositionUnit(),
  chapter: readingPositionUnit(),
  page: readingPositionUnit(),
});

export type ReadingPosition = z.infer<typeof ReadingPositionSchema>;

export const readingPositionQueryFields = {
  contextAudioSeconds: ReadingPositionSchema.shape.audioSeconds,
  contextChapter: ReadingPositionSchema.shape.chapter,
  contextPage: ReadingPositionSchema.shape.page,
};

export const readingPositionFromQuery = (query: {
  contextAudioSeconds?: number;
  contextChapter?: number;
  contextPage?: number;
}): ReadingPosition | undefined => {
  if (
    query.contextAudioSeconds === undefined &&
    query.contextChapter === undefined &&
    query.contextPage === undefined
  ) {
    return undefined;
  }
  return {
    audioSeconds: query.contextAudioSeconds,
    chapter: query.contextChapter,
    page: query.contextPage,
  };
};

const HTML_TAG = /<\/?[a-zA-Z][^<>]*>|<!--|<!\w/;

export const noHtmlTags = (value: string): boolean => !HTML_TAG.test(value);

export function collapseHorizontalSpaces(value: string): string {
  return value.replace(/[^\S\n]+/g, " ").trim();
}

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return collapseSpaces(name).toLowerCase();
}

export function normalizeSearch(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const collapsed = collapseSpaces(value);
  return collapsed.length === 0 ? undefined : collapsed;
}

export const CurrencyTotalSchema = z.object({ currency: CurrencySchema, total: z.number() });

export type CurrencyTotal = z.infer<typeof CurrencyTotalSchema>;

export const CurrencyAverageSchema = z.object({ average: z.number(), currency: CurrencySchema });

export type CurrencyAverage = z.infer<typeof CurrencyAverageSchema>;

export const createPaginatedSchema = <ItemSchema extends z.ZodType>(item: ItemSchema) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pagesCount: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
  });

export const paginationQueryFields = (options: {
  pageNumberMax?: number;
  pageSizeDefault: number;
  pageSizeMax?: number;
}) => ({
  pageNumber: z.coerce
    .number()
    .int()
    .min(1)
    .max(options.pageNumberMax ?? PAGE_NUMBER_MAX)
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(options.pageSizeMax ?? LIST_PAGE_SIZE_MAX)
    .default(options.pageSizeDefault),
});

import { isAfter, parseISO } from "date-fns";
import { z } from "zod";

import { createPaginatedSchema, paginationQueryFields } from "./common.js";
import { CountSchema, isoDay, queryStringArray } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { TRASH_PAGE_SIZE_DEFAULT, TrashDeletionResultSchema } from "./trash.js";

const QUOTE_TEXT_MAX = 1000;
const QUOTE_CHAPTER_MAX = 80;
const QUOTE_COMMENT_MAX = 500;
const QUOTE_PAGE_MIN = 1;
export const QUOTE_PAGE_MAX = 10000;
const QUOTE_SEARCH_MAX = 100;
const QUOTES_DEFAULT_PAGE_SIZE = 12;

export const QuoteTextSchema = z
  .string()
  .trim()
  .min(1, "Quote text is required")
  .max(QUOTE_TEXT_MAX, "Quote text must be at most 1000 characters long");

export const QuoteChapterSchema = z
  .string()
  .trim()
  .max(QUOTE_CHAPTER_MAX, "Chapter must be at most 80 characters long");

export const QuoteCommentSchema = z
  .string()
  .trim()
  .max(QUOTE_COMMENT_MAX, "Comment must be at most 500 characters long");

export const QuotePageSchema = z.coerce
  .number()
  .int("Page must be a whole number")
  .min(QUOTE_PAGE_MIN, "Page must be greater than 0")
  .max(QUOTE_PAGE_MAX, "Page must be at most 10000");

export const CreateQuoteInputSchema = z.object({
  chapter: QuoteChapterSchema.nullish(),
  comment: QuoteCommentSchema.nullish(),
  isFavorite: z.boolean().default(false),
  isSpoiler: z.boolean().default(false),
  page: QuotePageSchema.nullish(),
  text: QuoteTextSchema,
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteInputSchema>;

export const UpdateQuoteInputSchema = z.object({
  chapter: QuoteChapterSchema.nullish(),
  comment: QuoteCommentSchema.nullish(),
  isFavorite: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
  page: QuotePageSchema.nullish(),
  text: QuoteTextSchema.optional(),
});

export type UpdateQuoteInput = z.infer<typeof UpdateQuoteInputSchema>;

export const QuoteFilterSchema = z.enum([
  "all",
  "no_spoiler",
  "with_spoiler",
  "favorites",
  "with_comment",
  "without_comment",
]);

export type QuoteFilter = z.infer<typeof QuoteFilterSchema>;

export const QuoteSortSchema = z.enum([
  "newest",
  "oldest",
  "book_title",
  "book_author",
  "page",
  "favorites_first",
  "no_spoiler_first",
  "with_spoiler_first",
]);

export type QuoteSort = z.infer<typeof QuoteSortSchema>;

const CREATED_RANGE_MESSAGE = "createdFrom must not be later than createdTo";

const quotesDatasetQueryFields = {
  author: queryStringArray(z.uuid()),
  book: queryStringArray(z.uuid()),
  bookId: z.uuid().optional(),
  createdFrom: isoDay().optional(),
  createdTo: isoDay().optional(),
  q: z.string().trim().max(QUOTE_SEARCH_MAX).optional(),
};

function refineCreatedRange(
  value: { createdFrom?: string | undefined; createdTo?: string | undefined },
  context: z.RefinementCtx,
): void {
  const { createdFrom, createdTo } = value;
  if (createdFrom === undefined || createdTo === undefined) {
    return;
  }
  if (!isAfter(parseISO(createdFrom), parseISO(createdTo))) {
    return;
  }
  context.addIssue({
    code: "custom",
    message: CREATED_RANGE_MESSAGE,
    path: ["createdFrom"],
  });
}

export const QuotesQuerySchema = z
  .object({
    ...quotesDatasetQueryFields,
    filter: QuoteFilterSchema.default("all"),
    ...paginationQueryFields({ pageSizeDefault: QUOTES_DEFAULT_PAGE_SIZE }),
    sort: QuoteSortSchema.default("newest"),
  })
  .superRefine(refineCreatedRange);

export type QuotesQuery = z.infer<typeof QuotesQuerySchema>;

export function toQuoteBookIds(query: {
  book?: string[] | undefined;
  bookId?: string | undefined;
}): string[] | undefined {
  const { book, bookId } = query;
  if (book === undefined && bookId === undefined) {
    return undefined;
  }
  return [...new Set([...(book ?? []), ...(bookId === undefined ? [] : [bookId])])];
}

export const QuoteBookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  firstAuthorName: z.string(),
  id: z.string(),
  title: z.string(),
});

export type QuoteBookPreview = z.infer<typeof QuoteBookPreviewSchema>;

export const QuoteViewSchema = z.object({
  book: QuoteBookPreviewSchema,
  bookId: z.string(),
  chapter: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  isFavorite: z.boolean(),
  isSpoiler: z.boolean(),
  page: z.number().int().nullable(),
  text: z.string(),
  updatedAt: z.string(),
});

export type QuoteView = z.infer<typeof QuoteViewSchema>;

export const BookQuotesViewSchema = z.object({
  favoritesCount: z.number().int().nonnegative(),
  items: z.array(QuoteViewSchema),
  spoilerCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export type BookQuotesView = z.infer<typeof BookQuotesViewSchema>;

export const PaginatedQuotesSchema = createPaginatedSchema(QuoteViewSchema);

export const QuotesSummaryBookSchema = z.object({
  id: z.string(),
  quotesCount: z.number().int().nonnegative(),
  title: z.string(),
});

export type QuotesSummaryBook = z.infer<typeof QuotesSummaryBookSchema>;

export const QuotesSummaryAuthorSchema = z.object({
  name: z.string(),
  quotesCount: z.number().int().nonnegative(),
});

export type QuotesSummaryAuthor = z.infer<typeof QuotesSummaryAuthorSchema>;

export const QuotesSummaryViewSchema = z.object({
  favoritesCount: z.number().int().nonnegative(),
  spoilerCount: z.number().int().nonnegative(),
  topAuthor: QuotesSummaryAuthorSchema.nullable(),
  topBook: QuotesSummaryBookSchema.nullable(),
  totalCount: z.number().int().nonnegative(),
  withCommentCount: z.number().int().nonnegative(),
  withoutSpoilerCount: z.number().int().nonnegative(),
});

export type QuotesSummaryView = z.infer<typeof QuotesSummaryViewSchema>;

export const QuotesFacetsQuerySchema = z
  .object(quotesDatasetQueryFields)
  .superRefine(refineCreatedRange);

export type QuotesFacetsQuery = z.infer<typeof QuotesFacetsQuerySchema>;

export const QuoteAuthorFacetSchema = z.object({
  count: CountSchema,
  id: z.string(),
  name: z.string(),
});

export type QuoteAuthorFacet = z.infer<typeof QuoteAuthorFacetSchema>;

export const QuoteBookFacetSchema = z.object({
  count: CountSchema,
  id: z.string(),
  title: z.string(),
});

export type QuoteBookFacet = z.infer<typeof QuoteBookFacetSchema>;

export const QuotesFacetsViewSchema = z.object({
  authors: z
    .array(QuoteAuthorFacetSchema)
    .describe(
      "Authors of books holding a quote of the scope, with how many quotes each one carries. The list answers to every dataset filter except the selected authors, so picking one author never makes another disappear.",
    ),
  books: z
    .array(QuoteBookFacetSchema)
    .describe(
      "Books holding a quote of the scope, with their quote counts. The list answers to every dataset filter except the selected books, so picking one book never makes another disappear.",
    ),
  favoritesCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Quotes of the scope that are marked as favorite."),
  spoilerCount: z.number().int().nonnegative().describe("Quotes of the scope marked as a spoiler."),
  totalCount: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Quotes in the scope. The scope answers to the dataset parameters only, never to the primary filter or to pagination, so picking one quick filter never moves the number shown on another one.",
    ),
  withCommentCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Quotes of the scope that carry a comment."),
  withoutCommentCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Quotes of the scope that carry no comment."),
  withoutSpoilerCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Quotes of the scope that are not marked as a spoiler."),
});

export type QuotesFacetsView = z.infer<typeof QuotesFacetsViewSchema>;

export const QuoteDeletionResultSchema = TrashDeletionResultSchema.extend({
  quoteId: z.string(),
});

export type QuoteDeletionResult = z.infer<typeof QuoteDeletionResultSchema>;

export const TrashedQuoteViewSchema = z.object({
  bookTitle: z.string(),
  deletedAt: z.iso.datetime(),
  id: z.string(),
  purgeAt: z.iso.datetime(),
  text: z.string(),
});

export type TrashedQuoteView = z.infer<typeof TrashedQuoteViewSchema>;

export const TrashedQuotesQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashedQuotesQuery = z.infer<typeof TrashedQuotesQuerySchema>;

export const PaginatedTrashedQuotesSchema = createPaginatedSchema(TrashedQuoteViewSchema);

export type PaginatedTrashedQuotes = z.infer<typeof PaginatedTrashedQuotesSchema>;

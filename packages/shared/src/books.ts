import { z } from "zod";

import { BookAuthorRefSchema, BookAuthorsInputSchema } from "./authors.js";
import {
  ActiveShipmentStatusSchema,
  AgeCategorySchema,
  BookFormatSchema,
  BookFormatsSchema,
  BookLanguageSchema,
  BookPartNumberSchema,
  BookTypeSchema,
  CurrencySchema,
  LoanDirectionSchema,
  OwnershipStatusSchema,
  ownershipStatusUsesLoan,
  QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
} from "./book-enums.js";
import {
  collapseHorizontalSpaces,
  collapseSpaces,
  createPaginatedSchema,
  LIST_PAGE_SIZE_MAX,
  type Nullable,
  paginationQueryFields,
  type ValueOf,
} from "./common.js";
import { DeliveryServiceSchema } from "./delivery-services.js";
import { DeliverySummaryViewSchema } from "./delivery-view.js";
import { BookGenresSchema, GenreKeySchema } from "./genres.js";
import {
  CancelReasonSchema,
  EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
  isExpectedNotBeforeOrder,
  NoHtmlString,
  notInFutureDate,
  OwnershipNoteSchema,
  OwnershipOrderNumberSchema,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
  queryStringArray,
  ratingBound,
  RECENT_USED_LIMIT_DEFAULT,
  RECENT_USED_LIMIT_MAX,
  TrackingNumberSchema,
} from "./internal.js";
import {
  BookListViewSchema,
  ListFacetEntrySchema,
  ListGenreFacetSchema,
  NewListInputSchema,
} from "./lists.js";
import { LoanInfoViewSchema, LoanNoteSchema } from "./loans.js";
import { MediaViewSchema } from "./media.js";
import { validateOrderInvariant } from "./order-financials.js";
import { LOAN_REMINDER_LEAD_DAYS } from "./profile.js";
import { BookPublisherRefSchema } from "./publishers.js";
import { NewSeriesInputSchema, SeriesViewSchema } from "./series.js";
import { BookTagsInputSchema, TagViewSchema } from "./tags.js";
import { TaxonomyNameSchema } from "./taxonomy.js";
import { TRASH_PAGE_SIZE_DEFAULT, TrashDeletionResultSchema } from "./trash.js";

const BOOK_TITLE_MIN = 1;
export const BOOK_TITLE_MAX = 150;

export const BOOK_DESCRIPTION_MAX = 5000;

const BOOK_LIST_IDS_MAX = 50;
const BOOK_NEW_LISTS_MAX = 20;

const BOOK_PAGES_COUNT_MIN = 1;
const BOOK_PAGES_COUNT_MAX = 10000;
const BOOK_PUBLICATION_YEAR_MIN = 1000;
const BOOK_ORIGINAL_TITLE_MAX = 200;
const BOOK_CONTRIBUTOR_NAME_MAX = 100;
export const BOOK_DEDICATION_MAX = 2000;

const READING_CURRENT_PAGE_MIN = 0;
const READING_CURRENT_PAGE_MAX = 100000;
const READING_RATING_MIN = 0.5;
const READING_RATING_MAX = 10;
const READING_RATING_STEP = 0.5;
const READING_NOTE_MAX = 300;
const READING_IMPRESSION_MAX = 5000;

const ISBN_DIGITS_PATTERN = /^\d+$/;
const ISBN_10_LENGTH = 10;
const ISBN_13_LENGTH = 13;
const ISBN_10_CHECK_MODULUS = 11;
const ISBN_13_CHECK_MODULUS = 10;
const ISBN_13_ODD_WEIGHT = 1;
const ISBN_13_EVEN_WEIGHT = 3;

export const BookTitleSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(BOOK_TITLE_MIN, "Enter the book title").max(
      BOOK_TITLE_MAX,
      "Title must be at most 150 characters long",
    ),
  );

export const BookDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(BOOK_DESCRIPTION_MAX, "Description must be at most 5000 characters long"));

const isValidIsbn10 = (digits: string): boolean => {
  let sum = 0;
  for (let position = 0; position < ISBN_10_LENGTH; position += 1) {
    sum += Number(digits[position]) * (ISBN_10_LENGTH - position);
  }
  return sum % ISBN_10_CHECK_MODULUS === 0;
};

const isValidIsbn13 = (digits: string): boolean => {
  let sum = 0;
  for (let position = 0; position < ISBN_13_LENGTH; position += 1) {
    const weight = position % 2 === 0 ? ISBN_13_ODD_WEIGHT : ISBN_13_EVEN_WEIGHT;
    sum += Number(digits[position]) * weight;
  }
  return sum % ISBN_13_CHECK_MODULUS === 0;
};

export const isValidIsbn = (value: string): boolean => {
  if (!ISBN_DIGITS_PATTERN.test(value)) {
    return false;
  }
  if (value.length === ISBN_10_LENGTH) {
    return isValidIsbn10(value);
  }
  if (value.length === ISBN_13_LENGTH) {
    return isValidIsbn13(value);
  }
  return false;
};

export const BookPagesCountSchema = z
  .number()
  .int()
  .min(BOOK_PAGES_COUNT_MIN, "Pages must be greater than 0")
  .max(BOOK_PAGES_COUNT_MAX, "Pages must be at most 10000");

export const BookPublicationYearSchema = z
  .number()
  .int()
  .min(BOOK_PUBLICATION_YEAR_MIN, "Enter a valid publication year")
  .max(new Date().getUTCFullYear() + 1, "Enter a valid publication year");

export const IsbnSchema = z
  .string()
  .trim()
  .refine((value) => ISBN_DIGITS_PATTERN.test(value), "ISBN must contain digits only")
  .refine(isValidIsbn, "Enter a valid ISBN-10 or ISBN-13");

export const OriginalTitleSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_ORIGINAL_TITLE_MAX, "Original title must be at most 200 characters long"),
  );

export const TranslatorSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_CONTRIBUTOR_NAME_MAX, "Translator must be at most 100 characters long"),
  );

export const IllustratorSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.max(BOOK_CONTRIBUTOR_NAME_MAX, "Illustrator must be at most 100 characters long"),
  );

export const DedicationSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(BOOK_DEDICATION_MAX, "Dedication must be at most 2000 characters long"));

export const ReadingNoteSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(READING_NOTE_MAX, "Note must be at most 300 characters long"));

export const ReadingImpressionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(
    NoHtmlString.max(READING_IMPRESSION_MAX, "Impression must be at most 5000 characters long"),
  );

const ReadingCurrentPageSchema = z
  .number()
  .int()
  .min(READING_CURRENT_PAGE_MIN)
  .max(READING_CURRENT_PAGE_MAX);

const ReadingRatingSchema = z
  .number()
  .min(READING_RATING_MIN, "Rating must be from 0.5 to 10 in steps of 0.5")
  .max(READING_RATING_MAX, "Rating must be from 0.5 to 10 in steps of 0.5")
  .multipleOf(READING_RATING_STEP, "Rating must be from 0.5 to 10 in steps of 0.5");

export const ReadingProgressInputSchema = z
  .object({
    abandonedAt: notInFutureDate("Abandoned date must not be in the future").nullable().optional(),
    currentPage: ReadingCurrentPageSchema.nullable().optional(),
    finishedAt: notInFutureDate("Finished date must not be in the future").nullable().optional(),
    impression: ReadingImpressionSchema.nullable().optional(),
    note: ReadingNoteSchema.nullable().optional(),
    pausedAt: notInFutureDate("Paused date must not be in the future").nullable().optional(),
    rating: ReadingRatingSchema.nullable().optional(),
    startedAt: notInFutureDate("Start date must not be in the future").nullable().optional(),
  })
  .optional();

export const ChangeReadingStatusInputSchema = z.object({
  currentPage: ReadingCurrentPageSchema.optional(),
  date: notInFutureDate("Date must not be in the future").optional(),
  impression: ReadingImpressionSchema.nullable().optional(),
  note: ReadingNoteSchema.nullable().optional(),
  rating: ReadingRatingSchema.nullable().optional(),
  resetProgress: z.boolean().optional(),
  status: ReadingStatusSchema,
});

export const UpdateReadingProgressInputSchema = z.object({
  currentPage: ReadingCurrentPageSchema,
  markAsFinished: z.boolean().optional(),
  updateDate: notInFutureDate("Update date must not be in the future").optional(),
});

const OWNERSHIP_PERSON_NAME_MIN = 1;
export const OWNERSHIP_PERSON_NAME_MAX = 100;

export {
  OWNERSHIP_STORE_NAME_MAX,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
} from "./internal.js";

const OwnershipPersonNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(OWNERSHIP_PERSON_NAME_MIN, "Enter the person's name").max(
      OWNERSHIP_PERSON_NAME_MAX,
      "Name must be at most 100 characters long",
    ),
  );

const PurchaseInfoFieldsSchema = z.object({
  currency: CurrencySchema.nullable().optional(),
  expectedPrice: OwnershipPriceSchema.nullable().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  storeName: OwnershipStoreNameSchema.nullable().optional(),
  storeUrl: OwnershipStoreUrlSchema.nullable().optional(),
});

export const PurchaseInfoInputSchema = PurchaseInfoFieldsSchema.optional();

export type PurchaseInfoInput = z.infer<typeof PurchaseInfoInputSchema>;

export const MarkBoughtInputSchema = z.object({
  currency: CurrencySchema.nullable().optional(),
  expectedPrice: OwnershipPriceSchema.nullable().optional(),
  purchasedAt: notInFutureDate("Purchase date must not be in the future").optional(),
  storeName: OwnershipStoreNameSchema.nullable().optional(),
});

export type MarkBoughtInput = z.infer<typeof MarkBoughtInputSchema>;

export const DeliveryInfoInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
    deliveryService: DeliveryServiceSchema.nullable().optional(),
    deliveryStatus: ActiveShipmentStatusSchema.optional(),
    expectedDeliveryDate: z.iso.date().nullable().optional(),
    isFree: z.boolean().optional(),
    isShipped: z.boolean().optional(),
    note: OwnershipNoteSchema.nullable().optional(),
    orderDate: notInFutureDate("Order date must not be in the future").nullable().optional(),
    orderNumber: OwnershipOrderNumberSchema.nullable().optional(),
    price: OwnershipPriceSchema.nullable().optional(),
    storeName: OwnershipStoreNameSchema.nullable().optional(),
    trackingNumber: TrackingNumberSchema.nullable().optional(),
    trackingUrl: OwnershipStoreUrlSchema.nullable().optional(),
  })
  .refine(isExpectedNotBeforeOrder, {
    error: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
    path: ["expectedDeliveryDate"],
  })
  .optional();

export type DeliveryInfoInput = z.infer<typeof DeliveryInfoInputSchema>;

export const CreateDeliveryInputSchema = z
  .object({
    currency: CurrencySchema,
    deliveryService: DeliveryServiceSchema.optional(),
    expectedDeliveryDate: z.iso.date().optional(),
    isFree: z.boolean().default(false),
    note: OwnershipNoteSchema.optional(),
    orderDate: notInFutureDate("Order date must not be in the future"),
    orderNumber: OwnershipOrderNumberSchema.optional(),
    price: OwnershipPriceSchema.optional(),
    storeName: OwnershipStoreNameSchema,
    trackingNumber: TrackingNumberSchema.optional(),
    trackingUrl: OwnershipStoreUrlSchema.optional(),
  })
  .refine(isExpectedNotBeforeOrder, {
    error: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
    path: ["expectedDeliveryDate"],
  })
  .superRefine((delivery, context) => {
    const validation = validateOrderInvariant({
      currency: delivery.currency,
      isFree: delivery.isFree,
      itemPrices: [delivery.price ?? null],
    });
    if (validation.error !== null) {
      context.addIssue({ code: "custom", message: validation.error, path: ["price"] });
    }
  });

export type CreateDeliveryInput = z.infer<typeof CreateDeliveryInputSchema>;

export const UpdateDeliveryInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
    deliveryService: DeliveryServiceSchema.nullable().optional(),
    expectedDeliveryDate: z.iso.date().nullable().optional(),
    isFree: z.boolean().optional(),
    note: OwnershipNoteSchema.nullable().optional(),
    orderDate: notInFutureDate("Order date must not be in the future").nullable().optional(),
    orderNumber: OwnershipOrderNumberSchema.nullable().optional(),
    price: OwnershipPriceSchema.nullable().optional(),
    status: ActiveShipmentStatusSchema.optional(),
    storeName: OwnershipStoreNameSchema.nullable().optional(),
    trackingNumber: TrackingNumberSchema.nullable().optional(),
    trackingUrl: OwnershipStoreUrlSchema.nullable().optional(),
  })
  .refine(isExpectedNotBeforeOrder, {
    error: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
    path: ["expectedDeliveryDate"],
  });

export type UpdateDeliveryInput = z.infer<typeof UpdateDeliveryInputSchema>;

export const CancelDeliveryInputSchema = z.object({
  cancelReason: CancelReasonSchema.nullable().optional(),
  keepAsWantToBuy: z.boolean().default(true),
});

export type CancelDeliveryInput = z.infer<typeof CancelDeliveryInputSchema>;

export const ReceiveDeliveryInputSchema = z.object({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type ReceiveDeliveryInput = z.infer<typeof ReceiveDeliveryInputSchema>;

const RETURN_BEFORE_LOAN_MESSAGE = "Expected return cannot be before the loan date";
const REMINDER_NEEDS_RETURN_DATE_MESSAGE = "Select a return date for the reminder";

export const LOAN_QUICK_ACTIONS = {
  extendDays: [7, 14],
  reminderBeforeDays: [1, 3, 7],
} as const;

export const ExtendLoanInputSchema = z.object({
  days: z.literal([...LOAN_QUICK_ACTIONS.extendDays]),
});

export type ExtendLoanInput = z.infer<typeof ExtendLoanInputSchema>;

export const SetLoanReminderInputSchema = z.object({
  remindBeforeDays: z
    .number()
    .int()
    .min(LOAN_REMINDER_LEAD_DAYS.min)
    .max(LOAN_REMINDER_LEAD_DAYS.max)
    .nullable(),
});

export type SetLoanReminderInput = z.infer<typeof SetLoanReminderInputSchema>;

const isReturnNotBeforeLoan = (value: {
  expectedReturnDate?: Nullable<string>;
  loanDate?: Nullable<string>;
}): boolean =>
  value.loanDate === undefined ||
  value.loanDate === null ||
  value.expectedReturnDate === undefined ||
  value.expectedReturnDate === null ||
  value.expectedReturnDate >= value.loanDate;

export const LOAN_PERSON_REQUIRED_MESSAGE = "Enter the person's name";

export function hasLoanPersonIdentity(value: {
  loanContactId?: string;
  personName?: string;
}): boolean {
  return value.loanContactId !== undefined || (value.personName ?? "").length > 0;
}

const LoanInfoFieldsSchema = z.object({
  expectedReturnDate: z.iso.date().nullable().optional(),
  loanContactId: z.uuid().optional(),
  loanDate: notInFutureDate("Loan date must not be in the future").nullable().optional(),
  note: LoanNoteSchema.nullable().optional(),
  personName: OwnershipPersonNameSchema.optional(),
});

export const LoanInfoInputSchema = LoanInfoFieldsSchema.refine(isReturnNotBeforeLoan, {
  error: RETURN_BEFORE_LOAN_MESSAGE,
  path: ["expectedReturnDate"],
}).optional();

export type LoanInfoInput = z.infer<typeof LoanInfoInputSchema>;

export const CreateLoanInputSchema = z
  .object({
    direction: LoanDirectionSchema,
    expectedReturnDate: z.iso.date().nullable().optional(),
    loanContactId: z.uuid().optional(),
    loanDate: notInFutureDate("Loan date must not be in the future"),
    note: LoanNoteSchema.nullable().optional(),
    personName: OwnershipPersonNameSchema.optional(),
    remindToReturn: z.boolean().optional(),
  })
  .refine(isReturnNotBeforeLoan, {
    error: RETURN_BEFORE_LOAN_MESSAGE,
    path: ["expectedReturnDate"],
  })
  .refine(hasLoanPersonIdentity, {
    error: LOAN_PERSON_REQUIRED_MESSAGE,
    path: ["personName"],
  })
  .refine(
    (value) =>
      value.remindToReturn !== true ||
      (value.expectedReturnDate !== undefined && value.expectedReturnDate !== null),
    {
      error: REMINDER_NEEDS_RETURN_DATE_MESSAGE,
      path: ["expectedReturnDate"],
    },
  );

export type CreateLoanInput = z.infer<typeof CreateLoanInputSchema>;

export const UpdateLoanInputSchema = z
  .object({
    expectedReturnDate: z.iso.date().nullable().optional(),
    loanContactId: z.uuid().optional(),
    loanDate: notInFutureDate("Loan date must not be in the future").nullable().optional(),
    note: LoanNoteSchema.nullable().optional(),
    personName: OwnershipPersonNameSchema.optional(),
    remindToReturn: z.boolean().optional(),
  })
  .refine(isReturnNotBeforeLoan, {
    error: RETURN_BEFORE_LOAN_MESSAGE,
    path: ["expectedReturnDate"],
  })
  .refine(hasLoanPersonIdentity, {
    error: LOAN_PERSON_REQUIRED_MESSAGE,
    path: ["personName"],
  })
  .refine(
    (value) =>
      value.remindToReturn !== true ||
      (value.expectedReturnDate !== undefined && value.expectedReturnDate !== null),
    {
      error: REMINDER_NEEDS_RETURN_DATE_MESSAGE,
      path: ["expectedReturnDate"],
    },
  );

export type UpdateLoanInput = z.infer<typeof UpdateLoanInputSchema>;

export const LOAN_BATCH_MAX = LIST_PAGE_SIZE_MAX;

export const CreateLoansBatchInputSchema = z
  .object({
    bookIds: z.array(z.uuid()).min(1).max(LOAN_BATCH_MAX),
    direction: LoanDirectionSchema,
    expectedReturnDate: z.iso.date().nullable().optional(),
    loanContactId: z.uuid(),
    loanDate: notInFutureDate("Loan date must not be in the future"),
    note: LoanNoteSchema.nullable().optional(),
    remindToReturn: z.boolean().optional(),
  })
  .refine(isReturnNotBeforeLoan, {
    error: RETURN_BEFORE_LOAN_MESSAGE,
    path: ["expectedReturnDate"],
  })
  .refine(
    (value) =>
      value.remindToReturn !== true ||
      (value.expectedReturnDate !== undefined && value.expectedReturnDate !== null),
    {
      error: REMINDER_NEEDS_RETURN_DATE_MESSAGE,
      path: ["expectedReturnDate"],
    },
  );

export type CreateLoansBatchInput = z.infer<typeof CreateLoansBatchInputSchema>;

export const CreateLoansBatchResultSchema = z.object({
  createdBookIds: z.array(z.uuid()),
});

export type CreateLoansBatchResult = z.infer<typeof CreateLoansBatchResultSchema>;

export const LOAN_BATCH_CONFLICT_CODE = "BATCH_LOAN_CONFLICT";

export const LoanBatchConflictReasonSchema = z.enum([
  "active_loan_exists",
  "book_not_found",
  "borrow_requires_available_ownership",
  "lend_requires_owned",
]);

export type LoanBatchConflictReason = z.infer<typeof LoanBatchConflictReasonSchema>;

export const LoanBatchConflictDetailsSchema = z.object({
  conflicts: z.array(z.object({ bookId: z.uuid(), reason: LoanBatchConflictReasonSchema })).min(1),
});

export type LoanBatchConflictDetails = z.infer<typeof LoanBatchConflictDetailsSchema>;

export const LOAN_ERROR_CODES = {
  activeLoanExists: "LOAN_ACTIVE_EXISTS",
  bookNotFound: "LOAN_BOOK_NOT_FOUND",
  borrowRequiresFreeBook: "LOAN_BORROW_REQUIRES_FREE_BOOK",
  extendRequiresReturnDate: "LOAN_EXTEND_REQUIRES_RETURN_DATE",
  lendRequiresOwned: "LOAN_LEND_REQUIRES_OWNED",
  loanNotFound: "LOAN_NOT_FOUND",
  reminderRequiresReturnDate: "LOAN_REMINDER_REQUIRES_RETURN_DATE",
  returnRequiresLoan: "LOAN_RETURN_REQUIRES_LOAN",
} as const;

export type LoanErrorCode = ValueOf<typeof LOAN_ERROR_CODES>;

export const BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE =
  "Part number can't be greater than the total books in the series";

export const BOOK_SERIES_PART_NUMBER_TAKEN_CODE = "book_series_part_number_taken";

export const BOOK_SERIES_REQUIRED_MESSAGE = "Choose an existing series or create a new one";

export const CreateBookInputSchema = z
  .object({
    addToReadingQueue: z.boolean().default(false),
    ageCategory: AgeCategorySchema.default("not_specified"),
    authors: BookAuthorsInputSchema,
    bookType: BookTypeSchema.default("solo"),
    coverMediaId: z.uuid().nullable().optional(),
    dedication: DedicationSchema.nullable().optional(),
    deliveryInfo: DeliveryInfoInputSchema,
    description: BookDescriptionSchema.nullable().optional(),
    formats: BookFormatsSchema.default([]),
    genres: BookGenresSchema.default([]),
    illustrator: IllustratorSchema.nullable().optional(),
    isbn: IsbnSchema.nullable().optional(),
    isFavorite: z.boolean().default(false),
    language: BookLanguageSchema.default("ukrainian"),
    listIds: z.array(z.uuid()).max(BOOK_LIST_IDS_MAX).optional(),
    loanInfo: LoanInfoInputSchema,
    newLists: z.array(NewListInputSchema).max(BOOK_NEW_LISTS_MAX).optional(),
    newSeries: NewSeriesInputSchema.optional(),
    originalTitle: OriginalTitleSchema.nullable().optional(),
    ownershipStatus: OwnershipStatusSchema.default("none"),
    pagesCount: BookPagesCountSchema.nullable().optional(),
    partNumber: BookPartNumberSchema.optional(),
    publicationYear: BookPublicationYearSchema.nullable().optional(),
    publisherId: z.uuid().optional(),
    publisherName: TaxonomyNameSchema.optional(),
    purchaseInfo: PurchaseInfoInputSchema,
    queuePriority: QueuePrioritySchema.optional(),
    queuePriorityReason: QueuePriorityReasonSchema.nullable().optional(),
    queuePriorityReasonCustomText: z
      .string()
      .max(QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX)
      .nullable()
      .optional(),
    queuePriorityTargetDate: z.iso.date().nullable().optional(),
    readingProgress: ReadingProgressInputSchema,
    readingStatus: ReadingStatusSchema.default("not_started"),
    seriesId: z.uuid().optional(),
    tags: BookTagsInputSchema.default([]),
    title: BookTitleSchema,
    translator: TranslatorSchema.nullable().optional(),
  })
  .refine((value) => !(value.publisherId !== undefined && value.publisherName !== undefined), {
    error: "Provide either an existing publisher or a custom publisher name",
    path: ["publisherName"],
  })
  .superRefine((value, context) => {
    const currentPage = value.readingProgress?.currentPage;
    const pagesCount = value.pagesCount;
    if (
      currentPage !== undefined &&
      currentPage !== null &&
      pagesCount !== undefined &&
      pagesCount !== null &&
      currentPage > pagesCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Current page cannot exceed the page count",
        path: ["readingProgress", "currentPage"],
      });
    }

    if (
      ownershipStatusUsesLoan(value.ownershipStatus) &&
      !hasLoanPersonIdentity(value.loanInfo ?? {})
    ) {
      context.addIssue({
        code: "custom",
        message: LOAN_PERSON_REQUIRED_MESSAGE,
        path: ["loanInfo", "personName"],
      });
    }

    if (value.bookType === "series_part") {
      const hasExistingSeries = value.seriesId !== undefined;
      const hasNewSeries = value.newSeries !== undefined;
      if (hasExistingSeries === hasNewSeries) {
        context.addIssue({
          code: "custom",
          message: BOOK_SERIES_REQUIRED_MESSAGE,
          path: ["newSeries"],
        });
      }

      if (value.partNumber === undefined) {
        context.addIssue({
          code: "custom",
          message: "Enter the part number",
          path: ["partNumber"],
        });
      }

      const totalBooks = value.newSeries?.totalBooks;
      if (
        totalBooks !== undefined &&
        value.partNumber !== undefined &&
        totalBooks < value.partNumber
      ) {
        context.addIssue({
          code: "custom",
          message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
          path: ["partNumber"],
        });
      }
    }
  });

export const UpdateBookInputSchema = z
  .object({
    addToReadingQueue: z.boolean().optional(),
    ageCategory: AgeCategorySchema.optional(),
    authors: BookAuthorsInputSchema.optional(),
    bookType: BookTypeSchema.optional(),
    coverMediaId: z.uuid().nullable().optional(),
    dedication: DedicationSchema.nullable().optional(),
    deliveryInfo: DeliveryInfoInputSchema,
    description: BookDescriptionSchema.nullable().optional(),
    formats: BookFormatsSchema.optional(),
    genres: BookGenresSchema.optional(),
    illustrator: IllustratorSchema.nullable().optional(),
    isbn: IsbnSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    isFavoriteDedication: z.boolean().optional(),
    language: BookLanguageSchema.optional(),
    listIds: z.array(z.uuid()).max(BOOK_LIST_IDS_MAX).optional(),
    loanInfo: LoanInfoInputSchema,
    newLists: z.array(NewListInputSchema).max(BOOK_NEW_LISTS_MAX).optional(),
    newSeries: NewSeriesInputSchema.optional(),
    originalTitle: OriginalTitleSchema.nullable().optional(),
    ownershipStatus: OwnershipStatusSchema.optional(),
    pagesCount: BookPagesCountSchema.nullable().optional(),
    partNumber: BookPartNumberSchema.optional(),
    publicationYear: BookPublicationYearSchema.nullable().optional(),
    publisherId: z.uuid().optional(),
    publisherName: TaxonomyNameSchema.optional(),
    purchaseInfo: PurchaseInfoInputSchema,
    queuePriority: QueuePrioritySchema.optional(),
    queuePriorityReason: QueuePriorityReasonSchema.nullable().optional(),
    queuePriorityReasonCustomText: z
      .string()
      .max(QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX)
      .nullable()
      .optional(),
    queuePriorityTargetDate: z.iso.date().nullable().optional(),
    readingProgress: ReadingProgressInputSchema,
    readingStatus: ReadingStatusSchema.optional(),
    seriesId: z.uuid().optional(),
    tags: BookTagsInputSchema.optional(),
    title: BookTitleSchema.optional(),
    translator: TranslatorSchema.nullable().optional(),
  })
  .refine((value) => !(value.publisherId !== undefined && value.publisherName !== undefined), {
    error: "Provide either an existing publisher or a custom publisher name",
    path: ["publisherName"],
  })
  .superRefine((value, context) => {
    const currentPage = value.readingProgress?.currentPage;
    const pagesCount = value.pagesCount;
    if (
      currentPage !== undefined &&
      currentPage !== null &&
      pagesCount !== undefined &&
      pagesCount !== null &&
      currentPage > pagesCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Current page cannot exceed the page count",
        path: ["readingProgress", "currentPage"],
      });
    }

    if (value.bookType === "series_part") {
      const hasExistingSeries = value.seriesId !== undefined;
      const hasNewSeries = value.newSeries !== undefined;
      if (hasExistingSeries === hasNewSeries) {
        context.addIssue({
          code: "custom",
          message: BOOK_SERIES_REQUIRED_MESSAGE,
          path: ["newSeries"],
        });
      }

      if (value.partNumber === undefined) {
        context.addIssue({
          code: "custom",
          message: "Enter the part number",
          path: ["partNumber"],
        });
      }

      const totalBooks = value.newSeries?.totalBooks;
      if (
        totalBooks !== undefined &&
        value.partNumber !== undefined &&
        totalBooks < value.partNumber
      ) {
        context.addIssue({
          code: "custom",
          message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
          path: ["partNumber"],
        });
      }
    }
  });

export type UpdateBookInput = z.infer<typeof UpdateBookInputSchema>;

const BULK_BOOK_IDS_MAX = LIST_PAGE_SIZE_MAX;

export const BulkBookIdsSchema = z.object({
  bookIds: z.array(z.uuid()).min(1).max(BULK_BOOK_IDS_MAX),
});

export type BulkBookIds = z.infer<typeof BulkBookIdsSchema>;

export const BulkFavoriteInputSchema = BulkBookIdsSchema.extend({
  isFavorite: z.boolean(),
});

export type BulkFavoriteInput = z.infer<typeof BulkFavoriteInputSchema>;

export const BulkReadingStatusInputSchema = BulkBookIdsSchema.extend({
  readingStatus: ReadingStatusSchema,
});

export type BulkReadingStatusInput = z.infer<typeof BulkReadingStatusInputSchema>;

export const BulkOwnershipStatusInputSchema = BulkBookIdsSchema.extend({
  ownershipStatus: OwnershipStatusSchema,
});

export type BulkOwnershipStatusInput = z.infer<typeof BulkOwnershipStatusInputSchema>;

export const BulkTagsInputSchema = BulkBookIdsSchema.extend({
  tags: BookTagsInputSchema,
});

export type BulkTagsInput = z.infer<typeof BulkTagsInputSchema>;

export const BulkListsInputSchema = BulkBookIdsSchema.extend({
  listIds: z.array(z.uuid()).max(BOOK_LIST_IDS_MAX).optional(),
  newLists: z.array(NewListInputSchema).max(BOOK_NEW_LISTS_MAX).optional(),
});

export type BulkListsInput = z.infer<typeof BulkListsInputSchema>;

export const BulkActionResultSchema = z.object({
  affected: z.number().int().nonnegative(),
});

export type BulkActionResult = z.infer<typeof BulkActionResultSchema>;

export const QUEUE_VOLUME_BULK_MAX = 200;

export const UpdatePagesCountItemSchema = z.discriminatedUnion("kind", [
  z.object({
    bookId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime(),
    kind: z.literal("pages_count"),
    pagesCount: BookPagesCountSchema,
  }),
  z.object({
    bookId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime(),
    kind: z.literal("pages_count_unavailable"),
  }),
]);

export type UpdatePagesCountItem = z.infer<typeof UpdatePagesCountItemSchema>;

export const BulkPagesCountInputSchema = z.object({
  items: z.array(UpdatePagesCountItemSchema).min(1).max(QUEUE_VOLUME_BULK_MAX),
});

export type BulkPagesCountInput = z.infer<typeof BulkPagesCountInputSchema>;

export const BulkPagesCountFailureReasonSchema = z.enum([
  "below_current_page",
  "not_found",
  "stale",
]);

export type BulkPagesCountFailureReason = z.infer<typeof BulkPagesCountFailureReasonSchema>;

export const BulkPagesCountResultSchema = z.object({
  failed: z.array(z.object({ bookId: z.uuid(), reason: BulkPagesCountFailureReasonSchema })),
  updated: z.array(z.uuid()),
});

export type BulkPagesCountResult = z.infer<typeof BulkPagesCountResultSchema>;

export type ChangeReadingStatusInput = z.infer<typeof ChangeReadingStatusInputSchema>;

export type CreateBookInput = z.infer<typeof CreateBookInputSchema>;

export type ReadingProgressInput = z.infer<typeof ReadingProgressInputSchema>;

export type UpdateReadingProgressInput = z.infer<typeof UpdateReadingProgressInputSchema>;

const LIBRARY_PAGE_SIZE_DEFAULT = 24;
export const LIBRARY_SEARCH_MAX = 200;

export const LibrarySortSchema = z.enum([
  "created_desc",
  "created_asc",
  "updated_desc",
  "favorite_added_desc",
  "favorite_added_asc",
  "title_asc",
  "title_desc",
  "author_asc",
  "author_desc",
  "rating_desc",
  "rating_asc",
  "year_desc",
  "year_asc",
  "pages_desc",
  "pages_asc",
]);

export type LibrarySort = z.infer<typeof LibrarySortSchema>;

export const PublisherPresenceSchema = z.enum(["all", "assigned", "missing"]);

export type PublisherPresence = z.infer<typeof PublisherPresenceSchema>;

export const LibraryBooksQuerySchema = z
  .object({
    ageCategory: queryStringArray(AgeCategorySchema),
    author: queryStringArray(z.uuid()),
    bookType: BookTypeSchema.optional(),
    format: queryStringArray(BookFormatSchema),
    genre: queryStringArray(GenreKeySchema),
    hasActiveOrder: z.stringbool().optional(),
    hasCover: z.stringbool().optional(),
    hasDedication: z.stringbool().optional(),
    hasRating: z.stringbool().optional(),
    inQueue: z.stringbool().optional(),
    isFavorite: z.stringbool().optional(),
    language: queryStringArray(BookLanguageSchema),
    notInList: z.uuid().optional(),
    owner: queryStringArray(OwnershipStatusSchema),
    ...paginationQueryFields({ pageSizeDefault: LIBRARY_PAGE_SIZE_DEFAULT }),
    pagesMax: z.coerce.number().int().optional(),
    pagesMin: z.coerce.number().int().optional(),
    publisher: queryStringArray(z.uuid()),
    publisherPresence: PublisherPresenceSchema.optional(),
    q: z.string().max(LIBRARY_SEARCH_MAX).optional(),
    ratingMax: ratingBound().optional(),
    ratingMin: ratingBound().optional(),
    sort: LibrarySortSchema.default("created_desc"),
    status: queryStringArray(ReadingStatusSchema),
    tag: queryStringArray(z.uuid()),
    yearMax: z.coerce.number().int().optional(),
    yearMin: z.coerce.number().int().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.ratingMin !== undefined &&
      value.ratingMax !== undefined &&
      value.ratingMin > value.ratingMax
    ) {
      context.addIssue({
        code: "custom",
        message: "ratingMin must not exceed ratingMax",
        path: ["ratingMin"],
      });
    }

    if (
      value.yearMin !== undefined &&
      value.yearMax !== undefined &&
      value.yearMin > value.yearMax
    ) {
      context.addIssue({
        code: "custom",
        message: "yearMin must not exceed yearMax",
        path: ["yearMin"],
      });
    }

    if (
      value.pagesMin !== undefined &&
      value.pagesMax !== undefined &&
      value.pagesMin > value.pagesMax
    ) {
      context.addIssue({
        code: "custom",
        message: "pagesMin must not exceed pagesMax",
        path: ["pagesMin"],
      });
    }
  });

export type LibraryBooksQuery = z.infer<typeof LibraryBooksQuerySchema>;

export const LibraryOverviewQuerySchema = z.object({
  owner: queryStringArray(OwnershipStatusSchema),
});

export type LibraryOverviewQuery = z.infer<typeof LibraryOverviewQuerySchema>;

export const RecentPurchaseStoresQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
});

export type RecentPurchaseStores = string[];

export type RecentPurchaseStoresQuery = z.infer<typeof RecentPurchaseStoresQuerySchema>;

export const PurchaseInfoViewSchema = z.object({
  currency: CurrencySchema.nullable(),
  expectedPrice: z.number().nullable(),
  note: z.string().nullable(),
  purchasedAt: z.string().nullable(),
  storeName: z.string().nullable(),
  storeUrl: z.string().nullable(),
});

export type PurchaseInfoView = z.infer<typeof PurchaseInfoViewSchema>;

export const ReadingProgressViewSchema = z.object({
  abandonedAt: z.string().nullable(),
  currentPage: z.number().nullable(),
  finishedAt: z.string().nullable(),
  impression: z.string().nullable(),
  lastProgressUpdateAt: z.string().nullable(),
  note: z.string().nullable(),
  pausedAt: z.string().nullable(),
  rating: z.number().nullable(),
  startedAt: z.string().nullable(),
});

export type ReadingProgressView = z.infer<typeof ReadingProgressViewSchema>;

export const READING_HISTORY_DAYS_LIMIT_DEFAULT = 20;
export const READING_HISTORY_DAYS_LIMIT_MAX = 100;

export const ReadingActivityRangeSchema = z.enum(["7d", "14d", "all"]);

export type ReadingActivityRange = z.infer<typeof ReadingActivityRangeSchema>;

export const ReadingHistorySortSchema = z.enum(["asc", "desc"]);

export type ReadingHistorySort = z.infer<typeof ReadingHistorySortSchema>;

export const ReadingHistoryQuerySchema = z.object({
  activityRange: ReadingActivityRangeSchema.default("7d"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(READING_HISTORY_DAYS_LIMIT_MAX)
    .default(READING_HISTORY_DAYS_LIMIT_DEFAULT),
  page: z.coerce.number().int().min(1).default(1),
  sort: ReadingHistorySortSchema.default("desc"),
});

export type ReadingHistoryQuery = z.infer<typeof ReadingHistoryQuerySchema>;

export const ReadingHistoryEventViewSchema = z.object({
  date: z.string(),
  id: z.string(),
  page: z.number(),
  pagesRead: z.number(),
  recordedAt: z.string(),
});

export type ReadingHistoryEventView = z.infer<typeof ReadingHistoryEventViewSchema>;

export const ReadingDaySummaryViewSchema = z.object({
  date: z.string(),
  finalPage: z.number().nullable(),
  pagesRead: z.number(),
  updatesCount: z.number(),
});

export type ReadingDaySummaryView = z.infer<typeof ReadingDaySummaryViewSchema>;

export const ReadingHistorySummaryViewSchema = z.object({
  abandonedAt: z.string().nullable(),
  activeDaysCount: z.number(),
  averagePagesPerActiveDay: z.number().nullable(),
  bestDay: ReadingDaySummaryViewSchema.nullable(),
  currentPage: z.number(),
  estimatedActiveDaysRemaining: z.number().nullable(),
  finishedAt: z.string().nullable(),
  historyCompleteness: z.object({
    isComplete: z.boolean(),
    untrackedPages: z.number(),
  }),
  lastActivity: ReadingDaySummaryViewSchema.nullable(),
  lastProgressUpdateAt: z.string().nullable(),
  pagesCount: z.number().nullable(),
  pagesRemaining: z.number().nullable(),
  pausedAt: z.string().nullable(),
  progressPercent: z.number().nullable(),
  readingPeriod: z.object({
    calendarDays: z.number().nullable(),
    endDate: z.string().nullable(),
    startDate: z.string().nullable(),
  }),
  startedAt: z.string().nullable(),
  status: ReadingStatusSchema,
  trackedPagesRead: z.number(),
  updatesCount: z.number(),
});

export type ReadingHistorySummaryView = z.infer<typeof ReadingHistorySummaryViewSchema>;

export const ReadingActivityPointViewSchema = z.object({
  date: z.string(),
  finalPage: z.number().nullable(),
  hasActivity: z.boolean(),
  pagesRead: z.number(),
  startPage: z.number().nullable(),
  updatesCount: z.number(),
});

export type ReadingActivityPointView = z.infer<typeof ReadingActivityPointViewSchema>;

export const ReadingActivityViewSchema = z.object({
  from: z.string().nullable(),
  points: z.array(ReadingActivityPointViewSchema),
  range: ReadingActivityRangeSchema,
  summary: z.object({
    activeDaysCount: z.number(),
    averagePagesPerActiveDay: z.number().nullable(),
    bestDay: ReadingDaySummaryViewSchema.nullable(),
    pagesRead: z.number(),
    updatesCount: z.number(),
  }),
  to: z.string().nullable(),
});

export type ReadingActivityView = z.infer<typeof ReadingActivityViewSchema>;

export const ReadingHistoryDayViewSchema = z.object({
  date: z.string(),
  events: z.array(ReadingHistoryEventViewSchema),
  finalPage: z.number(),
  pagesRead: z.number(),
  startPage: z.number(),
  updatesCount: z.number(),
});

export type ReadingHistoryDayView = z.infer<typeof ReadingHistoryDayViewSchema>;

export const ReadingHistoryPaginationViewSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  limit: z.number(),
  page: z.number(),
  totalDays: z.number(),
  totalPages: z.number(),
});

export type ReadingHistoryPaginationView = z.infer<typeof ReadingHistoryPaginationViewSchema>;

export const ReadingHistoryViewSchema = z.object({
  activity: ReadingActivityViewSchema,
  history: z.object({
    days: z.array(ReadingHistoryDayViewSchema),
    pagination: ReadingHistoryPaginationViewSchema,
  }),
  summary: ReadingHistorySummaryViewSchema,
});

export type ReadingHistoryView = z.infer<typeof ReadingHistoryViewSchema>;

export const BookViewSchema = z.object({
  ageCategory: AgeCategorySchema,
  authors: z.array(BookAuthorRefSchema),
  bookType: BookTypeSchema,
  cover: MediaViewSchema.nullable().optional(),
  createdAt: z.string(),
  dedication: z.string().nullable(),
  delivery: DeliverySummaryViewSchema,
  description: z.string().nullable(),
  favoriteAddedAt: z.string().nullable(),
  formats: z.array(BookFormatSchema),
  genres: z.array(z.string()),
  hasUnreadEarlierSeriesParts: z.boolean().nullable(),
  id: z.string(),
  illustrator: z.string().nullable(),
  isbn: z.string().nullable(),
  isFavorite: z.boolean(),
  isFavoriteDedication: z.boolean(),
  isInReadingQueue: z.boolean(),
  language: BookLanguageSchema,
  lists: z.array(BookListViewSchema),
  loanInfo: LoanInfoViewSchema.nullable(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  pagesCount: z.number().nullable(),
  pagesCountUnavailable: z.boolean(),
  partNumber: z.number().nullable(),
  publicationYear: z.number().nullable(),
  publisher: BookPublisherRefSchema.nullable(),
  purchaseInfo: PurchaseInfoViewSchema.nullable(),
  queuePriority: QueuePrioritySchema.nullable(),
  queuePriorityReason: QueuePriorityReasonSchema.nullable(),
  queuePriorityReasonCustomText: z.string().nullable(),
  queuePriorityTargetDate: z.iso.date().nullable(),
  readingProgress: ReadingProgressViewSchema.nullable(),
  readingStatus: ReadingStatusSchema,
  series: SeriesViewSchema.nullable(),
  tags: z.array(TagViewSchema),
  title: z.string(),
  translator: z.string().nullable(),
  updatedAt: z.string(),
  userId: z.string(),
  wishlistAddedAt: z.string().nullable(),
});

export type BookView = z.infer<typeof BookViewSchema>;

export const LibraryOverviewViewSchema = z.object({
  activeReading: z
    .object({
      book: z
        .object({
          currentPage: z.number(),
          id: z.string(),
          pagesCount: z.number(),
          title: z.string(),
        })
        .nullable(),
      pagesAhead: z.number(),
    })
    .optional(),
  recentlyAdded: z.array(BookViewSchema),
  summary: z.object({
    authorsCount: z.number().optional(),
    borrowed: z.number(),
    favorites: z.number(),
    finished: z.number(),
    inTransit: z.number(),
    physicallyAvailable: z.number().optional(),
    reading: z.number(),
    series: z.number(),
    seriesCount: z.number().optional(),
    solo: z.number(),
    total: z.number(),
    wantToBuy: z.number(),
    wantToRead: z.number(),
  }),
  topGenres: z.array(
    z.object({
      count: z.number(),
      key: z.string(),
      name: z.string(),
    }),
  ),
  topTags: z.array(
    z.object({
      count: z.number(),
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type LibraryOverviewView = z.infer<typeof LibraryOverviewViewSchema>;

export const FavoritesSummaryViewSchema = z.object({
  averageRating: z.number().nullable(),
  finished: z.number(),
  reading: z.number(),
  series: z.number(),
  solo: z.number(),
  topGenres: z.array(z.object({ count: z.number().int().nonnegative(), genre: z.string() })),
  topTags: z.array(z.object({ count: z.number().int().nonnegative(), tag: z.string() })),
  total: z.number(),
  unrated: z
    .number()
    .int()
    .nonnegative()
    .describe("Count of finished favorite books without a rating"),
  wantToRead: z.number(),
});

export type FavoritesSummaryView = z.infer<typeof FavoritesSummaryViewSchema>;

export const PaginatedBooksSchema = createPaginatedSchema(BookViewSchema);

export const ListBookViewSchema = BookViewSchema.extend({ position: z.number() });

export type ListBookView = z.infer<typeof ListBookViewSchema>;

export const BookDeletionResultSchema = TrashDeletionResultSchema.extend({
  bookId: z.string(),
});

export type BookDeletionResult = z.infer<typeof BookDeletionResultSchema>;

export const TrashedBookViewSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  deletedAt: z.iso.datetime(),
  id: z.string(),
  purgeAt: z.iso.datetime(),
  seriesTitle: z.string().nullable(),
  title: z.string(),
});

export type TrashedBookView = z.infer<typeof TrashedBookViewSchema>;

export const TrashedBooksQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashedBooksQuery = z.infer<typeof TrashedBooksQuerySchema>;

export const PaginatedTrashedBooksSchema = createPaginatedSchema(TrashedBookViewSchema);

export type PaginatedTrashedBooks = z.infer<typeof PaginatedTrashedBooksSchema>;

export const CustomListDetailSchema = z.object({
  bookCount: z.number(),
  books: createPaginatedSchema(ListBookViewSchema),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  previewCovers: z.array(MediaViewSchema),
  quickCounts: z.object({
    all: z.number().int().nonnegative(),
    favorites: z.number().int().nonnegative(),
    finished: z.number().int().nonnegative(),
    in_queue: z.number().int().nonnegative(),
    not_started: z.number().int().nonnegative(),
    reading: z.number().int().nonnegative(),
    series: z.number().int().nonnegative(),
  }),
  updatedAt: z.string(),
});

export type CustomListDetail = z.infer<typeof CustomListDetailSchema>;

export const ListOverviewViewSchema = z.object({
  currentlyReading: z
    .object({
      book: ListBookViewSchema,
      othersCount: z.number().int().nonnegative(),
    })
    .nullable(),
  distinctAuthorsCount: z.number().int().nonnegative(),
  finishedCount: z.number().int().nonnegative(),
  genresCount: z.number().int().nonnegative(),
  inQueueCount: z.number().int().nonnegative(),
  ownedCount: z.number().int().nonnegative(),
  pagesKnownCount: z.number().int().nonnegative(),
  seriesCount: z.number().int().nonnegative(),
  soloCount: z.number().int().nonnegative(),
  topGenres: z.array(ListGenreFacetSchema),
  totalBooks: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type ListOverviewView = z.infer<typeof ListOverviewViewSchema>;

export const BookFacetScopeSchema = z.enum([
  "all",
  "favorites",
  "my",
  "queue",
  "series",
  "wishlist",
]);

export type BookFacetScope = z.infer<typeof BookFacetScopeSchema>;

export const BookFacetsQuerySchema = z.object({
  q: z.string().trim().min(1).max(LIBRARY_SEARCH_MAX).optional(),
  scope: BookFacetScopeSchema,
});

export type BookFacetsQuery = z.infer<typeof BookFacetsQuerySchema>;

export const BookFacetsViewSchema = z.object({
  authors: z.array(ListFacetEntrySchema),
  genres: z.array(ListGenreFacetSchema),
});

export type BookFacetsView = z.infer<typeof BookFacetsViewSchema>;

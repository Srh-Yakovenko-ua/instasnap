import { z } from "zod";

import { collapseSpaces, createPaginatedSchema, paginationQueryFields } from "./common.js";
import { NoHtmlString } from "./internal.js";

const LOAN_CONTACT_NAME = {
  max: 100,
  min: 1,
} as const;

const LOAN_CONTACT_CONTACT_MAX = 100;

const LOAN_CONTACT_SEARCH_MAX = 100;

const LOAN_CONTACT_PAGE_SIZE_DEFAULT = 20;

const LoanContactNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(LOAN_CONTACT_NAME.min, "Enter the person's name").max(
      LOAN_CONTACT_NAME.max,
      "Name must be at most 100 characters long",
    ),
  );

const LoanContactContactSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(NoHtmlString.max(LOAN_CONTACT_CONTACT_MAX, "Contact must be at most 100 characters long"));

export const LoanContactViewSchema = z.object({
  archivedAt: z.string().nullable(),
  contact: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  loanCount: z.number().int().nonnegative(),
  name: z.string(),
  updatedAt: z.string(),
});

export type LoanContactView = z.infer<typeof LoanContactViewSchema>;

export const LoanContactCountsSchema = z.object({
  active: z.number().int().nonnegative(),
  all: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
});

export type LoanContactCounts = z.infer<typeof LoanContactCountsSchema>;

export const LoanContactListItemViewSchema = LoanContactViewSchema.extend({
  activeBorrowedCount: z.number().int().nonnegative(),
  activeLentCount: z.number().int().nonnegative(),
});

export type LoanContactListItemView = z.infer<typeof LoanContactListItemViewSchema>;

export const LoanContactsViewSchema = createPaginatedSchema(LoanContactListItemViewSchema).extend({
  counts: LoanContactCountsSchema,
});

export type LoanContactsView = z.infer<typeof LoanContactsViewSchema>;

export const LoanContactStatusSchema = z.enum(["all", "active", "archived"]);

export type LoanContactStatus = z.infer<typeof LoanContactStatusSchema>;

export const LoanContactsQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: LOAN_CONTACT_PAGE_SIZE_DEFAULT }),
  search: z.string().trim().max(LOAN_CONTACT_SEARCH_MAX).optional(),
  status: LoanContactStatusSchema.default("active"),
});

export type LoanContactsQuery = z.infer<typeof LoanContactsQuerySchema>;

export const LoanContactByNameQuerySchema = z.object({ name: LoanContactNameSchema });

export type LoanContactByNameQuery = z.infer<typeof LoanContactByNameQuerySchema>;

export const CreateLoanContactInputSchema = z.strictObject({
  contact: LoanContactContactSchema.nullable().optional(),
  name: LoanContactNameSchema,
});

export type CreateLoanContactInput = z.infer<typeof CreateLoanContactInputSchema>;

const EMPTY_UPDATE_MESSAGE = "Provide a name or a contact to update";

export const UpdateLoanContactInputSchema = z
  .strictObject({
    contact: LoanContactContactSchema.nullable().optional(),
    name: LoanContactNameSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.contact !== undefined, {
    error: EMPTY_UPDATE_MESSAGE,
    path: ["name"],
  });

export type UpdateLoanContactInput = z.infer<typeof UpdateLoanContactInputSchema>;

export const LOAN_CONTACT_ERROR_CODES = {
  archived: "LOAN_CONTACT_ARCHIVED",
  archivedName: "LOAN_CONTACT_ARCHIVED_NAME",
  duplicateName: "LOAN_CONTACT_DUPLICATE_NAME",
  notFound: "LOAN_CONTACT_NOT_FOUND",
} as const;

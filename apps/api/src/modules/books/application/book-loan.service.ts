import type {
  BookView,
  CreateLoanInput,
  ExtendLoanInput,
  OwnershipStatus,
  SetLoanReminderInput,
  UpdateLoanInput,
} from "@app/shared";

import { LOAN_ERROR_CODES, OwnershipStatusSchema, ownershipStatusUsesLoan } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { BookLoanModel } from "../../../generated/prisma/models.js";
import type { LoanCreateRule } from "../domain/loan-create-rules.js";
import type { GuardedChangeOutcome } from "../infrastructure/books.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { LoanContactResolver } from "../../loans/index.js";
import { LOAN_CREATE_RULES } from "../domain/loan-create-rules.js";
import { extendReturnDate, resolveReminderFields } from "../domain/loan-quick-actions.js";
import { buildLoanEditData, computeLoanChange } from "../domain/loan-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const RETURN_REQUIRES_LOAN_MESSAGE = "Book must be borrowed or lent to be returned";
const ACTIVE_LOAN_EXISTS_MESSAGE = "This book already has an active loan";
const LOAN_NOT_FOUND_MESSAGE = "Loan not found";
const EXTEND_REQUIRES_RETURN_DATE_MESSAGE = "Set a return date before extending the loan";
const REMINDER_REQUIRES_RETURN_DATE_MESSAGE = "Set a return date before turning the reminder on";

const LOAN_ACTIVE_OWNERSHIP_STATUSES: OwnershipStatus[] = [
  "borrowed_from_someone",
  "lent_to_someone",
];

@Injectable()
export class BookLoanService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly transactionRunner: TransactionRunner,
    private readonly loanContactResolver: LoanContactResolver,
  ) {}

  async createLoan(userId: string, bookId: string, input: CreateLoanInput): Promise<BookView> {
    const rule = LOAN_CREATE_RULES[input.direction];
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!rule.expectedStatuses.includes(ownershipStatus)) {
      throw toLoanCreateConflict(rule);
    }

    const now = new Date();
    let outcome: GuardedChangeOutcome;
    try {
      outcome = await this.transactionRunner.run(async (client) => {
        const loanContact = await this.loanContactResolver.resolve(
          {
            attached: null,
            loanContactId: input.loanContactId,
            personName: input.personName,
            userId,
          },
          client,
        );
        const patch = computeLoanChange({
          fields: input,
          kind: "create",
          loanContact,
          now,
          ownershipStatus,
        });

        return this.booksRepository.applyLoanChange(
          userId,
          bookId,
          patch,
          { expectedStatuses: rule.expectedStatuses },
          client,
        );
      });
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError(ACTIVE_LOAN_EXISTS_MESSAGE, {
            code: LOAN_ERROR_CODES.activeLoanExists,
          }),
      });
    }
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE, { code: LOAN_ERROR_CODES.bookNotFound });
    }
    if (outcome === "status-conflict") {
      throw toLoanCreateConflict(rule);
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async editLoan(userId: string, bookId: string, input: UpdateLoanInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const active = book.loans[0];
    if (active === undefined) {
      throw new NotFoundError(LOAN_NOT_FOUND_MESSAGE, { code: LOAN_ERROR_CODES.loanNotFound });
    }

    await this.transactionRunner.run(async (client) => {
      const loanContact = await this.loanContactResolver.resolve(
        {
          attached: active,
          loanContactId: input.loanContactId,
          personName: input.personName,
          userId,
        },
        client,
      );
      const data = buildLoanEditData({
        existingLoanDate: active.loanDate,
        existingRemindBeforeDays: active.remindBeforeDays,
        input,
        loanContact,
      });

      await this.booksRepository.updateActiveLoan(userId, bookId, data, client);
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async extendLoan(userId: string, bookId: string, input: ExtendLoanInput): Promise<BookView> {
    const active = await this.loadActiveLoanOrThrow(userId, bookId);
    if (active.expectedReturnDate === null) {
      throw new ConflictError(EXTEND_REQUIRES_RETURN_DATE_MESSAGE, {
        code: LOAN_ERROR_CODES.extendRequiresReturnDate,
      });
    }

    const expectedReturnDate = extendReturnDate({
      days: input.days,
      expectedReturnDate: active.expectedReturnDate,
      now: new Date(),
    });
    await this.booksRepository.updateActiveLoanSchedule(userId, bookId, {
      expectedReturnDate,
      ...resolveReminderFields({
        expectedReturnDate,
        remindBeforeDays: active.remindToReturn ? active.remindBeforeDays : null,
      }),
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async returnLoan(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE, {
        code: LOAN_ERROR_CODES.returnRequiresLoan,
      });
    }

    const patch = computeLoanChange({ kind: "return", now: new Date(), ownershipStatus });
    const outcome = await this.booksRepository.applyLoanChange(userId, bookId, patch, {
      expectedStatuses: LOAN_ACTIVE_OWNERSHIP_STATUSES,
    });
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE, { code: LOAN_ERROR_CODES.bookNotFound });
    }
    if (outcome === "status-conflict") {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE, {
        code: LOAN_ERROR_CODES.returnRequiresLoan,
      });
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async setLoanReminder(
    userId: string,
    bookId: string,
    input: SetLoanReminderInput,
  ): Promise<BookView> {
    const active = await this.loadActiveLoanOrThrow(userId, bookId);
    if (input.remindBeforeDays !== null && active.expectedReturnDate === null) {
      throw new ConflictError(REMINDER_REQUIRES_RETURN_DATE_MESSAGE, {
        code: LOAN_ERROR_CODES.reminderRequiresReturnDate,
      });
    }

    await this.booksRepository.updateActiveLoanReminder(
      userId,
      bookId,
      resolveReminderFields({
        expectedReturnDate: active.expectedReturnDate,
        remindBeforeDays: input.remindBeforeDays,
      }),
    );

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async loadActiveLoanOrThrow(userId: string, bookId: string): Promise<BookLoanModel> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const active = book.loans[0];
    if (active === undefined) {
      throw new NotFoundError(LOAN_NOT_FOUND_MESSAGE, { code: LOAN_ERROR_CODES.loanNotFound });
    }

    return active;
  }
}

function toLoanCreateConflict(rule: LoanCreateRule): ConflictError {
  return new ConflictError(rule.conflictMessage, { code: rule.conflictCode });
}

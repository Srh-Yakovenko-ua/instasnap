import type {
  CreateLoansBatchInput,
  CreateLoansBatchResult,
  LoanBatchConflictReason,
  Nullable,
  OwnershipStatus,
} from "@app/shared";

import { LOAN_BATCH_CONFLICT_CODE, LOAN_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ResolvedLoanContact } from "../../loans/index.js";
import type { LoanCreateRule } from "../domain/loan-create-rules.js";
import type { BookOwnershipFields, LoanCreateTarget } from "../infrastructure/books.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { LoanContactResolver } from "../../loans/index.js";
import { buildBookOwnershipFields } from "../domain/book-ownership-fields.js";
import { LOAN_CREATE_RULES } from "../domain/loan-create-rules.js";
import { buildLoanCreateFields } from "../domain/loan-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

const BATCH_REJECTED_MESSAGE = "Some of the selected books cannot be lent or borrowed right now";
const ACTIVE_LOAN_EXISTS_MESSAGE = "This book already has an active loan";

type LoanBatchConflict = {
  bookId: string;
  reason: LoanBatchConflictReason;
};

type OwnershipGroup = {
  bookIds: string[];
  fields: BookOwnershipFields;
};

@Injectable()
export class BookLoanBatchService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly loanContactResolver: LoanContactResolver,
  ) {}

  async createLoans(userId: string, input: CreateLoansBatchInput): Promise<CreateLoansBatchResult> {
    const bookIds = [...new Set(input.bookIds)];
    const rule = LOAN_CREATE_RULES[input.direction];
    const now = new Date();

    try {
      await this.transactionRunner.run(async (client) => {
        const targets = await this.booksRepository.findLoanCreateTargets(
          { bookIds, userId },
          client,
        );
        const conflicts = collectConflicts({ bookIds, rule, targets });
        if (conflicts.length > 0) {
          throw toBatchConflict(conflicts);
        }

        const loanContact = await this.loanContactResolver.resolve(
          { attached: null, loanContactId: input.loanContactId, personName: undefined, userId },
          client,
        );

        await this.applyOwnershipTransitions({ client, now, rule, targets, userId });
        await this.createLoanRows({ bookIds, client, input, loanContact, rule, userId });
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

    return { createdBookIds: bookIds };
  }

  private async applyOwnershipTransitions({
    client,
    now,
    rule,
    targets,
    userId,
  }: {
    client: Prisma.TransactionClient;
    now: Date;
    rule: LoanCreateRule;
    targets: LoanCreateTarget[];
    userId: string;
  }): Promise<void> {
    for (const group of groupByOwnershipFields({ now, rule, targets })) {
      const updated = await this.booksRepository.applyGuardedOwnershipFields(
        userId,
        { bookIds: group.bookIds, expectedStatuses: rule.expectedStatuses, fields: group.fields },
        client,
      );
      if (updated !== group.bookIds.length) {
        throw toBatchConflict(
          group.bookIds.map((bookId) => ({ bookId, reason: rule.conflictReason })),
        );
      }
    }
  }

  private async createLoanRows({
    bookIds,
    client,
    input,
    loanContact,
    rule,
    userId,
  }: {
    bookIds: string[];
    client: Prisma.TransactionClient;
    input: CreateLoansBatchInput;
    loanContact: ResolvedLoanContact;
    rule: LoanCreateRule;
    userId: string;
  }): Promise<void> {
    const fields = buildLoanCreateFields({ fields: input, loanContact });

    await this.booksRepository.createLoansForBooks(
      userId,
      bookIds.map((bookId) => ({ ...fields, bookId, type: rule.loanType })),
      client,
    );
  }
}

function collectConflicts({
  bookIds,
  rule,
  targets,
}: {
  bookIds: string[];
  rule: LoanCreateRule;
  targets: LoanCreateTarget[];
}): LoanBatchConflict[] {
  const byId = new Map(targets.map((target) => [target.id, target]));

  return bookIds.flatMap((bookId) => {
    const target = byId.get(bookId);
    if (target === undefined) return [{ bookId, reason: "book_not_found" as const }];
    if (target.hasActiveLoan) return [{ bookId, reason: "active_loan_exists" as const }];
    if (!isEligible(target.ownershipStatus, rule.expectedStatuses)) {
      return [{ bookId, reason: rule.conflictReason }];
    }
    return [];
  });
}

function groupByOwnershipFields({
  now,
  rule,
  targets,
}: {
  now: Date;
  rule: LoanCreateRule;
  targets: LoanCreateTarget[];
}): OwnershipGroup[] {
  const groups = new Map<Nullable<OwnershipStatus>, OwnershipGroup>();

  for (const target of targets) {
    const group = groups.get(target.ownershipStatus);
    if (group === undefined) {
      groups.set(target.ownershipStatus, {
        bookIds: [target.id],
        fields: buildBookOwnershipFields({
          current: target.ownershipStatus,
          next: rule.loanType,
          now,
        }),
      });
      continue;
    }
    group.bookIds.push(target.id);
  }

  return [...groups.values()];
}

function isEligible(
  ownershipStatus: Nullable<OwnershipStatus>,
  expectedStatuses: OwnershipStatus[],
): boolean {
  return ownershipStatus !== null && expectedStatuses.includes(ownershipStatus);
}

function toBatchConflict(conflicts: LoanBatchConflict[]): ConflictError {
  return new ConflictError(BATCH_REJECTED_MESSAGE, {
    code: LOAN_BATCH_CONFLICT_CODE,
    details: { conflicts },
  });
}

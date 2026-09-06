import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

@Injectable()
export class ReadingHistoryCorrectionService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async deleteReadingEvent({
    bookId,
    eventId,
    userId,
  }: {
    bookId: string;
    eventId: string;
    userId: string;
  }): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      await this.booksRepository.acquireBookLock(bookId, tx);
      await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

      const deleted = await this.booksRepository.deleteReadingEvent({ bookId, eventId }, tx);
      if (deleted === 0) {
        throw new NotFoundError("Reading event not found");
      }
    });
  }
}

import type { Nullable, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingCycleCommand } from "../domain/reading-cycle.js";
import type { ReadingProgressEventData } from "../infrastructure/books.repository.js";
import type {
  ReadingCycleContext,
  ReadingCycleFinalization,
} from "../infrastructure/reading-cycle.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { ValidationError } from "../../../core/exceptions/errors.js";
import { toNullableIsoDate } from "../../../core/iso-date.js";
import { buildReadingCompletionSnapshot } from "../domain/reading-completion-snapshot.js";
import {
  planReadingCycleCommand,
  READING_CYCLE_METADATA_PROVENANCE,
  READING_CYCLE_STATE,
  resolveFirstCompletionReliability,
} from "../domain/reading-cycle.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { ReadingCycleRepository } from "../infrastructure/reading-cycle.repository.js";
import { ReadingHistoryProvenanceService } from "./reading-history-provenance.service.js";

const FINISH_BEFORE_START_MESSAGE = "Finish date cannot be earlier than the reading start date";

export type ReadingLifecycleTransition = {
  bookId: string;
  currentStatus: ReadingStatus;
  date: string;
  event: Nullable<ReadingProgressEventData>;
  existingStartedAt: Nullable<Date>;
  rating: Nullable<number>;
  targetStatus: ReadingStatus;
  userId: string;
};

@Injectable()
export class ReadingLifecycleCoordinator {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly readingCycleRepository: ReadingCycleRepository,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
  ) {}

  async apply(
    transition: ReadingLifecycleTransition,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const context = await this.readingCycleRepository.findContext(
      { bookId: transition.bookId, userId: transition.userId },
      client,
    );
    const command = planReadingCycleCommand({
      activeCycle: context.activeCycle,
      currentStatus: transition.currentStatus,
      date: transition.date,
      existingStartedAt: transition.existingStartedAt,
      latestTerminalCycle: context.latestTerminalCycle,
      targetStatus: transition.targetStatus,
    });

    const currentCycleId = await this.execute({ client, command, context, transition });

    if (transition.event !== null) {
      await this.booksRepository.recordReadingEvent(
        { bookId: transition.bookId, event: transition.event, readingCycleId: currentCycleId },
        client,
      );
    }
  }

  private assertDateOrder({
    finishedAt,
    startedAt,
  }: {
    finishedAt: string;
    startedAt: Nullable<string>;
  }): void {
    if (startedAt !== null && finishedAt < startedAt) {
      throw new ValidationError(FINISH_BEFORE_START_MESSAGE);
    }
  }

  private async buildFinalization({
    client,
    command,
    context,
    transition,
  }: {
    client: Prisma.TransactionClient;
    command: Extract<ReadingCycleCommand, { state: unknown }>;
    context: ReadingCycleContext;
    transition: ReadingLifecycleTransition;
  }): Promise<ReadingCycleFinalization> {
    if (command.state !== READING_CYCLE_STATE.finished) {
      return {
        completionMetadata: null,
        date: command.date,
        firstCompletionReliability: null,
        rating: null,
        state: command.state,
      };
    }

    const { cycleHistoryCutoverAt } = await this.readingHistoryProvenanceService.ensure(
      transition.userId,
      client,
    );
    const source = await this.readingCycleRepository.findCompletionMetadataSource(
      { bookId: transition.bookId, userId: transition.userId },
      client,
    );
    if (source === null) {
      throw new ValidationError("Book not found");
    }

    const seriesKnownBooksCount =
      source.series === null
        ? 0
        : await this.readingCycleRepository.countSeriesKnownBooks(
            { seriesId: source.series.id, userId: transition.userId },
            client,
          );

    return {
      completionMetadata: buildReadingCompletionSnapshot({
        provenance: READING_CYCLE_METADATA_PROVENANCE.trackedAtCompletion,
        seriesKnownBooksCount,
        source,
      }),
      date: command.date,
      firstCompletionReliability: resolveFirstCompletionReliability({
        bookCreatedAt: source.createdAt,
        cycleHistoryCutoverAt,
        hasEarlierFinishedCycle: context.hasFinishedCycle,
      }),
      rating: transition.rating,
      state: command.state,
    };
  }

  private async editTerminalCycle({
    client,
    command,
    transition,
  }: {
    client: Prisma.TransactionClient;
    command: Extract<ReadingCycleCommand, { kind: "edit_terminal" }>;
    transition: ReadingLifecycleTransition;
  }): Promise<Nullable<string>> {
    const cycle = await this.readingCycleRepository.findOwnedCycle(
      { cycleId: command.cycleId, userId: transition.userId },
      client,
    );
    if (cycle === null) {
      return null;
    }
    this.assertDateOrder({
      finishedAt: command.date,
      startedAt: toNullableIsoDate(cycle.startedAt),
    });
    await this.readingCycleRepository.editTerminalCycle(
      {
        cycleId: command.cycleId,
        date: command.date,
        rating: command.state === READING_CYCLE_STATE.finished ? transition.rating : null,
        state: command.state,
        userId: transition.userId,
      },
      client,
    );
    return command.cycleId;
  }

  private async execute({
    client,
    command,
    context,
    transition,
  }: {
    client: Prisma.TransactionClient;
    command: ReadingCycleCommand;
    context: ReadingCycleContext;
    transition: ReadingLifecycleTransition;
  }): Promise<Nullable<string>> {
    switch (command.kind) {
      case "edit_terminal":
        return this.editTerminalCycle({ client, command, transition });
      case "finalize_active": {
        this.assertDateOrder({
          finishedAt: command.date,
          startedAt: toNullableIsoDate(context.activeCycle?.startedAt ?? null),
        });
        const finalization = await this.buildFinalization({
          client,
          command,
          context,
          transition,
        });
        const cycleId = requireActiveCycleId(context);
        await this.readingCycleRepository.finalizeActiveCycle(
          { cycleId, finalization, userId: transition.userId },
          client,
        );
        return cycleId;
      }
      case "keep_active":
        return context.activeCycle?.id ?? null;
      case "noop":
        return null;
      case "repair_finalized": {
        this.assertDateOrder({ finishedAt: command.date, startedAt: command.startedAt });
        const finalization = await this.buildFinalization({
          client,
          command,
          context,
          transition,
        });
        return this.readingCycleRepository.createFinalizedCycle(
          {
            bookId: transition.bookId,
            finalization,
            legacySourceKey: null,
            startedAt: command.startedAt,
            userId: transition.userId,
          },
          client,
        );
      }
      case "start":
        return this.readingCycleRepository.createActiveCycle(
          {
            bookId: transition.bookId,
            startedAt: command.startedAt,
            userId: transition.userId,
          },
          client,
        );
      default:
        return assertNever(command);
    }
  }
}

function requireActiveCycleId(context: ReadingCycleContext): string {
  const cycleId = context.activeCycle?.id;
  if (cycleId === undefined) {
    throw new ValidationError("Active reading cycle is missing");
  }
  return cycleId;
}

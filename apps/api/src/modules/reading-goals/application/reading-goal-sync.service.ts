import type { Nullable, ReadingGoalUncountedReason } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { differenceInCalendarDays } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalCalculationGoal } from "../domain/reading-goal-metrics.js";
import type {
  ReadingGoalProgress,
  ReadingGoalQualifyingBook,
} from "../domain/reading-goal-progress.js";
import type { ReadingGoalActivityInput } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalSnapshotEntryWithProgressRow } from "../infrastructure/reading-goal-books.repository.js";

import { startOfUtcDay, toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { calculateReadingGoalMetrics } from "../domain/reading-goal-metrics.js";
import { selectQualifyingReadingGoalBooks } from "../domain/reading-goal-progress.js";
import { resolveReadingGoalCountingEnd } from "../domain/reading-goal-window.js";
import { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";

export type ReadingGoalSyncInput = {
  bookIds: string[];
  client?: Prisma.TransactionClient;
  userId: string;
};

type CompletionRowsInput = {
  client: Prisma.TransactionClient | undefined;
  goal: SyncGoal;
  progress: ReadingGoalProgress;
  userId: string;
};

type GoalSyncGroup = {
  entries: ReadingGoalSnapshotEntryWithProgressRow[];
  goal: SyncGoal;
};

type GoalSyncInput = {
  client: Prisma.TransactionClient | undefined;
  entries: ReadingGoalSnapshotEntryWithProgressRow[];
  goal: SyncGoal;
  now: Date;
  userId: string;
};

type QualificationTransition = {
  bookId: string;
  latestFinishedAt: Nullable<Date>;
  previousQualifiedFinishedAt: Nullable<Date>;
  qualifiedFinishedAt: Nullable<Date>;
  qualifiedReadingCycleId: Nullable<string>;
};

type QualificationWindow = {
  countingEndsAt: Date;
  goalStartDate: Date;
};

type RecordTransitionsInput = {
  client: Prisma.TransactionClient | undefined;
  goal: SyncGoal;
  now: Date;
  transitions: QualificationTransition[];
  userId: string;
};

type SyncGoal = ReadingGoalCalculationGoal & { id: string };

@Injectable()
export class ReadingGoalSyncService {
  constructor(
    private readonly readingGoalActivityRepository: ReadingGoalActivityRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
  ) {}

  async syncBooks({ bookIds, client, userId }: ReadingGoalSyncInput): Promise<void> {
    const uniqueBookIds = [...new Set(bookIds)];
    if (uniqueBookIds.length === 0) {
      return;
    }
    const entries = await this.readingGoalBooksRepository.findSnapshotEntriesForBooks(
      { bookIds: uniqueBookIds, userId },
      client,
    );
    const now = new Date();
    for (const group of groupEntriesByGoal(entries)) {
      await this.syncGoal({ client, entries: group.entries, goal: group.goal, now, userId });
    }
  }

  private async completionRows({
    client,
    goal,
    progress,
    userId,
  }: CompletionRowsInput): Promise<ReadingGoalActivityInput[]> {
    if (progress.status !== "completed") {
      return [];
    }
    const recorded = await this.readingGoalActivityRepository.existsOfType(
      { goalId: goal.id, type: "goal_completed" },
      client,
    );
    return recorded ? [] : [completedRow({ goal, progress, userId })];
  }

  private async recordTransitions({
    client,
    goal,
    now,
    transitions,
    userId,
  }: RecordTransitionsInput): Promise<void> {
    const snapshotBooks = await this.readingGoalBooksRepository.findByGoal(
      { goalId: goal.id },
      client,
    );
    const { progress } = calculateReadingGoalMetrics({ goal, now, snapshotBooks });
    const qualifying = selectQualifyingReadingGoalBooks({
      books: snapshotBooks.map((book) => ({
        bookId: book.bookId,
        finishedAt: book.qualifiedFinishedAt,
      })),
      ...qualificationWindow(goal),
    });
    const rows = [
      ...countedRows({ goal, qualifying, transitions, userId }),
      ...uncountedRows({ goal, transitions, userId }),
      ...(await this.completionRows({ client, goal, progress, userId })),
    ];
    if (rows.length === 0) {
      return;
    }
    await this.readingGoalActivityRepository.createMany({ rows }, client);
  }

  private async syncGoal({ client, entries, goal, now, userId }: GoalSyncInput): Promise<void> {
    const transitions: QualificationTransition[] = [];

    for (const entry of entries) {
      const qualifiedFinishedAt = entry.finishedAt;
      const qualifiedReadingCycleId = entry.readingCycleId;
      if (
        toNullableIsoDate(entry.qualifiedFinishedAt) === toNullableIsoDate(qualifiedFinishedAt) &&
        entry.qualifiedReadingCycleId === qualifiedReadingCycleId
      ) {
        continue;
      }
      const written = await this.readingGoalBooksRepository.updateQualifiedFinishedAt(
        {
          bookId: entry.bookId,
          goalId: goal.id,
          previousQualifiedFinishedAt: entry.qualifiedFinishedAt,
          qualifiedFinishedAt,
          qualifiedReadingCycleId,
        },
        client,
      );
      if (written === 1) {
        transitions.push({
          bookId: entry.bookId,
          latestFinishedAt: entry.latestFinishedAt,
          previousQualifiedFinishedAt: entry.qualifiedFinishedAt,
          qualifiedFinishedAt,
          qualifiedReadingCycleId,
        });
      }
    }

    if (transitions.length === 0) {
      return;
    }
    await this.recordTransitions({ client, goal, now, transitions, userId });
  }
}

function activityRow({
  bookId = null,
  goal,
  metadata,
  type,
  userId,
}: {
  bookId?: Nullable<string>;
  goal: SyncGoal;
  metadata: Nullable<Prisma.InputJsonValue>;
  type: ReadingGoalActivityInput["type"];
  userId: string;
}): ReadingGoalActivityInput {
  return { bookId, goalId: goal.id, metadata, type, userId };
}

function completedRow({
  goal,
  progress,
  userId,
}: {
  goal: SyncGoal;
  progress: ReadingGoalProgress;
  userId: string;
}): ReadingGoalActivityInput {
  const { completedAt } = progress;
  return activityRow({
    goal,
    metadata: {
      completedAt: toNullableIsoDate(completedAt),
      daysBeforeDeadline:
        completedAt === null ? null : daysBeforeDeadline({ completedAt, deadline: goal.deadline }),
      targetCount: goal.targetCount,
    },
    type: "goal_completed",
    userId,
  });
}

function countedRows({
  goal,
  qualifying,
  transitions,
  userId,
}: {
  goal: SyncGoal;
  qualifying: ReadingGoalQualifyingBook[];
  transitions: QualificationTransition[];
  userId: string;
}): ReadingGoalActivityInput[] {
  const countedBookIds = new Set(
    transitions
      .filter(
        (transition) =>
          transition.previousQualifiedFinishedAt === null &&
          transition.qualifiedFinishedAt !== null,
      )
      .map((transition) => transition.bookId),
  );
  return qualifying.flatMap((book, index) => {
    if (!countedBookIds.has(book.bookId)) {
      return [];
    }
    return [
      activityRow({
        bookId: book.bookId,
        goal,
        metadata: {
          completedCount: index + 1,
          finishedAt: toIsoDate(book.finishedAt),
          targetCount: goal.targetCount,
        },
        type: "book_counted",
        userId,
      }),
    ];
  });
}

function daysBeforeDeadline({
  completedAt,
  deadline,
}: {
  completedAt: Date;
  deadline: Date;
}): number {
  return Math.max(0, differenceInCalendarDays(startOfUtcDay(deadline), startOfUtcDay(completedAt)));
}

function groupEntriesByGoal(entries: ReadingGoalSnapshotEntryWithProgressRow[]): GoalSyncGroup[] {
  const groups = new Map<string, GoalSyncGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.goalId);
    if (group === undefined) {
      groups.set(entry.goalId, { entries: [entry], goal: toSyncGoal(entry) });
      continue;
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

function qualificationWindow({ archivedAt, createdAt, deadline }: SyncGoal): QualificationWindow {
  return {
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedAt, deadline }),
    goalStartDate: startOfUtcDay(createdAt),
  };
}

function resolveUncountedReason(latestFinishedAt: Nullable<Date>): ReadingGoalUncountedReason {
  return latestFinishedAt === null ? "finished_date_removed" : "finished_date_changed";
}

function toSyncGoal({
  archivedAt,
  createdAt,
  deadline,
  goalId,
  targetCount,
}: ReadingGoalSnapshotEntryWithProgressRow): SyncGoal {
  return { archivedAt, createdAt, deadline, id: goalId, targetCount };
}

function uncountedRows({
  goal,
  transitions,
  userId,
}: {
  goal: SyncGoal;
  transitions: QualificationTransition[];
  userId: string;
}): ReadingGoalActivityInput[] {
  return transitions.flatMap((transition) => {
    const { previousQualifiedFinishedAt } = transition;
    if (previousQualifiedFinishedAt === null || transition.qualifiedFinishedAt !== null) {
      return [];
    }
    return [
      activityRow({
        bookId: transition.bookId,
        goal,
        metadata: {
          previousFinishedAt: toIsoDate(previousQualifiedFinishedAt),
          reason: resolveUncountedReason(transition.latestFinishedAt),
        },
        type: "book_uncounted",
        userId,
      }),
    ];
  });
}

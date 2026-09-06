import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { ReadingGoalSnapshotService } from "./reading-goal-snapshot.service.js";

const GOAL_ID = "33333333-3333-4333-8333-333333333333";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const TX = fakeOf<Prisma.TransactionClient>({});

function bookId(index: number): string {
  return `2222${String(index).padStart(4, "0")}-2222-4222-8222-222222222222`;
}

function buildSnapshotService(snapshotRows: unknown[] = []) {
  const repository = {
    createMany: vi.fn().mockResolvedValue(0),
    findSnapshotProgress: vi.fn().mockResolvedValue(snapshotRows),
    updateQualifiedFinishedAt: vi.fn().mockResolvedValue(1),
  };
  const snapshotService = new ReadingGoalSnapshotService(
    repository as unknown as ReadingGoalBooksRepository,
  );
  return { repository, snapshotService };
}

function cycleId(index: number): string {
  return `4444${String(index).padStart(4, "0")}-4444-4444-8444-444444444444`;
}

function goal(overrides: Partial<ReadingGoalWithList> = {}): ReadingGoalWithList {
  return {
    archivedAt: null,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    deadline: parseIsoDate("2026-09-01"),
    id: GOAL_ID,
    list: { id: LIST_ID, name: "Autumn reads" },
    listId: LIST_ID,
    name: "Five books",
    targetCount: 5,
    updatedAt: new Date("2026-08-01T10:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

describe("ReadingGoalSnapshotService.seed", () => {
  it("stores positions only and resolves qualification from finished reading cycles", async () => {
    const { repository, snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: parseIsoDate("2026-08-15"),
        qualifiedFinishedAt: null,
        qualifiedReadingCycleId: null,
        readingCycleId: cycleId(0),
      },
    ]);

    await snapshotService.seed({
      candidates: [
        { bookId: bookId(0), position: 0 },
        { bookId: bookId(1), position: 1 },
      ],
      goal: goal(),
      tx: TX,
    });

    expect(repository.createMany).toHaveBeenCalledWith(
      {
        goalId: GOAL_ID,
        rows: [
          { bookId: bookId(0), position: 0 },
          { bookId: bookId(1), position: 1 },
        ],
      },
      TX,
    );
    expect(repository.updateQualifiedFinishedAt).toHaveBeenCalledWith(
      {
        bookId: bookId(0),
        goalId: GOAL_ID,
        previousQualifiedFinishedAt: null,
        qualifiedFinishedAt: parseIsoDate("2026-08-15"),
        qualifiedReadingCycleId: cycleId(0),
      },
      TX,
    );
  });

  it("writes nothing for a goal whose list holds no books", async () => {
    const { repository, snapshotService } = buildSnapshotService();

    await snapshotService.seed({ candidates: [], goal: goal(), tx: TX });

    expect(repository.createMany).not.toHaveBeenCalled();
  });
});

describe("ReadingGoalSnapshotService.resync", () => {
  it("clears a book the shortened deadline no longer covers", async () => {
    const { repository, snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: parseIsoDate("2026-08-20"),
        qualifiedFinishedAt: parseIsoDate("2026-08-20"),
        qualifiedReadingCycleId: cycleId(0),
        readingCycleId: cycleId(0),
      },
    ]);

    const changes = await snapshotService.resync({
      goal: goal({ deadline: parseIsoDate("2026-08-10") }),
      tx: TX,
    });

    expect(repository.updateQualifiedFinishedAt).toHaveBeenCalledWith(
      {
        bookId: bookId(0),
        goalId: GOAL_ID,
        previousQualifiedFinishedAt: parseIsoDate("2026-08-20"),
        qualifiedFinishedAt: null,
        qualifiedReadingCycleId: null,
      },
      TX,
    );
    expect(changes).toEqual([
      {
        bookId: bookId(0),
        previousQualifiedFinishedAt: parseIsoDate("2026-08-20"),
        qualifiedFinishedAt: null,
      },
    ]);
  });

  it("counts a book the extended deadline now covers", async () => {
    const { snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: parseIsoDate("2026-09-20"),
        qualifiedFinishedAt: null,
        qualifiedReadingCycleId: null,
        readingCycleId: cycleId(0),
      },
    ]);

    const changes = await snapshotService.resync({
      goal: goal({ deadline: parseIsoDate("2026-10-01") }),
      tx: TX,
    });

    expect(changes).toEqual([
      {
        bookId: bookId(0),
        previousQualifiedFinishedAt: null,
        qualifiedFinishedAt: parseIsoDate("2026-09-20"),
      },
    ]);
  });

  it("leaves a row alone when its qualification did not move", async () => {
    const { repository, snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: parseIsoDate("2026-08-15"),
        qualifiedFinishedAt: parseIsoDate("2026-08-15"),
        qualifiedReadingCycleId: cycleId(0),
        readingCycleId: cycleId(0),
      },
      {
        bookId: bookId(1),
        finishedAt: null,
        qualifiedFinishedAt: null,
        qualifiedReadingCycleId: null,
        readingCycleId: null,
      },
    ]);

    const changes = await snapshotService.resync({ goal: goal(), tx: TX });

    expect(repository.updateQualifiedFinishedAt).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  it("reports no change when a concurrent writer moved the row first", async () => {
    const { repository, snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: parseIsoDate("2026-08-20"),
        qualifiedFinishedAt: parseIsoDate("2026-08-20"),
        qualifiedReadingCycleId: cycleId(0),
        readingCycleId: cycleId(0),
      },
    ]);
    repository.updateQualifiedFinishedAt.mockResolvedValue(0);

    const changes = await snapshotService.resync({
      goal: goal({ deadline: parseIsoDate("2026-08-10") }),
      tx: TX,
    });

    expect(repository.updateQualifiedFinishedAt).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([]);
  });

  it("drops a trashed book out of the counted set", async () => {
    const { snapshotService } = buildSnapshotService([
      {
        bookId: bookId(0),
        finishedAt: null,
        qualifiedFinishedAt: parseIsoDate("2026-08-15"),
        qualifiedReadingCycleId: cycleId(0),
        readingCycleId: null,
      },
    ]);

    const changes = await snapshotService.resync({
      goal: goal({ deadline: parseIsoDate("2026-10-01") }),
      tx: TX,
    });

    expect(changes).toEqual([
      {
        bookId: bookId(0),
        previousQualifiedFinishedAt: parseIsoDate("2026-08-15"),
        qualifiedFinishedAt: null,
      },
    ]);
  });
});

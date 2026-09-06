import type { BookView, Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookReadingService } from "./book-reading.service.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const EXISTING_STARTED_AT = new Date("2026-01-01T00:00:00.000Z");
const UPDATE_DATE = "2026-07-07";
const EXPECTED_EVENT_DATE = new Date("2026-07-07T00:00:00.000Z");

const TRANSACTION_CLIENT = {} as unknown as Prisma.TransactionClient;

type AssemblerMock = { loadView: ReturnType<typeof vi.fn> };

type CoordinatorMock = { apply: ReturnType<typeof vi.fn> };

type RepositoryMock = {
  acquireBookLock: ReturnType<typeof vi.fn>;
  applyReadingChange: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  findReadingEvents: ReturnType<typeof vi.fn>;
};

function assemblerMock(): AssemblerMock {
  return { loadView: vi.fn().mockResolvedValue({} as BookView) };
}

function buildService({
  assembler,
  coordinator,
  repository,
}: {
  assembler: AssemblerMock;
  coordinator: CoordinatorMock;
  repository: RepositoryMock;
}): BookReadingService {
  return new BookReadingService(
    repository as unknown as BooksRepository,
    assembler as unknown as BookViewAssembler,
    transactionRunnerMock(),
    fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
    coordinator as unknown as ReadingLifecycleCoordinator,
    fakeOf<UserSettingsContextService>({ today: vi.fn().mockResolvedValue(UPDATE_DATE) }),
  );
}

function coordinatorMock(): CoordinatorMock {
  return { apply: vi.fn().mockResolvedValue(undefined) };
}

function ownedBook(args: {
  currentPage?: number;
  pagesCount?: Nullable<number>;
  readingStatus?: string;
}): BookWithRelations {
  const readingProgress =
    args.currentPage === undefined
      ? null
      : { currentPage: args.currentPage, startedAt: EXISTING_STARTED_AT };
  return {
    pagesCount: args.pagesCount ?? 320,
    readingProgress,
    readingStatus: args.readingStatus ?? "reading",
  } as unknown as BookWithRelations;
}

function repositoryMock(): RepositoryMock {
  return {
    acquireBookLock: vi.fn().mockResolvedValue(undefined),
    applyReadingChange: vi.fn().mockResolvedValue(undefined),
    findOwnedByIdOrThrow: vi.fn(),
    findReadingEvents: vi.fn(),
  };
}

function transactionRunnerMock(): TransactionRunner {
  return {
    run: vi.fn((callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(TRANSACTION_CLIENT),
    ),
  } as unknown as TransactionRunner;
}

describe("BookReadingService.updateReadingProgress history event", () => {
  it("appends an event with the pages advanced when the page moves forward", async () => {
    const repository = repositoryMock();
    const coordinator = coordinatorMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 50 }));
    const service = buildService({ assembler: assemblerMock(), coordinator, repository });

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 120,
      updateDate: UPDATE_DATE,
    });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: BOOK_ID,
        event: { date: EXPECTED_EVENT_DATE, page: 120, pagesRead: 70 },
        userId: USER_ID,
      }),
      TRANSACTION_CLIENT,
    );
  });

  it("persists the resolved page of the change it logs", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 50 }));
    const service = buildService({
      assembler: assemblerMock(),
      coordinator: coordinatorMock(),
      repository,
    });

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 120,
      updateDate: UPDATE_DATE,
    });

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.objectContaining({ progress: expect.objectContaining({ currentPage: 120 }) }),
      TRANSACTION_CLIENT,
    );
  });

  it("counts the whole current page as pages read on the first-ever progress update", async () => {
    const repository = repositoryMock();
    const coordinator = coordinatorMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ readingStatus: "not_started" }));
    const service = buildService({ assembler: assemblerMock(), coordinator, repository });

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 45,
      updateDate: UPDATE_DATE,
    });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ event: { date: EXPECTED_EVENT_DATE, page: 45, pagesRead: 45 } }),
      TRANSACTION_CLIENT,
    );
  });

  it("passes a null event when the page does not advance", async () => {
    const repository = repositoryMock();
    const coordinator = coordinatorMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 120 }));
    const service = buildService({ assembler: assemblerMock(), coordinator, repository });

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 120,
      updateDate: UPDATE_DATE,
    });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ event: null }),
      TRANSACTION_CLIENT,
    );
  });

  it("logs the remaining pages to the page count when marking the book as finished", async () => {
    const repository = repositoryMock();
    const coordinator = coordinatorMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(
      ownedBook({ currentPage: 100, pagesCount: 320 }),
    );
    const service = buildService({ assembler: assemblerMock(), coordinator, repository });

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 150,
      markAsFinished: true,
      updateDate: UPDATE_DATE,
    });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ event: { date: EXPECTED_EVENT_DATE, page: 320, pagesRead: 220 } }),
      TRANSACTION_CLIENT,
    );
  });
});

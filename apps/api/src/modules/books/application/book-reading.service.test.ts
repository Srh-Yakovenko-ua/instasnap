import type { BookView, Nullable } from "@app/shared";
import type { Mock } from "vitest";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { fakeOf } from "../../../test/fake.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookReadingService } from "./book-reading.service.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const TODAY = new Date("2026-07-07T09:00:00.000Z");
const TODAY_START = new Date("2026-07-07T00:00:00.000Z");
const EXISTING_STARTED_AT = new Date("2026-01-01T00:00:00.000Z");
const TODAY_ISO = "2026-07-07";

const TRANSACTION_CLIENT = fakeOf<Prisma.TransactionClient>();

type ReadingProgressRow = NonNullable<BookWithRelations["readingProgress"]>;

type RepositoryMock = {
  acquireBookLock: Mock;
  applyReadingChange: Mock;
  findOwnedByIdOrThrow: Mock;
};

type StatusRepositoryMock = {
  acquireBookLock: Mock;
  applyReadingChange: Mock;
  findOwnedByIdOrThrow: Mock;
};

function buildService(repository: RepositoryMock): BookReadingService {
  return new BookReadingService(
    fakeOf<BooksRepository>(repository),
    fakeOf<BookViewAssembler>(),
    transactionRunnerMock(),
    fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<ReadingLifecycleCoordinator>({ apply: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<UserSettingsContextService>({
      today: vi.fn().mockResolvedValue(TODAY_ISO),
    }),
  );
}

function ownedBook(
  readingProgress: Nullable<ReadingProgressRow>,
  readingStatus = "not_started",
): BookWithRelations {
  return fakeOf<BookWithRelations>({ pagesCount: 320, readingProgress, readingStatus });
}

function readingProgressRow(startedAt: Nullable<Date>): ReadingProgressRow {
  return fakeOf<ReadingProgressRow>({ startedAt });
}

function repositoryMock(): RepositoryMock {
  return {
    acquireBookLock: vi.fn().mockResolvedValue(undefined),
    applyReadingChange: vi.fn().mockResolvedValue(undefined),
    findOwnedByIdOrThrow: vi.fn(),
  };
}

function transactionRunnerMock(): TransactionRunner {
  return fakeOf<TransactionRunner>({
    run: <T>(callback: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
      callback(TRANSACTION_CLIENT),
  });
}

describe("BookReadingService.startReading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects and never applies a change when the book is not owned", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));
    const service = buildService(repository);

    await expect(service.startReading(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
    expect(repository.applyReadingChange).not.toHaveBeenCalled();
  });

  it("applies a fresh reading patch with today's start date when there is no existing progress", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    const service = buildService(repository);

    await service.startReading(USER_ID, BOOK_ID);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      {
        book: { readingStatus: "reading" },
        progress: {
          abandonedAt: null,
          finishedAt: null,
          note: null,
          pausedAt: null,
          startedAt: TODAY_START,
        },
      },
      TRANSACTION_CLIENT,
    );
  });

  it("preserves the existing start date on an idempotent restart", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(
      ownedBook(readingProgressRow(EXISTING_STARTED_AT), "paused"),
    );
    const service = buildService(repository);

    await service.startReading(USER_ID, BOOK_ID);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.objectContaining({
        book: { readingStatus: "reading" },
        progress: expect.objectContaining({ startedAt: EXISTING_STARTED_AT }),
      }),
      TRANSACTION_CLIENT,
    );
  });

  it("threads the provided transaction client through to applyReadingChange", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    const service = buildService(repository);
    const client = fakeOf<Prisma.TransactionClient>();

    await service.startReading(USER_ID, BOOK_ID, client);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.anything(),
      client,
    );
  });
});

describe("BookReadingService.changeReadingStatus reading-cycle integration", () => {
  function buildStatusService({
    coordinator,
    repository,
  }: {
    coordinator: { apply: Mock };
    repository: StatusRepositoryMock;
  }): BookReadingService {
    return new BookReadingService(
      fakeOf<BooksRepository>(repository),
      fakeOf<BookViewAssembler>({ loadView: vi.fn().mockResolvedValue({} as BookView) }),
      transactionRunnerMock(),
      fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
      fakeOf<ReadingLifecycleCoordinator>(coordinator),
      fakeOf<UserSettingsContextService>({ today: vi.fn().mockResolvedValue(TODAY_ISO) }),
    );
  }

  function coordinatorMock(): { apply: Mock } {
    return { apply: vi.fn().mockResolvedValue(undefined) };
  }

  function statusRepositoryMock(): StatusRepositoryMock {
    return {
      acquireBookLock: vi.fn().mockResolvedValue(undefined),
      applyReadingChange: vi.fn().mockResolvedValue(undefined),
      findOwnedByIdOrThrow: vi.fn().mockResolvedValue(
        fakeOf<BookWithRelations>({
          pagesCount: 320,
          readingProgress: fakeOf<ReadingProgressRow>({
            currentPage: 120,
            rating: 8,
            startedAt: EXISTING_STARTED_AT,
          }),
          readingStatus: "reading",
        }),
      ),
    };
  }

  it("routes a reset to not_started through the lifecycle coordinator", async () => {
    const repository = statusRepositoryMock();
    const coordinator = coordinatorMock();
    const service = buildStatusService({ coordinator, repository });

    await service.changeReadingStatus(USER_ID, BOOK_ID, {
      resetProgress: true,
      status: "not_started",
    });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: BOOK_ID, targetStatus: "not_started", userId: USER_ID }),
      TRANSACTION_CLIENT,
    );
    expect(repository.applyReadingChange).toHaveBeenCalledTimes(1);
  });

  it("passes the explicit finish rating to the lifecycle coordinator", async () => {
    const repository = statusRepositoryMock();
    const coordinator = coordinatorMock();
    const service = buildStatusService({ coordinator, repository });

    await service.changeReadingStatus(USER_ID, BOOK_ID, { rating: 9.5, status: "finished" });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 9.5, targetStatus: "finished" }),
      TRANSACTION_CLIENT,
    );
  });

  it("falls back to the stored rating when the finish request omits one", async () => {
    const repository = statusRepositoryMock();
    const coordinator = coordinatorMock();
    const service = buildStatusService({ coordinator, repository });

    await service.changeReadingStatus(USER_ID, BOOK_ID, { status: "finished" });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 8, targetStatus: "finished" }),
      TRANSACTION_CLIENT,
    );
  });

  it("resolves the implicit change date in the user timezone", async () => {
    const repository = statusRepositoryMock();
    const coordinator = coordinatorMock();
    const service = buildStatusService({ coordinator, repository });

    await service.changeReadingStatus(USER_ID, BOOK_ID, { status: "paused" });

    expect(coordinator.apply).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY_ISO }),
      TRANSACTION_CLIENT,
    );
  });
});

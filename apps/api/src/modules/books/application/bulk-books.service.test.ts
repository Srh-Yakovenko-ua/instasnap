import type {
  BulkListsInput,
  BulkOwnershipStatusInput,
  BulkReadingStatusInput,
  BulkTagsInput,
} from "@app/shared";
import type { Mock } from "vitest";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { ListsService } from "../../lists/application/lists.service.js";
import type { TagsService } from "../../tags/application/tags.service.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";
import type { BulkBooksRepository } from "../infrastructure/bulk-books.repository.js";
import type { BookPurgeScheduler } from "./book-purge.scheduler.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BulkBooksService } from "./bulk-books.service.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const TX = fakeOf<Prisma.TransactionClient>();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_A = "22222222-2222-4222-8222-222222222201";
const BOOK_B = "22222222-2222-4222-8222-222222222202";
const TAG_ID = "33333333-3333-4333-8333-333333333301";
const LIST_ID = "44444444-4444-4444-8444-444444444401";

type BooksRepositoryMock = {
  acquireBookLock: Mock<BooksRepository["acquireBookLock"]>;
  applyReadingChange: Mock<BooksRepository["applyReadingChange"]>;
  findOwnedById: Mock<BooksRepository["findOwnedById"]>;
};

type BulkRepository = {
  addTags: ReturnType<typeof vi.fn>;
  addToLists: ReturnType<typeof vi.fn>;
  addToReadingQueue: ReturnType<typeof vi.fn>;
  clearReadingProgress: ReturnType<typeof vi.fn>;
  findOwnedIds: ReturnType<typeof vi.fn>;
  setFavorite: ReturnType<typeof vi.fn>;
  setOwnershipStatus: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
};

function buildService(
  overrides: {
    addTags?: number;
    addToLists?: number;
    addToReadingQueue?: number;
    listIds?: string[];
    ownedBook?: BookWithRelations;
    ownedBookIds?: string[];
    setFavorite?: number;
    setOwnershipStatus?: number;
    softDeletedIds?: string[];
    tagIds?: string[];
  } = {},
): {
  booksRepository: BooksRepositoryMock;
  bulkBooksRepository: BulkRepository;
  listsService: { resolveListsForBook: ReturnType<typeof vi.fn> };
  purgeScheduler: { scheduleMany: ReturnType<typeof vi.fn> };
  readingGoalSyncService: ReadingGoalSyncService;
  service: BulkBooksService;
  tagsService: { resolveOrCreateMany: ReturnType<typeof vi.fn> };
} {
  const bulkBooksRepository: BulkRepository = {
    addTags: vi.fn().mockResolvedValue(overrides.addTags ?? 0),
    addToLists: vi.fn().mockResolvedValue(overrides.addToLists ?? 0),
    addToReadingQueue: vi.fn().mockResolvedValue(overrides.addToReadingQueue ?? 0),
    clearReadingProgress: vi.fn().mockResolvedValue(undefined),
    findOwnedIds: vi.fn().mockResolvedValue(overrides.ownedBookIds ?? [BOOK_A]),
    setFavorite: vi.fn().mockResolvedValue(overrides.setFavorite ?? 0),
    setOwnershipStatus: vi.fn().mockResolvedValue(overrides.setOwnershipStatus ?? 0),
    softDelete: vi.fn().mockResolvedValue(overrides.softDeletedIds ?? []),
  };
  const booksRepository: BooksRepositoryMock = {
    acquireBookLock: vi.fn<BooksRepository["acquireBookLock"]>().mockResolvedValue(undefined),
    applyReadingChange: vi.fn<BooksRepository["applyReadingChange"]>().mockResolvedValue(undefined),
    findOwnedById: vi
      .fn<BooksRepository["findOwnedById"]>()
      .mockResolvedValue(overrides.ownedBook ?? null),
  };
  const tagsService = {
    resolveOrCreateMany: vi.fn().mockResolvedValue(overrides.tagIds ?? []),
  };
  const listsService = {
    resolveListsForBook: vi.fn().mockResolvedValue(overrides.listIds ?? []),
  };
  const purgeScheduler = {
    scheduleMany: vi.fn().mockResolvedValue(undefined),
  };
  const transactionRunner = {
    run: vi.fn(<T>(work: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> => work(TX)),
  };

  const readingGoalSyncService = fakeOf<ReadingGoalSyncService>({
    syncBooks: vi.fn().mockResolvedValue(undefined),
  });

  const service = new BulkBooksService(
    bulkBooksRepository as unknown as BulkBooksRepository,
    tagsService as unknown as TagsService,
    listsService as unknown as ListsService,
    purgeScheduler as unknown as BookPurgeScheduler,
    transactionRunner as unknown as TransactionRunner,
    readingGoalSyncService,
    fakeOf<BooksRepository>(booksRepository),
    fakeOf<ReadingLifecycleCoordinator>({ apply: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<UserSettingsContextService>({ today: vi.fn().mockResolvedValue("2026-07-07") }),
  );

  return {
    booksRepository,
    bulkBooksRepository,
    listsService,
    purgeScheduler,
    readingGoalSyncService,
    service,
    tagsService,
  };
}

function ownedReadingBook(): BookWithRelations {
  return fakeOf<BookWithRelations>({
    pagesCount: 320,
    readingProgress: null,
    readingStatus: "reading",
  });
}

describe("BulkBooksService.addTags", () => {
  it("returns zero affected and skips the repository when no tags resolve", async () => {
    const { bulkBooksRepository, service } = buildService({ ownedBookIds: [BOOK_A], tagIds: [] });
    const input: BulkTagsInput = { bookIds: [BOOK_A], tags: [] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(bulkBooksRepository.addTags).not.toHaveBeenCalled();
  });

  it("creates no tags and skips the repository when no books are owned", async () => {
    const { bulkBooksRepository, service, tagsService } = buildService({
      ownedBookIds: [],
      tagIds: [TAG_ID],
    });
    const input: BulkTagsInput = { bookIds: [BOOK_A], tags: ["dark academia"] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(tagsService.resolveOrCreateMany).not.toHaveBeenCalled();
    expect(bulkBooksRepository.addTags).not.toHaveBeenCalled();
  });

  it("passes the owned book ids and resolved tag ids to the repository", async () => {
    const { bulkBooksRepository, service, tagsService } = buildService({
      addTags: 2,
      ownedBookIds: [BOOK_A, BOOK_B],
      tagIds: [TAG_ID],
    });
    const input: BulkTagsInput = { bookIds: [BOOK_A, BOOK_B], tags: ["dark academia"] };

    const result = await service.addTags({ input, userId: USER_ID });

    expect(tagsService.resolveOrCreateMany).toHaveBeenCalledWith(USER_ID, ["dark academia"]);
    expect(bulkBooksRepository.addTags).toHaveBeenCalledWith({
      bookIds: [BOOK_A, BOOK_B],
      tagIds: [TAG_ID],
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 2 });
  });
});

describe("BulkBooksService.addToLists", () => {
  it("returns zero affected and skips the repository when no lists resolve", async () => {
    const { bulkBooksRepository, service } = buildService({ listIds: [], ownedBookIds: [BOOK_A] });
    const input: BulkListsInput = { bookIds: [BOOK_A] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(bulkBooksRepository.addToLists).not.toHaveBeenCalled();
  });

  it("creates no lists and skips the repository when no books are owned", async () => {
    const { bulkBooksRepository, listsService, service } = buildService({
      listIds: [LIST_ID],
      ownedBookIds: [],
    });
    const input: BulkListsInput = { bookIds: [BOOK_A], newLists: [{ name: "Summer" }] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(listsService.resolveListsForBook).not.toHaveBeenCalled();
    expect(bulkBooksRepository.addToLists).not.toHaveBeenCalled();
  });

  it("passes the owned book ids and resolved list ids to the repository", async () => {
    const { bulkBooksRepository, listsService, service } = buildService({
      addToLists: 1,
      listIds: [LIST_ID],
      ownedBookIds: [BOOK_A],
    });
    const input: BulkListsInput = { bookIds: [BOOK_A], listIds: [LIST_ID] };

    const result = await service.addToLists({ input, userId: USER_ID });

    expect(listsService.resolveListsForBook).toHaveBeenCalledWith(
      { input: { listIds: [LIST_ID], newLists: undefined }, userId: USER_ID },
      TX,
    );
    expect(bulkBooksRepository.addToLists).toHaveBeenCalledWith(
      { bookIds: [BOOK_A], listIds: [LIST_ID], now: expect.any(Date), userId: USER_ID },
      TX,
    );
    expect(result).toEqual({ affected: 1 });
  });
});

describe("BulkBooksService.addToReadingQueue", () => {
  it("queues with the default normal priority and returns the affected count", async () => {
    const { bulkBooksRepository, service } = buildService({ addToReadingQueue: 2 });

    const result = await service.addToReadingQueue({
      input: { bookIds: [BOOK_A, BOOK_B] },
      userId: USER_ID,
    });

    expect(bulkBooksRepository.addToReadingQueue).toHaveBeenCalledWith({
      bookIds: [BOOK_A, BOOK_B],
      queuePriority: "normal",
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 2 });
  });
});

describe("BulkBooksService.setFavorite", () => {
  it("forwards the favorite flag and returns the affected count", async () => {
    const { bulkBooksRepository, service } = buildService({ setFavorite: 3 });

    const result = await service.setFavorite({
      input: { bookIds: [BOOK_A], isFavorite: true },
      userId: USER_ID,
    });

    expect(bulkBooksRepository.setFavorite).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      isFavorite: true,
      now: expect.any(Date),
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 3 });
  });
});

describe("BulkBooksService.setReadingStatus", () => {
  it("clears progress when the new status does not use reading progress", async () => {
    const { bulkBooksRepository, service } = buildService({ ownedBook: ownedReadingBook() });
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "not_started" };

    await service.setReadingStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.clearReadingProgress).toHaveBeenCalledWith(
      { bookIds: [BOOK_A], userId: USER_ID },
      TX,
    );
  });

  it("keeps progress when the new status uses reading progress", async () => {
    const { bulkBooksRepository, service } = buildService({ ownedBook: ownedReadingBook() });
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "reading" };

    await service.setReadingStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.clearReadingProgress).not.toHaveBeenCalled();
  });

  it("writes the requested status for every owned book", async () => {
    const { booksRepository, service } = buildService({ ownedBook: ownedReadingBook() });
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "not_started" };

    await service.setReadingStatus({ input, userId: USER_ID });

    expect(booksRepository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_A,
      expect.objectContaining({ book: { readingStatus: "not_started" } }),
      TX,
    );
  });

  it("skips a book that disappeared between the ownership check and the write", async () => {
    const { booksRepository, service } = buildService();
    const input: BulkReadingStatusInput = { bookIds: [BOOK_A], readingStatus: "not_started" };

    const result = await service.setReadingStatus({ input, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
    expect(booksRepository.applyReadingChange).not.toHaveBeenCalled();
  });
});

describe("BulkBooksService.setOwnershipStatus", () => {
  it("clears every conditional block when the new status uses none of them", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "none" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      clearDelivery: true,
      clearLoan: true,
      clearPurchase: true,
      now: expect.any(Date),
      ownershipStatus: "none",
      userId: USER_ID,
    });
  });

  it("keeps the purchase block when the new status is owned", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "owned" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: true, clearLoan: true, clearPurchase: false }),
    );
  });

  it("keeps the delivery block when the new status is in_transit", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "in_transit" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: false, clearLoan: true, clearPurchase: true }),
    );
  });

  it("keeps the purchase block when the new status is want_to_buy", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = { bookIds: [BOOK_A], ownershipStatus: "want_to_buy" };

    await service.setOwnershipStatus({ input, userId: USER_ID });

    expect(bulkBooksRepository.setOwnershipStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clearDelivery: true, clearLoan: true, clearPurchase: false }),
    );
  });

  it("rejects a bulk loan status because each loan needs a per-book borrower", async () => {
    const { bulkBooksRepository, service } = buildService({ setOwnershipStatus: 1 });
    const input: BulkOwnershipStatusInput = {
      bookIds: [BOOK_A],
      ownershipStatus: "borrowed_from_someone",
    };

    await expect(service.setOwnershipStatus({ input, userId: USER_ID })).rejects.toThrow(
      BadRequestError,
    );

    expect(bulkBooksRepository.setOwnershipStatus).not.toHaveBeenCalled();
  });
});

describe("BulkBooksService.delete", () => {
  it("counts the books the repository actually moved to the trash", async () => {
    const { bulkBooksRepository, purgeScheduler, service } = buildService({
      softDeletedIds: [BOOK_A, BOOK_B],
    });

    const result = await service.delete({
      input: { bookIds: [BOOK_A, BOOK_B] },
      userId: USER_ID,
    });

    expect(bulkBooksRepository.softDelete).toHaveBeenCalledWith(
      {
        bookIds: [BOOK_A, BOOK_B],
        stamp: { deletedAt: expect.any(Date), purgeAt: expect.any(Date) },
        userId: USER_ID,
      },
      TX,
    );
    expect(purgeScheduler.scheduleMany).toHaveBeenCalledWith({
      bookIds: [BOOK_A, BOOK_B],
      userId: USER_ID,
    });
    expect(result).toEqual({ affected: 2 });
  });

  it("uncounts the trashed books from their reading goals in the same transaction", async () => {
    const { readingGoalSyncService, service } = buildService({ softDeletedIds: [BOOK_A] });

    await service.delete({ input: { bookIds: [BOOK_A, BOOK_B] }, userId: USER_ID });

    expect(readingGoalSyncService.syncBooks).toHaveBeenCalledWith({
      bookIds: [BOOK_A],
      client: TX,
      userId: USER_ID,
    });
  });

  it("reports zero affected when no owned book matched", async () => {
    const { service } = buildService({ softDeletedIds: [] });

    const result = await service.delete({ input: { bookIds: [BOOK_A] }, userId: USER_ID });

    expect(result).toEqual({ affected: 0 });
  });
});

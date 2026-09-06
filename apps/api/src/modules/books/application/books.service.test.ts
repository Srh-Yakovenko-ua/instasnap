import type { CreateBookInput, FavoritesSummaryView, Nullable, UpdateBookInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { LoanContactResolver, ResolveLoanContactInput } from "../../loans/index.js";
import type { MediaService } from "../../media/application/media.service.js";
import type {
  BooksRepository,
  BookWithRelations,
  UpdateBookData,
} from "../infrastructure/books.repository.js";
import type {
  BookRelationsResolver,
  ResolvedBookCreate,
  ResolvedBookUpdate,
} from "./book-relations-resolver.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { fakeOf } from "../../../test/fake.js";
import { SingleBookOrderService } from "../../delivery/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BookViewAssembler } from "./book-view-assembler.js";
import { BooksService } from "./books.service.js";
import { ReadingLifecycleCoordinator } from "./reading-lifecycle.coordinator.js";

const TX = fakeOf<Prisma.TransactionClient>();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID_B = "33333333-3333-4333-8333-333333333334";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";
const TAG_ID = "55555555-5555-4555-8555-555555555555";
const SERIES_ID = "66666666-6666-4666-8666-666666666666";
const LIST_ID = "77777777-7777-4777-8777-777777777777";
const MEDIA_ID = "88888888-8888-4888-8888-888888888801";
const LOAN_CONTACT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_LOAN_CONTACT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";

type Repository = {
  acquireBookLock: ReturnType<typeof vi.fn>;
  countForLibrary: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  favoritesSummary: ReturnType<typeof vi.fn>;
  findOwnedById: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  listForLibrary: ReturnType<typeof vi.fn>;
  recentPurchaseStores: ReturnType<typeof vi.fn>;
  updateOwned: ReturnType<typeof vi.fn>;
};

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    _count: { orderItems: 0 },
    ageCategory: "not_specified",
    authors: [
      {
        author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
        authorId: AUTHOR_ID,
        bookId: BOOK_ID,
        position: 0,
      },
    ] as BookWithRelations["authors"],
    coverMedia: null,
    coverMediaId: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dedication: null,
    description: null,
    favoriteAddedAt: null,
    firstAuthorName: "Frank Herbert",
    formats: [],
    genres: [],
    id: BOOK_ID,
    illustrator: null,
    isbn: null,
    isFavorite: false,
    isFavoriteDedication: false,
    language: "ukrainian",
    lists: [],
    loans: [],
    orderItems: [],
    originalTitle: null,
    ownershipStatus: "none",
    pagesCount: null,
    pagesCountUnavailable: false,
    partNumber: null,
    publicationYear: null,
    publisher: { id: PUBLISHER_ID, name: "Penguin", normalizedName: "penguin" },
    publisherId: PUBLISHER_ID,
    purchaseInfo: null,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: null,
    queuePriorityTargetDate: null,
    readingProgress: null,
    readingStatus: "not_started",
    series: null,
    seriesId: null,
    tags: [],
    title: "Dune",
    translator: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    wishlistAddedAt: null,
    ...overrides,
  } as BookWithRelations;
}

function buildService(
  overrides: {
    countForLibrary?: number;
    create?: BookWithRelations;
    favoritesSummary?: FavoritesSummaryView;
    findOwnedById?: Nullable<BookWithRelations>;
    listForLibrary?: BookWithRelations[];
    recentPurchaseStores?: string[];
    updateOwned?: BookWithRelations;
  } = {},
): {
  coverCleanup: { deleteIfOrphaned: ReturnType<typeof vi.fn> };
  relationsResolver: {
    assertCreatableRelations: ReturnType<typeof vi.fn>;
    assertUpdatableRelations: ReturnType<typeof vi.fn>;
    mapSeriesPartNumberWriteError: ReturnType<typeof vi.fn>;
    resolveAuthors: ReturnType<typeof vi.fn>;
    resolveForCreate: ReturnType<typeof vi.fn>;
    resolveForUpdate: ReturnType<typeof vi.fn>;
  };
  repository: Repository;
  service: BooksService;
  singleBookOrder: { applyBlock: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
} {
  const repository = {
    acquireBookLock: vi.fn().mockResolvedValue(undefined),
    countForLibrary: vi.fn().mockResolvedValue(overrides.countForLibrary ?? 0),
    create: vi.fn().mockResolvedValue(overrides.create ?? bookRow()),
    favoritesSummary: vi.fn().mockResolvedValue(
      overrides.favoritesSummary ?? {
        averageRating: null,
        finished: 0,
        reading: 0,
        series: 0,
        solo: 0,
        total: 0,
        wantToRead: 0,
      },
    ),
    findOwnedById: vi.fn().mockResolvedValue(overrides.findOwnedById ?? null),
    findOwnedByIdOrThrow: vi.fn().mockResolvedValue(overrides.findOwnedById ?? bookRow()),
    listForLibrary: vi.fn().mockResolvedValue(overrides.listForLibrary ?? []),
    recentPurchaseStores: vi.fn().mockResolvedValue(overrides.recentPurchaseStores ?? []),
    updateOwned: vi.fn().mockResolvedValue(overrides.updateOwned ?? bookRow()),
  };

  const relationsResolver = {
    assertCreatableRelations: vi.fn().mockResolvedValue(undefined),
    assertUpdatableRelations: vi.fn().mockResolvedValue(undefined),
    mapSeriesPartNumberWriteError: vi
      .fn()
      .mockImplementation(({ error }: { error: unknown }) => Promise.resolve(error)),
    resolveAuthors: vi
      .fn()
      .mockResolvedValue({ authorIds: [AUTHOR_ID], firstAuthorName: "Frank Herbert" }),
    resolveForCreate: vi.fn().mockResolvedValue(resolvedCreate()),
    resolveForUpdate: vi.fn().mockResolvedValue(resolvedUpdate()),
  };

  const mediaService = { buildViewOrNull: vi.fn().mockReturnValue(null) };
  const viewAssembler = new BookViewAssembler(
    fakeOf<BooksRepository>(repository),
    fakeOf<MediaService>(mediaService),
  );
  const coverCleanup = { deleteIfOrphaned: vi.fn().mockResolvedValue(undefined) };
  const singleBookOrder = {
    applyBlock: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
  };
  const transactionRunner = {
    run: <T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(TX),
  };
  const loanContactResolver = {
    resolve: ({ attached, loanContactId, personName }: ResolveLoanContactInput) => {
      const targetId = loanContactId ?? attached?.loanContactId ?? LOAN_CONTACT_ID;
      const keptAttachment =
        attached !== null && attached.loanContactId === targetId ? attached : null;
      return Promise.resolve({
        contact: keptAttachment?.contact ?? null,
        loanContactId: targetId,
        personName: personName ?? attached?.personName ?? "",
        refreshesSnapshot: keptAttachment === null,
      });
    },
  };

  const service = new BooksService(
    fakeOf<BooksRepository>(repository),
    fakeOf<BookRelationsResolver>(relationsResolver),
    viewAssembler,
    fakeOf<BookCoverCleanup>(coverCleanup),
    fakeOf<SingleBookOrderService>(singleBookOrder),
    fakeOf<TransactionRunner>(transactionRunner),
    fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<LoanContactResolver>(loanContactResolver),
    fakeOf<ReadingLifecycleCoordinator>({ apply: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<UserSettingsContextService>({ today: vi.fn().mockResolvedValue("2026-07-07") }),
  );

  return { coverCleanup, relationsResolver, repository, service, singleBookOrder };
}

function loanRow(
  overrides: Partial<BookWithRelations["loans"][number]> = {},
): BookWithRelations["loans"][number] {
  return {
    bookId: BOOK_ID,
    contact: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    expectedReturnDate: null,
    id: "88888888-8888-4888-8888-888888888881",
    loanContact: {
      archivedAt: null,
      contact: null,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      id: LOAN_CONTACT_ID,
      name: "Olha",
      normalizedName: "olha",
      updatedAt: new Date("2026-02-01T10:00:00.000Z"),
      userId: USER_ID,
    },
    loanContactId: LOAN_CONTACT_ID,
    loanDate: null,
    note: null,
    personName: "Olha",
    remindToReturn: false,
    returnedAt: null,
    status: "active",
    type: "borrowed_from_someone",
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  } as BookWithRelations["loans"][number];
}

function minimalCreateInput(overrides: Partial<CreateBookInput> = {}): CreateBookInput {
  return {
    addToReadingQueue: false,
    ageCategory: "not_specified",
    authors: [{ name: "Frank Herbert" }],
    bookType: "solo",
    formats: [],
    genres: [],
    isFavorite: false,
    language: "ukrainian",
    ownershipStatus: "none",
    readingStatus: "not_started",
    tags: [],
    title: "Dune",
    ...overrides,
  };
}

function progressRow(
  overrides: Partial<NonNullable<BookWithRelations["readingProgress"]>> = {},
): BookWithRelations["readingProgress"] {
  return {
    abandonedAt: null,
    bookId: BOOK_ID,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    currentPage: null,
    finishedAt: null,
    id: "88888888-8888-4888-8888-888888888882",
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  } as BookWithRelations["readingProgress"];
}

function resolvedCreate(overrides: Partial<ResolvedBookCreate> = {}): ResolvedBookCreate {
  return {
    authorIds: [AUTHOR_ID],
    firstAuthorName: "Frank Herbert",
    listIds: [],
    partNumber: null,
    publisherId: PUBLISHER_ID,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: null,
    queuePriorityTargetDate: null,
    seriesId: null,
    tagIds: [],
    ...overrides,
  };
}

function resolvedUpdate(overrides: Partial<ResolvedBookUpdate> = {}): ResolvedBookUpdate {
  return {
    authorIds: undefined,
    fields: {},
    listIds: undefined,
    queueRemoval: null,
    seriesPlacement: { partNumber: null, seriesId: null },
    tagIds: undefined,
    ...overrides,
  };
}

function updateDataFromFirstCall(repository: Repository): UpdateBookData {
  const call = repository.updateOwned.mock.calls.at(0);
  if (call === undefined) {
    throw new Error("updateOwned was not called");
  }
  return call[2] as UpdateBookData;
}

describe("BooksService.create", () => {
  it("delegates reference resolution to the resolver and creates the book", async () => {
    const { relationsResolver, repository, service } = buildService();
    const input = minimalCreateInput();

    await service.create(USER_ID, input);

    expect(relationsResolver.resolveAuthors).toHaveBeenCalledWith({
      references: input.authors,
      userId: USER_ID,
    });
    expect(relationsResolver.resolveForCreate).toHaveBeenCalledWith(
      {
        input,
        resolvedAuthors: { authorIds: [AUTHOR_ID], firstAuthorName: "Frank Herbert" },
        userId: USER_ID,
      },
      TX,
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("threads the resolved references into the repository create payload", async () => {
    const { relationsResolver, repository, service } = buildService();
    relationsResolver.resolveForCreate.mockResolvedValue(
      resolvedCreate({
        authorIds: [AUTHOR_ID, AUTHOR_ID_B],
        firstAuthorName: "Terry Pratchett",
        listIds: [LIST_ID],
        partNumber: 2,
        publisherId: PUBLISHER_ID,
        queuePosition: 5,
        queuePriority: "high",
        seriesId: SERIES_ID,
        tagIds: [TAG_ID],
      }),
    );

    await service.create(USER_ID, minimalCreateInput({ coverMediaId: MEDIA_ID }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        authorIds: [AUTHOR_ID, AUTHOR_ID_B],
        coverMediaId: MEDIA_ID,
        firstAuthorName: "Terry Pratchett",
        listIds: [LIST_ID],
        partNumber: 2,
        publisherId: PUBLISHER_ID,
        queuePosition: 5,
        queuePriority: "high",
        seriesId: SERIES_ID,
        tagIds: [TAG_ID],
      }),
      expect.any(Date),
      TX,
    );
  });

  it("returns the BookView with nested author, publisher and tags", async () => {
    const { service } = buildService({
      create: bookRow({
        tags: [
          {
            tag: {
              createdAt: new Date("2026-02-01T10:00:00.000Z"),
              id: TAG_ID,
              name: "dark academia",
              normalizedName: "dark academia",
              updatedAt: new Date("2026-02-02T11:00:00.000Z"),
              userId: USER_ID,
            },
          },
        ] as BookWithRelations["tags"],
      }),
    });

    const view = await service.create(USER_ID, minimalCreateInput({ tags: ["dark academia"] }));

    expect(view).toEqual({
      ageCategory: "not_specified",
      authors: [{ id: AUTHOR_ID, name: "Frank Herbert" }],
      bookType: "solo",
      cover: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      dedication: null,
      delivery: { active: null, latest: null, totalCount: 0 },
      description: null,
      favoriteAddedAt: null,
      formats: [],
      genres: [],
      hasUnreadEarlierSeriesParts: null,
      id: BOOK_ID,
      illustrator: null,
      isbn: null,
      isFavorite: false,
      isFavoriteDedication: false,
      isInReadingQueue: false,
      language: "ukrainian",
      lists: [],
      loanInfo: null,
      originalTitle: null,
      ownershipStatus: "none",
      pagesCount: null,
      pagesCountUnavailable: false,
      partNumber: null,
      publicationYear: null,
      publisher: { id: PUBLISHER_ID, name: "Penguin" },
      purchaseInfo: null,
      queuePriority: null,
      queuePriorityReason: null,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: null,
      readingProgress: null,
      readingStatus: "not_started",
      series: null,
      tags: [{ id: TAG_ID, name: "dark academia" }],
      title: "Dune",
      translator: null,
      updatedAt: "2026-02-02T11:00:00.000Z",
      userId: USER_ID,
      wishlistAddedAt: null,
    });
  });

  it("builds a reading-progress payload for a reading book and passes it to the repository", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        readingProgress: { currentPage: 42, note: "great so far", startedAt: "2026-02-01" },
        readingStatus: "reading",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        readingProgress: {
          abandonedAt: null,
          currentPage: 42,
          finishedAt: null,
          impression: null,
          lastProgressUpdateAt: null,
          note: "great so far",
          pausedAt: null,
          rating: null,
          startedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      }),
      expect.any(Date),
      TX,
    );
  });

  it("does not build a reading-progress payload when the status does not use one", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        readingProgress: { currentPage: 42, startedAt: "2026-02-01" },
        readingStatus: "not_started",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ readingProgress: null }),
      expect.any(Date),
      TX,
    );
  });

  it("builds purchase info for a want_to_buy book and ignores delivery and loan blocks", async () => {
    const { repository, service, singleBookOrder } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        deliveryInfo: { storeName: "Should be ignored" },
        ownershipStatus: "want_to_buy",
        purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      }),
    );

    expect(singleBookOrder.create).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        loanInfo: null,
        purchaseInfo: {
          currency: "UAH",
          expectedPrice: 299.99,
          note: null,
          storeName: "Yakaboo",
          storeUrl: null,
        },
      }),
      expect.any(Date),
      TX,
    );
  });

  it("defaults the delivery status to ordered for an in_transit book without one", async () => {
    const { repository, service, singleBookOrder } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        deliveryInfo: { currency: "UAH", orderNumber: "TTN-1", price: 350, storeName: "Yakaboo" },
        ownershipStatus: "in_transit",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ purchaseInfo: null }),
      expect.any(Date),
      TX,
    );
    expect(singleBookOrder.create).toHaveBeenCalledWith(
      {
        bookId: BOOK_ID,
        draft: {
          currency: "UAH",
          deliveryService: null,
          expectedDeliveryDate: null,
          hasShipment: true,
          isFree: false,
          note: null,
          orderDate: null,
          orderNumber: "TTN-1",
          price: 350,
          status: "ordered",
          storeName: "Yakaboo",
          trackingNumber: null,
          trackingUrl: null,
        },
        userId: USER_ID,
      },
      TX,
    );
  });

  it("builds loan info for a lent_to_someone book", async () => {
    const { repository, service } = buildService();

    await service.create(
      USER_ID,
      minimalCreateInput({
        loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
        ownershipStatus: "lent_to_someone",
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        loanInfo: {
          contact: null,
          expectedReturnDate: null,
          loanContactId: LOAN_CONTACT_ID,
          loanDate: new Date("2026-02-01T00:00:00.000Z"),
          note: null,
          personName: "Olha",
          remindBeforeDays: null,
          remindToReturn: false,
        },
        purchaseInfo: null,
      }),
      expect.any(Date),
      TX,
    );
  });

  it("passes the input cover media id to the repository create", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ coverMediaId: MEDIA_ID }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ coverMediaId: MEDIA_ID }),
      expect.any(Date),
      TX,
    );
  });

  it("stamps favoriteAddedAt when the book is created as a favorite", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ isFavorite: true }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ favoriteAddedAt: expect.any(Date), isFavorite: true }),
      expect.any(Date),
      TX,
    );
  });

  it("leaves favoriteAddedAt null when the book is created as a non-favorite", async () => {
    const { repository, service } = buildService();

    await service.create(USER_ID, minimalCreateInput({ isFavorite: false }));

    expect(repository.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ favoriteAddedAt: null, isFavorite: false }),
      expect.any(Date),
      TX,
    );
  });

  it("propagates a resolver rejection and does not create the book", async () => {
    const { relationsResolver, repository, service } = buildService();
    relationsResolver.resolveForCreate.mockRejectedValue(new BadRequestError("Invalid genres"));

    await expect(service.create(USER_ID, minimalCreateInput())).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("throws the error mapped by the resolver when the repository create raises", async () => {
    const { relationsResolver, repository, service } = buildService();
    const original = new Error("write failed");
    const mapped = new BadRequestError("Duplicate part number");
    relationsResolver.resolveForCreate.mockResolvedValue(
      resolvedCreate({ partNumber: 2, seriesId: SERIES_ID }),
    );
    relationsResolver.mapSeriesPartNumberWriteError.mockResolvedValue(mapped);
    repository.create.mockRejectedValue(original);

    await expect(service.create(USER_ID, minimalCreateInput())).rejects.toBe(mapped);
    expect(relationsResolver.mapSeriesPartNumberWriteError).toHaveBeenCalledWith({
      error: original,
      excludeBookId: null,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });
  });
});

describe("BooksService.getById", () => {
  it("returns the mapped view when the book is owned by the caller", async () => {
    const { service } = buildService({ findOwnedById: bookRow({ userId: USER_ID }) });

    await expect(service.getById(USER_ID, BOOK_ID)).resolves.toMatchObject({ id: BOOK_ID });
  });

  it("throws NotFoundError when the book does not belong to the caller", async () => {
    const { service } = buildService({ findOwnedById: null });

    await expect(service.getById(OTHER_USER_ID, BOOK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("BooksService cover replacement on update", () => {
  it("delegates cover cleanup for the previous cover when it is replaced", async () => {
    const previousCoverMediaId = "88888888-8888-4888-8888-888888888802";
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: previousCoverMediaId }),
      updateOwned: bookRow({ coverMediaId: MEDIA_ID }),
    });

    await service.update(USER_ID, BOOK_ID, { coverMediaId: MEDIA_ID });

    expect(coverCleanup.deleteIfOrphaned).toHaveBeenCalledWith({
      mediaId: previousCoverMediaId,
      userId: USER_ID,
    });
  });

  it("does not run cover cleanup when the cover is unchanged", async () => {
    const { coverCleanup, service } = buildService({
      findOwnedById: bookRow({ coverMediaId: null }),
      updateOwned: bookRow(),
    });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    expect(coverCleanup.deleteIfOrphaned).not.toHaveBeenCalled();
  });
});

describe("BooksService.update", () => {
  it("throws NotFoundError when the book does not belong to the caller", async () => {
    const { repository, service } = buildService({ findOwnedById: null });

    await expect(service.update(OTHER_USER_ID, BOOK_ID, { title: "New" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("assigns only the provided scalar fields on top of the resolver field patch", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("passes through an explicit null to clear a nullable scalar field", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { dedication: null });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ dedication: null });
  });

  it("stamps favoriteAddedAt when the book becomes a favorite", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ favoriteAddedAt: null, isFavorite: false }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ favoriteAddedAt: expect.any(Date), isFavorite: true });
  });

  it("clears favoriteAddedAt when the book stops being a favorite", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: false });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ favoriteAddedAt: null, isFavorite: false });
  });

  it("leaves favoriteAddedAt untouched when an already-favorite book is edited", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true, title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("does not touch favorite fields when isFavorite is omitted", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z"),
        isFavorite: true,
      }),
    });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("sets the dedication favorite without touching the book favorite", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ dedication: "For my family", isFavorite: false }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavoriteDedication: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ isFavoriteDedication: true });
  });

  it("leaves the dedication favorite untouched when only the book favorite changes", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ dedication: "For my family", isFavorite: false }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ favoriteAddedAt: expect.any(Date), isFavorite: true });
  });

  it("sets both favorite states in a single update", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ dedication: "For my family", isFavorite: false }),
    });

    await service.update(USER_ID, BOOK_ID, { isFavorite: true, isFavoriteDedication: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({
      favoriteAddedAt: expect.any(Date),
      isFavorite: true,
      isFavoriteDedication: true,
    });
  });

  it("normalizes an empty dedication to null", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { dedication: "" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ dedication: null });
  });

  it("clears the dedication favorite when the dedication is cleared", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ dedication: "For my family", isFavoriteDedication: true }),
    });

    await service.update(USER_ID, BOOK_ID, { dedication: null });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ dedication: null, isFavoriteDedication: false });
  });

  it("lets the auto-reset override a dedication favorite sent in the same clearing patch", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ dedication: "For my family", isFavoriteDedication: true }),
    });

    await service.update(USER_ID, BOOK_ID, { dedication: "", isFavoriteDedication: true });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ dedication: null, isFavoriteDedication: false });
  });

  it("leaves the dedication favorite untouched on an unrelated patch without a dedication", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.fields).toEqual({ title: "Renamed" });
  });

  it("threads the resolver output into the repository update payload", async () => {
    const { relationsResolver, repository, service } = buildService({ findOwnedById: bookRow() });
    relationsResolver.resolveForUpdate.mockResolvedValue(
      resolvedUpdate({
        authorIds: [AUTHOR_ID_B],
        fields: { firstAuthorName: "Ursula K. Le Guin", publisherId: PUBLISHER_ID },
        listIds: [LIST_ID],
        tagIds: [TAG_ID],
      }),
    );

    await service.update(USER_ID, BOOK_ID, { title: "Renamed" });

    const data = updateDataFromFirstCall(repository);
    expect(data.authorIds).toEqual([AUTHOR_ID_B]);
    expect(data.tagIds).toEqual([TAG_ID]);
    expect(data.listIds).toEqual([LIST_ID]);
    expect(data.fields).toMatchObject({
      firstAuthorName: "Ursula K. Le Guin",
      publisherId: PUBLISHER_ID,
      title: "Renamed",
    });
  });

  it("marks the loan block returned when ownership moves away from a loan status", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ ownershipStatus: "borrowed_from_someone" }),
    });

    await service.update(USER_ID, BOOK_ID, { ownershipStatus: "owned" });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toMatchObject({ kind: "return" });
  });

  it("builds the purchase block when ownership becomes want_to_buy", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, {
      ownershipStatus: "want_to_buy",
      purchaseInfo: { storeName: "Yakaboo" },
    });

    const data = updateDataFromFirstCall(repository);
    expect(data.purchaseInfo).toEqual({
      create: {
        currency: null,
        expectedPrice: null,
        note: null,
        storeName: "Yakaboo",
        storeUrl: null,
      },
      update: {
        currency: undefined,
        expectedPrice: undefined,
        note: undefined,
        storeName: "Yakaboo",
        storeUrl: undefined,
      },
    });
  });

  it("builds the reading-progress block when the status becomes reading", async () => {
    const { repository, service } = buildService({ findOwnedById: bookRow() });

    await service.update(USER_ID, BOOK_ID, {
      readingProgress: { currentPage: 30 },
      readingStatus: "reading",
    });

    const data = updateDataFromFirstCall(repository);
    expect(data.readingProgress).toMatchObject({
      create: { currentPage: 30 },
      update: { currentPage: 30 },
    });
  });

  it("uses the stored reading status when validating current page so a payload-only page is checked against the db pages", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({ pagesCount: 100, readingStatus: "reading" }),
    });

    const input: UpdateBookInput = { readingProgress: { currentPage: 150 } };

    await expect(service.update(USER_ID, BOOK_ID, input)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("merges the payload page against the stored pages count for the cross-field check", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 100,
        readingProgress: progressRow({ currentPage: 150 }),
        readingStatus: "reading",
      }),
    });

    await expect(service.update(USER_ID, BOOK_ID, { pagesCount: 120 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("does not run the page check when the merged status does not use reading progress", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({ pagesCount: 100, readingStatus: "not_started" }),
    });

    await service.update(USER_ID, BOOK_ID, { pagesCount: 50 });

    expect(repository.updateOwned).toHaveBeenCalledTimes(1);
  });

  it("returns the mapped view from the reread row", async () => {
    const { service } = buildService({
      findOwnedById: bookRow(),
      updateOwned: bookRow({ title: "Updated Title" }),
    });

    const view = await service.update(USER_ID, BOOK_ID, { title: "Updated Title" });

    expect(view).toMatchObject({ id: BOOK_ID, title: "Updated Title" });
  });

  it("emits a partial loan update that omits absent sub-fields and carries only the provided one", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loans: [loanRow({ note: null, personName: "Olha" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { loanInfo: { note: "return next week" } });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toEqual({
      create: {
        contact: null,
        expectedReturnDate: null,
        loanContactId: LOAN_CONTACT_ID,
        loanDate: null,
        note: "return next week",
        personName: "Olha",
        remindBeforeDays: null,
        remindToReturn: false,
      },
      kind: "upsertActive",
      type: "borrowed_from_someone",
      update: {
        contact: undefined,
        expectedReturnDate: undefined,
        loanContactId: LOAN_CONTACT_ID,
        loanDate: undefined,
        note: "return next week",
        personName: undefined,
      },
    });
  });

  it("emits an explicit null in the partial loan update so a sub-field is cleared", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loans: [loanRow({ note: "old note", personName: "Olha" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { loanInfo: { note: null } });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toMatchObject({ update: { note: null } });
  });

  it("retakes the name and contact snapshot when the loan moves to another contact", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loans: [loanRow({ contact: "olha@example.com", personName: "Olha" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, {
      loanInfo: { loanContactId: OTHER_LOAN_CONTACT_ID, personName: "Taras" },
    });

    const data = updateDataFromFirstCall(repository);
    expect(data.loanInfo).toMatchObject({
      update: { contact: null, loanContactId: OTHER_LOAN_CONTACT_ID, personName: "Taras" },
    });
  });

  it("emits a partial reading-progress update that preserves untouched sub-fields", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 400,
        readingProgress: progressRow({ currentPage: 10, rating: 4 }),
        readingStatus: "reading",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { readingProgress: { currentPage: 50 } });

    const data = updateDataFromFirstCall(repository);
    expect(data.readingProgress).toMatchObject({
      update: { currentPage: 50, rating: undefined, startedAt: undefined },
    });
  });

  it("allows a status-only switch between loan statuses when a loan row already has a person name", async () => {
    const { repository, service } = buildService({
      findOwnedById: bookRow({
        loans: [loanRow({ personName: "Olha" })],
        ownershipStatus: "borrowed_from_someone",
      }),
    });

    await service.update(USER_ID, BOOK_ID, { ownershipStatus: "lent_to_someone" });

    expect(repository.updateOwned).toHaveBeenCalledTimes(1);
  });

  it("rejects a switch to a loan status when neither payload nor existing row has a person name", async () => {
    const { service } = buildService({ findOwnedById: bookRow() });

    await expect(
      service.update(USER_ID, BOOK_ID, { ownershipStatus: "borrowed_from_someone" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("rejects lowering the page count below a stored current page", async () => {
    const { service } = buildService({
      findOwnedById: bookRow({
        pagesCount: 300,
        readingProgress: progressRow({ currentPage: 250 }),
        readingStatus: "reading",
      }),
    });

    await expect(service.update(USER_ID, BOOK_ID, { pagesCount: 200 })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("propagates a resolver rejection and does not update the book", async () => {
    const { relationsResolver, repository, service } = buildService({ findOwnedById: bookRow() });
    relationsResolver.resolveForUpdate.mockRejectedValue(new BadRequestError("Invalid genres"));

    await expect(
      service.update(USER_ID, BOOK_ID, { genres: ["not-a-real-genre"] }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.updateOwned).not.toHaveBeenCalled();
  });

  it("throws the error mapped by the resolver when the repository update raises", async () => {
    const { relationsResolver, repository, service } = buildService({
      findOwnedById: bookRow({ partNumber: 3, seriesId: SERIES_ID }),
    });
    const original = new Error("write failed");
    const mapped = new BadRequestError("Duplicate part number");
    relationsResolver.resolveForUpdate.mockResolvedValue(
      resolvedUpdate({ seriesPlacement: { partNumber: 2, seriesId: SERIES_ID } }),
    );
    relationsResolver.mapSeriesPartNumberWriteError.mockResolvedValue(mapped);
    repository.updateOwned.mockRejectedValue(original);

    await expect(
      service.update(USER_ID, BOOK_ID, { partNumber: 2 } as UpdateBookInput),
    ).rejects.toBe(mapped);
    expect(relationsResolver.mapSeriesPartNumberWriteError).toHaveBeenCalledWith({
      error: original,
      excludeBookId: BOOK_ID,
      placement: { partNumber: 2, seriesId: SERIES_ID },
      userId: USER_ID,
    });
  });
});

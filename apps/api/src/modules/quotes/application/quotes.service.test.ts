import type { CreateQuoteInput, QuotesQuery } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type {
  OwnedBook,
  QuoteFilterCounts,
  QuoteWithBook,
} from "../infrastructure/quotes.repository.js";
import type { QuotesRepository } from "../infrastructure/quotes.repository.js";
import type { QuoteLifecycleService } from "./quote-lifecycle.service.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { QuotesService } from "./quotes.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_BOOK_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const QUOTE_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-05-01T10:00:00.000Z");

function book(overrides: Partial<QuoteWithBook["book"]> = {}): QuoteWithBook["book"] {
  return {
    ageCategory: "not_specified",
    coverMedia: null,
    coverMediaId: null,
    createdAt: NOW,
    dedication: null,
    deletedAt: null,
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
    originalTitle: null,
    ownershipStatus: "none",
    pagesCount: null,
    pagesCountUnavailable: false,
    partNumber: null,
    publicationYear: null,
    publisherId: null,
    purgeAt: null,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: null,
    queuePriorityTargetDate: null,
    readingStatus: "not_started",
    seriesId: null,
    title: "Dune",
    translator: null,
    updatedAt: NOW,
    userId: USER_ID,
    wishlistAddedAt: null,
    ...overrides,
  };
}

function buildService(): {
  lifecycleService: { softDelete: ReturnType<typeof vi.fn> };
  mediaService: { buildViewOrNull: ReturnType<typeof vi.fn> };
  repository: {
    authorQuoteLinks: ReturnType<typeof vi.fn>;
    bookCounts: ReturnType<typeof vi.fn>;
    bookQuoteCounts: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    filterCounts: ReturnType<typeof vi.fn>;
    findOwnedBook: ReturnType<typeof vi.fn>;
    findOwnedQuote: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    listForBook: ReturnType<typeof vi.fn>;
    summaryData: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  service: QuotesService;
} {
  const repository = {
    authorQuoteLinks: vi.fn().mockResolvedValue([]),
    bookCounts: vi.fn().mockResolvedValue({ favorites: 0, spoiler: 0, total: 0 }),
    bookQuoteCounts: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(quote()),
    filterCounts: vi.fn().mockResolvedValue(filterCounts()),
    findOwnedBook: vi.fn().mockResolvedValue(ownedBook()),
    findOwnedQuote: vi.fn().mockResolvedValue(quote()),
    list: vi.fn().mockResolvedValue([]),
    listForBook: vi.fn().mockResolvedValue([]),
    summaryData: vi.fn(),
    update: vi.fn().mockResolvedValue(quote()),
  };

  const mediaService = { buildViewOrNull: vi.fn().mockReturnValue(null) };

  const lifecycleService = {
    softDelete: vi.fn().mockResolvedValue({
      deletedAt: NOW.toISOString(),
      purgeAt: NOW.toISOString(),
      quoteId: QUOTE_ID,
    }),
  };

  const service = new QuotesService(
    repository as unknown as QuotesRepository,
    mediaService as unknown as MediaService,
    lifecycleService as unknown as QuoteLifecycleService,
  );

  return { lifecycleService, mediaService, repository, service };
}

function createInput(overrides: Partial<CreateQuoteInput> = {}): CreateQuoteInput {
  return {
    chapter: null,
    comment: null,
    isFavorite: false,
    isSpoiler: false,
    page: null,
    text: "Fear is the mind-killer",
    ...overrides,
  };
}

function filterCounts(overrides: Partial<QuoteFilterCounts> = {}): QuoteFilterCounts {
  return {
    all: 0,
    favorites: 0,
    no_spoiler: 0,
    with_comment: 0,
    with_spoiler: 0,
    without_comment: 0,
    ...overrides,
  };
}

function ownedBook(overrides: Partial<OwnedBook> = {}): OwnedBook {
  return { id: BOOK_ID, pagesCount: null, ...overrides };
}

function query(overrides: Partial<QuotesQuery> = {}): QuotesQuery {
  return {
    bookId: undefined,
    filter: "all",
    pageNumber: 1,
    pageSize: 12,
    q: undefined,
    sort: "newest",
    ...overrides,
  };
}

function quote(overrides: Partial<QuoteWithBook> = {}): QuoteWithBook {
  return {
    book: book(),
    bookId: BOOK_ID,
    chapter: null,
    comment: null,
    createdAt: NOW,
    deletedAt: null,
    id: QUOTE_ID,
    isFavorite: false,
    isSpoiler: false,
    page: null,
    purgeAt: null,
    text: "Fear is the mind-killer",
    updatedAt: NOW,
    userId: USER_ID,
    ...overrides,
  };
}

describe("QuotesService.createForBook", () => {
  it("throws NotFoundError when the book is not owned by the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedBook.mockResolvedValue(null);

    await expect(
      service.createForBook({ bookId: BOOK_ID, input: createInput(), userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a page greater than the book's page count", async () => {
    const { repository, service } = buildService();
    repository.findOwnedBook.mockResolvedValue(ownedBook({ pagesCount: 100 }));

    await expect(
      service.createForBook({
        bookId: BOOK_ID,
        input: createInput({ page: 200 }),
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("accepts a page when the book has no page count", async () => {
    const { repository, service } = buildService();
    repository.findOwnedBook.mockResolvedValue(ownedBook({ pagesCount: null }));

    await service.createForBook({
      bookId: BOOK_ID,
      input: createInput({ page: 999 }),
      userId: USER_ID,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ page: 999 }) }),
    );
  });

  it("persists the spoiler and favorite flags as given and trims blank optional text to null", async () => {
    const { repository, service } = buildService();

    await service.createForBook({
      bookId: BOOK_ID,
      input: createInput({
        chapter: "   ",
        comment: "  a memorable line  ",
        isFavorite: true,
        isSpoiler: true,
        page: 42,
      }),
      userId: USER_ID,
    });

    expect(repository.create).toHaveBeenCalledWith({
      bookId: BOOK_ID,
      data: {
        chapter: null,
        comment: "a memorable line",
        isFavorite: true,
        isSpoiler: true,
        page: 42,
        text: "Fear is the mind-killer",
      },
      userId: USER_ID,
    });
  });

  it("maps the created quote to a view with an ISO timestamp and a null cover", async () => {
    const { mediaService, repository, service } = buildService();
    repository.create.mockResolvedValue(quote({ isFavorite: true, isSpoiler: true }));

    const view = await service.createForBook({
      bookId: BOOK_ID,
      input: createInput(),
      userId: USER_ID,
    });

    expect(view).toMatchObject({
      book: { cover: null, firstAuthorName: "Frank Herbert", id: BOOK_ID, title: "Dune" },
      bookId: BOOK_ID,
      createdAt: NOW.toISOString(),
      id: QUOTE_ID,
      isFavorite: true,
      isSpoiler: true,
    });
    expect(mediaService.buildViewOrNull).toHaveBeenCalledWith(null);
  });
});

describe("QuotesService.updateForBook", () => {
  it("scopes the quote lookup to the user and the book in the path", async () => {
    const { repository, service } = buildService();

    await service.updateForBook({
      bookId: BOOK_ID,
      input: createInput(),
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.findOwnedQuote).toHaveBeenCalledWith({
      bookId: BOOK_ID,
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });
  });

  it("throws NotFoundError when the quote does not belong to the user", async () => {
    const { repository, service } = buildService();
    repository.findOwnedQuote.mockResolvedValue(null);

    await expect(
      service.updateForBook({
        bookId: BOOK_ID,
        input: createInput(),
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("updates only the favorite flag and leaves every other field untouched", async () => {
    const { repository, service } = buildService();

    await service.updateForBook({
      bookId: BOOK_ID,
      input: { isFavorite: true },
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      data: { isFavorite: true },
      quoteId: QUOTE_ID,
    });
  });

  it("updates only the spoiler flag without wiping the other fields", async () => {
    const { repository, service } = buildService();

    await service.updateForBook({
      bookId: BOOK_ID,
      input: { isSpoiler: true },
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      data: { isSpoiler: true },
      quoteId: QUOTE_ID,
    });
  });

  it("clears only the chapter when it is explicitly set to null", async () => {
    const { repository, service } = buildService();

    await service.updateForBook({
      bookId: BOOK_ID,
      input: { chapter: null },
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      data: { chapter: null },
      quoteId: QUOTE_ID,
    });
  });

  it("never sends an omitted field to the repository", async () => {
    const { repository, service } = buildService();

    await service.updateForBook({
      bookId: BOOK_ID,
      input: { text: "revised" },
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      data: { text: "revised" },
      quoteId: QUOTE_ID,
    });
  });

  it("rejects a page greater than the book's page count only when the page is being set", async () => {
    const { repository, service } = buildService();
    repository.findOwnedQuote.mockResolvedValue(quote({ book: book({ pagesCount: 50 }) }));

    await expect(
      service.updateForBook({
        bookId: BOOK_ID,
        input: { page: 51 },
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("does not check the page bound when the page is omitted on edit", async () => {
    const { repository, service } = buildService();
    repository.findOwnedQuote.mockResolvedValue(quote({ book: book({ pagesCount: 50 }) }));

    await service.updateForBook({
      bookId: BOOK_ID,
      input: { text: "revised" },
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    expect(repository.update).toHaveBeenCalledWith({
      data: { text: "revised" },
      quoteId: QUOTE_ID,
    });
  });
});

describe("QuotesService.deleteForBook", () => {
  it("throws NotFoundError when the book is not owned", async () => {
    const { lifecycleService, repository, service } = buildService();
    repository.findOwnedBook.mockResolvedValue(null);

    await expect(
      service.deleteForBook({ bookId: BOOK_ID, quoteId: QUOTE_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(lifecycleService.softDelete).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the quote is not owned", async () => {
    const { lifecycleService, repository, service } = buildService();
    repository.findOwnedQuote.mockResolvedValue(null);

    await expect(
      service.deleteForBook({ bookId: BOOK_ID, quoteId: QUOTE_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(lifecycleService.softDelete).not.toHaveBeenCalled();
  });

  it("moves the quote to the trash after verifying ownership", async () => {
    const { lifecycleService, service } = buildService();

    await service.deleteForBook({ bookId: BOOK_ID, quoteId: QUOTE_ID, userId: USER_ID });

    expect(lifecycleService.softDelete).toHaveBeenCalledWith({
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });
  });
});

describe("QuotesService.facets", () => {
  it("normalizes the search term and scopes the counts by book only", async () => {
    const { repository, service } = buildService();

    await service.facets({ query: { bookId: BOOK_ID, q: "  fear   mind  " }, userId: USER_ID });

    expect(repository.filterCounts).toHaveBeenCalledWith({
      authorIds: undefined,
      bookIds: [BOOK_ID],
      createdFrom: undefined,
      createdTo: undefined,
      search: "fear mind",
      userId: USER_ID,
    });
  });

  it("folds a legacy bookId and an explicit book list into one set of ids", async () => {
    const { repository, service } = buildService();

    await service.facets({
      query: { book: [OTHER_BOOK_ID, BOOK_ID], bookId: BOOK_ID },
      userId: USER_ID,
    });

    expect(repository.filterCounts).toHaveBeenCalledWith(
      expect.objectContaining({ bookIds: [OTHER_BOOK_ID, BOOK_ID] }),
    );
  });

  it("leaves each facet dimension out of its own counts", async () => {
    const { repository, service } = buildService();

    await service.facets({
      query: { author: [AUTHOR_ID], book: [BOOK_ID] },
      userId: USER_ID,
    });

    expect(repository.bookQuoteCounts).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: [AUTHOR_ID], bookIds: undefined }),
    );
    expect(repository.bookQuoteCounts).toHaveBeenCalledWith(
      expect.objectContaining({ authorIds: undefined, bookIds: [BOOK_ID] }),
    );
  });

  it("drops a blank search term instead of scoping the counts to it", async () => {
    const { repository, service } = buildService();

    await service.facets({ query: { q: "   " }, userId: USER_ID });

    expect(repository.filterCounts).toHaveBeenCalledWith({
      authorIds: undefined,
      bookIds: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      search: undefined,
      userId: USER_ID,
    });
  });

  it("maps each repository filter count onto its own facet field", async () => {
    const { repository, service } = buildService();
    repository.filterCounts.mockResolvedValue(
      filterCounts({
        all: 9,
        favorites: 4,
        no_spoiler: 7,
        with_comment: 3,
        with_spoiler: 2,
        without_comment: 6,
      }),
    );

    const view = await service.facets({ query: {}, userId: USER_ID });

    expect(view).toEqual({
      authors: [],
      books: [],
      favoritesCount: 4,
      spoilerCount: 2,
      totalCount: 9,
      withCommentCount: 3,
      withoutCommentCount: 6,
      withoutSpoilerCount: 7,
    });
  });
});

describe("QuotesService.list", () => {
  it("normalizes the search term and translates paging into skip and take", async () => {
    const { repository, service } = buildService();
    repository.count.mockResolvedValue(30);

    const result = await service.list({
      query: query({ pageNumber: 3, pageSize: 10, q: "  fear   mind  " }),
      userId: USER_ID,
    });

    expect(repository.list).toHaveBeenCalledWith({
      bookId: undefined,
      filter: "all",
      search: "fear mind",
      skip: 20,
      sort: "newest",
      take: 10,
      userId: USER_ID,
    });
    expect(result).toMatchObject({ page: 3, pagesCount: 3, pageSize: 10, totalCount: 30 });
  });
});

describe("QuotesService.summary", () => {
  it("maps aggregate repository data into the summary view", async () => {
    const { repository, service } = buildService();
    repository.summaryData.mockResolvedValue({
      bookCounts: [{ bookId: BOOK_ID, count: 4, firstAuthorName: "Frank Herbert", title: "Dune" }],
      favorites: 2,
      spoiler: 1,
      total: 4,
      withComment: 3,
    });

    const summary = await service.summary({ userId: USER_ID });

    expect(summary).toEqual({
      favoritesCount: 2,
      spoilerCount: 1,
      topAuthor: { name: "Frank Herbert", quotesCount: 4 },
      topBook: { id: BOOK_ID, quotesCount: 4, title: "Dune" },
      totalCount: 4,
      withCommentCount: 3,
      withoutSpoilerCount: 3,
    });
  });
});

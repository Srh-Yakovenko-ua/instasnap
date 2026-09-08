import type { QuotesFacetsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { QuotesFacetsViewSchema } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { addDaysToIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QuotesModule } from "../quotes.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, QuotesModule]);
  app = context.app;
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function addQuote(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/quotes`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
  if (res.status !== 201) {
    throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

async function authorIdByName(accessToken: string, name: string): Promise<string> {
  const body = await facetsBody(accessToken);
  const match = body.authors.find((author) => author.name === name);
  if (match === undefined) {
    throw new Error(`author not found in facets: ${name}`);
  }
  return match.id;
}

async function createBook(
  accessToken: string,
  body: Record<string, unknown> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], title: "Dune", ...body });
  if (res.status !== 201) {
    throw new Error(`book creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

function facetCounts(body: QuotesFacetsView): Omit<QuotesFacetsView, "authors" | "books"> {
  const { authors: _authors, books: _books, ...counts } = body;
  return counts;
}

async function facetsBody(accessToken: string, queryString = ""): Promise<QuotesFacetsView> {
  const res = await quotesFacets(accessToken, queryString);
  return QuotesFacetsViewSchema.parse(res.body);
}

function listQuotes(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/quotes${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function quotesFacets(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/quotes/facets${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function quotesSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/quotes/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function texts(body: { items: Array<{ text: string }> }): string[] {
  return body.items.map((item) => item.text);
}

describe("GET /api/quotes authorization", () => {
  it("returns 401 without an Authorization header for the list", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes");
    expect(res.status).toBe(401);
  });

  it("returns 401 without an Authorization header for the summary", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes/summary");
    expect(res.status).toBe(401);
  });

  it("returns 401 without an Authorization header for the facets", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes/facets");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/quotes", () => {
  it("returns an empty page when the user has no quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listQuotes(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("lists quotes across books newest first with a book preview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken);
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, { text: "older" });
    await addQuote(accessToken, hyperion, { text: "newer" });

    const res = await listQuotes(accessToken);

    expect(texts(res.body)).toEqual(["newer", "older"]);
    expect(res.body.items[0].book).toMatchObject({
      cover: null,
      firstAuthorName: "Dan Simmons",
      title: "Hyperion",
    });
  });

  it("does not expose another user's quotes", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await addQuote(owner.accessToken, bookId, { text: "secret" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listQuotes(stranger.accessToken);

    expect(res.body.items).toEqual([]);
  });

  it("filters by the bookId query param", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken);
    const hyperion = await createBook(accessToken, { title: "Hyperion" });
    await addQuote(accessToken, dune, { text: "from dune" });
    await addQuote(accessToken, hyperion, { text: "from hyperion" });

    const res = await listQuotes(accessToken, `?bookId=${dune}`);

    expect(texts(res.body)).toEqual(["from dune"]);
  });
});

describe("GET /api/quotes filters", () => {
  async function seedMixed(accessToken: string, bookId: string): Promise<void> {
    await addQuote(accessToken, bookId, { isFavorite: true, text: "favorite" });
    await addQuote(accessToken, bookId, { isSpoiler: true, text: "spoiler" });
    await addQuote(accessToken, bookId, { comment: "thoughts", text: "commented" });
    await addQuote(accessToken, bookId, { text: "plain" });
  }

  it("filters favorites, spoilers, non-spoilers and commented quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await seedMixed(accessToken, bookId);

    const favorites = await listQuotes(accessToken, "?filter=favorites");
    const spoilers = await listQuotes(accessToken, "?filter=with_spoiler");
    const noSpoilers = await listQuotes(accessToken, "?filter=no_spoiler");
    const commented = await listQuotes(accessToken, "?filter=with_comment");

    expect(texts(favorites.body)).toEqual(["favorite"]);
    expect(texts(spoilers.body)).toEqual(["spoiler"]);
    expect(texts(noSpoilers.body).sort()).toEqual(["commented", "favorite", "plain"]);
    expect(texts(commented.body)).toEqual(["commented"]);
  });

  it("returns only quotes without a comment for filter=without_comment", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await seedMixed(accessToken, bookId);

    const withoutComment = await listQuotes(accessToken, "?filter=without_comment");

    expect(texts(withoutComment.body).sort()).toEqual(["favorite", "plain", "spoiler"]);
  });
});

describe("GET /api/quotes sorting", () => {
  it("sorts oldest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "one" });
    await addQuote(accessToken, bookId, { text: "two" });

    const res = await listQuotes(accessToken, "?sort=oldest");

    expect(texts(res.body)).toEqual(["one", "two"]);
  });

  it("sorts by page and puts quotes without a page last", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { pagesCount: 500 });
    await addQuote(accessToken, bookId, { page: 200, text: "middle" });
    await addQuote(accessToken, bookId, { text: "no page" });
    await addQuote(accessToken, bookId, { page: 30, text: "early" });

    const res = await listQuotes(accessToken, "?sort=page");

    expect(texts(res.body)).toEqual(["early", "middle", "no page"]);
  });

  it("sorts by book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const zebra = await createBook(accessToken, { title: "Zebra" });
    const apple = await createBook(accessToken, { title: "Apple" });
    await addQuote(accessToken, zebra, { text: "z" });
    await addQuote(accessToken, apple, { text: "a" });

    const res = await listQuotes(accessToken, "?sort=book_title");

    expect(texts(res.body)).toEqual(["a", "z"]);
  });

  it("sorts by author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const zed = await createBook(accessToken, { authors: [{ name: "Zed" }], title: "One" });
    const ann = await createBook(accessToken, { authors: [{ name: "Ann" }], title: "Two" });
    await addQuote(accessToken, zed, { text: "z" });
    await addQuote(accessToken, ann, { text: "a" });

    const res = await listQuotes(accessToken, "?sort=book_author");

    expect(texts(res.body)).toEqual(["a", "z"]);
  });

  it("sorts favorites first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "plain" });
    await addQuote(accessToken, bookId, { isFavorite: true, text: "favorite" });

    const res = await listQuotes(accessToken, "?sort=favorites_first");

    expect(texts(res.body)).toEqual(["favorite", "plain"]);
  });

  it("sorts spoilers first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "plain" });
    await addQuote(accessToken, bookId, { isSpoiler: true, text: "spoiler" });

    const res = await listQuotes(accessToken, "?sort=with_spoiler_first");

    expect(texts(res.body)).toEqual(["spoiler", "plain"]);
  });
});

describe("GET /api/quotes search", () => {
  async function seedSearchable(accessToken: string): Promise<void> {
    const dune = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      originalTitle: "Dune Original",
      title: "Dune",
    });
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, {
      chapter: "Arrakis",
      comment: "about spice",
      page: 87,
      text: "Fear is the mind-killer",
    });
    await addQuote(accessToken, hyperion, { text: "Shrike stands watch" });
  }

  it("searches by quote text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const res = await listQuotes(accessToken, "?q=mind-killer");

    expect(texts(res.body)).toEqual(["Fear is the mind-killer"]);
  });

  it("searches by comment, chapter, book title, author and page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const byComment = await listQuotes(accessToken, "?q=spice");
    const byChapter = await listQuotes(accessToken, "?q=arrakis");
    const byTitle = await listQuotes(accessToken, "?q=hyperion");
    const byAuthor = await listQuotes(accessToken, "?q=herbert");
    const byPage = await listQuotes(accessToken, "?q=87");

    expect(texts(byComment.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byChapter.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byTitle.body)).toEqual(["Shrike stands watch"]);
    expect(texts(byAuthor.body)).toEqual(["Fear is the mind-killer"]);
    expect(texts(byPage.body)).toEqual(["Fear is the mind-killer"]);
  });

  it("searches by a co-author who is not the first author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const collab = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }, { name: "Brian Herbert Jr" }],
      title: "Dune Messiah",
    });
    await addQuote(accessToken, collab, { text: "The past is prologue" });

    const res = await listQuotes(accessToken, "?q=brian");

    expect(res.status).toBe(200);
    expect(texts(res.body)).toEqual(["The past is prologue"]);
  });

  it("does not error on a numeric search larger than any storable page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchable(accessToken);

    const res = await listQuotes(accessToken, "?q=9780441013593");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/quotes pagination and validation", () => {
  it("paginates and reports totals", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addQuote(accessToken, bookId, { text: "one" });
    await addQuote(accessToken, bookId, { text: "two" });
    await addQuote(accessToken, bookId, { text: "three" });

    const res = await listQuotes(accessToken, "?pageSize=2&pageNumber=2&sort=oldest");

    expect(res.body.items).toHaveLength(1);
    expect(texts(res.body)).toEqual(["three"]);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.pagesCount).toBe(2);
    expect(res.body.totalCount).toBe(3);
  });

  it("rejects invalid filter, sort and oversized page size", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const badFilter = await listQuotes(accessToken, "?filter=bogus");
    const badSort = await listQuotes(accessToken, "?sort=bogus");
    const bigPage = await listQuotes(accessToken, "?pageSize=101");

    expect(badFilter.status).toBe(400);
    expect(badSort.status).toBe(400);
    expect(bigPage.status).toBe(400);
  });
});

describe("GET /api/quotes/summary", () => {
  it("returns zeros when there are no quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await quotesSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      favoritesCount: 0,
      spoilerCount: 0,
      topAuthor: null,
      topBook: null,
      totalCount: 0,
      withCommentCount: 0,
      withoutSpoilerCount: 0,
    });
  });

  it("aggregates counts and the top book and author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dune = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const hyperion = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    await addQuote(accessToken, dune, { isFavorite: true, text: "a" });
    await addQuote(accessToken, dune, { comment: "note", isSpoiler: true, text: "b" });
    await addQuote(accessToken, dune, { text: "c" });
    await addQuote(accessToken, hyperion, { text: "d" });

    const res = await quotesSummary(accessToken);

    expect(res.body).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      topAuthor: { name: "Frank Herbert", quotesCount: 3 },
      topBook: { id: dune, quotesCount: 3, title: "Dune" },
      totalCount: 4,
      withCommentCount: 1,
      withoutSpoilerCount: 3,
    });
  });
});

describe("GET /api/quotes/facets", () => {
  type SeededLibrary = {
    duneFavoriteId: string;
    duneId: string;
    hyperionId: string;
  };

  async function seedLibrary(accessToken: string): Promise<SeededLibrary> {
    const duneId = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const hyperionId = await createBook(accessToken, {
      authors: [{ name: "Dan Simmons" }],
      title: "Hyperion",
    });
    const duneFavoriteId = await addQuote(accessToken, duneId, {
      comment: "spice matters",
      isFavorite: true,
      text: "Fear is the mind-killer",
    });
    await addQuote(accessToken, duneId, { isSpoiler: true, text: "Paul rides a worm" });
    await addQuote(accessToken, duneId, { text: "The sleeper must awaken" });
    await addQuote(accessToken, hyperionId, {
      comment: "Shrike reveal",
      isFavorite: true,
      isSpoiler: true,
      text: "The Shrike waits",
    });
    await addQuote(accessToken, hyperionId, { text: "Time tides" });

    return { duneFavoriteId, duneId, hyperionId };
  }

  async function trashBook(accessToken: string, bookId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    if (res.status !== 200) {
      throw new Error(`book trashing failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  async function trashQuote(accessToken: string, bookId: string, quoteId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    if (res.status !== 200) {
      throw new Error(`quote trashing failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  it("returns zeros for a user with no quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await quotesFacets(accessToken);

    expect(res.status).toBe(200);
    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 0,
      spoilerCount: 0,
      totalCount: 0,
      withCommentCount: 0,
      withoutCommentCount: 0,
      withoutSpoilerCount: 0,
    });
  });

  it("counts every quick filter over the whole active library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const res = await quotesFacets(accessToken);

    expect(res.status).toBe(200);
    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 2,
      spoilerCount: 2,
      totalCount: 5,
      withCommentCount: 2,
      withoutCommentCount: 3,
      withoutSpoilerCount: 3,
    });
  });

  it("reports the totalCount the list endpoint reports for filter=all", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const facets = await quotesFacets(accessToken);
    const list = await listQuotes(accessToken, "?filter=all");

    expect(list.body.totalCount).toBe(5);
    expect(facets.body.totalCount).toBe(list.body.totalCount);
  });

  it("shrinks the counts to the searched subset", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const res = await quotesFacets(accessToken, "?q=the");

    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 2,
      spoilerCount: 1,
      totalCount: 3,
      withCommentCount: 2,
      withoutCommentCount: 1,
      withoutSpoilerCount: 2,
    });
  });

  it("counts quotes matched through their book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const res = await quotesFacets(accessToken, "?q=hyperion");

    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 2,
      withCommentCount: 1,
      withoutCommentCount: 1,
      withoutSpoilerCount: 1,
    });
  });

  it("counts quotes matched through their book author", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const res = await quotesFacets(accessToken, "?q=herbert");

    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 3,
      withCommentCount: 1,
      withoutCommentCount: 2,
      withoutSpoilerCount: 2,
    });
  });

  it("reports the totalCount the list endpoint reports for the same search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const facets = await quotesFacets(accessToken, "?q=herbert");
    const list = await listQuotes(accessToken, "?q=herbert");

    expect(list.body.totalCount).toBe(3);
    expect(facets.body.totalCount).toBe(list.body.totalCount);
  });

  it("scopes the counts to one book instead of the whole library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { hyperionId } = await seedLibrary(accessToken);

    const res = await quotesFacets(accessToken, `?bookId=${hyperionId}`);

    expect(facetCounts(res.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 2,
      withCommentCount: 1,
      withoutCommentCount: 1,
      withoutSpoilerCount: 1,
    });
  });

  it("narrows a search further when a bookId is given", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedLibrary(accessToken);

    const searchOnly = await quotesFacets(accessToken, "?q=the");
    const bookOnly = await quotesFacets(accessToken, `?bookId=${duneId}`);
    const combined = await quotesFacets(accessToken, `?bookId=${duneId}&q=the`);

    expect(searchOnly.body.totalCount).toBe(3);
    expect(bookOnly.body.totalCount).toBe(3);
    expect(facetCounts(combined.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 0,
      totalCount: 2,
      withCommentCount: 1,
      withoutCommentCount: 1,
      withoutSpoilerCount: 2,
    });
  });

  it("ignores pageNumber and pageSize in the query string", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const unpaged = await quotesFacets(accessToken);
    const paged = await quotesFacets(accessToken, "?pageNumber=2&pageSize=1");

    expect(paged.status).toBe(200);
    expect(unpaged.body.totalCount).toBe(5);
    expect(paged.body).toEqual(unpaged.body);
  });

  it("returns the same counts whichever primary filter is active", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const noFilter = await quotesFacets(accessToken);
    const favorites = await quotesFacets(accessToken, "?filter=favorites");
    const spoilers = await quotesFacets(accessToken, "?filter=with_spoiler");

    expect(noFilter.body.favoritesCount).toBe(2);
    expect(noFilter.body.totalCount).toBe(5);
    expect(favorites.body).toEqual(noFilter.body);
    expect(spoilers.body).toEqual(noFilter.body);
  });

  it("does not count another user's quotes", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedLibrary(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerBook = await createBook(stranger.accessToken, { title: "Solaris" });
    await addQuote(stranger.accessToken, strangerBook, { text: "The ocean thinks" });

    const res = await quotesFacets(stranger.accessToken);

    expect(res.body.totalCount).toBe(1);
  });

  it("excludes trashed quotes, matching the list scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneFavoriteId, duneId } = await seedLibrary(accessToken);
    await trashQuote(accessToken, duneId, duneFavoriteId);

    const facets = await quotesFacets(accessToken);
    const list = await listQuotes(accessToken);

    expect(facetCounts(facets.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 2,
      totalCount: 4,
      withCommentCount: 1,
      withoutCommentCount: 3,
      withoutSpoilerCount: 2,
    });
    expect(facets.body.totalCount).toBe(list.body.totalCount);
  });

  it("excludes quotes whose book is in the trash, matching the list scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { hyperionId } = await seedLibrary(accessToken);
    await trashBook(accessToken, hyperionId);

    const facets = await quotesFacets(accessToken);
    const list = await listQuotes(accessToken);

    expect(facetCounts(facets.body)).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 3,
      withCommentCount: 1,
      withoutCommentCount: 2,
      withoutSpoilerCount: 2,
    });
    expect(facets.body.totalCount).toBe(list.body.totalCount);
  });

  it("splits the scope into commented and uncommented quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const { body } = await quotesFacets(accessToken, "?q=the");

    expect(body.withCommentCount).toBe(2);
    expect(body.withoutCommentCount).toBe(1);
    expect(body.withCommentCount + body.withoutCommentCount).toBe(body.totalCount);
  });

  it("splits the scope into spoiler and non-spoiler quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);

    const { body } = await quotesFacets(accessToken, "?q=the");

    expect(body.spoilerCount).toBe(1);
    expect(body.withoutSpoilerCount).toBe(2);
    expect(body.spoilerCount + body.withoutSpoilerCount).toBe(body.totalCount);
  });

  it("rejects a bookId that is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await quotesFacets(accessToken, "?bookId=not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookId" })]),
    );
  });

  it("lists every book and author holding a quote, busiest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedLibrary(accessToken);

    const body = await facetsBody(accessToken);

    expect(body.books).toEqual([
      { count: 3, id: duneId, title: "Dune" },
      { count: 2, id: hyperionId, title: "Hyperion" },
    ]);
    expect(body.authors).toEqual([
      { count: 3, id: expect.any(String), name: "Frank Herbert" },
      { count: 2, id: expect.any(String), name: "Dan Simmons" },
    ]);
  });

  it("narrows the author list to the picked book without shortening the book list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { hyperionId } = await seedLibrary(accessToken);

    const body = await facetsBody(accessToken, `?book=${hyperionId}`);

    expect(body.authors.map((author) => author.name)).toEqual(["Dan Simmons"]);
    expect(body.books.map((book) => book.title)).toEqual(["Dune", "Hyperion"]);
    expect(body.totalCount).toBe(2);
  });

  it("narrows the book list to the picked author without shortening the author list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);
    const herbertId = await authorIdByName(accessToken, "Frank Herbert");

    const body = await facetsBody(accessToken, `?author=${herbertId}`);

    expect(body.books.map((book) => book.title)).toEqual(["Dune"]);
    expect(body.authors.map((author) => author.name)).toEqual(["Frank Herbert", "Dan Simmons"]);
    expect(body.totalCount).toBe(3);
  });

  it("reads several books of one dimension as alternatives", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedLibrary(accessToken);

    const { body } = await quotesFacets(accessToken, `?book=${duneId}&book=${hyperionId}`);

    expect(body.totalCount).toBe(5);
  });

  it("reads two different dimensions as a conjunction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { hyperionId } = await seedLibrary(accessToken);
    const herbertId = await authorIdByName(accessToken, "Frank Herbert");

    const body = await facetsBody(accessToken, `?author=${herbertId}&book=${hyperionId}`);

    expect(body.totalCount).toBe(0);
    expect(body.books.map((book) => book.title)).toEqual(["Dune"]);
    expect(body.authors.map((author) => author.name)).toEqual(["Dan Simmons"]);
  });

  it("treats the legacy bookId exactly like the book list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { hyperionId } = await seedLibrary(accessToken);

    const legacy = await quotesFacets(accessToken, `?bookId=${hyperionId}`);
    const current = await quotesFacets(accessToken, `?book=${hyperionId}`);

    expect(legacy.body).toEqual(current.body);
    expect(legacy.body.totalCount).toBe(2);
  });

  it("keeps the quotes written on the boundary days of the range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);
    const today = toIsoDate(new Date());

    const inclusive = await quotesFacets(accessToken, `?createdFrom=${today}&createdTo=${today}`);
    const before = await quotesFacets(accessToken, `?createdTo=${addDaysToIsoDate(today, -1)}`);
    const after = await quotesFacets(accessToken, `?createdFrom=${addDaysToIsoDate(today, 1)}`);

    expect(inclusive.body.totalCount).toBe(5);
    expect(before.body.totalCount).toBe(0);
    expect(after.body.totalCount).toBe(0);
  });

  it("rejects a range that ends before it starts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await quotesFacets(accessToken, "?createdFrom=2026-08-31&createdTo=2026-01-01");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "createdFrom" })]),
    );
  });

  it("keeps the list answering to the same dimensions as the facets", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLibrary(accessToken);
    const herbertId = await authorIdByName(accessToken, "Frank Herbert");

    const facets = await quotesFacets(accessToken, `?author=${herbertId}`);
    const list = await listQuotes(accessToken, `?author=${herbertId}`);

    expect(list.status).toBe(200);
    expect(list.body.totalCount).toBe(facets.body.totalCount);
  });
});

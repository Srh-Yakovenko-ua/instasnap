import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { OpenLibraryAuthorDetail } from "../../authors/infrastructure/open-library.client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { OpenLibraryClient } from "../../authors/infrastructure/open-library.client.js";
import { WikidataClient } from "../../authors/infrastructure/wikidata.client.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";
import { QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE } from "../domain/queue-priority.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const OPEN_LIBRARY_KEY = "OL23919A";

const authorDetail: OpenLibraryAuthorDetail = {
  bio: "An English novelist.",
  birthYear: 1903,
  name: "George Orwell",
  photoUrl: "https://covers.openlibrary.org/a/id/12345-L.jpg",
  wikidataId: "Q3335",
};

const getAuthorByKey = vi.fn<(olid: string) => Promise<Nullable<OpenLibraryAuthorDetail>>>();
const getAuthorFactsByQid = vi.fn().mockResolvedValue(null);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, ListsModule],
    [
      { provide: OpenLibraryClient, useValue: { getAuthorByKey } },
      { provide: WikidataClient, useValue: { getAuthorFactsByQid } },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  getAuthorByKey.mockReset();
  getAuthorByKey.mockResolvedValue(authorDetail);
  getAuthorFactsByQid.mockReset();
  getAuthorFactsByQid.mockResolvedValue(null);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function readQueuePositions(
  userId: string,
): Promise<{ id: string; queuePosition: Nullable<number> }[]> {
  return prisma.book.findMany({
    orderBy: { queuePosition: "asc" },
    select: { id: true, queuePosition: true },
    where: { queuePosition: { not: null }, userId },
  });
}

function updateBook(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("PATCH /api/books/:id authorization and input", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/books/${MISSING_UUID}`)
      .send({ title: "New" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed id that is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateBook(accessToken, "not-a-uuid", { title: "New" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await updateBook(stranger.accessToken, created.body.id, { title: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent book without leaking existence", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateBook(accessToken, MISSING_UUID, { title: "New" });

    expect(res.status).toBe(404);
  });

  it("returns 200 and leaves the book unchanged for an empty body", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {});

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune");
  });
});

describe("PATCH /api/books/:id scalar fields", () => {
  it("updates only the title and leaves the other scalars untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      description: "A desert epic",
      pagesCount: 412,
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune Reborn");
    expect(res.body.description).toBe("A desert epic");
    expect(res.body.pagesCount).toBe(412);
  });

  it("clears a nullable field when an explicit null is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { dedication: null });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBeNull();
  });

  it("leaves an absent nullable field as-is", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBe("For my family");
  });

  it("toggles the favorite flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { isFavorite: true });

    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
  });

  it("stamps favoriteAddedAt when a book is favorited and clears it when unfavorited", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.favoriteAddedAt).toBeNull();

    const favorited = await updateBook(accessToken, created.body.id, { isFavorite: true });
    expect(favorited.body.favoriteAddedAt).toEqual(expect.any(String));

    const unfavorited = await updateBook(accessToken, created.body.id, { isFavorite: false });
    expect(unfavorited.body.favoriteAddedAt).toBeNull();
  });

  it("keeps the original favoriteAddedAt when an already-favorite book is edited", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isFavorite: true,
      title: "Dune",
    });
    const stampedAt = created.body.favoriteAddedAt;
    expect(stampedAt).toEqual(expect.any(String));

    const renamed = await updateBook(accessToken, created.body.id, {
      isFavorite: true,
      title: "Dune Reborn",
    });
    expect(renamed.body.favoriteAddedAt).toBe(stampedAt);

    const untouched = await updateBook(accessToken, created.body.id, { title: "Dune Again" });
    expect(untouched.body.favoriteAddedAt).toBe(stampedAt);
  });
});

describe("PATCH /api/books/:id status to block transitions", () => {
  it("creates a reading-progress row when the status moves to reading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "not_started",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 80, startedAt: "2026-02-01" },
      readingStatus: "reading",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({ currentPage: 80, startedAt: "2026-02-01" });
    const rows = await prisma.bookReadingProgress.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("keeps a finished reading-progress row with rating and impression", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { startedAt: "2026-02-01" },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { finishedAt: "2026-02-05", impression: "loved it", rating: 5 },
      readingStatus: "finished",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({
      finishedAt: "2026-02-05",
      impression: "loved it",
      rating: 5,
    });
  });

  it("deletes the reading-progress row when the status moves back to not_started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 80 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { readingStatus: "not_started" });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toBeNull();
    const rows = await prisma.bookReadingProgress.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(0);
  });

  it("marks the loan returned and clears its reminder when ownership moves away from borrowed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { expectedReturnDate: "2026-09-01", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });
    await prisma.bookLoan.updateMany({
      data: { remindBeforeDays: 3, remindToReturn: true },
      where: { bookId: created.body.id },
    });

    const res = await updateBook(accessToken, created.body.id, { ownershipStatus: "owned" });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toBeNull();
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("returned");
    expect(rows[0]?.returnedAt).not.toBeNull();
    expect(rows[0]?.remindToReturn).toBe(false);
    expect(rows[0]?.remindBeforeDays).toBeNull();
  });

  it("creates a purchase row when ownership moves to want_to_buy", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
    });

    expect(res.status).toBe(200);
    expect(res.body.purchaseInfo).toMatchObject({
      currency: "UAH",
      expectedPrice: 299.99,
      storeName: "Yakaboo",
    });
    const rows = await prisma.bookPurchaseInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("swaps a delivery block for a loan block when ownership moves from in_transit to lent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      loanInfo: { personName: "Olha" },
      ownershipStatus: "lent_to_someone",
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toBeNull();
    expect(res.body.loanInfo).toMatchObject({ personName: "Olha" });
    const orderedBooks = await prisma.bookOrderItem.findMany({
      where: { bookId: created.body.id },
    });
    const loan = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(orderedBooks).toHaveLength(1);
    expect(orderedBooks[0]?.cancelledAt).not.toBeNull();
    expect(loan).toHaveLength(1);
    expect(loan[0]?.status).toBe("active");
  });

  it("edits the active delivery row through the deliveryInfo block", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { deliveryStatus: "in_transit", storeName: "Nova Poshta" },
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({
      status: "in_transit",
      storeName: "Nova Poshta",
    });
    expect(res.body.delivery.totalCount).toBe(1);
    const rows = await prisma.bookOrderItem.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("creates an active delivery row when ownership moves to in_transit without one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("in_transit");
    expect(res.body.delivery.active).toMatchObject({ status: "ordered", storeName: "Yakaboo" });
    expect(res.body.delivery.totalCount).toBe(1);
    const rows = await prisma.bookOrderItem.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });
});

describe("PATCH /api/books/:id delivery field parity", () => {
  it("updates the price, currency, service and tracking fields of the active delivery", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: {
        currency: "USD",
        deliveryService: "Ukrposhta",
        price: 199.99,
        trackingNumber: "TN-9",
        trackingUrl: "https://parcel.example.com",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({
      currency: "USD",
      deliveryService: "Ukrposhta",
      price: 199.99,
      trackingNumber: "TN-9",
      trackingUrl: "https://parcel.example.com",
    });
    const row = await prisma.bookOrderItem.findFirstOrThrow({
      include: { order: true, shipment: true },
      where: { bookId: created.body.id },
    });
    expect(row.shipment?.deliveryServiceName).toBe("Ukrposhta");
    expect(row.shipment?.trackingNumber).toBe("TN-9");
    expect(row.order.currency).toBe("USD");
    expect(row.price?.toString()).toBe("199.99");
  });

  it("preserves untouched delivery fields when the patch omits them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: {
        currency: "UAH",
        price: 349.5,
        storeName: "Yakaboo",
        trackingNumber: "TTN-123",
        trackingUrl: "https://track.example.com",
      },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { storeName: "Nova Poshta Store" },
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({
      currency: "UAH",
      price: 349.5,
      storeName: "Nova Poshta Store",
      trackingNumber: "TTN-123",
      trackingUrl: "https://track.example.com",
    });
  });

  it("clears a nullable delivery field when the patch sends an explicit null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: {
        currency: "UAH",
        price: 349.5,
        storeName: "Yakaboo",
        trackingNumber: "TTN-123",
      },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { trackingNumber: null },
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({ price: 349.5, trackingNumber: null });
  });

  it("returns 400 for a non-https tracking url in the delivery patch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { trackingUrl: "not-a-url" },
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deliveryInfo.trackingUrl" })]),
    );
  });

  it("returns 400 for a negative delivery price in the patch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { currency: "UAH", price: 350, storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { price: -5 },
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deliveryInfo.price" })]),
    );
  });
});

describe("PATCH /api/books/:id relation re-resolution", () => {
  it("repoints the book to a new custom author resolved by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      authors: [{ name: "Ursula K. Le Guin" }],
    });

    expect(res.status).toBe(200);
    expect(res.body.authors[0].name).toBe("Ursula K. Le Guin");
    expect(res.body.authors[0].id).toMatch(UUID);
    const author = await prisma.author.findFirst({
      where: { name: "Ursula K. Le Guin", userId },
    });
    expect(author).not.toBeNull();
  });

  it("repoints the book to a seeded global author referenced by id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const global = await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });

    const res = await updateBook(accessToken, created.body.id, { authors: [{ id: global.id }] });

    expect(res.status).toBe(200);
    expect(res.body.authors[0]).toEqual({ id: global.id, name: "George Orwell" });
  });

  it("materializes a global author from open library and repoints the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
    });

    expect(res.status).toBe(200);
    expect(res.body.authors[0].name).toBe("George Orwell");
    const materialized = await prisma.author.findFirst({
      where: { openLibraryKey: OPEN_LIBRARY_KEY },
    });
    expect(materialized?.userId).toBeNull();
  });

  it("returns 404 when repointing to another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const created = await createBook(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const ownerAuthor = await prisma.author.create({
      data: { name: "Owner Author", normalizedName: "owner author", userId: owner.userId },
    });

    const res = await updateBook(stranger.accessToken, created.body.id, {
      authors: [{ id: ownerAuthor.id }],
    });

    expect(res.status).toBe(404);
  });

  it("replaces the tag set with the provided one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia", "slow burn"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { tags: ["cozy"] });

    expect(res.status).toBe(200);
    const names = res.body.tags.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(["cozy"]);
    const items = await prisma.bookTag.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(1);
  });

  it("clears all tags when an empty tag set is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { tags: [] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
    const items = await prisma.bookTag.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(0);
  });

  it("leaves the existing tags in place when tags are absent from the payload", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    const names = res.body.tags.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(["dark academia"]);
  });

  it("replaces the list membership with the provided list set", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await prisma.bookList.create({
      data: { name: "Gifts", normalizedName: "gifts", userId },
    });
    const second = await prisma.bookList.create({
      data: { name: "Autumn reads", normalizedName: "autumn reads", userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [first.id],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { listIds: [second.id] });

    expect(res.status).toBe(200);
    const listNames = res.body.lists.map((list: { name: string }) => list.name);
    expect(listNames).toEqual(["Autumn reads"]);
    const items = await prisma.bookListItem.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(1);
  });
});

describe("PATCH /api/books/:id partial block merge", () => {
  it("updates only the provided loan sub-field and preserves the siblings", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      loanInfo: { note: "return next week" },
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({
      loanDate: "2026-02-01",
      note: "return next week",
      personName: "Olha",
    });
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows.at(0)?.personName).toBe("Olha");
    expect(rows.at(0)?.loanDate).not.toBeNull();
  });

  it("preserves stored rating and started date when only the current page is patched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 400,
      readingProgress: { currentPage: 10, rating: 4, startedAt: "2026-02-01" },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 50 },
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({
      currentPage: 50,
      rating: 4,
      startedAt: "2026-02-01",
    });
  });

  it("keeps the purchase info on an owned book when patching an unrelated field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });
    await request(app.getHttpServer())
      .post(`/api/books/${created.body.id}/ownership/mark-bought`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune Reborn");
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toMatchObject({
      currency: "UAH",
      expectedPrice: 299.99,
      storeName: "Yakaboo",
    });
    const rows = await prisma.bookPurchaseInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("clears a loan sub-field when an explicit null is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { note: "old note", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { loanInfo: { note: null } });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({ note: null, personName: "Olha" });
  });
});

describe("PATCH /api/books/:id cross-field validation", () => {
  it("returns 400 when the payload current page exceeds the payload page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      pagesCount: 300,
      readingProgress: { currentPage: 301 },
      readingStatus: "reading",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when a payload-only current page exceeds the stored page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 301 },
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when a payload-only page count drops below the stored current page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 250 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { pagesCount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when ownership is set to borrowed without loan info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "borrowed_from_someone",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanInfo.personName" })]),
    );
  });

  it("allows a status-only switch between loan statuses when the existing row has a person name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "lent_to_someone",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("lent_to_someone");
    expect(res.body.loanInfo).toMatchObject({ personName: "Olha" });
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.type).toBe("lent_to_someone");
  });

  it("syncs the active loan type when the direction flips with loan fields present", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      loanInfo: { personName: "Olha" },
      ownershipStatus: "lent_to_someone",
    });

    expect(res.status).toBe(200);
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("lent_to_someone");
  });

  it("returns 400 for an unknown reading status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { readingStatus: "halfway" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingStatus" })]),
    );
  });
});

describe("PATCH /api/books/:id series part number", () => {
  it("rejects an update that reuses a part number held by another book in the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      title: "Throne of Glass",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId: first.body.series.id,
      title: "Crown of Midnight",
    });

    const res = await updateBook(accessToken, second.body.id, { partNumber: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("allows a book to keep its own part number on an unrelated update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      title: "Throne of Glass",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Throne of Glass (rev)" });

    expect(res.status).toBe(200);
    expect(res.body.partNumber).toBe(1);
    expect(res.body.title).toBe("Throne of Glass (rev)");
  });
});

describe("PATCH /api/books/:id reading queue", () => {
  it("adds the book to the queue and reflects membership in the returned view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.isInReadingQueue).toBe(false);

    const res = await updateBook(accessToken, created.body.id, {
      addToReadingQueue: true,
      queuePriority: "high",
    });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.queuePriority).toBe("high");
  });

  it("removes the book from the queue when toggled off", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.isInReadingQueue).toBe(true);

    const res = await updateBook(accessToken, created.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
  });

  it("re-sequences the tail with no gap when a middle queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const middle = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, middle.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: first.body.id, queuePosition: 1 },
      { id: last.body.id, queuePosition: 2 },
    ]);
  });

  it("leaves earlier positions untouched when the last queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, last.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: first.body.id, queuePosition: 1 },
      { id: second.body.id, queuePosition: 2 },
    ]);
  });

  it("re-sequences the rest to start at 1 when the first queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, first.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: second.body.id, queuePosition: 1 },
      { id: last.body.id, queuePosition: 2 },
    ]);
  });
});

describe("PATCH /api/books/:id queue priority reason", () => {
  function createHighQueueBook(accessToken: string, extra: Record<string, unknown>): request.Test {
    return createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      queuePriority: "high",
      title: "Dune",
      ...extra,
    });
  }

  it("clears all reason detail fields when the priority is lowered to normal", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    const res = await updateBook(accessToken, created.body.id, { queuePriority: "normal" });

    expect(res.status).toBe(200);
    expect(res.body.queuePriority).toBe("normal");
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("clears all reason detail fields when the priority is lowered to low", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "wife recommended",
    });

    const res = await updateBook(accessToken, created.body.id, { queuePriority: "low" });

    expect(res.status).toBe(200);
    expect(res.body.queuePriority).toBe("low");
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("clears the custom text when the reason changes away from other", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "wife recommended",
    });

    const res = await updateBook(accessToken, created.body.id, {
      queuePriorityReason: "series_order",
    });

    expect(res.status).toBe(200);
    expect(res.body.queuePriorityReason).toBe("series_order");
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
  });

  it("clears the target date when the reason changes to one without dates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    const res = await updateBook(accessToken, created.body.id, {
      queuePriorityReason: "series_order",
    });

    expect(res.status).toBe(200);
    expect(res.body.queuePriorityReason).toBe("series_order");
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("clears the custom text and target date when the reason is set to null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "wife recommended",
    });

    const res = await updateBook(accessToken, created.body.id, { queuePriorityReason: null });

    expect(res.status).toBe(200);
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("leaves the reason detail fields unchanged when the patch omits them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune Reborn");
    expect(res.body.queuePriority).toBe("high");
    expect(res.body.queuePriorityReason).toBe("book_club");
    expect(res.body.queuePriorityTargetDate).toBe("2026-08-24");
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
  });

  it("returns 400 when the patch sets the other reason without custom text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, { queuePriorityReason: "series_order" });

    const res = await updateBook(accessToken, created.body.id, { queuePriorityReason: "other" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "queuePriorityReasonCustomText",
          message: QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE,
        }),
      ]),
    );
  });

  it("clears the priority and reason detail fields when the book is removed from the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createHighQueueBook(accessToken, {
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    const res = await updateBook(accessToken, created.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
    expect(res.body.queuePriorityReason).toBeNull();
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
    expect(res.body.queuePriorityTargetDate).toBeNull();
  });

  it("persists the reason detail fields when re-adding a non-queued book to the queue", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.isInReadingQueue).toBe(false);

    const res = await updateBook(accessToken, created.body.id, {
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.queuePriority).toBe("high");
    expect(res.body.queuePriorityReason).toBe("book_club");
    expect(res.body.queuePriorityTargetDate).toBe("2026-08-24");
    expect(res.body.queuePriorityReasonCustomText).toBeNull();
  });

  it("keeps the queue position and order when the priority is toggled", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const before = await readQueuePositions(userId);
    expect(before).toEqual([
      { id: first.body.id, queuePosition: 1 },
      { id: second.body.id, queuePosition: 2 },
    ]);

    const raised = await updateBook(accessToken, first.body.id, { queuePriority: "high" });
    expect(raised.status).toBe(200);
    expect(raised.body.queuePriority).toBe("high");

    const lowered = await updateBook(accessToken, first.body.id, { queuePriority: "normal" });
    expect(lowered.status).toBe(200);
    expect(lowered.body.queuePriority).toBe("normal");

    const after = await readQueuePositions(userId);
    expect(after).toEqual(before);
  });
});

describe("PATCH /api/books/:id series progress recompute", () => {
  function searchSeries(accessToken: string): request.Test {
    return request(app.getHttpServer())
      .get("/api/series")
      .set("Authorization", `Bearer ${accessToken}`);
  }

  it("drops booksInSeries and finishedInSeries when a finished book is detached to solo", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const seriesId = created.body.series.id;

    const res = await updateBook(accessToken, created.body.id, { bookType: "solo" });
    expect(res.status).toBe(200);
    expect(res.body.series).toBeNull();

    const after = await searchSeries(accessToken);
    const series = after.body.items.find((item: { id: string }) => item.id === seriesId);
    expect(series).toMatchObject({ booksInSeries: 0, finishedInSeries: 0 });
  });

  it("moves the finished book's contribution to the target series when reassigned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const source = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const sourceSeriesId = source.body.series.id;
    const targetAnchor = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "A Court of Thorns" },
      partNumber: 1,
      title: "A Court of Thorns and Roses",
    });
    const targetSeriesId = targetAnchor.body.series.id;

    const res = await updateBook(accessToken, source.body.id, {
      bookType: "series_part",
      partNumber: 2,
      seriesId: targetSeriesId,
    });
    expect(res.status).toBe(200);
    expect(res.body.series.id).toBe(targetSeriesId);

    const search = await searchSeries(accessToken);
    const byId = new Map<string, { booksInSeries: number; finishedInSeries: number }>(
      search.body.items.map(
        (item: { booksInSeries: number; finishedInSeries: number; id: string }) => [
          item.id,
          { booksInSeries: item.booksInSeries, finishedInSeries: item.finishedInSeries },
        ],
      ),
    );
    expect(byId.get(sourceSeriesId)).toEqual({ booksInSeries: 0, finishedInSeries: 0 });
    expect(byId.get(targetSeriesId)).toEqual({ booksInSeries: 2, finishedInSeries: 1 });
  });
});

describe("PATCH /api/books/:id dedication favorite independence and normalization", () => {
  it("favorites the dedication without touching the book favorite (TC-014)", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });
    expect(created.body.isFavorite).toBe(false);
    expect(created.body.isFavoriteDedication).toBe(false);

    const res = await updateBook(accessToken, created.body.id, { isFavoriteDedication: true });

    expect(res.status).toBe(200);
    expect(res.body.isFavoriteDedication).toBe(true);
    expect(res.body.isFavorite).toBe(false);
  });

  it("favorites the book without touching the dedication favorite (TC-015)", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { isFavorite: true });

    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
    expect(res.body.isFavoriteDedication).toBe(false);
  });

  it("keeps both favorite states true at once (TC-016)", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      isFavorite: true,
      isFavoriteDedication: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
    expect(res.body.isFavoriteDedication).toBe(true);
  });

  it("normalizes a whitespace-only dedication to null on create", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "   ",
      title: "Dune",
    });

    expect(created.status).toBe(201);
    expect(created.body.dedication).toBeNull();
    expect(created.body.isFavoriteDedication).toBe(false);
  });

  it("normalizes an empty-string dedication to null on update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { dedication: "" });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBeNull();
  });

  it("auto-resets the dedication favorite when the dedication is cleared", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });
    const favorited = await updateBook(accessToken, created.body.id, {
      isFavoriteDedication: true,
    });
    expect(favorited.body.isFavoriteDedication).toBe(true);

    const res = await updateBook(accessToken, created.body.id, { dedication: null });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBeNull();
    expect(res.body.isFavoriteDedication).toBe(false);
  });

  it("lets the auto-reset win over a favorite flag sent in the same clearing patch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      dedication: "",
      isFavoriteDedication: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBeNull();
    expect(res.body.isFavoriteDedication).toBe(false);
  });

  it("accepts a dedication of exactly 2000 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const dedication = "a".repeat(2000);

    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication,
      title: "Dune",
    });

    expect(created.status).toBe(201);
    expect(created.body.dedication).toBe(dedication);
  });

  it("rejects a dedication longer than 2000 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "a".repeat(2001),
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dedication" })]),
    );
  });
});

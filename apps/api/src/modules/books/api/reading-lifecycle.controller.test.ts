import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, toNullableIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

const DEFAULT_TIMEZONE = "Europe/Kyiv";
const TODAY = toZonedIsoDate({ instant: new Date(), timeZone: DEFAULT_TIMEZONE });
const YESTERDAY = addDaysToIsoDate(TODAY, -1);

type CycleRow = {
  endedAt: Nullable<string>;
  finishedAt: Nullable<string>;
  rating: Nullable<number>;
  state: string;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

function authorized(method: "delete" | "get" | "patch" | "post", path: string) {
  return request(app.getHttpServer())
    [method](path)
    .set("Authorization", `Bearer ${reader.accessToken}`);
}

function changeStatus(bookId: string, body: Record<string, unknown>) {
  return authorized("post", `/api/books/${bookId}/reading-status`).send(body);
}

async function createBook(body: Record<string, unknown>): Promise<string> {
  const response = await authorized("post", "/api/books").send({
    authors: [{ name: "Author" }],
    ownershipStatus: "owned",
    pagesCount: 300,
    title: "Book",
    ...body,
  });
  expect(response.status).toBe(201);
  return String(response.body.id);
}

async function cyclesOf(bookId: string): Promise<CycleRow[]> {
  const rows = await prisma.bookReadingCycle.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { endedAt: true, finishedAt: true, rating: true, state: true },
    where: { bookId },
  });
  return rows.map((row) => ({
    endedAt: toNullableIsoDate(row.endedAt),
    finishedAt: toNullableIsoDate(row.finishedAt),
    rating: row.rating,
    state: row.state,
  }));
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await context.close();
});

beforeEach(async () => {
  await truncateAllTables(app);
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

describe("reading lifecycle through the books API", () => {
  it("opens one active cycle when a book starts being read", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: TODAY, status: "reading" });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: null, rating: null, state: "active" },
    ]);
  });

  it("does not open a second cycle when the same start is sent twice", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: TODAY, status: "reading" });
    await changeStatus(bookId, { date: TODAY, status: "reading" });

    expect(await cyclesOf(bookId)).toHaveLength(1);
  });

  it("closes the active cycle when the book is finished", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { date: TODAY, rating: 9, status: "finished" });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: TODAY, rating: 9, state: "finished" },
    ]);
  });

  it("does not create a second completed read when the finish is retried", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { date: TODAY, rating: 9, status: "finished" });
    await changeStatus(bookId, { date: TODAY, rating: 9, status: "finished" });

    expect(await cyclesOf(bookId)).toHaveLength(1);
  });

  it("edits the rating of the completed read instead of opening a cycle", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { date: TODAY, rating: 7, status: "finished" });
    await changeStatus(bookId, { date: TODAY, rating: 10, status: "finished" });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: TODAY, rating: 10, state: "finished" },
    ]);
  });

  it("starts a fresh cycle for a reread and leaves the finished one alone", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { date: YESTERDAY, rating: 8, status: "finished" });
    await changeStatus(bookId, { date: TODAY, status: "rereading" });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: YESTERDAY, rating: 8, state: "finished" },
      { endedAt: null, finishedAt: null, rating: null, state: "active" },
    ]);
  });

  it("counts a finished reread as a second completed read", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { date: YESTERDAY, status: "finished" });
    await changeStatus(bookId, { date: TODAY, status: "rereading" });
    await changeStatus(bookId, { date: TODAY, status: "finished" });

    const cycles = await cyclesOf(bookId);
    expect(cycles.filter((cycle) => cycle.state === "finished")).toHaveLength(2);
  });

  it("abandons the current cycle on reset and keeps the pages already read", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await authorized("post", `/api/books/${bookId}/reading-progress`).send({
      currentPage: 120,
      updateDate: YESTERDAY,
    });
    await changeStatus(bookId, { resetProgress: true, status: "not_started" });

    const events = await prisma.bookReadingProgressEvent.findMany({ where: { bookId } });
    expect(events).toHaveLength(1);
    expect(events[0]?.pagesRead).toBe(120);
    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: TODAY, finishedAt: null, rating: null, state: "abandoned" },
    ]);
  });

  it("does not abandon twice when the reset is repeated", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { resetProgress: true, status: "not_started" });
    await changeStatus(bookId, { resetProgress: true, status: "not_started" });

    expect(await cyclesOf(bookId)).toHaveLength(1);
  });

  it("attaches every new progress event to the cycle that was open", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await authorized("post", `/api/books/${bookId}/reading-progress`).send({
      currentPage: 50,
      updateDate: YESTERDAY,
    });

    const events = await prisma.bookReadingProgressEvent.findMany({ where: { bookId } });
    const cycle = await prisma.bookReadingCycle.findFirst({ where: { bookId, state: "active" } });
    expect(events[0]?.readingCycleId).toBe(cycle?.id);
  });

  it("attaches the last pages read to the cycle they finished", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await changeStatus(bookId, { currentPage: 300, date: TODAY, status: "finished" });

    const events = await prisma.bookReadingProgressEvent.findMany({ where: { bookId } });
    const cycle = await prisma.bookReadingCycle.findFirstOrThrow({
      where: { bookId, state: "finished" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.readingCycleId).toBe(cycle.id);
  });

  it("creates the finished cycle when a book is added as already read", async () => {
    const bookId = await createBook({
      readingProgress: { finishedAt: YESTERDAY, rating: 8, startedAt: YESTERDAY },
      readingStatus: "finished",
    });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: YESTERDAY, rating: 8, state: "finished" },
    ]);
  });

  it("creates the finished cycle when an existing book is edited to finished", async () => {
    const bookId = await createBook({});
    const response = await request(app.getHttpServer())
      .patch(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${reader.accessToken}`)
      .send({ readingProgress: { finishedAt: TODAY, rating: 6 }, readingStatus: "finished" });

    expect(response.status).toBe(200);
    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: TODAY, rating: 6, state: "finished" },
    ]);
  });

  it("leaves the cycles alone when an unrelated field is edited", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await request(app.getHttpServer())
      .patch(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${reader.accessToken}`)
      .send({ title: "Renamed" });

    expect(await cyclesOf(bookId)).toEqual([
      { endedAt: null, finishedAt: null, rating: null, state: "active" },
    ]);
  });

  it("gives every book its own cycle when the status is set in bulk", async () => {
    const first = await createBook({ title: "First" });
    const second = await createBook({ title: "Second" });

    const response = await authorized("patch", "/api/books/bulk/reading-status").send({
      bookIds: [first, second],
      readingStatus: "reading",
    });

    expect(response.status).toBe(200);
    expect(response.body.affected).toBe(2);
    expect(await cyclesOf(first)).toHaveLength(1);
    expect(await cyclesOf(second)).toHaveLength(1);
  });

  it("does not duplicate cycles when the same bulk change is repeated", async () => {
    const bookId = await createBook({});
    const body = { bookIds: [bookId], readingStatus: "reading" };
    await authorized("patch", "/api/books/bulk/reading-status").send(body);
    await authorized("patch", "/api/books/bulk/reading-status").send(body);

    expect(await cyclesOf(bookId)).toHaveLength(1);
  });

  it("removes one mistaken reading event and nothing else", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await authorized("post", `/api/books/${bookId}/reading-progress`).send({
      currentPage: 50,
      updateDate: YESTERDAY,
    });
    await authorized("post", `/api/books/${bookId}/reading-progress`).send({
      currentPage: 90,
      updateDate: TODAY,
    });

    const events = await prisma.bookReadingProgressEvent.findMany({
      orderBy: { date: "asc" },
      where: { bookId },
    });
    const removed = events[0]?.id ?? "";

    const response = await authorized("delete", `/api/books/${bookId}/reading-events/${removed}`);
    expect(response.status).toBe(204);

    const remaining = await prisma.bookReadingProgressEvent.findMany({ where: { bookId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(events[1]?.id);
  });

  it("refuses to remove a reading event that belongs to another reader", async () => {
    const bookId = await createBook({});
    await changeStatus(bookId, { date: YESTERDAY, status: "reading" });
    await authorized("post", `/api/books/${bookId}/reading-progress`).send({
      currentPage: 50,
      updateDate: YESTERDAY,
    });
    const event = await prisma.bookReadingProgressEvent.findFirstOrThrow({ where: { bookId } });

    const intruder = await context.registerVerifyAndLogin({
      email: "intruder@example.com",
      nickname: "intruder",
    });
    const response = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}/reading-events/${event.id}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`);

    expect(response.status).toBe(404);
    expect(await prisma.bookReadingProgressEvent.count({ where: { bookId } })).toBe(1);
  });
});

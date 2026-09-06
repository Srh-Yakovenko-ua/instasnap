import type { INestApplication } from "@nestjs/common";

import { ReadingDayDetailsSchema, ReadingStatisticsOverviewSchema } from "@app/shared";
import { addDays } from "date-fns";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StatisticsModule } from "../statistics.module.js";

const TODAY = toIsoDate(new Date());
const YESTERDAY = addDaysToIsoDate(TODAY, -1);
const CURRENT_YEAR = Number(TODAY.slice(0, 4));

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

async function createBook({
  genres = ["fantasy"],
  language = "ukrainian",
  pagesCount = 300,
  title,
  userId,
}: {
  genres?: string[];
  language?: string;
  pagesCount?: number;
  title: string;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: { genres, language, pagesCount, readingStatus: "finished", title, userId },
    select: { id: true },
  });
  return book.id;
}

function overview(user: AuthenticatedUser, query: Record<string, string> = {}) {
  return request(app.getHttpServer())
    .get("/api/statistics/overview")
    .query(query)
    .set("Authorization", `Bearer ${user.accessToken}`);
}

async function recordReading({
  bookId,
  isoDate,
  page,
  pagesRead,
}: {
  bookId: string;
  isoDate: string;
  page: number;
  pagesRead: number;
}): Promise<void> {
  await prisma.bookReadingProgressEvent.create({
    data: { bookId, date: parseIsoDate(isoDate), page, pagesRead },
  });
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, StatisticsModule]);
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

describe("GET /api/statistics/overview", () => {
  it("rejects an anonymous request", async () => {
    const response = await request(app.getHttpServer()).get("/api/statistics/overview");
    expect(response.status).toBe(401);
  });

  it("returns every section for a reader with no history at all", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });

    expect(response.status).toBe(200);
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    expect(parsed.kpis.completedReads.value).toBe(0);
    expect(parsed.kpis.completedReads.comparison).toBeNull();
    expect(parsed.calendar.activeDays).toBe(0);
    expect(parsed.calendar.days.every((day) => day.pagesRead === 0)).toBe(true);
    expect(parsed.hero.featuredInsight).toBeNull();
  });

  it("counts a reread as two completed reads of one book", async () => {
    const bookId = await createBook({ title: "Dune", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-03-01`,
      userId: reader.userId,
    });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-08-01`,
      userId: reader.userId,
    });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(2);
    expect(parsed.kpis.uniqueBooksCompleted.value).toBe(1);
    expect(parsed.hero.recentCompletedReads).toHaveLength(2);
  });

  it("keeps a completed read after the book is moved to trash", async () => {
    const bookId = await createBook({ title: "Trashed", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-05-01`,
      rating: 9,
      userId: reader.userId,
    });
    const trashedAt = new Date();
    await prisma.book.update({
      data: { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_RETENTION.days) },
      where: { id: bookId },
    });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(1);
    expect(parsed.hero.recentCompletedReads[0]?.book.bookState).toBe("soft_deleted");
    expect(parsed.libraryBalance.currentOwnedTotal).toBe(0);
  });

  it("reads the completed metadata from the snapshot, not from the book as it is now", async () => {
    const bookId = await createBook({
      genres: ["fantasy"],
      title: "Snapshot",
      userId: reader.userId,
    });
    await prisma.bookReadingCycle.create({
      data: {
        bookId,
        completionMetadata: {
          authors: [],
          book: { genres: ["scifi"], language: "english", pagesCount: 500, title: "Snapshot" },
          provenance: "tracked_at_completion",
          publisher: null,
          series: null,
          version: 1,
        },
        finishedAt: parseIsoDate(`${String(CURRENT_YEAR)}-04-01`),
        state: "finished",
        userId: reader.userId,
      },
    });
    await prisma.book.update({ data: { genres: ["horror"] }, where: { id: bookId } });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.genres.frequency.map((entry) => entry.genreKey)).toEqual(["scifi"]);
    expect(parsed.languages.items.map((entry) => entry.language)).toEqual(["english"]);
  });

  it("keeps another reader's history out of the response", async () => {
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    const bookId = await createBook({ title: "Theirs", userId: other.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-04-01`,
      userId: other.userId,
    });
    await recordReading({ bookId, isoDate: TODAY, page: 10, pagesRead: 10 });

    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(0);
    expect(parsed.kpis.pagesRead.value).toBe(0);
  });

  it("says the current streak does not apply to a period that already ended", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR - 1) });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.calendar.currentStreak).toMatchObject({
      availability: "unavailable",
      data: null,
    });
  });

  it("rejects a period that reaches into the future", async () => {
    const response = await overview(reader, { period: "year", year: String(CURRENT_YEAR + 1) });
    expect(response.status).toBe(400);
  });

  it("rejects a comparison against all time", async () => {
    const response = await overview(reader, { compare: "previous_period", period: "all_time" });
    expect(response.status).toBe(400);
  });

  it("rejects a reversed custom range", async () => {
    const response = await overview(reader, {
      from: `${String(CURRENT_YEAR)}-08-10`,
      period: "custom",
      to: `${String(CURRENT_YEAR)}-08-01`,
    });
    expect(response.status).toBe(400);
  });

  it("compares a period with the one before it", async () => {
    const bookId = await createBook({ title: "Compared", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: TODAY,
      userId: reader.userId,
    });

    const response = await overview(reader, {
      compare: "previous_period",
      from: TODAY,
      period: "custom",
      to: TODAY,
    });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.comparison).toEqual({
      from: YESTERDAY,
      mode: "previous_period",
      to: YESTERDAY,
    });
    expect(parsed.kpis.completedReads.comparison).toEqual({
      absoluteDelta: 1,
      percentDelta: null,
      previous: 0,
    });
  });

  it("keeps a completed read on its own date after the reader moves timezone", async () => {
    const bookId = await createBook({ title: "Stable", userId: reader.userId });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: `${String(CURRENT_YEAR)}-05-01`,
      userId: reader.userId,
    });
    await recordReading({
      bookId,
      isoDate: `${String(CURRENT_YEAR)}-05-01`,
      page: 40,
      pagesRead: 40,
    });

    const before = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });
    await prisma.userProfileSettings.upsert({
      create: { timezone: "Pacific/Auckland", userId: reader.userId },
      update: { timezone: "Pacific/Auckland" },
      where: { userId: reader.userId },
    });
    const after = await overview(reader, { period: "year", year: String(CURRENT_YEAR) });

    const dayOf = (response: { body: unknown }): unknown =>
      ReadingStatisticsOverviewSchema.parse(response.body).calendar.days.find(
        (day) => day.date === `${String(CURRENT_YEAR)}-05-01`,
      )?.pagesRead;

    expect(dayOf(before)).toBe(40);
    expect(dayOf(after)).toBe(40);
    expect(
      ReadingStatisticsOverviewSchema.parse(after.body).hero.recentCompletedReads[0]?.finishedAt,
    ).toBe(`${String(CURRENT_YEAR)}-05-01`);
  });

  it("carries the reader's own timezone and week start into the response", async () => {
    await prisma.userProfileSettings.upsert({
      create: { timezone: "America/New_York", userId: reader.userId, weekStartDay: "sunday" },
      update: { timezone: "America/New_York", weekStartDay: "sunday" },
      where: { userId: reader.userId },
    });

    const response = await overview(reader, { period: "last_12_months" });
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.meta.timezone).toBe("America/New_York");
    expect(parsed.meta.weekStartDay).toBe("sunday");
  });
});

describe("GET /api/statistics/reading-days/:date", () => {
  it("returns every book read on the day, largest first", async () => {
    const first = await createBook({ title: "First", userId: reader.userId });
    const second = await createBook({ title: "Second", userId: reader.userId });
    await recordReading({ bookId: first, isoDate: TODAY, page: 20, pagesRead: 20 });
    await recordReading({ bookId: second, isoDate: TODAY, page: 60, pagesRead: 60 });

    const response = await request(app.getHttpServer())
      .get(`/api/statistics/reading-days/${TODAY}`)
      .set("Authorization", `Bearer ${reader.accessToken}`);

    expect(response.status).toBe(200);
    const parsed = ReadingDayDetailsSchema.parse(response.body);
    expect(parsed.pagesRead).toBe(80);
    expect(parsed.books.map((book) => book.title)).toEqual(["Second", "First"]);
  });

  it("rejects a malformed date", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/statistics/reading-days/not-a-date")
      .set("Authorization", `Bearer ${reader.accessToken}`);
    expect(response.status).toBe(400);
  });
});

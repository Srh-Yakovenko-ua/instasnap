import type { INestApplication } from "@nestjs/common";

import { ReadingStatisticsOverviewSchema } from "@app/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StatisticsModule } from "../statistics.module.js";

const TODAY = toIsoDate(new Date());
const CURRENT_YEAR = TODAY.slice(0, 4);

const RETIRED_FIELD_NAMES = [
  "completedBooks",
  "booksCompleted",
  "ratedBooksCount",
  "completedBooksCount",
  "deltaPercent",
  "changePercent",
  "pctDelta",
  "comparisonEnabled",
  "hasData",
  "insufficient",
  "historyAvailability",
  "qualityStatus",
  "dataVersion",
] as const;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

function collectKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectKeys(entry, keys);
    }
    return keys;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

function collectNumbers(value: unknown, numbers: number[] = []): number[] {
  if (typeof value === "number") {
    numbers.push(value);
    return numbers;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectNumbers(entry, numbers);
    }
    return numbers;
  }
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectNumbers(nested, numbers);
    }
  }
  return numbers;
}

async function seedRichHistory(userId: string): Promise<void> {
  const author = await prisma.author.create({
    data: { name: "Ursula Le Guin", normalizedName: "ursula le guin", userId },
    select: { id: true },
  });
  const publisher = await prisma.publisher.create({
    data: { name: "Old Lion", normalizedName: "old lion", userId },
    select: { id: true },
  });
  const series = await prisma.series.create({
    data: { name: "Earthsea", normalizedName: "earthsea", totalBooks: 3, userId },
    select: { id: true },
  });

  for (const [index, month] of ["01", "03", "05", "07"].entries()) {
    const book = await prisma.book.create({
      data: {
        firstAuthorName: "Ursula Le Guin",
        genres: ["fantasy", "classic"],
        language: "ukrainian",
        ownershipStatus: "owned",
        pagesCount: 200 + index * 50,
        partNumber: index + 1,
        publisherId: publisher.id,
        readingStatus: "finished",
        seriesId: series.id,
        title: `Earthsea ${String(index + 1)}`,
        userId,
      },
      select: { id: true },
    });
    await prisma.bookAuthor.create({ data: { authorId: author.id, bookId: book.id } });

    await prisma.bookReadingCycle.create({
      data: {
        bookId: book.id,
        completionMetadata: {
          authors: [{ authorId: author.id, name: "Ursula Le Guin" }],
          book: {
            genres: ["fantasy", "classic"],
            language: "ukrainian",
            pagesCount: 200 + index * 50,
            title: `Earthsea ${String(index + 1)}`,
          },
          provenance: "tracked_at_completion",
          publisher: { name: "Old Lion", publisherId: publisher.id },
          series: {
            knownBooksCount: 4,
            name: "Earthsea",
            partNumber: index + 1,
            seriesId: series.id,
            status: "ongoing",
            totalBooks: 3,
          },
          version: 1,
        },
        finishedAt: parseIsoDate(`${CURRENT_YEAR}-${month}-20`),
        firstCompletionReliability: "proven_first",
        rating: 7 + index * 0.5,
        startedAt: parseIsoDate(`${CURRENT_YEAR}-${month}-01`),
        state: "finished",
        userId,
      },
    });

    for (let day = 1; day <= 5; day += 1) {
      await prisma.bookReadingProgressEvent.create({
        data: {
          bookId: book.id,
          date: parseIsoDate(`${CURRENT_YEAR}-${month}-0${String(day)}`),
          page: day * 40,
          pagesRead: 40,
        },
      });
    }
  }
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

describe("reading statistics contract", () => {
  it("parses a rich overview through the published schema", async () => {
    await seedRichHistory(reader.userId);

    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ compare: "same_period_last_year", period: "year", year: CURRENT_YEAR })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    expect(response.status).toBe(200);
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

    expect(parsed.kpis.completedReads.value).toBe(4);
    expect(parsed.kpis.pagesRead.value).toBe(800);
    expect(parsed.genres.frequency.map((entry) => entry.genreKey)).toEqual(["classic", "fantasy"]);
    expect(parsed.authors.frequency[0]?.completedReadCount).toBe(4);
    expect(parsed.publishers.items[0]?.completedReadCount).toBe(4);
    expect(parsed.series.mostActive[0]?.completedReadCycles).toBe(4);
    expect(parsed.records.items.length).toBeGreaterThan(0);
  });

  it("parses an empty overview through the published schema", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ period: "all_time" })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    expect(response.status).toBe(200);
    expect(() => ReadingStatisticsOverviewSchema.parse(response.body)).not.toThrow();
  });

  it("never serializes a number that is not finite", async () => {
    await seedRichHistory(reader.userId);

    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ compare: "previous_period", period: "year", year: CURRENT_YEAR })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    const numbers = collectNumbers(response.body);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every((value) => Number.isFinite(value))).toBe(true);
    expect(response.text).not.toContain("NaN");
    expect(response.text).not.toContain("Infinity");
  });

  it("keeps every retired field name out of the payload", async () => {
    await seedRichHistory(reader.userId);

    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ compare: "previous_period", period: "year", year: CURRENT_YEAR })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    const keys = collectKeys(response.body);
    expect(RETIRED_FIELD_NAMES.filter((name) => keys.has(name))).toEqual([]);
  });

  it("names the cycle count and the distinct title count separately", async () => {
    await seedRichHistory(reader.userId);

    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ period: "year", year: CURRENT_YEAR })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    const keys = collectKeys(response.body);
    expect(keys.has("completedReads")).toBe(true);
    expect(keys.has("uniqueBooksCompleted")).toBe(true);
  });

  it("uses the exact drill-down vocabulary for interactive rows", async () => {
    await seedRichHistory(reader.userId);

    const response = await request(app.getHttpServer())
      .get("/api/statistics/overview")
      .query({ period: "year", year: CURRENT_YEAR })
      .set("Authorization", `Bearer ${reader.accessToken}`);

    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    expect(parsed.genres.frequency[0]?.drilldown.kind).toBe("completed_reads_subset");
    expect(parsed.hero.recentCompletedReads[0]?.drilldown.kind).toBe("reading_cycle");
    expect(parsed.calendar.days[0]?.drilldown.kind).toBe("reading_day");
  });
});

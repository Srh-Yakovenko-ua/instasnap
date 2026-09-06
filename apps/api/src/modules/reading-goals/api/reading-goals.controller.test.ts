import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { ReadingGoalDetailSchema, ReadingGoalsOverviewSchema } from "@app/shared";
import { subDays } from "date-fns";
import { Client } from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import {
  addDaysToIsoDate,
  parseIsoDate,
  toIsoDate,
  toNullableIsoDate,
} from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListLifecycleService } from "../../lists/application/list-lifecycle.service.js";
import { ListsModule } from "../../lists/lists.module.js";
import { ReadingGoalSyncService } from "../application/reading-goal-sync.service.js";
import { ReadingGoalsModule } from "../reading-goals.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const TODAY = toIsoDate(new Date());
const YESTERDAY = addDaysToIsoDate(TODAY, -1);
const TOMORROW = addDaysToIsoDate(TODAY, 1);
const NEXT_WEEK = addDaysToIsoDate(TODAY, 7);
const NEXT_MONTH = addDaysToIsoDate(TODAY, 30);

const DEADLINE = Object.freeze({
  inFifteenDays: addDaysToIsoDate(TODAY, 15),
  inFiveDays: addDaysToIsoDate(TODAY, 5),
  inFourDays: addDaysToIsoDate(TODAY, 4),
  inNineDays: addDaysToIsoDate(TODAY, 9),
  inThreeDays: addDaysToIsoDate(TODAY, 3),
  inTwentyFiveDays: addDaysToIsoDate(TODAY, 25),
  inTwoDays: addDaysToIsoDate(TODAY, 2),
});

const CURSOR_PAGE_SCHEMA = Object.freeze({
  activity: z.object({
    items: z.array(z.object({ type: z.string() })),
    nextCursor: z.string().nullable(),
  }),
  books: z.object({
    items: z.array(z.object({ qualifies: z.boolean(), title: z.string() })),
    nextCursor: z.string().nullable(),
  }),
  ids: z.object({
    items: z.array(z.object({ id: z.string() })),
    nextCursor: z.string().nullable(),
  }),
  metadata: z.object({
    items: z.array(z.object({ metadata: z.record(z.string(), z.unknown()).nullable() })),
  }),
  metrics: z.object({ items: z.array(z.record(z.string(), z.unknown())) }),
  walk: z.object({
    items: z.array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
      }),
    ),
    nextCursor: z.string().nullable(),
  }),
});

const DEFINITION_OF_DONE_FIELDS = [
  "status",
  "result",
  "completedCount",
  "remainingCount",
  "progressPercent",
  "daysLeft",
  "elapsedPercent",
  "expectedCompletedCount",
  "pace",
  "paceDeltaBooks",
  "paceDeltaPercent",
  "requiredBooksPerDay",
  "requiredDaysPerBook",
  "actualBooksPerDay",
  "averageDaysPerBook",
  "lastCountedAt",
  "daysSinceLastCounted",
  "projectedCompletionDate",
  "projectedDaysDelta",
  "projectionConfidence",
  "riskLevel",
  "riskReasons",
];

const MAX_PAGE_WALKS = 20;

const CATALOG_QUERY_LOAD = Object.freeze({ heavyGoalCount: 6, lightGoalCount: 2 });

type CursorPageRequest = (
  cursor: Nullable<string>,
) => PromiseLike<{ body: unknown; status: number }>;

type PostgresQueryTarget = { query: (...args: unknown[]) => unknown };

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let lifecycle: ListLifecycleService;
let owner: AuthenticatedUser;
let syncService: ReadingGoalSyncService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule, ReadingGoalsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  lifecycle = app.get(ListLifecycleService);
  syncService = app.get(ReadingGoalSyncService);
});

beforeEach(async () => {
  context.reset();
  owner = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function activityMetadata({
  goalId,
  type,
}: {
  goalId: string;
  type: string;
}): Promise<unknown> {
  const row = await prisma.readingGoalActivity.findFirst({ where: { goalId, type } });
  return row?.metadata ?? null;
}

async function activityTypes(goalId: string): Promise<string[]> {
  const rows = await prisma.readingGoalActivity.findMany({ where: { goalId } });
  return rows.map((row) => row.type).sort((left, right) => left.localeCompare(right));
}

async function addBookToList({
  deletedAt,
  finishedIsoDate,
  listId,
  position,
  title,
  userId,
}: {
  deletedAt?: Date;
  finishedIsoDate?: string;
  listId: string;
  position: number;
  title: string;
  userId: string;
}): Promise<string> {
  const bookId = await createBook({ deletedAt, finishedIsoDate, title, userId });
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
  return bookId;
}

async function collectPages(sendPage: CursorPageRequest): Promise<{
  ids: string[];
  pages: number;
  titles: string[];
  types: string[];
}> {
  const ids: string[] = [];
  const titles: string[] = [];
  const types: string[] = [];
  let cursor: Nullable<string> = null;

  for (let page = 1; page <= MAX_PAGE_WALKS; page += 1) {
    const response = await sendPage(cursor);
    if (response.status !== 200) {
      throw new Error(`cursor page failed with ${String(response.status)}`);
    }
    const parsed = CURSOR_PAGE_SCHEMA.walk.parse(response.body);
    for (const item of parsed.items) {
      pushDefinedString(ids, item.id);
      pushDefinedString(titles, item.title);
      pushDefinedString(types, item.type);
    }
    cursor = parsed.nextCursor;
    if (cursor === null) {
      return { ids, pages: page, titles, types };
    }
  }
  throw new Error("cursor pagination did not terminate");
}

async function countPostgresQueries(run: () => PromiseLike<unknown>): Promise<number> {
  const target = Client.prototype as unknown as PostgresQueryTarget;
  const original = target.query;
  let issued = 0;
  target.query = function countedQuery(this: unknown, ...args: unknown[]): unknown {
    issued += 1;
    return Reflect.apply(original, this, args);
  };
  try {
    await run();
  } finally {
    target.query = original;
  }
  return issued;
}

async function createBook({
  deletedAt,
  finishedIsoDate,
  title,
  userId,
}: {
  deletedAt?: Date;
  finishedIsoDate?: string;
  title: string;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: {
      deletedAt: deletedAt ?? null,
      firstAuthorName: "",
      genres: [],
      readingStatus: finishedIsoDate === undefined ? "not_started" : "finished",
      title,
      userId,
    },
  });
  if (finishedIsoDate !== undefined) {
    await prisma.bookReadingProgress.create({
      data: { bookId: book.id, finishedAt: parseIsoDate(finishedIsoDate) },
    });
    await insertFinishedReadingCycle(prisma, { bookId: book.id, finishedIsoDate, userId });
  }
  return book.id;
}

async function createGoalOrThrow({
  accessToken,
  deadline = NEXT_MONTH,
  listId,
  targetCount,
}: {
  accessToken: string;
  deadline?: string;
  listId: string;
  targetCount: number;
}): Promise<string> {
  const response = await postGoal({
    accessToken,
    body: { deadline, name: "Autumn goal", targetCount },
    listId,
  });
  if (response.status !== 201) {
    throw new Error(`goal creation failed with ${String(response.status)}`);
  }
  const goalId: unknown = response.body.id;
  if (typeof goalId !== "string") {
    throw new Error("goal creation returned no id");
  }
  return goalId;
}

async function createList(userId: string, name = "Autumn reads"): Promise<string> {
  const created = await prisma.bookList.create({
    data: { description: null, name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

function getGoal({ accessToken, goalId }: { accessToken: string; goalId: string }) {
  return request(app.getHttpServer())
    .get(`/api/goals/${goalId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getGoalActivity({
  accessToken,
  goalId,
  query = {},
}: {
  accessToken: string;
  goalId: string;
  query?: Record<string, number | string>;
}) {
  return request(app.getHttpServer())
    .get(`/api/goals/${goalId}/activity`)
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getGoalBooks({
  accessToken,
  goalId,
  query = {},
}: {
  accessToken: string;
  goalId: string;
  query?: Record<string, number | string>;
}) {
  return request(app.getHttpServer())
    .get(`/api/goals/${goalId}/books`)
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getGoals({
  accessToken,
  query = {},
}: {
  accessToken: string;
  query?: Record<string, number | string>;
}) {
  return request(app.getHttpServer())
    .get("/api/goals")
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getListGoal({ accessToken, listId }: { accessToken: string; listId: string }) {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}/goal`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getOverview(accessToken: string) {
  return request(app.getHttpServer())
    .get("/api/goals/overview")
    .set("Authorization", `Bearer ${accessToken}`);
}

function patchGoal({
  accessToken,
  body,
  goalId,
}: {
  accessToken: string;
  body: Record<string, unknown>;
  goalId: string;
}) {
  return request(app.getHttpServer())
    .patch(`/api/goals/${goalId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function postArchive({ accessToken, goalId }: { accessToken: string; goalId: string }) {
  return request(app.getHttpServer())
    .post(`/api/goals/${goalId}/archive`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function postGoal({
  accessToken,
  body,
  listId,
}: {
  accessToken: string;
  body: Record<string, unknown>;
  listId: string;
}) {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/goal`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function pushDefinedString(target: string[], value: string | undefined): void {
  if (value !== undefined) {
    target.push(value);
  }
}

function readActivityTypes(body: unknown): string[] {
  return CURSOR_PAGE_SCHEMA.activity.parse(body).items.map((item) => item.type);
}

function readBookTitles(body: unknown): string[] {
  return CURSOR_PAGE_SCHEMA.books.parse(body).items.map((item) => item.title);
}

function readItemIds(body: unknown): string[] {
  return CURSOR_PAGE_SCHEMA.ids.parse(body).items.map((item) => item.id);
}

async function seedDetailFixture(user: AuthenticatedUser): Promise<{
  goalId: string;
  listId: string;
}> {
  const listId = await createList(user.userId, "Detail list");
  await addBookToList({
    finishedIsoDate: TODAY,
    listId,
    position: 0,
    title: "Detail counted",
    userId: user.userId,
  });
  await addBookToList({
    listId,
    position: 1,
    title: "Detail remaining one",
    userId: user.userId,
  });
  await addBookToList({
    listId,
    position: 2,
    title: "Detail remaining two",
    userId: user.userId,
  });
  const goalId = await createGoalOrThrow({
    accessToken: user.accessToken,
    deadline: DEADLINE.inNineDays,
    listId,
    targetCount: 2,
  });
  return { goalId, listId };
}

async function seedGoal({
  deadline,
  finishedCount,
  name,
  targetCount,
  totalBooks,
  user,
}: {
  deadline: string;
  finishedCount: number;
  name: string;
  targetCount: number;
  totalBooks: number;
  user: AuthenticatedUser;
}): Promise<{ goalId: string; listId: string }> {
  const listId = await createList(user.userId, `${name} list`);
  for (let index = 0; index < totalBooks; index += 1) {
    await addBookToList({
      finishedIsoDate: index < finishedCount ? TODAY : undefined,
      listId,
      position: index,
      title: `${name} book ${String(index)}`,
      userId: user.userId,
    });
  }
  const response = await postGoal({
    accessToken: user.accessToken,
    body: { deadline, name, targetCount },
    listId,
  });
  if (response.status !== 201) {
    throw new Error(`goal ${name} creation failed with ${String(response.status)}`);
  }
  const goalId: unknown = response.body.id;
  if (typeof goalId !== "string") {
    throw new Error(`goal ${name} creation returned no id`);
  }
  return { goalId, listId };
}

async function seedGoals({
  count,
  user,
}: {
  count: number;
  user: AuthenticatedUser;
}): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: `Catalog ${String(index)}`,
      targetCount: 1,
      totalBooks: 1,
      user,
    });
  }
}

async function seedList({
  bookCount,
  finishedIsoDate,
  user,
}: {
  bookCount: number;
  finishedIsoDate?: string;
  user: AuthenticatedUser;
}): Promise<string> {
  const listId = await createList(user.userId);
  for (let index = 0; index < bookCount; index += 1) {
    await addBookToList({
      finishedIsoDate,
      listId,
      position: index,
      title: `Book ${String(index)}`,
      userId: user.userId,
    });
  }
  return listId;
}

async function seedOverviewGoals(user: AuthenticatedUser): Promise<{
  ahead: string;
  criticalThree: string;
  criticalTwo: string;
  done: string;
  expired: string;
  medium: string;
}> {
  const ahead = await seedGoal({
    deadline: DEADLINE.inNineDays,
    finishedCount: 1,
    name: "Ahead",
    targetCount: 2,
    totalBooks: 2,
    user,
  });
  const done = await seedGoal({
    deadline: DEADLINE.inFiveDays,
    finishedCount: 1,
    name: "Done",
    targetCount: 1,
    totalBooks: 1,
    user,
  });
  const expired = await seedGoal({
    deadline: DEADLINE.inFourDays,
    finishedCount: 0,
    name: "Expired",
    targetCount: 2,
    totalBooks: 2,
    user,
  });
  await prisma.readingGoal.update({
    data: { deadline: parseIsoDate(YESTERDAY) },
    where: { id: expired.goalId },
  });
  const medium = await seedGoal({
    deadline: DEADLINE.inNineDays,
    finishedCount: 0,
    name: "Medium",
    targetCount: 5,
    totalBooks: 5,
    user,
  });
  const criticalThree = await seedGoal({
    deadline: DEADLINE.inThreeDays,
    finishedCount: 0,
    name: "Critical three",
    targetCount: 3,
    totalBooks: 3,
    user,
  });
  const criticalTwo = await seedGoal({
    deadline: DEADLINE.inTwoDays,
    finishedCount: 0,
    name: "Critical two",
    targetCount: 5,
    totalBooks: 5,
    user,
  });

  return {
    ahead: ahead.goalId,
    criticalThree: criticalThree.goalId,
    criticalTwo: criticalTwo.goalId,
    done: done.goalId,
    expired: expired.goalId,
    medium: medium.goalId,
  };
}

function snapshotRows(goalId: string) {
  return prisma.readingGoalBook.findMany({ orderBy: { position: "asc" }, where: { goalId } });
}

async function trashBook(title: string): Promise<void> {
  await prisma.book.updateMany({ data: TRASH_RETENTION.stamp(), where: { title } });
}

describe("POST /api/lists/:listId/goal", () => {
  it("creates a goal over the list and returns the view shape", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, name: "Autumn goal", targetCount: 3 },
      listId,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      completedCount: 0,
      deadline: NEXT_MONTH,
      list: { id: listId, name: "Autumn reads" },
      name: "Autumn goal",
      remainingCount: 3,
      status: "active",
      targetCount: 3,
    });
    expect(response.body.id).toMatch(UUID_PATTERN);
  });

  it("rejects a deadline in the past with a field-scoped error on deadline", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: YESTERDAY, targetCount: 1 },
      listId,
    });

    expect(response.status).toBe(400);
    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deadline" })]),
    );
  });

  it("conflicts when the list already has an active goal", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 3 });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 2 },
      listId,
    });

    expect(response.status).toBe(409);
  });

  it("lets exactly one of two simultaneous attempts win", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    const body = { deadline: NEXT_MONTH, targetCount: 2 };

    const responses = await Promise.all([
      postGoal({ accessToken: owner.accessToken, body, listId }),
      postGoal({ accessToken: owner.accessToken, body, listId }),
    ]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);
  });

  it("leaves exactly one goal row behind after two simultaneous attempts", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    const body = { deadline: NEXT_MONTH, targetCount: 2 };

    await Promise.all([
      postGoal({ accessToken: owner.accessToken, body, listId }),
      postGoal({ accessToken: owner.accessToken, body, listId }),
    ]);

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(1);
  });

  it("archives the previous goal when it is already completed", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const firstGoalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const second = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 1 },
      listId,
    });
    const previous = await getGoal({ accessToken: owner.accessToken, goalId: firstGoalId });

    expect(second.status).toBe(201);
    expect(previous.body.status).toBe("archived");
  });

  it("returns 404 for a list owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 1 },
      listId,
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/lists/:listId/goal", () => {
  it("returns 204 with an empty body when the list has no open goal", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it("returns 204 rather than the goal once the only goal is archived", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(204);
  });

  it("returns the open goal of the list", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(goalId);
  });

  it("returns 404 for a list owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a list that does not exist", async () => {
    const response = await getListGoal({ accessToken: owner.accessToken, listId: MISSING_UUID });

    expect(response.status).toBe(404);
  });
});

describe("reading goal progress", () => {
  it("does not count a book finished the day before the goal was created", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: YESTERDAY,
      listId,
      position: 0,
      title: "Finished yesterday",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(0);
  });

  it("counts a book finished earlier on the same UTC day the goal was created", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Finished this morning",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(1);
  });

  it("counts a book finished after the goal was created", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    const before = await getGoal({ accessToken: owner.accessToken, goalId });

    const [item] = await prisma.bookListItem.findMany({
      orderBy: { position: "asc" },
      where: { listId },
    });
    const bookId = item?.bookId ?? MISSING_UUID;
    await prisma.bookReadingProgress.create({
      data: { bookId, finishedAt: parseIsoDate(TODAY) },
    });
    await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: TODAY,
      userId: owner.userId,
    });
    await syncService.syncBooks({ bookIds: [bookId], userId: owner.userId });
    const after = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(before.body.completedCount).toBe(0);
    expect(after.body.completedCount).toBe(1);
  });

  it("flips the status to completed once the target is met", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body).toMatchObject({
      completedCount: 2,
      remainingCount: 0,
      status: "completed",
    });
  });

  it("does not count a book that sits in the trash", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Counted",
      userId: owner.userId,
    });
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 1,
      title: "Trashed",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await trashBook("Trashed");
    const trashed = await prisma.book.findFirstOrThrow({ where: { title: "Trashed" } });
    await syncService.syncBooks({ bookIds: [trashed.id], userId: owner.userId });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(1);
  });

  it("keeps counting a book that leaves the list after the goal captured it", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    const before = await getGoal({ accessToken: owner.accessToken, goalId });

    const [item] = await prisma.bookListItem.findMany({
      orderBy: { position: "asc" },
      where: { listId },
    });
    await prisma.bookListItem.deleteMany({
      where: { bookId: item?.bookId ?? MISSING_UUID, listId },
    });
    const after = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(before.body.completedCount).toBe(2);
    expect(after.body.completedCount).toBe(2);
  });
});

describe("GET /api/goals/:goalId", () => {
  it("still returns an archived goal with an archived status", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("archived");
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/goals/:goalId", () => {
  it("renames the goal", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Renamed goal" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Renamed goal");
  });

  it("rejects moving the deadline into the past with a field-scoped error on deadline", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ deadline: YESTERDAY });

    expect(response.status).toBe(400);
    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deadline" })]),
    );
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/goals/:goalId/archive", () => {
  it("keeps the original archivedAt when archived twice", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const first = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const second = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(second.status).toBe(200);
    expect(second.body.archivedAt).toBe(first.body.archivedAt);
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/goals/:goalId", () => {
  it("removes the goal and then reports it as gone", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const deleted = await request(app.getHttpServer())
      .delete(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const reread = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(deleted.status).toBe(204);
    expect(reread.status).toBe(404);
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe("reading goal snapshot", () => {
  it("captures every active book of the list", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });

    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 3,
    });

    const activeBookCount = await prisma.bookListItem.count({
      where: { book: { deletedAt: null }, listId },
    });
    expect(await prisma.readingGoalBook.count({ where: { goalId } })).toBe(activeBookCount);
    expect(activeBookCount).toBe(3);
  });

  it("leaves a trashed book out of the snapshot", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({ listId, position: 0, title: "Kept", userId: owner.userId });
    await addBookToList({ listId, position: 1, title: "Trashed", userId: owner.userId });
    await trashBook("Trashed");

    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    expect(await prisma.readingGoalBook.count({ where: { goalId } })).toBe(1);
  });

  it("keeps the captured membership when a book later leaves the list", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await prisma.bookListItem.deleteMany({ where: { listId } });

    expect(await prisma.readingGoalBook.count({ where: { goalId } })).toBe(2);
  });

  it("marks the books that already qualify as counted", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Finished",
      userId: owner.userId,
    });
    await addBookToList({ listId, position: 1, title: "Unread", userId: owner.userId });

    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const rows = await snapshotRows(goalId);
    expect(rows.map((row) => toNullableIsoDate(row.qualifiedFinishedAt))).toEqual([TODAY, null]);
  });

  it("rejects a target above the number of books the snapshot captured", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({ listId, position: 0, title: "Only book", userId: owner.userId });
    await addBookToList({ listId, position: 1, title: "Trashed", userId: owner.userId });
    await trashBook("Trashed");

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 2 },
      listId,
    });

    expect(response.status).toBe(400);
    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(0);
  });
});

describe("reading goal activity on create", () => {
  it("records the goal with its target, deadline and snapshot size", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });

    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    expect(await activityTypes(goalId)).toEqual(["goal_created"]);
    expect(await activityMetadata({ goalId, type: "goal_created" })).toEqual({
      deadline: NEXT_MONTH,
      snapshotBookCount: 3,
      targetCount: 2,
    });
  });

  it("counts the books that were already finished and closes a met goal", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });

    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    expect(await activityTypes(goalId)).toEqual([
      "book_counted",
      "book_counted",
      "goal_completed",
      "goal_created",
    ]);
    const counted = await prisma.readingGoalActivity.findFirst({
      where: { goalId, type: "book_counted" },
    });
    expect(counted?.bookId).toEqual(expect.stringMatching(UUID_PATTERN));
    expect(counted?.metadata).toMatchObject({ finishedAt: TODAY, targetCount: 2 });
  });
});

describe("reading goal activity on patch", () => {
  it("records a rename", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await patchGoal({ accessToken: owner.accessToken, body: { name: "Renamed" }, goalId });

    expect(await activityMetadata({ goalId, type: "goal_renamed" })).toEqual({
      from: "Autumn goal",
      to: "Renamed",
    });
  });

  it("records a target change", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await patchGoal({ accessToken: owner.accessToken, body: { targetCount: 1 }, goalId });

    expect(await activityMetadata({ goalId, type: "target_changed" })).toEqual({ from: 2, to: 1 });
  });

  it("records a deadline change", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await patchGoal({ accessToken: owner.accessToken, body: { deadline: NEXT_WEEK }, goalId });

    expect(await activityMetadata({ goalId, type: "deadline_changed" })).toEqual({
      from: NEXT_MONTH,
      to: NEXT_WEEK,
    });
  });

  it("uncounts a book the shortened deadline pushed out", async () => {
    const listId = await createList(owner.userId);
    const bookId = await addBookToList({
      finishedIsoDate: NEXT_WEEK,
      listId,
      position: 0,
      title: "Finished next week",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    await patchGoal({ accessToken: owner.accessToken, body: { deadline: TOMORROW }, goalId });

    expect(await activityMetadata({ goalId, type: "book_uncounted" })).toEqual({
      previousFinishedAt: NEXT_WEEK,
      reason: "deadline_changed",
    });
    const [row] = await snapshotRows(goalId);
    expect(row?.bookId).toBe(bookId);
    expect(row?.qualifiedFinishedAt).toBeNull();
  });

  it("counts a book the extended deadline pulled in and closes the goal once", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: NEXT_WEEK,
      listId,
      position: 0,
      title: "Finished next week",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      deadline: TOMORROW,
      listId,
      targetCount: 1,
    });

    await patchGoal({ accessToken: owner.accessToken, body: { deadline: NEXT_MONTH }, goalId });
    await patchGoal({ accessToken: owner.accessToken, body: { name: "Renamed" }, goalId });

    expect(await activityTypes(goalId)).toEqual([
      "book_counted",
      "deadline_changed",
      "goal_completed",
      "goal_created",
      "goal_renamed",
    ]);
    expect(await activityMetadata({ goalId, type: "book_counted" })).toEqual({
      completedCount: 1,
      finishedAt: NEXT_WEEK,
      targetCount: 1,
    });
  });

  it("clears the qualification of a book that was trashed after the goal started", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Counted then trashed",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    await prisma.book.updateMany({
      data: TRASH_RETENTION.stamp(),
      where: { title: "Counted then trashed" },
    });
    await patchGoal({ accessToken: owner.accessToken, body: { deadline: NEXT_WEEK }, goalId });

    const [row] = await snapshotRows(goalId);
    expect(row?.qualifiedFinishedAt).toBeNull();
  });

  it("patches a goal that has no list", async () => {
    const goal = await prisma.readingGoal.create({
      data: {
        deadline: parseIsoDate(NEXT_MONTH),
        listId: null,
        name: "Standalone",
        targetCount: 1,
        userId: owner.userId,
      },
    });

    const response = await patchGoal({
      accessToken: owner.accessToken,
      body: { name: "Renamed" },
      goalId: goal.id,
    });

    expect(response.status).toBe(200);
    expect(await prisma.readingGoalBook.count({ where: { goalId: goal.id } })).toBe(0);
    expect(await activityTypes(goal.id)).toEqual(["goal_renamed"]);
  });
});

describe("reading goal activity on archive", () => {
  it("records the result the goal ended with", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await postArchive({ accessToken: owner.accessToken, goalId });

    expect(await activityMetadata({ goalId, type: "goal_archived" })).toEqual({
      result: "completed",
    });
  });

  it("records nothing more when the goal is archived twice", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await postArchive({ accessToken: owner.accessToken, goalId });
    await postArchive({ accessToken: owner.accessToken, goalId });

    expect(
      await prisma.readingGoalActivity.count({ where: { goalId, type: "goal_archived" } }),
    ).toBe(1);
  });

  it("records the archive of a predecessor superseded by a new goal", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const firstGoalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 1 },
      listId,
    });

    expect(await activityMetadata({ goalId: firstGoalId, type: "goal_archived" })).toEqual({
      result: "completed",
    });
  });
});

describe("list and user lifecycle", () => {
  it("keeps the goal row while its list only sits in the trash", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });

    await lifecycle.softDelete({ listId, userId: owner.userId });

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(1);
  });

  it("serves the goal again once its list is restored from the trash", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await lifecycle.softDelete({ listId, userId: owner.userId });

    await lifecycle.restore({ listId, userId: owner.userId });
    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(goalId);
  });

  it("purges the goal together with its list", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });
    await lifecycle.softDelete({ listId, userId: owner.userId });
    await prisma.bookList.update({
      data: { purgeAt: subDays(new Date(), 1) },
      where: { id: listId },
    });

    await lifecycle.purge({ listId, userId: owner.userId });

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(0);
  });

  it("removes the goals of a deleted user", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });

    await prisma.user.delete({ where: { id: owner.userId } });

    expect(await prisma.readingGoal.count({ where: { userId: owner.userId } })).toBe(0);
  });
});

describe("GET /api/goals", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(app.getHttpServer()).get("/api/goals");

    expect(response.status).toBe(401);
  });

  it("serves only the goals of the calling user", async () => {
    const ownerGoal = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Mine",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const stranger = await context.registerVerifyAndLogin();
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Theirs",
      targetCount: 1,
      totalBooks: 1,
      user: stranger,
    });

    const response = await getGoals({ accessToken: owner.accessToken });

    expect(readItemIds(response.body)).toEqual([ownerGoal.goalId]);
  });

  it("filters by derived status", async () => {
    const goals = await seedOverviewGoals(owner);

    const completed = await getGoals({
      accessToken: owner.accessToken,
      query: { status: "completed" },
    });
    const expired = await getGoals({
      accessToken: owner.accessToken,
      query: { status: "expired" },
    });
    const active = await getGoals({ accessToken: owner.accessToken, query: { status: "active" } });

    expect(readItemIds(completed.body)).toEqual([goals.done]);
    expect(readItemIds(expired.body)).toEqual([goals.expired]);
    expect(readItemIds(active.body)).toHaveLength(4);
  });

  it("filters by list", async () => {
    const wanted = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Wanted",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Other",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });

    const response = await getGoals({
      accessToken: owner.accessToken,
      query: { listId: wanted.listId },
    });

    expect(readItemIds(response.body)).toEqual([wanted.goalId]);
  });

  it("returns an empty page for a list owned by another user", async () => {
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Mine",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const stranger = await context.registerVerifyAndLogin();
    const theirs = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Theirs",
      targetCount: 1,
      totalBooks: 1,
      user: stranger,
    });

    const response = await getGoals({
      accessToken: owner.accessToken,
      query: { listId: theirs.listId },
    });

    expect(readItemIds(response.body)).toEqual([]);
  });

  it("orders by creation date in both directions", async () => {
    const first = await seedGoal({
      deadline: DEADLINE.inFiveDays,
      finishedCount: 0,
      name: "First",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const second = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Second",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });

    const descending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "created_desc" },
    });
    const ascending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "created_asc" },
    });

    expect(readItemIds(descending.body)).toEqual([second.goalId, first.goalId]);
    expect(readItemIds(ascending.body)).toEqual([first.goalId, second.goalId]);
  });

  it("orders by deadline in both directions", async () => {
    const soon = await seedGoal({
      deadline: DEADLINE.inThreeDays,
      finishedCount: 0,
      name: "Soon",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const later = await seedGoal({
      deadline: DEADLINE.inTwentyFiveDays,
      finishedCount: 0,
      name: "Later",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });

    const ascending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "deadline_asc" },
    });
    const descending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "deadline_desc" },
    });

    expect(readItemIds(ascending.body)).toEqual([soon.goalId, later.goalId]);
    expect(readItemIds(descending.body)).toEqual([later.goalId, soon.goalId]);
  });

  it("orders by progress in both directions", async () => {
    const empty = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Empty",
      targetCount: 2,
      totalBooks: 2,
      user: owner,
    });
    const half = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 1,
      name: "Half",
      targetCount: 2,
      totalBooks: 2,
      user: owner,
    });

    const descending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "progress_desc" },
    });
    const ascending = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "progress_asc" },
    });

    expect(readItemIds(descending.body)).toEqual([half.goalId, empty.goalId]);
    expect(readItemIds(ascending.body)).toEqual([empty.goalId, half.goalId]);
  });

  it("puts the riskiest goal first when sorting by risk", async () => {
    const goals = await seedOverviewGoals(owner);

    const response = await getGoals({
      accessToken: owner.accessToken,
      query: { sort: "risk_desc" },
    });
    const [firstId] = readItemIds(response.body);

    expect([goals.criticalTwo, goals.criticalThree]).toContain(firstId);
  });

  it("walks every goal exactly once across cursor pages", async () => {
    await seedGoals({ count: 5, user: owner });

    const collected = await collectPages((cursor) =>
      getGoals({
        accessToken: owner.accessToken,
        query: { limit: 2, ...(cursor === null ? {} : { cursor }) },
      }),
    );

    expect(collected.pages).toBe(3);
    expect(collected.ids).toHaveLength(5);
    expect(new Set(collected.ids).size).toBe(5);
  });

  it("serves every derived metric on each item", async () => {
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 1,
      name: "Metrics",
      targetCount: 2,
      totalBooks: 2,
      user: owner,
    });

    const response = await getGoals({ accessToken: owner.accessToken });
    const [item] = CURSOR_PAGE_SCHEMA.metrics.parse(response.body).items;

    expect(Object.keys(item ?? {})).toEqual(expect.arrayContaining(DEFINITION_OF_DONE_FIELDS));
  });
});

describe("GET /api/goals/overview", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(app.getHttpServer()).get("/api/goals/overview");

    expect(response.status).toBe(401);
  });

  it("aggregates the control set into one response", async () => {
    const goals = await seedOverviewGoals(owner);

    const response = await getOverview(owner.accessToken);
    const overview = ReadingGoalsOverviewSchema.parse(response.body);

    expect(overview.active).toEqual({ needsAttention: 3, onTrack: 1, total: 4 });
    expect(overview.completed).toEqual({ completedOnOrBeforeDeadline: 1, total: 1 });
    expect(overview.booksCounted).toEqual({ currentYear: 2 });
    expect(overview.success).toEqual({
      finishedGoals: 2,
      successfulGoals: 1,
      successRatePercent: 50,
    });
    expect(overview.bestResult).toEqual({
      completedAt: TODAY,
      daysBeforeDeadline: 5,
      goalId: goals.done,
      goalName: "Done",
      listName: "Done list",
      targetCount: 1,
    });
  });

  it("orders the attention block by severity and then by the nearest deadline", async () => {
    const goals = await seedOverviewGoals(owner);

    const response = await getOverview(owner.accessToken);
    const overview = ReadingGoalsOverviewSchema.parse(response.body);

    expect(overview.attention.map((item) => item.goalId)).toEqual([
      goals.criticalTwo,
      goals.criticalThree,
      goals.medium,
    ]);
    expect(overview.attention.map((item) => item.severity)).toEqual([
      "critical",
      "critical",
      "medium",
    ]);
    expect(overview.attention.every((item) => typeof item.reason === "string")).toBe(true);
  });

  it("caps the attention block at five goals", async () => {
    for (let index = 0; index < 7; index += 1) {
      await seedGoal({
        deadline: DEADLINE.inTwoDays,
        finishedCount: 0,
        name: `Attention ${String(index)}`,
        targetCount: 3,
        totalBooks: 3,
        user: owner,
      });
    }

    const response = await getOverview(owner.accessToken);
    const overview = ReadingGoalsOverviewSchema.parse(response.body);

    expect(overview.active.needsAttention).toBe(7);
    expect(overview.attention).toHaveLength(5);
  });

  it("reports a zero success rate when nothing has finished yet", async () => {
    await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Open",
      targetCount: 2,
      totalBooks: 2,
      user: owner,
    });

    const response = await getOverview(owner.accessToken);
    const overview = ReadingGoalsOverviewSchema.parse(response.body);

    expect(overview.success).toEqual({
      finishedGoals: 0,
      successfulGoals: 0,
      successRatePercent: 0,
    });
    expect(overview.bestResult).toBeNull();
  });
});

describe("catalog query load", () => {
  it("keeps the goal catalog query count flat as the number of goals grows", async () => {
    await seedGoals({ count: CATALOG_QUERY_LOAD.lightGoalCount, user: owner });
    const light = await countPostgresQueries(() => getGoals({ accessToken: owner.accessToken }));

    await truncateAllTables(app);
    owner = await context.registerVerifyAndLogin();
    await seedGoals({ count: CATALOG_QUERY_LOAD.heavyGoalCount, user: owner });
    const heavy = await countPostgresQueries(() => getGoals({ accessToken: owner.accessToken }));

    expect(heavy).toBe(light);
  });

  it("keeps the overview query count flat as the number of goals grows", async () => {
    await seedGoals({ count: CATALOG_QUERY_LOAD.lightGoalCount, user: owner });
    const light = await countPostgresQueries(() => getOverview(owner.accessToken));

    await truncateAllTables(app);
    owner = await context.registerVerifyAndLogin();
    await seedGoals({ count: CATALOG_QUERY_LOAD.heavyGoalCount, user: owner });
    const heavy = await countPostgresQueries(() => getOverview(owner.accessToken));

    expect(heavy).toBe(light);
  });
});

describe("GET /api/goals/:goalId detail payload", () => {
  it("serves the metrics, the snapshot books, the checkpoints and the activity preview", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const response = await getGoal({ accessToken: owner.accessToken, goalId });
    const detail = ReadingGoalDetailSchema.parse(response.body);

    expect(Object.keys(detail)).toEqual(expect.arrayContaining(DEFINITION_OF_DONE_FIELDS));
    expect(detail.checkpoints.length).toBeGreaterThan(0);
    expect(detail.countedBooks.map((book) => book.title)).toEqual(["Detail counted"]);
    expect(detail.remainingBooks.map((book) => book.title)).toEqual([
      "Detail remaining one",
      "Detail remaining two",
    ]);
    expect(detail.snapshotBookCount).toBe(3);
    expect(detail.listBookCount).toBe(3);
    expect(detail.activityPreview.map((entry) => entry.type)).toContain("goal_created");
  });

  it("still lists a book that left the list after the goal was created", async () => {
    const { goalId, listId } = await seedDetailFixture(owner);
    await prisma.bookListItem.deleteMany({ where: { listId } });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });
    const detail = ReadingGoalDetailSchema.parse(response.body);

    expect(detail.snapshotBookCount).toBe(3);
    expect(detail.remainingBooks).toHaveLength(2);
    expect(detail.listBookCount).toBe(0);
  });
});

describe("GET /api/goals/:goalId/books", () => {
  it("returns 404 for a goal owned by another user", async () => {
    const { goalId } = await seedDetailFixture(owner);
    const stranger = await context.registerVerifyAndLogin();

    const response = await getGoalBooks({ accessToken: stranger.accessToken, goalId });

    expect(response.status).toBe(404);
  });

  it("splits the snapshot by scope", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const counted = await getGoalBooks({
      accessToken: owner.accessToken,
      goalId,
      query: { scope: "counted" },
    });
    const remaining = await getGoalBooks({
      accessToken: owner.accessToken,
      goalId,
      query: { scope: "remaining" },
    });
    const all = await getGoalBooks({
      accessToken: owner.accessToken,
      goalId,
      query: { scope: "all" },
    });

    expect(readBookTitles(counted.body)).toEqual(["Detail counted"]);
    expect(readBookTitles(remaining.body)).toEqual([
      "Detail remaining one",
      "Detail remaining two",
    ]);
    expect(readBookTitles(all.body)).toEqual([
      "Detail counted",
      "Detail remaining one",
      "Detail remaining two",
    ]);
  });

  it("rejects a limit above the maximum page size", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const response = await getGoalBooks({
      accessToken: owner.accessToken,
      goalId,
      query: { limit: 101 },
    });

    expect(response.status).toBe(400);
  });

  it("walks the snapshot exactly once across cursor pages", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const collected = await collectPages((cursor) =>
      getGoalBooks({
        accessToken: owner.accessToken,
        goalId,
        query: { limit: 2, ...(cursor === null ? {} : { cursor }) },
      }),
    );

    expect(collected.pages).toBe(2);
    expect(collected.titles).toEqual([
      "Detail counted",
      "Detail remaining one",
      "Detail remaining two",
    ]);
  });

  it("rejects a forged cursor", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const response = await getGoalBooks({
      accessToken: owner.accessToken,
      goalId,
      query: { cursor: "not-a-cursor" },
    });

    expect(response.status).toBe(400);
  });
});

describe("GET /api/goals/:goalId/activity", () => {
  it("returns 404 for a goal owned by another user", async () => {
    const { goalId } = await seedDetailFixture(owner);
    const stranger = await context.registerVerifyAndLogin();

    const response = await getGoalActivity({ accessToken: stranger.accessToken, goalId });

    expect(response.status).toBe(404);
  });

  it("filters by activity type", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const response = await getGoalActivity({
      accessToken: owner.accessToken,
      goalId,
      query: { type: "goal_created" },
    });

    expect(readActivityTypes(response.body)).toEqual(["goal_created"]);
  });

  it("serves raw metadata rather than a localized message", async () => {
    const { goalId } = await seedDetailFixture(owner);

    const response = await getGoalActivity({
      accessToken: owner.accessToken,
      goalId,
      query: { type: "goal_created" },
    });
    const [entry] = CURSOR_PAGE_SCHEMA.metadata.parse(response.body).items;

    expect(entry?.metadata).toMatchObject({ targetCount: 2 });
  });

  it("walks the activity exactly once across cursor pages", async () => {
    const { goalId } = await seedDetailFixture(owner);
    await patchGoal({ accessToken: owner.accessToken, body: { name: "Renamed" }, goalId });
    await patchGoal({ accessToken: owner.accessToken, body: { targetCount: 3 }, goalId });

    const collected = await collectPages((cursor) =>
      getGoalActivity({
        accessToken: owner.accessToken,
        goalId,
        query: { limit: 2, ...(cursor === null ? {} : { cursor }) },
      }),
    );

    expect(collected.types.length).toBeGreaterThanOrEqual(4);
    expect(collected.pages).toBeGreaterThan(1);
  });
});

describe("reading goal snapshot invariants", () => {
  it("validates a raised target against the snapshot, not against the list as it stands now", async () => {
    const listId = await seedList({ bookCount: 4, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await prisma.bookListItem.deleteMany({ where: { listId } });

    const response = await patchGoal({
      accessToken: owner.accessToken,
      body: { targetCount: 4 },
      goalId,
    });

    expect(response.status).toBe(200);
    expect(response.body.targetCount).toBe(4);
  });

  it("rejects a target above the snapshot even after the list grew", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await addBookToList({ listId, position: 2, title: "Added later", userId: owner.userId });

    const response = await patchGoal({
      accessToken: owner.accessToken,
      body: { targetCount: 3 },
      goalId,
    });

    expect(response.status).toBe(400);
  });

  it("uncounts a book the archive pushed outside the counting window", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: NEXT_WEEK,
      listId,
      position: 0,
      title: "Finished later",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      deadline: NEXT_MONTH,
      listId,
      targetCount: 1,
    });
    const before = await getGoal({ accessToken: owner.accessToken, goalId });

    await postArchive({ accessToken: owner.accessToken, goalId });
    const after = await getGoal({ accessToken: owner.accessToken, goalId });
    const detail = ReadingGoalDetailSchema.parse(after.body);

    expect(before.body.completedCount).toBe(1);
    expect(detail.completedCount).toBe(0);
    expect(detail.countedBooks).toEqual([]);
    expect(detail.remainingBooks.map((book) => book.qualifies)).toEqual([false]);
    expect(await activityTypes(goalId)).toContain("book_uncounted");
  });

  it("skips no goal when the cursor anchor leaves the catalog between pages", async () => {
    const first = await seedGoal({
      deadline: DEADLINE.inThreeDays,
      finishedCount: 0,
      name: "Anchor",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const second = await seedGoal({
      deadline: DEADLINE.inFiveDays,
      finishedCount: 0,
      name: "Second",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });
    const third = await seedGoal({
      deadline: DEADLINE.inNineDays,
      finishedCount: 0,
      name: "Third",
      targetCount: 1,
      totalBooks: 1,
      user: owner,
    });

    const page = await getGoals({
      accessToken: owner.accessToken,
      query: { limit: 1, sort: "deadline_asc" },
    });
    const cursor = CURSOR_PAGE_SCHEMA.ids.parse(page.body).nextCursor;
    await prisma.readingGoal.delete({ where: { id: first.goalId } });
    const next = await getGoals({
      accessToken: owner.accessToken,
      query: { limit: 1, sort: "deadline_asc", ...(cursor === null ? {} : { cursor }) },
    });

    expect(readItemIds(page.body)).toEqual([first.goalId]);
    expect(readItemIds(next.body)).toEqual([second.goalId]);
    expect(third.goalId).not.toBe(second.goalId);
  });
});

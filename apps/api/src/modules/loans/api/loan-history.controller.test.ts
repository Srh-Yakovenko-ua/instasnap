import type {
  LoanDirection,
  LoanHistoryListItemView,
  LoanHistoryPersonOption,
  LoanHistoryPersonStats,
  LoanHistoryResultCounts,
  LoanHistorySort,
  Nullable,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  LoanHistoryDetailViewSchema,
  LoanHistoryOverviewViewSchema,
  LoanHistoryPeopleViewSchema,
  PaginatedLoanHistorySchema,
} from "@app/shared";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import request, { type Response } from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { LoansModule } from "../loans.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HISTORY_FIXTURE = {
  author: "Frank Herbert",
  fallbackLoanDate: "2026-01-01",
  missingLoanId: "00000000-0000-4000-8000-000000000000",
  sortableSize: 5,
} as const;

const EMPTY_OVERVIEW = {
  duration: { averageDays: null, longestDays: null, shortestDays: null },
  reliability: { lateCount: 0, noDueDateCount: 0, onTimeCount: 0, onTimePercent: null },
  summary: {
    averageDelayDays: null,
    averageDurationDays: null,
    borrowedCount: 0,
    durationCount: 0,
    lateCount: 0,
    lentCount: 0,
    noDueDateCount: 0,
    onTimeCount: 0,
    onTimePercent: null,
    totalCompleted: 0,
  },
  topPeople: [],
};

type CompletedLoanRef = { bookId: string; loanId: string };

type CompletedLoanSpec = LoanSpec & { returnedAt: string };

type LoanColumns = {
  contact: Nullable<string>;
  expectedReturnDate: Nullable<Date>;
  loanDate: Nullable<Date>;
  personName: string;
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
  returnedAt: Nullable<Date>;
  status: string;
  type: string;
};

type LoanSpec = {
  authorName?: string;
  contact?: string;
  direction: LoanDirection;
  expectedReturnDate?: string;
  loanDate?: Nullable<string>;
  note?: string;
  personName: string;
  remindToReturn?: boolean;
  title: string;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, LoansModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

async function archiveContact(accessToken: string, contactId: string): Promise<void> {
  const res = await request(app.getHttpServer())
    .post(`/api/loans/contacts/${contactId}/archive`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
}

async function completeLoan(
  accessToken: string,
  spec: CompletedLoanSpec,
): Promise<CompletedLoanRef> {
  const active = await startLoan(accessToken, spec);
  const returned = await returnLoan(accessToken, active.bookId);
  expect(returned.status).toBe(200);

  await prisma.bookLoan.update({
    data: {
      loanDate: spec.loanDate === null ? null : undefined,
      returnedAt: new Date(spec.returnedAt),
    },
    where: { id: active.loanId },
  });
  return active;
}

async function contactIdFor(name: string): Promise<string> {
  const contact = await prisma.loanContact.findFirstOrThrow({
    select: { id: true },
    where: { name },
  });
  return contact.id;
}

function correctHistory(
  accessToken: string,
  loanId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/loans/history/${loanId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function historyDetail(accessToken: string, loanId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/history/${loanId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function historyItems(res: Response): LoanHistoryListItemView[] {
  return PaginatedLoanHistorySchema.parse(res.body).items;
}

function historyOverview(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/history/overview${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function historyPeople(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/history/people${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function historyResultCounts(res: Response): LoanHistoryResultCounts {
  return PaginatedLoanHistorySchema.parse(res.body).resultCounts;
}

function historyTitles(res: Response): string[] {
  return historyItems(res).map((item) => item.book.title);
}

function listActiveLoans(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/loans")
    .set("Authorization", `Bearer ${accessToken}`);
}

function listHistory(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/history${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function loanColumns(loanId: string): Promise<LoanColumns> {
  return prisma.bookLoan.findUniqueOrThrow({
    select: {
      contact: true,
      expectedReturnDate: true,
      loanDate: true,
      personName: true,
      remindBeforeDays: true,
      remindToReturn: true,
      returnedAt: true,
      status: true,
      type: true,
    },
    where: { id: loanId },
  });
}

function peopleOptions(res: Response): LoanHistoryPersonOption[] {
  return LoanHistoryPeopleViewSchema.parse(res.body).items;
}

async function reachableContactId(
  accessToken: string,
  { contact, name }: { contact: string; name: string },
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/loans/contacts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ contact, name });
  if (res.status === 201) {
    const contactId: string = res.body.id;
    return contactId;
  }

  expect(res.status).toBe(409);
  return contactIdFor(name);
}

async function renameContact(accessToken: string, contactId: string, name: string): Promise<void> {
  const res = await request(app.getHttpServer())
    .patch(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name });
  expect(res.status).toBe(200);
}

function returnLoan(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/loan/return`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedOverviewHistory(accessToken: string): Promise<void> {
  await completeLoan(accessToken, {
    direction: "borrowed",
    expectedReturnDate: "2026-01-10",
    loanDate: "2026-01-01",
    personName: "Olha",
    returnedAt: "2026-01-10T23:59:59.000Z",
    title: "On time borrowed",
  });
  await completeLoan(accessToken, {
    direction: "borrowed",
    expectedReturnDate: "2026-02-10",
    loanDate: "2026-02-01",
    personName: "Olha",
    returnedAt: "2026-02-13T00:00:00.000Z",
    title: "Late borrowed",
  });
  await completeLoan(accessToken, {
    direction: "lent",
    loanDate: "2026-03-01",
    personName: "Ivan",
    returnedAt: "2026-03-05T10:00:00.000Z",
    title: "Open ended lent",
  });
  await completeLoan(accessToken, {
    direction: "lent",
    expectedReturnDate: "2026-04-10",
    loanDate: null,
    personName: "Ivan",
    returnedAt: "2026-04-20T00:00:00.000Z",
    title: "Late lent without a loan date",
  });
}

async function seedSortableHistory(accessToken: string): Promise<void> {
  await completeLoan(accessToken, {
    direction: "borrowed",
    loanDate: "2026-01-01",
    personName: "Dmytro",
    returnedAt: "2026-01-05T10:00:00.000Z",
    title: "Alpha",
  });
  await completeLoan(accessToken, {
    direction: "borrowed",
    loanDate: "2026-02-01",
    personName: "Cecilia",
    returnedAt: "2026-02-20T10:00:00.000Z",
    title: "Bravo",
  });
  await completeLoan(accessToken, {
    direction: "borrowed",
    loanDate: null,
    personName: "Bohdan",
    returnedAt: "2026-03-15T10:00:00.000Z",
    title: "Charlie",
  });
  await completeLoan(accessToken, {
    direction: "borrowed",
    loanDate: "2026-04-10",
    personName: "Alice",
    returnedAt: "2026-04-12T10:00:00.000Z",
    title: "Delta",
  });
  await completeLoan(accessToken, {
    direction: "borrowed",
    loanDate: "2026-05-01",
    personName: "Evgen",
    returnedAt: "2026-05-31T10:00:00.000Z",
    title: "Echo",
  });
}

async function sortedHistoryTitles(accessToken: string, sort: LoanHistorySort): Promise<string[]> {
  const titles: string[] = [];
  for (const pageNumber of [1, 2, 3]) {
    const res = await listHistory(accessToken, `?sort=${sort}&pageSize=2&pageNumber=${pageNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(HISTORY_FIXTURE.sortableSize);
    titles.push(...historyTitles(res));
  }
  return titles;
}

async function startLoan(accessToken: string, spec: LoanSpec): Promise<CompletedLoanRef> {
  const created = await createBook(accessToken, {
    authors: [{ name: spec.authorName ?? HISTORY_FIXTURE.author }],
    ownershipStatus: spec.direction === "borrowed" ? "none" : "owned",
    title: spec.title,
  });
  expect(created.status).toBe(201);

  const bookId: string = created.body.id;
  const started = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      direction: spec.direction,
      expectedReturnDate: spec.expectedReturnDate,
      loanContactId:
        spec.contact === undefined
          ? undefined
          : await reachableContactId(accessToken, { contact: spec.contact, name: spec.personName }),
      loanDate: spec.loanDate ?? HISTORY_FIXTURE.fallbackLoanDate,
      note: spec.note,
      personName: spec.personName,
      remindToReturn: spec.remindToReturn,
    });
  expect(started.status).toBe(200);

  const loan = await prisma.bookLoan.findFirstOrThrow({ select: { id: true }, where: { bookId } });
  return { bookId, loanId: loan.id };
}

function utcToday(): string {
  return formatInTimeZone(new Date(), "UTC", "yyyy-MM-dd");
}

describe("loan history authorization", () => {
  it("returns 401 for the history list without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/history");

    expect(res.status).toBe(401);
  });

  it("returns 401 for the history overview without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/history/overview");

    expect(res.status).toBe(401);
  });

  it("returns 401 for the history people without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/history/people");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a history correction without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/loans/history/${HISTORY_FIXTURE.missingLoanId}`)
      .send({ note: "changed" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/loans/history scope", () => {
  it("returns an empty page when the user has no completed loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], page: 1, pagesCount: 0, totalCount: 0 });
  });

  it("returns a completed loan with its person and book preview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      authorName: "Ursula Le Guin",
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      personName: "Olha Melnyk",
      returnedAt: "2026-01-13T08:00:00.000Z",
      title: "The Left Hand of Darkness",
    });

    const res = await listHistory(accessToken);

    expect(res.status).toBe(200);
    const [item] = historyItems(res);
    expect(item).toMatchObject({
      book: { firstAuthorName: "Ursula Le Guin", title: "The Left Hand of Darkness" },
      personName: "Olha Melnyk",
      type: "borrowed_from_someone",
    });
    expect(item?.id).toMatch(UUID);
  });

  it("derives the returned day, result, delay and duration of a completed loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-13T08:00:00.000Z",
      title: "Dune",
    });

    const res = await listHistory(accessToken);

    expect(historyItems(res)[0]).toMatchObject({
      delayDays: 3,
      durationDays: 12,
      expectedReturnDate: "2026-01-10",
      historyResult: "late",
      loanDate: "2026-01-01",
      returnedAt: "2026-01-13T08:00:00.000Z",
      returnedDate: "2026-01-13",
    });
  });

  it("leaves an active loan of the same user out of the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await startLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      title: "Still borrowed",
    });

    const res = await listHistory(accessToken);

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });

  it("leaves another user's completed loan out of the history", async () => {
    const owner = await context.registerVerifyAndLogin();
    await completeLoan(owner.accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Owner book",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listHistory(stranger.accessToken);

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });

  it("leaves a completed loan whose book went to the trash out of the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Trashed book",
    });
    const deleted = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(200);

    const res = await listHistory(accessToken);

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe("GET /api/loans/history direction filter", () => {
  async function seedBothDirections(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Borrowed book",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-02-01",
      personName: "Ivan",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Lent book",
    });
  }

  it("returns only the borrowed loans for the borrowed direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedBothDirections(accessToken);

    const res = await listHistory(accessToken, "?type=borrowed_from_someone");

    expect(historyTitles(res)).toEqual(["Borrowed book"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("returns only the lent loans for the lent direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedBothDirections(accessToken);

    const res = await listHistory(accessToken, "?type=lent_to_someone");

    expect(historyTitles(res)).toEqual(["Lent book"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("returns both directions when no direction is asked for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedBothDirections(accessToken);

    const res = await listHistory(accessToken);

    expect(historyTitles(res)).toEqual(["Lent book", "Borrowed book"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("returns 400 for an unknown direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?type=given_away");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans/history contact filter", () => {
  function seedCyrillicPerson(accessToken: string): Promise<CompletedLoanRef> {
    return completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Олена",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Cyrillic person book",
    });
  }

  async function seedTwoPeople(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Olha first",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Olha second",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-01-01",
      personName: "Ivan",
      returnedAt: "2026-03-20T10:00:00.000Z",
      title: "Ivan only",
    });
  }

  it("returns only the completed loans of the selected contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedTwoPeople(accessToken);

    const res = await listHistory(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(historyTitles(res)).toEqual(["Olha second", "Olha first"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("reaches a Cyrillic contact through its id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCyrillicPerson(accessToken);

    const res = await listHistory(accessToken, `?contactId=${await contactIdFor("Олена")}`);

    expect(historyTitles(res)).toEqual(["Cyrillic person book"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("returns 400 for a person name in place of the contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCyrillicPerson(accessToken);

    const res = await listHistory(accessToken, `?contactId=${encodeURIComponent("Олена")}`);

    expect(res.status).toBe(400);
  });

  it("returns an empty page for another user's contact id", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedTwoPeople(owner.accessToken);
    const ownerContactId = await contactIdFor("Olha");
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listHistory(stranger.accessToken, `?contactId=${ownerContactId}`);

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe("GET /api/loans/history result filter", () => {
  async function seedEveryResult(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-02-10",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-02-10T23:59:59.000Z",
      title: "Returned on the due day",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-03-10",
      loanDate: "2026-03-01",
      personName: "Olha",
      returnedAt: "2026-03-05T12:00:00.000Z",
      title: "Returned early",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-04-10",
      loanDate: "2026-04-01",
      personName: "Olha",
      returnedAt: "2026-04-13T00:00:00.000Z",
      title: "Returned late",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-05-01",
      personName: "Olha",
      returnedAt: "2026-05-05T12:00:00.000Z",
      title: "Returned without a due date",
    });
  }

  it("returns only the loans that came back on time", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEveryResult(accessToken);

    const res = await listHistory(accessToken, "?result=on_time");

    expect(historyTitles(res)).toEqual(["Returned early", "Returned on the due day"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("returns only the late loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEveryResult(accessToken);

    const res = await listHistory(accessToken, "?result=late");

    expect(historyTitles(res)).toEqual(["Returned late"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("returns only the loans that had no due date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEveryResult(accessToken);

    const res = await listHistory(accessToken, "?result=no_due_date");

    expect(historyTitles(res)).toEqual(["Returned without a due date"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("counts every match of the result filter, not the rows of the page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEveryResult(accessToken);

    const res = await listHistory(accessToken, "?result=on_time&pageSize=1");

    expect(historyTitles(res)).toEqual(["Returned early"]);
    expect(res.body).toMatchObject({ pagesCount: 2, totalCount: 2 });
  });

  it("treats a return one second before UTC midnight of the due day as on time", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEveryResult(accessToken);

    const res = await listHistory(accessToken, "?result=on_time");

    expect(historyTitles(res)).toContain("Returned on the due day");
  });

  it("treats a return on the UTC day after the due day as one day late", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-02-10",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-02-11T00:00:01.000Z",
      title: "Returned just after midnight",
    });

    const res = await listHistory(accessToken, "?result=late");

    const items = historyItems(res);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ delayDays: 1, historyResult: "late" });
  });

  it("returns 400 for an unknown result", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?result=returned_somehow");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans/history result counts", () => {
  const EVERY_RESULT_COUNT = { all: 4, late: 1, no_due_date: 1, on_time: 2 };

  async function seedCountableHistory(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-02-10",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-02-08T10:00:00.000Z",
      title: "Borrowed on time",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-03-10",
      loanDate: "2026-03-01",
      personName: "Olha",
      returnedAt: "2026-03-14T10:00:00.000Z",
      title: "Borrowed late",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-04-01",
      personName: "Ivan",
      returnedAt: "2026-04-05T10:00:00.000Z",
      title: "Lent without a due date",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      expectedReturnDate: "2026-05-10",
      loanDate: "2026-05-01",
      personName: "Ivan",
      returnedAt: "2026-05-09T10:00:00.000Z",
      title: "Lent on time",
    });
  }

  it("reports the result counts of the whole history on the page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken);

    expect(res.status).toBe(200);
    expect(historyResultCounts(res)).toEqual(EVERY_RESULT_COUNT);
  });

  it("adds the three result counts up to the count before the result filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const counts = historyResultCounts(await listHistory(accessToken, "?result=late"));

    expect(counts.on_time + counts.late + counts.no_due_date).toBe(counts.all);
  });

  it("keeps the result counts steady while the result filter moves the total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    for (const [result, totalCount] of [
      ["all", 4],
      ["on_time", 2],
      ["late", 1],
      ["no_due_date", 1],
    ] as const) {
      const res = await listHistory(accessToken, `?result=${result}`);

      expect(historyResultCounts(res)).toEqual(EVERY_RESULT_COUNT);
      expect(res.body.totalCount).toBe(totalCount);
    }
  });

  it("reports zero result counts for an empty history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken);

    expect(historyResultCounts(res)).toEqual({ all: 0, late: 0, no_due_date: 0, on_time: 0 });
  });

  it("reports the result counts on a page past the end of the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?pageNumber=4&pageSize=2");

    expect(historyItems(res)).toEqual([]);
    expect(historyResultCounts(res)).toEqual(EVERY_RESULT_COUNT);
  });

  it("narrows the result counts by the search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=Borrowed");

    expect(historyResultCounts(res)).toEqual({ all: 2, late: 1, no_due_date: 0, on_time: 1 });
  });

  it("narrows the result counts by direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?type=lent_to_someone");

    expect(historyResultCounts(res)).toEqual({ all: 2, late: 0, no_due_date: 1, on_time: 1 });
  });

  it("narrows the result counts by contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(historyResultCounts(res)).toEqual({ all: 2, late: 1, no_due_date: 0, on_time: 1 });
  });

  it("narrows the result counts by the returned period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?returnedFrom=2026-03-01&returnedTo=2026-04-30");

    expect(historyResultCounts(res)).toEqual({ all: 2, late: 1, no_due_date: 1, on_time: 0 });
  });

  it("narrows the result counts by the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?loanDateFrom=2026-03-01&loanDateTo=2026-04-30");

    expect(historyResultCounts(res)).toEqual({ all: 2, late: 1, no_due_date: 1, on_time: 0 });
  });

  it("keeps the surrounding filters in the counts while the result filter empties the page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCountableHistory(accessToken);

    const res = await listHistory(accessToken, "?type=lent_to_someone&result=late");

    expect(historyItems(res)).toEqual([]);
    expect(res.body.totalCount).toBe(0);
    expect(historyResultCounts(res)).toEqual({ all: 2, late: 0, no_due_date: 1, on_time: 1 });
  });
});

describe("GET /api/loans/history period filter", () => {
  async function seedReturnedDays(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-03-01T09:00:00.000Z",
      title: "March 1",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-03-05T23:30:00.000Z",
      title: "March 5",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-03-09T00:00:00.000Z",
      title: "March 9",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-03-12T12:00:00.000Z",
      title: "March 12",
    });
  }

  it("includes the loans returned on the first day of the period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedReturnedDays(accessToken);

    const res = await listHistory(accessToken, "?returnedFrom=2026-03-09");

    expect(historyTitles(res)).toEqual(["March 12", "March 9"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("includes the loans returned late on the last day of the period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedReturnedDays(accessToken);

    const res = await listHistory(accessToken, "?returnedTo=2026-03-05");

    expect(historyTitles(res)).toEqual(["March 5", "March 1"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("keeps both ends of a period range inclusive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedReturnedDays(accessToken);

    const res = await listHistory(accessToken, "?returnedFrom=2026-03-05&returnedTo=2026-03-09");

    expect(historyTitles(res)).toEqual(["March 9", "March 5"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("returns 400 when the period starts after it ends", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?returnedFrom=2026-03-09&returnedTo=2026-03-05");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "returnedTo" })]),
    );
  });
});

describe("GET /api/loans/history loan date filter", () => {
  async function seedLoanDays(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Olha",
      returnedAt: "2026-03-01T09:00:00.000Z",
      title: "Taken February 1",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-03-05",
      personName: "Olha",
      returnedAt: "2026-04-01T09:00:00.000Z",
      title: "Taken March 5",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-04-10",
      personName: "Olha",
      returnedAt: "2026-05-01T09:00:00.000Z",
      title: "Taken April 10",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: null,
      personName: "Olha",
      returnedAt: "2026-06-01T09:00:00.000Z",
      title: "Taken on an unknown day",
    });
  }

  it("includes the loans taken on the first day of the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLoanDays(accessToken);

    const res = await listHistory(accessToken, "?loanDateFrom=2026-03-05");

    expect(historyTitles(res)).toEqual(["Taken April 10", "Taken March 5"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("includes the loans taken on the last day of the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLoanDays(accessToken);

    const res = await listHistory(accessToken, "?loanDateTo=2026-03-05");

    expect(historyTitles(res)).toEqual(["Taken March 5", "Taken February 1"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("keeps both ends of the loan date range inclusive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLoanDays(accessToken);

    const res = await listHistory(accessToken, "?loanDateFrom=2026-02-01&loanDateTo=2026-03-05");

    expect(historyTitles(res)).toEqual(["Taken March 5", "Taken February 1"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("drops a loan without a loan date out of a bounded loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLoanDays(accessToken);

    const res = await listHistory(accessToken, "?loanDateFrom=2026-01-01&loanDateTo=2026-12-31");

    expect(historyTitles(res)).toEqual(["Taken April 10", "Taken March 5", "Taken February 1"]);
    expect(res.body.totalCount).toBe(3);
  });

  it("keeps a loan without a loan date when no loan date range is asked for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLoanDays(accessToken);

    const res = await listHistory(accessToken);

    expect(historyTitles(res)).toContain("Taken on an unknown day");
    expect(res.body.totalCount).toBe(4);
  });

  it("returns 400 when the loan date range starts after it ends", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?loanDateFrom=2026-03-09&loanDateTo=2026-03-05");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanDateTo" })]),
    );
  });
});

describe("GET /api/loans/history search", () => {
  async function seedSearchableHistory(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      authorName: "Ursula Le Guin",
      contact: "olha@example.com",
      direction: "borrowed",
      loanDate: "2026-01-01",
      note: "hardcover copy",
      personName: "Olha Melnyk",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "The Left Hand of Darkness",
    });
    await completeLoan(accessToken, {
      authorName: "Dan Simmons",
      direction: "borrowed",
      loanDate: "2026-02-01",
      personName: "Ivan Petrenko",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Hyperion",
    });
  }

  it("matches a completed loan by book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=left hand");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("matches a completed loan by author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=simmons");

    expect(historyTitles(res)).toEqual(["Hyperion"]);
  });

  it("matches a completed loan by person name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=melnyk");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("matches the search term regardless of case", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=MELNYK");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("matches a completed loan by the new name of a renamed contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);
    await renameContact(accessToken, await contactIdFor("Olha Melnyk"), "Olha Sydorenko");

    const res = await listHistory(accessToken, "?search=sydorenko");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("still matches a completed loan by the person name it stored when it started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);
    await renameContact(accessToken, await contactIdFor("Olha Melnyk"), "Olha Sydorenko");

    const res = await listHistory(accessToken, "?search=melnyk");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("matches a completed loan by the current contact detail of the person", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);
    await request(app.getHttpServer())
      .patch(`/api/loans/contacts/${await contactIdFor("Ivan Petrenko")}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contact: "ivan@example.com" });

    const res = await listHistory(accessToken, "?search=ivan@example.com");

    expect(historyTitles(res)).toEqual(["Hyperion"]);
  });

  it("still matches a completed loan by the contact detail it stored when it started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSearchableHistory(accessToken);

    const res = await listHistory(accessToken, "?search=olha@example.com");

    expect(historyTitles(res)).toEqual(["The Left Hand of Darkness"]);
  });

  it("never reaches another user's completed loans", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedSearchableHistory(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await completeLoan(stranger.accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Petro",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Stranger book",
    });

    const res = await listHistory(stranger.accessToken, "?search=melnyk");

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });

  it("treats a percent sign in the search term as a literal character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      note: "returned 50% of the pages",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Percent note",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      note: "read 50 pages",
      personName: "Ivan",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Plain number note",
    });

    const res = await listHistory(accessToken, `?search=${encodeURIComponent("50%")}`);

    expect(historyTitles(res)).toEqual(["Percent note"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("treats an underscore in the search term as a literal character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      note: "read_me first",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Marked copy",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      note: "read me later",
      personName: "Ivan",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Plain copy",
    });

    const res = await listHistory(accessToken, `?search=${encodeURIComponent("read_me")}`);

    expect(historyTitles(res)).toEqual(["Marked copy"]);
    expect(res.body.totalCount).toBe(1);
  });
});

describe("GET /api/loans/history sorting", () => {
  it("puts the newest return first by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "returned_desc");

    expect(titles).toEqual(["Echo", "Delta", "Charlie", "Bravo", "Alpha"]);
  });

  it("puts the oldest return first for the ascending returned sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "returned_asc");

    expect(titles).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
  });

  it("puts the loans without a loan date last for the loan date sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "loan_date_desc");

    expect(titles).toEqual(["Echo", "Delta", "Bravo", "Alpha", "Charlie"]);
  });

  it("puts the longest loan first and the incalculable duration last", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "duration_desc");

    expect(titles).toEqual(["Echo", "Bravo", "Alpha", "Delta", "Charlie"]);
  });

  it("orders by book title for the title sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "title_asc");

    expect(titles).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
  });

  it("orders by person name for the person sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const titles = await sortedHistoryTitles(accessToken, "person_asc");

    expect(titles).toEqual(["Delta", "Charlie", "Bravo", "Alpha", "Echo"]);
  });

  it("breaks a tie on the returned date with the lower loan id first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-06-01T10:00:00.000Z",
      title: "Tie one",
    });
    const second = await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-06-01T10:00:00.000Z",
      title: "Tie two",
    });

    const res = await listHistory(accessToken);

    expect(historyItems(res).map((item) => item.id)).toEqual(
      [first.loanId, second.loanId].sort((left, right) => (left < right ? -1 : 1)),
    );
  });

  it("breaks a tie on the person with the newest return first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-06-01T10:00:00.000Z",
      title: "Older return",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-07-01T10:00:00.000Z",
      title: "Newer return",
    });

    const res = await listHistory(accessToken, "?sort=person_asc");

    expect(historyTitles(res)).toEqual(["Newer return", "Older return"]);
  });

  it("returns 400 for an unknown sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?sort=returned_someday");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans/history pagination", () => {
  it("returns the second page of the history with the paging meta of the whole match", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const res = await listHistory(accessToken, "?pageSize=2&pageNumber=2");

    expect(historyTitles(res)).toEqual(["Charlie", "Bravo"]);
    expect(res.body).toMatchObject({
      page: 2,
      pagesCount: 3,
      pageSize: 2,
      totalCount: HISTORY_FIXTURE.sortableSize,
    });
  });

  it("returns the trailing page of the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const res = await listHistory(accessToken, "?pageSize=2&pageNumber=3");

    expect(historyTitles(res)).toEqual(["Alpha"]);
    expect(res.body.totalCount).toBe(HISTORY_FIXTURE.sortableSize);
  });

  it("returns an empty page past the end of the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSortableHistory(accessToken);

    const res = await listHistory(accessToken, "?pageSize=2&pageNumber=9");

    expect(historyTitles(res)).toEqual([]);
    expect(res.body.totalCount).toBe(HISTORY_FIXTURE.sortableSize);
  });

  it("returns 400 when the page size exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listHistory(accessToken, "?pageSize=101");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans/history/overview summary", () => {
  it("summarises the completed loans of the current user", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);

    expect(res.status).toBe(200);
    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toEqual({
      averageDelayDays: 7,
      averageDurationDays: 8,
      borrowedCount: 2,
      durationCount: 3,
      lateCount: 2,
      lentCount: 2,
      noDueDateCount: 1,
      onTimeCount: 1,
      onTimePercent: 33,
      totalCompleted: 4,
    });
  });

  it("reports the duration analytics of the completed loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).duration).toEqual({
      averageDays: 8,
      longestDays: 12,
      shortestDays: 4,
    });
  });

  it("reports the reliability breakdown of the completed loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).reliability).toEqual({
      lateCount: 2,
      noDueDateCount: 1,
      onTimeCount: 1,
      onTimePercent: 33,
    });
  });

  it("returns null percents and null averages for an empty history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await historyOverview(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY_OVERVIEW);
  });

  it("leaves the caller's active loans out of the overview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await startLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      title: "Still borrowed",
    });

    const res = await historyOverview(accessToken);

    expect(res.body).toEqual(EMPTY_OVERVIEW);
  });

  it("leaves another user's completed loans out of the overview", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedOverviewHistory(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await historyOverview(stranger.accessToken);

    expect(res.body).toEqual(EMPTY_OVERVIEW);
  });

  it("counts the on-time share against the loans that carried a due date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);
    const { summary } = LoanHistoryOverviewViewSchema.parse(res.body);

    expect(summary.onTimePercent).toBe(
      Math.round((summary.onTimeCount / (summary.onTimeCount + summary.lateCount)) * 100),
    );
    expect(summary.noDueDateCount).toBeGreaterThan(0);
  });

  it("leaves the on-time percent null when no completed loan carried a due date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Open ended borrowed",
    });

    const res = await historyOverview(accessToken);
    const { reliability, summary } = LoanHistoryOverviewViewSchema.parse(res.body);

    expect(summary).toMatchObject({
      lateCount: 0,
      noDueDateCount: 1,
      onTimeCount: 0,
      onTimePercent: null,
      totalCompleted: 1,
    });
    expect(reliability.onTimePercent).toBeNull();
  });

  it("keeps a real zero on-time percent apart from a missing one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-14T10:00:00.000Z",
      title: "Late borrowed",
    });

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary.onTimePercent).toBe(0);
  });

  it("counts the average duration only over the loans that have a loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);
    const { summary } = LoanHistoryOverviewViewSchema.parse(res.body);

    expect(summary.durationCount).toBe(3);
    expect(summary.totalCompleted).toBe(4);
  });

  it("reports a real zero average when every loan came back the same day", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-01T18:00:00.000Z",
      title: "Same day borrowed",
    });

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toMatchObject({
      averageDurationDays: 0,
      durationCount: 1,
    });
  });

  it("returns null duration analytics when no completed loan has a loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-04-10",
      loanDate: null,
      personName: "Olha",
      returnedAt: "2026-04-20T00:00:00.000Z",
      title: "No loan date",
    });

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).duration).toEqual({
      averageDays: null,
      longestDays: null,
      shortestDays: null,
    });
  });
});

describe("GET /api/loans/history/overview scope", () => {
  it("ignores the result filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const base = await historyOverview(accessToken);
    const filtered = await historyOverview(accessToken, "?result=late");

    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(base.body);
  });

  it("ignores the search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const base = await historyOverview(accessToken);
    const searched = await historyOverview(accessToken, "?search=late");

    expect(searched.status).toBe(200);
    expect(searched.body).toEqual(base.body);
  });

  it("ignores the sort and the pagination params", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const base = await historyOverview(accessToken);
    const paged = await historyOverview(accessToken, "?sort=title_asc&pageNumber=2&pageSize=1");

    expect(paged.status).toBe(200);
    expect(paged.body).toEqual(base.body);
  });

  it("narrows the overview by direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken, "?type=lent_to_someone");

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toEqual({
      averageDelayDays: 10,
      averageDurationDays: 4,
      borrowedCount: 0,
      durationCount: 1,
      lateCount: 1,
      lentCount: 2,
      noDueDateCount: 1,
      onTimeCount: 0,
      onTimePercent: 0,
      totalCompleted: 2,
    });
  });

  it("narrows the overview by contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toMatchObject({
      borrowedCount: 2,
      lateCount: 1,
      lentCount: 0,
      onTimeCount: 1,
      totalCompleted: 2,
    });
  });

  it("narrows the overview by the returned period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(
      accessToken,
      "?returnedFrom=2026-02-01&returnedTo=2026-03-31",
    );

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toMatchObject({
      borrowedCount: 1,
      lateCount: 1,
      lentCount: 1,
      noDueDateCount: 1,
      onTimeCount: 0,
      totalCompleted: 2,
    });
  });

  it("narrows the overview by the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken, "?loanDateFrom=2026-02-01");

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toMatchObject({
      borrowedCount: 1,
      lateCount: 1,
      lentCount: 1,
      noDueDateCount: 1,
      onTimeCount: 0,
      totalCompleted: 2,
    });
  });

  it("returns 400 when the overview period starts after it ends", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await historyOverview(
      accessToken,
      "?returnedFrom=2026-03-09&returnedTo=2026-03-05",
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when the overview loan date range starts after it ends", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await historyOverview(
      accessToken,
      "?loanDateFrom=2026-03-09&loanDateTo=2026-03-05",
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans/history/overview top people", () => {
  async function seedOnePersonPerLoan(accessToken: string): Promise<void> {
    for (const personName of ["Cecilia", "Alice", "Fedir", "Bohdan", "Evgen", "Dmytro"]) {
      await completeLoan(accessToken, {
        direction: "borrowed",
        loanDate: "2026-01-01",
        personName,
        returnedAt: "2026-01-20T10:00:00.000Z",
        title: `Book of ${personName}`,
      });
    }
  }

  it("ranks the people of the completed loans with their direction breakdown", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOverviewHistory(accessToken);

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).topPeople).toEqual([
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Ivan"),
        lentCount: 2,
        personName: "Ivan",
        totalCount: 2,
      },
      {
        borrowedCount: 2,
        contactId: await contactIdFor("Olha"),
        lentCount: 0,
        personName: "Olha",
        totalCount: 2,
      },
    ]);
  });

  it("keeps at most five people in the top people block", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOnePersonPerLoan(accessToken);

    const res = await historyOverview(accessToken);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).topPeople).toHaveLength(5);
  });

  it("orders the top people by name when their totals tie", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedOnePersonPerLoan(accessToken);

    const res = await historyOverview(accessToken);

    expect(
      LoanHistoryOverviewViewSchema.parse(res.body).topPeople.map((person) => person.personName),
    ).toEqual(["Alice", "Bohdan", "Cecilia", "Dmytro", "Evgen"]);
  });

  it("ranks a person with more completed loans first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Zoryana",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Zoryana one",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Zoryana",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Zoryana two",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Andrii",
      returnedAt: "2026-03-20T10:00:00.000Z",
      title: "Andrii one",
    });

    const res = await historyOverview(accessToken);

    expect(
      LoanHistoryOverviewViewSchema.parse(res.body).topPeople.map((person) => person.personName),
    ).toEqual(["Zoryana", "Andrii"]);
  });
});

describe("GET /api/loans/history/overview top people facet", () => {
  function overviewTopPeople(res: Response): LoanHistoryPersonStats[] {
    return LoanHistoryOverviewViewSchema.parse(res.body).topPeople;
  }

  async function seedThreePeopleHistory(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-01-05",
      personName: "Ivan",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Ivan lent one",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-02-05",
      personName: "Ivan",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Ivan lent two",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-03-05",
      personName: "Ivan",
      returnedAt: "2026-03-20T10:00:00.000Z",
      title: "Ivan borrowed one",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-01-20",
      loanDate: "2026-01-10",
      personName: "Olha",
      returnedAt: "2026-01-25T10:00:00.000Z",
      title: "Olha borrowed late",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-02-20",
      loanDate: "2026-02-10",
      personName: "Olha",
      returnedAt: "2026-02-15T10:00:00.000Z",
      title: "Olha borrowed on time",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-03-10",
      personName: "Petro",
      returnedAt: "2026-03-15T10:00:00.000Z",
      title: "Petro lent one",
    });
  }

  it("ranks every person of the unfiltered history by their completed loan count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken);

    expect(overviewTopPeople(res)).toEqual([
      {
        borrowedCount: 1,
        contactId: await contactIdFor("Ivan"),
        lentCount: 2,
        personName: "Ivan",
        totalCount: 3,
      },
      {
        borrowedCount: 2,
        contactId: await contactIdFor("Olha"),
        lentCount: 0,
        personName: "Olha",
        totalCount: 2,
      },
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Petro"),
        lentCount: 1,
        personName: "Petro",
        totalCount: 1,
      },
    ]);
  });

  it("adds every top person's lent and borrowed counts up to their total", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const topPeople = overviewTopPeople(await historyOverview(accessToken));

    expect(topPeople.map((person) => person.lentCount + person.borrowedCount)).toEqual([3, 2, 1]);
    expect(topPeople.map((person) => person.totalCount)).toEqual([3, 2, 1]);
  });

  it("keeps the other people in the top people block when a contact filters the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(res.status).toBe(200);
    expect(overviewTopPeople(res).map((person) => person.personName)).toEqual([
      "Ivan",
      "Olha",
      "Petro",
    ]);
  });

  it("narrows the summary to the filtered contact while the top people stay comparative", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toEqual({
      averageDelayDays: 5,
      averageDurationDays: 10,
      borrowedCount: 2,
      durationCount: 2,
      lateCount: 1,
      lentCount: 0,
      noDueDateCount: 0,
      onTimeCount: 1,
      onTimePercent: 50,
      totalCompleted: 2,
    });
    expect(overviewTopPeople(res)).toHaveLength(3);
  });

  it("narrows the duration figures to the filtered contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(LoanHistoryOverviewViewSchema.parse(res.body).duration).toEqual({
      averageDays: 10,
      longestDays: 15,
      shortestDays: 5,
    });
  });

  it("counts only the lent loans in the top people block for the lent direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, "?type=lent_to_someone");

    expect(overviewTopPeople(res)).toEqual([
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Ivan"),
        lentCount: 2,
        personName: "Ivan",
        totalCount: 2,
      },
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Petro"),
        lentCount: 1,
        personName: "Petro",
        totalCount: 1,
      },
    ]);
  });

  it("counts only the borrowed loans in the top people block for the borrowed direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, "?type=borrowed_from_someone");

    expect(overviewTopPeople(res)).toEqual([
      {
        borrowedCount: 2,
        contactId: await contactIdFor("Olha"),
        lentCount: 0,
        personName: "Olha",
        totalCount: 2,
      },
      {
        borrowedCount: 1,
        contactId: await contactIdFor("Ivan"),
        lentCount: 0,
        personName: "Ivan",
        totalCount: 1,
      },
    ]);
  });

  it("keeps the direction filter on the top people while the contact filter stays off them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(
      accessToken,
      `?type=lent_to_someone&contactId=${await contactIdFor("Olha")}`,
    );

    expect(overviewTopPeople(res).map((person) => person.personName)).toEqual(["Ivan", "Petro"]);
    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary.totalCompleted).toBe(0);
  });

  it("narrows the top people by the returned period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(
      accessToken,
      "?returnedFrom=2026-02-01&returnedTo=2026-02-28",
    );

    expect(overviewTopPeople(res)).toEqual([
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Ivan"),
        lentCount: 1,
        personName: "Ivan",
        totalCount: 1,
      },
      {
        borrowedCount: 1,
        contactId: await contactIdFor("Olha"),
        lentCount: 0,
        personName: "Olha",
        totalCount: 1,
      },
    ]);
  });

  it("narrows the top people by the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePeopleHistory(accessToken);

    const res = await historyOverview(accessToken, "?loanDateFrom=2026-03-01");

    expect(overviewTopPeople(res)).toEqual([
      {
        borrowedCount: 1,
        contactId: await contactIdFor("Ivan"),
        lentCount: 0,
        personName: "Ivan",
        totalCount: 1,
      },
      {
        borrowedCount: 0,
        contactId: await contactIdFor("Petro"),
        lentCount: 1,
        personName: "Petro",
        totalCount: 1,
      },
    ]);
  });
});

describe("GET /api/loans/history/:loanId", () => {
  it("returns the completed loan with its contact, note and timestamps", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await completeLoan(accessToken, {
      contact: "olha@example.com",
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      note: "hardcover copy",
      personName: "Olha",
      returnedAt: "2026-01-13T08:00:00.000Z",
      title: "Dune",
    });

    const res = await historyDetail(accessToken, loanId);

    expect(res.status).toBe(200);
    expect(LoanHistoryDetailViewSchema.parse(res.body)).toMatchObject({
      contact: "olha@example.com",
      delayDays: 3,
      durationDays: 12,
      historyResult: "late",
      id: loanId,
      note: "hardcover copy",
      returnedDate: "2026-01-13",
    });
  });

  it("keeps the contact detail the loan stored when the person changes theirs", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await completeLoan(accessToken, {
      contact: "olha@example.com",
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-13T08:00:00.000Z",
      title: "Dune",
    });
    await request(app.getHttpServer())
      .patch(`/api/loans/contacts/${await contactIdFor("Olha")}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contact: "+380001112233" });

    const res = await historyDetail(accessToken, loanId);

    expect(res.body.contact).toBe("olha@example.com");
  });

  it("falls back to the current detail of the person when the loan stored none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-13T08:00:00.000Z",
      title: "Dune",
    });
    await request(app.getHttpServer())
      .patch(`/api/loans/contacts/${await contactIdFor("Olha")}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contact: "+380001112233" });

    const res = await historyDetail(accessToken, loanId);

    expect(res.body.contact).toBe("+380001112233");
  });

  it("keeps the reminder fields out of the history detail", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await completeLoan(accessToken, {
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      personName: "Olha",
      remindToReturn: true,
      returnedAt: "2026-01-09T08:00:00.000Z",
      title: "Dune",
    });

    const res = await historyDetail(accessToken, loanId);

    expect(res.body).not.toHaveProperty("remindToReturn");
    expect(res.body).not.toHaveProperty("remindBeforeDays");
  });

  it("returns 404 for the caller's own active loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await startLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      title: "Still borrowed",
    });

    const res = await historyDetail(accessToken, loanId);

    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's completed loan", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { loanId } = await completeLoan(owner.accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Owner book",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await historyDetail(stranger.accessToken, loanId);

    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown loan id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await historyDetail(accessToken, HISTORY_FIXTURE.missingLoanId);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a completed loan whose book went to the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, loanId } = await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Trashed book",
    });
    const deleted = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(200);

    const res = await historyDetail(accessToken, loanId);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/loans/history/people", () => {
  it("lists the people of the completed loans with their loan counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Olha one",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Olha two",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-01-01",
      personName: "Ivan",
      returnedAt: "2026-03-20T10:00:00.000Z",
      title: "Ivan one",
    });

    const res = await historyPeople(accessToken);

    expect(res.status).toBe(200);
    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 2 },
    ]);
  });

  it("leaves the people of active loans out", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await startLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      title: "Still borrowed",
    });

    const res = await historyPeople(accessToken);

    expect(peopleOptions(res)).toEqual([]);
  });

  it("leaves another user's people out", async () => {
    const owner = await context.registerVerifyAndLogin();
    await completeLoan(owner.accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Owner book",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await historyPeople(stranger.accessToken);

    expect(peopleOptions(res)).toEqual([]);
  });

  it("groups the completed loans of one contact under a single person", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Ігор",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Before the rename",
    });
    await renameContact(accessToken, await contactIdFor("Ігор"), "ігор");
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "ігор",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "After the rename",
    });

    const res = await historyPeople(accessToken);

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("ігор"), personName: "ігор", totalCount: 2 },
    ]);
  });

  it("filters the people by a search fragment regardless of case", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha Melnyk",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Olha one",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Ivan Petrenko",
      returnedAt: "2026-02-20T10:00:00.000Z",
      title: "Ivan one",
    });

    const res = await historyPeople(accessToken, "?search=MELNYK");

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Olha Melnyk"), personName: "Olha Melnyk", totalCount: 1 },
    ]);
  });

  it("keeps an archived contact with completed loans in the people list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Archived person book",
    });
    await archiveContact(accessToken, await contactIdFor("Olha"));

    const res = await historyPeople(accessToken);

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 1 },
    ]);
  });
});

describe("GET /api/loans/history/people scope", () => {
  async function seedScopedPeople(accessToken: string): Promise<void> {
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-05",
      personName: "Olha",
      returnedAt: "2026-02-10T10:00:00.000Z",
      title: "Olha borrowed in January",
    });
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-04-05",
      personName: "Olha",
      returnedAt: "2026-05-10T10:00:00.000Z",
      title: "Olha borrowed in April",
    });
    await completeLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-04-20",
      personName: "Ivan",
      returnedAt: "2026-05-25T10:00:00.000Z",
      title: "Ivan lent in April",
    });
  }

  it("narrows the people by direction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const res = await historyPeople(accessToken, "?type=lent_to_someone");

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
    ]);
  });

  it("narrows the people by the returned period", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const res = await historyPeople(accessToken, "?returnedFrom=2026-05-20");

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
    ]);
  });

  it("counts each person inside the loan date range instead of their whole history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const lifetime = await historyPeople(accessToken);
    const scoped = await historyPeople(accessToken, "?loanDateFrom=2026-04-01");

    expect(peopleOptions(lifetime)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 2 },
    ]);
    expect(peopleOptions(scoped)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 1 },
    ]);
  });

  it("drops a person whose only loans fall outside the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const res = await historyPeople(accessToken, "?loanDateTo=2026-01-31");

    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 1 },
    ]);
  });

  it("ignores the contact id so the person axis stays whole", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const res = await historyPeople(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(res.status).toBe(200);
    expect(peopleOptions(res)).toEqual([
      { contactId: await contactIdFor("Ivan"), personName: "Ivan", totalCount: 1 },
      { contactId: await contactIdFor("Olha"), personName: "Olha", totalCount: 2 },
    ]);
  });

  it("ignores the result filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedScopedPeople(accessToken);

    const base = await historyPeople(accessToken);
    const filtered = await historyPeople(accessToken, "?result=late");

    expect(filtered.status).toBe(200);
    expect(peopleOptions(filtered)).toEqual(peopleOptions(base));
  });

  it("returns 400 when the people loan date range starts after it ends", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await historyPeople(accessToken, "?loanDateFrom=2026-03-09&loanDateTo=2026-03-05");

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/loans/history/:loanId", () => {
  async function correctableLoan(accessToken: string): Promise<CompletedLoanRef> {
    const loan = await completeLoan(accessToken, {
      contact: "olha@example.com",
      direction: "borrowed",
      expectedReturnDate: "2026-01-10",
      loanDate: "2026-01-01",
      note: "hardcover copy",
      personName: "Olha",
      returnedAt: "2026-01-08T08:00:00.000Z",
      title: "Dune",
    });
    await prisma.bookLoan.update({
      data: { remindBeforeDays: 3, remindToReturn: true },
      where: { id: loan.loanId },
    });
    return loan;
  }

  it("re-derives the result, the delay and the duration from the corrected date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, { returnedDate: "2026-01-14" });

    expect(res.status).toBe(200);
    expect(LoanHistoryDetailViewSchema.parse(res.body)).toMatchObject({
      delayDays: 4,
      durationDays: 13,
      historyResult: "late",
      returnedDate: "2026-01-14",
    });
  });

  it("updates the note of a completed loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, { note: "paperback after all" });

    expect(res.status).toBe(200);
    expect(res.body.note).toBe("paperback after all");
  });

  it("keeps the loan returned after a correction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    await correctHistory(accessToken, loanId, { returnedDate: "2026-01-14" });

    const row = await loanColumns(loanId);
    expect(row.status).toBe("returned");
    expect(row.returnedAt).not.toBeNull();
  });

  it("leaves the person, the dates and the reminder columns untouched by a correction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);
    const before = await loanColumns(loanId);

    await correctHistory(accessToken, loanId, { note: "paperback after all" });

    expect(await loanColumns(loanId)).toEqual(before);
  });

  it("rejects a payload that carries more than the returned date and the note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, {
      expectedReturnDate: "2026-02-01",
      loanDate: "2025-12-01",
      personName: "Someone else",
      remindBeforeDays: 3,
      remindToReturn: true,
      returnedDate: "2026-01-09",
      status: "active",
      type: "lent_to_someone",
    });

    expect(res.status).toBe(400);
  });

  it("leaves every column untouched when the payload carries forbidden fields", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);
    const before = await loanColumns(loanId);

    await correctHistory(accessToken, loanId, {
      personName: "Someone else",
      returnedDate: "2026-01-09",
      status: "active",
      type: "lent_to_someone",
    });

    expect(await loanColumns(loanId)).toEqual(before);
  });

  it("rejects a returned date earlier than the loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, { returnedDate: "2025-12-25" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "returnedDate" })]),
    );
  });

  it("keeps the stored returned date when the correction is rejected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    await correctHistory(accessToken, loanId, { returnedDate: "2025-12-25" });

    const row = await loanColumns(loanId);
    expect(row.returnedAt?.toISOString()).toBe("2026-01-08T08:00:00.000Z");
  });

  it("rejects a returned date in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, {
      returnedDate: formatInTimeZone(addDays(new Date(), 3), "UTC", "yyyy-MM-dd"),
    });

    expect(res.status).toBe(400);
  });

  it("rejects an empty correction", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    const res = await correctHistory(accessToken, loanId, {});

    expect(res.status).toBe(400);
  });

  it("returns 404 when correcting the caller's own active loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await startLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      title: "Still borrowed",
    });

    const res = await correctHistory(accessToken, loanId, { note: "changed" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when correcting another user's completed loan", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await correctHistory(stranger.accessToken, loanId, { note: "changed" });

    expect(res.status).toBe(404);
  });

  it("leaves another user's loan untouched when they try to correct it", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(owner.accessToken);
    const before = await loanColumns(loanId);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    await correctHistory(stranger.accessToken, loanId, { note: "changed" });

    expect(await loanColumns(loanId)).toEqual(before);
  });

  it("returns 404 when correcting a completed loan whose book went to the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, loanId } = await correctableLoan(accessToken);
    const deleted = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(200);

    const res = await correctHistory(accessToken, loanId, { returnedDate: "2026-01-14" });

    expect(res.status).toBe(404);
  });

  it("leaves the loan of a trashed book untouched when correcting it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, loanId } = await correctableLoan(accessToken);
    const deleted = await request(app.getHttpServer())
      .delete(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(200);
    const before = await loanColumns(loanId);

    await correctHistory(accessToken, loanId, { returnedDate: "2026-01-14" });

    expect(await loanColumns(loanId)).toEqual(before);
  });

  it("carries the corrected date into the history overview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { loanId } = await correctableLoan(accessToken);

    await correctHistory(accessToken, loanId, { returnedDate: "2026-01-14" });

    const res = await historyOverview(accessToken);
    expect(LoanHistoryOverviewViewSchema.parse(res.body).summary).toMatchObject({
      averageDelayDays: 4,
      lateCount: 1,
      onTimeCount: 0,
    });
  });
});

describe("POST /api/books/:id/loan/return lands in the history", () => {
  it("drops the returned book from the active loans list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await startLoan(accessToken, {
      direction: "lent",
      expectedReturnDate: "2026-06-10",
      loanDate: "2026-06-01",
      personName: "Ivan",
      title: "Hyperion",
    });
    const before = await listActiveLoans(accessToken);
    expect(before.body.totalCount).toBe(1);

    const returned = await returnLoan(accessToken, bookId);

    expect(returned.status).toBe(200);
    const after = await listActiveLoans(accessToken);
    expect(after.body).toMatchObject({ items: [], totalCount: 0 });
  });

  it("adds the returned loan to the history with the returned day of the return", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await startLoan(accessToken, {
      direction: "lent",
      expectedReturnDate: "2026-06-10",
      loanDate: "2026-06-01",
      personName: "Ivan",
      title: "Hyperion",
    });

    const dayBeforeReturn = utcToday();
    await returnLoan(accessToken, bookId);
    const dayAfterReturn = utcToday();

    const res = await listHistory(accessToken);
    const [item] = historyItems(res);
    expect(historyTitles(res)).toEqual(["Hyperion"]);
    expect([dayBeforeReturn, dayAfterReturn]).toContain(item?.returnedDate);
  });

  it("keeps the direction of the loan it completes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId } = await startLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-06-01",
      personName: "Ivan",
      title: "Hyperion",
    });

    await returnLoan(accessToken, bookId);

    const res = await listHistory(accessToken);
    expect(historyItems(res)[0]).toMatchObject({
      personName: "Ivan",
      type: "lent_to_someone",
    });
  });

  it("raises the completed total of the history overview by one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await completeLoan(accessToken, {
      direction: "borrowed",
      loanDate: "2026-01-01",
      personName: "Olha",
      returnedAt: "2026-01-20T10:00:00.000Z",
      title: "Already returned",
    });
    const { bookId } = await startLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-06-01",
      personName: "Ivan",
      title: "Hyperion",
    });
    const before = await historyOverview(accessToken);
    expect(before.body.summary.totalCompleted).toBe(1);

    await returnLoan(accessToken, bookId);

    const after = await historyOverview(accessToken);
    expect(after.body.summary.totalCompleted).toBe(2);
  });

  it("clears the return reminder of the loan it completes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, loanId } = await startLoan(accessToken, {
      direction: "lent",
      expectedReturnDate: "2026-06-10",
      loanDate: "2026-06-01",
      personName: "Ivan",
      remindToReturn: true,
      title: "Hyperion",
    });
    expect((await loanColumns(loanId)).remindToReturn).toBe(true);

    await returnLoan(accessToken, bookId);

    expect(await loanColumns(loanId)).toMatchObject({
      remindBeforeDays: null,
      remindToReturn: false,
    });
  });

  it("stores a returned timestamp on the loan it completes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, loanId } = await startLoan(accessToken, {
      direction: "lent",
      loanDate: "2026-06-01",
      personName: "Ivan",
      title: "Hyperion",
    });

    await returnLoan(accessToken, bookId);

    const row = await loanColumns(loanId);
    expect(row.status).toBe("returned");
    expect(row.returnedAt).not.toBeNull();
  });
});

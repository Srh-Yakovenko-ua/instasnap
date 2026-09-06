import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import request from "supertest";
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
const MISSING_CONTACT_ID = "00000000-0000-4000-8000-000000000000";
const EMPTY_DIRECTION_SUMMARY = {
  earliestLoanDate: null,
  longHeldCount: 0,
  longHeldLoans: [],
  nearestReturnDate: null,
  noReminderWithDateCount: 0,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  topPeople: [],
  totalCount: 0,
  upcomingReturns: [],
};
const isoDay = (offsetDays: number): string =>
  formatInTimeZone(addDays(new Date(), offsetDays), "UTC", "yyyy-MM-dd");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, LoansModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

async function addAlternateAuthorName(
  bookId: string,
  alternate: { locale: string; name: string; normalizedName: string },
): Promise<void> {
  const link = await prisma.bookAuthor.findFirstOrThrow({
    select: { authorId: true },
    where: { bookId },
  });
  await prisma.authorName.create({
    data: {
      authorId: link.authorId,
      isPrimary: false,
      locale: alternate.locale,
      name: alternate.name,
      normalizedName: alternate.normalizedName,
    },
  });
}

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

async function borrowCustomBook(
  accessToken: string,
  book: Record<string, unknown>,
  personName: string,
): Promise<void> {
  const created = await createBook(accessToken, book);
  await startLoan(accessToken, created.body.id, {
    direction: "borrowed",
    loanDate: isoDay(0),
    personName,
  });
}

async function changeContactDetail(
  accessToken: string,
  contactId: string,
  contact: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .patch(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ contact });
  expect(res.status).toBe(200);
}

async function contactIdFor(name: string): Promise<string> {
  const contact = await prisma.loanContact.findFirstOrThrow({
    select: { id: true },
    where: { name },
  });
  return contact.id;
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createBorrowedLoan(
  accessToken: string,
  loan: Record<string, unknown>,
  title = "Dune",
): Promise<string> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "none",
    title,
  });
  const started = await startLoan(accessToken, created.body.id, {
    direction: "borrowed",
    loanDate: isoDay(0),
    personName: "Olha",
    ...loan,
  });
  expect(started.status).toBe(200);
  return created.body.id;
}

async function createLentLoan(
  accessToken: string,
  loan: Record<string, unknown>,
  title = "Hyperion",
): Promise<string> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Dan Simmons" }],
    ownershipStatus: "owned",
    title,
  });
  const started = await startLoan(accessToken, created.body.id, {
    direction: "lent",
    loanDate: isoDay(0),
    personName: "Ivan",
    ...loan,
  });
  expect(started.status).toBe(200);
  return created.body.id;
}

function listLoans(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function loanSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/loans/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function loanTitles(loans: { book: { title: string } }[]): string[] {
  return loans.map((loan) => loan.book.title);
}

async function renameContact(accessToken: string, contactId: string, name: string): Promise<void> {
  const res = await request(app.getHttpServer())
    .patch(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name });
  expect(res.status).toBe(200);
}

function startLoan(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("GET /api/loans authorization", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans");

    expect(res.status).toBe(401);
  });

  it("returns 401 for the summary without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/summary");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/loans", () => {
  it("returns an empty page when the user has no loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("lists active loans with a book preview and computed ui status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(3), personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.type).toBe("borrowed_from_someone");
    expect(item.personName).toBe("Olha");
    expect(item.loanUiStatus).toBe("return_soon");
    expect(item.book).toMatchObject({
      firstAuthorName: "Frank Herbert",
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });
  });

  it("does not list a loan that has been returned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, { personName: "Olha" });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("does not expose another user's loans", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createBorrowedLoan(owner.accessToken, { personName: "Olha" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listLoans(stranger.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("filters by loan type through the type tab", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });
    await createLentLoan(accessToken, { personName: "Ivan" });

    const borrowed = await listLoans(accessToken, "?type=borrowed_from_someone");
    const lent = await listLoans(accessToken, "?type=lent_to_someone");

    expect(borrowed.body.items).toHaveLength(1);
    expect(borrowed.body.items[0].type).toBe("borrowed_from_someone");
    expect(lent.body.items).toHaveLength(1);
    expect(lent.body.items[0].type).toBe("lent_to_someone");
  });

  it("filters overdue loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-5), loanDate: isoDay(-20), personName: "Olha" },
      "Overdue Book",
    );
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Ivan" });

    const res = await listLoans(accessToken, "?filter=overdue");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].loanUiStatus).toBe("overdue");
    expect(res.body.items[0].book.title).toBe("Overdue Book");
  });

  it("filters loans without a return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "No Date Book");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Ivan" });

    const res = await listLoans(accessToken, "?filter=no_return_date");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].loanUiStatus).toBe("no_return_date");
    expect(res.body.items[0].book.title).toBe("No Date Book");
  });

  it("filters loans with a reminder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(3),
      personName: "Olha",
      remindToReturn: true,
    });
    await createLentLoan(accessToken, { personName: "Ivan" });

    const res = await listLoans(accessToken, "?reminder=on");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].remindToReturn).toBe(true);
  });

  it("searches by person name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha Melnyk" });
    await createLentLoan(accessToken, { personName: "Ivan Petrenko" });

    const res = await listLoans(accessToken, "?search=melnyk");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha Melnyk");
  });

  it("searches by book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "The Left Hand of Darkness");
    await createLentLoan(accessToken, { personName: "Ivan" }, "Hyperion");

    const res = await listLoans(accessToken, "?search=left hand");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("The Left Hand of Darkness");
  });
});

describe("GET /api/loans/summary", () => {
  it("returns empty stats for both directions when there are no loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await loanSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      borrowed: EMPTY_DIRECTION_SUMMARY,
      lent: EMPTY_DIRECTION_SUMMARY,
    });
  });

  it("counts active loans under the direction they belong to", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-20), personName: "Olha" },
      "Overdue",
    );
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "No Date");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Ivan" });

    const res = await loanSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.borrowed.totalCount).toBe(2);
    expect(res.body.borrowed.overdueCount).toBe(1);
    expect(res.body.borrowed.noReturnDateCount).toBe(1);
    expect(res.body.lent.totalCount).toBe(1);
    expect(res.body.lent.overdueCount).toBe(0);
  });

  it("keeps the two directions from bleeding into each other", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-4), loanDate: isoDay(-20), personName: "Olha" },
      "Borrowed overdue",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), personName: "Ivan" },
      "Lent due soon",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.overdueCount).toBe(1);
    expect(res.body.borrowed.returningSoonCount).toBe(0);
    expect(res.body.lent.overdueCount).toBe(0);
    expect(res.body.lent.returningSoonCount).toBe(1);
    expect(res.body.lent.nearestReturnDate).toBe(isoDay(3));
  });

  it("excludes a returned loan from every count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(3),
      personName: "Olha",
      remindToReturn: true,
    });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body).toEqual({
      borrowed: EMPTY_DIRECTION_SUMMARY,
      lent: EMPTY_DIRECTION_SUMMARY,
    });
  });
});

describe("GET /api/loans/summary borrowed stats", () => {
  it("counts unique people across active borrowed loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "First");
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Second");
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "Third");

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.totalCount).toBe(3);
    expect(res.body.borrowed.peopleCount).toBe(2);
  });

  it("counts returns due within the next seven days and reports the nearest one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(2) }, "Soon");
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(6) }, "Later this week");
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(20) }, "Next month");

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.returningSoonCount).toBe(2);
    expect(res.body.borrowed.nearestReturnDate).toBe(isoDay(2));
  });

  it("keeps overdue loans out of the returning soon count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-4), loanDate: isoDay(-20) },
      "Overdue",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.returningSoonCount).toBe(0);
    expect(res.body.borrowed.nearestReturnDate).toBeNull();
  });

  it("counts overdue borrowed loans and reports the oldest return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-11), loanDate: isoDay(-20) },
      "Long overdue",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-2), loanDate: isoDay(-20) },
      "Just overdue",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.overdueCount).toBe(2);
    expect(res.body.borrowed.oldestOverdueReturnDate).toBe(isoDay(-11));
  });

  it("counts loans held for thirty days or longer and reports the earliest loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-47) }, "Ancient");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-30) }, "Exactly thirty days");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-3) }, "Recent");

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.longHeldCount).toBe(2);
    expect(res.body.borrowed.earliestLoanDate).toBe(isoDay(-47));
  });

  it("leaves borrowed stats empty when the user only lent books out", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, {
      expectedReturnDate: isoDay(-5),
      loanDate: isoDay(-60),
      personName: "Ivan",
    });

    const res = await loanSummary(accessToken);

    expect(res.body.lent.totalCount).toBe(1);
    expect(res.body.borrowed).toEqual(EMPTY_DIRECTION_SUMMARY);
  });

  it("excludes a returned borrowed loan from the borrowed stats", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(-6),
      loanDate: isoDay(-40),
      personName: "Olha",
    });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed).toEqual(EMPTY_DIRECTION_SUMMARY);
  });
});

describe("GET /api/loans/summary lent stats", () => {
  it("counts unique people holding the books the user lent out", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" }, "First");
    await createLentLoan(accessToken, { personName: "Ivan" }, "Second");
    await createLentLoan(accessToken, { personName: "Petro" }, "Third");

    const res = await loanSummary(accessToken);

    expect(res.body.lent.totalCount).toBe(3);
    expect(res.body.lent.peopleCount).toBe(2);
  });

  it("counts lent returns due within the next seven days and reports the nearest one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(2) }, "Soon");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(6) }, "Later this week");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(20) }, "Next month");

    const res = await loanSummary(accessToken);

    expect(res.body.lent.returningSoonCount).toBe(2);
    expect(res.body.lent.nearestReturnDate).toBe(isoDay(2));
  });

  it("counts overdue lent loans and reports the oldest return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-11), loanDate: isoDay(-20) },
      "Long overdue",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-2), loanDate: isoDay(-20) },
      "Just overdue",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.lent.overdueCount).toBe(2);
    expect(res.body.lent.oldestOverdueReturnDate).toBe(isoDay(-11));
  });

  it("counts lent loans without a return date and the people holding them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" }, "No date one");
    await createLentLoan(accessToken, { personName: "Ivan" }, "No date two");
    await createLentLoan(accessToken, { personName: "Petro" }, "No date three");
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(5), personName: "Sofia" },
      "With a date",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.lent.noReturnDateCount).toBe(3);
    expect(res.body.lent.noReturnDatePeopleCount).toBe(2);
  });

  it("counts lent loans that have a return date but no reminder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(5) }, "Silent one");
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10) },
      "Silent and overdue",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(9), remindToReturn: true },
      "With a reminder",
    );
    await createLentLoan(accessToken, {}, "Without a date");

    const res = await loanSummary(accessToken);

    expect(res.body.lent.noReminderWithDateCount).toBe(2);
    expect(res.body.lent.noReturnDateCount).toBe(1);
  });

  it("keeps the loans without a reminder on their own side of the summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(4) }, "Lent silently");
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(4) }, "Borrowed silently");

    const res = await loanSummary(accessToken);

    expect(res.body.lent.noReminderWithDateCount).toBe(1);
    expect(res.body.borrowed.noReminderWithDateCount).toBe(1);
  });

  it("leaves lent stats empty when the user only borrowed books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(-5),
      loanDate: isoDay(-60),
      personName: "Olha",
    });

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.totalCount).toBe(1);
    expect(res.body.lent).toEqual(EMPTY_DIRECTION_SUMMARY);
  });

  it("excludes a returned lent loan from the lent stats", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createLentLoan(accessToken, {
      expectedReturnDate: isoDay(-6),
      loanDate: isoDay(-40),
      personName: "Ivan",
    });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body.lent).toEqual(EMPTY_DIRECTION_SUMMARY);
  });
});

describe("GET /api/loans/summary upcoming returns", () => {
  it("keeps only dated future returns, soonest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(9) }, "Later");
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(0) }, "Today");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-2), loanDate: isoDay(-20) },
      "Overdue",
    );
    await createBorrowedLoan(accessToken, {}, "No date");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.upcomingReturns)).toEqual(["Today", "Later"]);
  });

  it("takes the five nearest returns even when the list paginates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const offset of [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(offset) }, `In ${offset}`);
    }

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.upcomingReturns)).toEqual([
      "In 1",
      "In 2",
      "In 3",
      "In 4",
      "In 5",
    ]);
  });

  it("carries the person and the book preview of each upcoming return", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(4), personName: "Maria" },
      "Dune",
    );

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.upcomingReturns).toHaveLength(1);
    expect(res.body.borrowed.upcomingReturns[0]).toMatchObject({
      book: { cover: null, firstAuthorName: "Frank Herbert", title: "Dune" },
      expectedReturnDate: isoDay(4),
      personName: "Maria",
    });
    expect(res.body.borrowed.upcomingReturns[0].book.id).toMatch(UUID);
  });

  it("keeps the upcoming returns of the two directions apart", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(2) }, "Borrowed soon");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(5) }, "Lent soon");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.upcomingReturns)).toEqual(["Borrowed soon"]);
    expect(loanTitles(res.body.lent.upcomingReturns)).toEqual(["Lent soon"]);
  });

  it("builds the lent upcoming returns the same way, without the overdue ones", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const offset of [6, 4, 2, 1, 3, 5]) {
      await createLentLoan(accessToken, { expectedReturnDate: isoDay(offset) }, `In ${offset}`);
    }
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-4), loanDate: isoDay(-20) },
      "Overdue",
    );
    await createLentLoan(accessToken, {}, "No date");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.lent.upcomingReturns)).toEqual([
      "In 1",
      "In 2",
      "In 3",
      "In 4",
      "In 5",
    ]);
  });

  it("drops a returned loan from the upcoming returns", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(2) });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.upcomingReturns).toEqual([]);
  });
});

describe("GET /api/loans/summary top people", () => {
  it("groups the lent loans by person and ranks the five biggest holders", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const holdings: [string, number][] = [
      ["Olha", 4],
      ["Ivan", 3],
      ["Petro", 2],
      ["Maria", 2],
      ["Sofia", 1],
      ["Andrii", 1],
    ];
    for (const [personName, books] of holdings) {
      for (let index = 0; index < books; index += 1) {
        await createLentLoan(accessToken, { personName }, `${personName} ${index}`);
      }
    }

    const res = await loanSummary(accessToken);

    expect(
      res.body.lent.topPeople.map(
        (person: { bookCount: number; personName: string }) =>
          `${person.personName}:${person.bookCount}`,
      ),
    ).toEqual(["Olha:4", "Ivan:3", "Maria:2", "Petro:2", "Andrii:1"]);
  });

  it("keeps the top people of the two directions apart and ignores returned loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" }, "Lent one");
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Borrowed one");
    const returnedBookId = await createLentLoan(accessToken, { personName: "Petro" }, "Returned");
    await request(app.getHttpServer())
      .post(`/api/books/${returnedBookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body.lent.topPeople).toEqual([
      { bookCount: 1, contactId: await contactIdFor("Ivan"), covers: [], personName: "Ivan" },
    ]);
    expect(res.body.borrowed.topPeople).toEqual([
      { bookCount: 1, contactId: await contactIdFor("Olha"), covers: [], personName: "Olha" },
    ]);
  });
});

describe("GET /api/loans by contact", () => {
  it("returns only the loans of the requested contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Olha" }, "Hers");
    await createLentLoan(accessToken, { personName: "Ivan" }, "His");

    const res = await listLoans(accessToken, `?contactId=${await contactIdFor("Olha")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(loanTitles(res.body.items)).toEqual(["Hers"]);
  });

  it("returns 400 for a person name in place of the contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Olha" }, "Hers");

    const res = await listLoans(accessToken, `?contactId=${encodeURIComponent("Olha")}`);

    expect(res.status).toBe(400);
  });

  it("combines the contact with the other list filters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Olha" },
      "Hers overdue",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(6), personName: "Olha" },
      "Hers on time",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-4), loanDate: isoDay(-10), personName: "Ivan" },
      "His overdue",
    );

    const res = await listLoans(
      accessToken,
      `?contactId=${await contactIdFor("Olha")}&filter=overdue`,
    );

    expect(loanTitles(res.body.items)).toEqual(["Hers overdue"]);
  });

  it("returns an empty page for a contact id that matches no loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Olha" }, "Hers");

    const res = await listLoans(accessToken, `?contactId=${MISSING_CONTACT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe("GET /api/loans after a contact rename", () => {
  async function lendToRenamedPerson(accessToken: string): Promise<void> {
    await createBorrowedLoan(accessToken, { personName: "Olha Melnyk" }, "Hers");
    await createLentLoan(accessToken, { personName: "Ivan Petrenko" }, "His");
    await renameContact(accessToken, await contactIdFor("Olha Melnyk"), "Olha Sydorenko");
  }

  it("shows the current name of the contact rather than the name stored on the loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await lendToRenamedPerson(accessToken);

    const res = await listLoans(accessToken, "?type=borrowed_from_someone");

    expect(res.body.items[0].personName).toBe("Olha Sydorenko");
  });

  it("finds the loan by the new name of the contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await lendToRenamedPerson(accessToken);

    const res = await listLoans(accessToken, "?search=sydorenko");

    expect(loanTitles(res.body.items)).toEqual(["Hers"]);
  });

  it("still finds the loan by the name stored on it when the loan started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await lendToRenamedPerson(accessToken);

    const res = await listLoans(accessToken, "?search=melnyk");

    expect(loanTitles(res.body.items)).toEqual(["Hers"]);
  });
});

describe("GET /api/loans after a contact detail change", () => {
  it("shows the current detail of the contact rather than the one stored on the loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" });
    const contactId = await contactIdFor("Ivan");
    await changeContactDetail(accessToken, contactId, "ivan@example.com");

    const res = await listLoans(accessToken, "?type=lent_to_someone");

    expect(res.body.items[0].contact).toBe("ivan@example.com");
  });

  it("keeps showing the current detail after the loan stored a different one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contact = await request(app.getHttpServer())
      .post("/api/loans/contacts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contact: "old@example.com", name: "Ivan" });
    expect(contact.status).toBe(201);
    await createLentLoan(accessToken, { loanContactId: contact.body.id });
    await changeContactDetail(accessToken, contact.body.id, "new@example.com");

    const [item] = (await listLoans(accessToken, "?type=lent_to_someone")).body.items;
    const stored = await prisma.bookLoan.findFirstOrThrow({
      select: { contact: true },
      where: { loanContactId: contact.body.id },
    });

    expect([item.contact, stored.contact]).toEqual(["new@example.com", "old@example.com"]);
  });
});

describe("GET /api/loans after a contact is archived", () => {
  it("keeps the active loan of an archived contact in the list", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" });
    await archiveContact(accessToken, await contactIdFor("Ivan"));

    const res = await listLoans(accessToken, "?type=lent_to_someone");

    expect(loanTitles(res.body.items)).toEqual(["Hyperion"]);
  });

  it("still names the person on the loan of an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" });
    const contactId = await contactIdFor("Ivan");
    await changeContactDetail(accessToken, contactId, "ivan@example.com");
    await archiveContact(accessToken, contactId);

    const [item] = (await listLoans(accessToken, "?type=lent_to_someone")).body.items;

    expect(item).toMatchObject({ contact: "ivan@example.com", personName: "Ivan" });
  });

  it("keeps counting the loan of an archived contact in the summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, { personName: "Ivan" });
    await archiveContact(accessToken, await contactIdFor("Ivan"));

    const res = await loanSummary(accessToken);

    expect(res.body.lent).toMatchObject({ peopleCount: 1, totalCount: 1 });
  });
});

describe("GET /api/loans/summary people grouped by contact", () => {
  async function lendTwiceUnderTwoSpellings(accessToken: string): Promise<void> {
    await createLentLoan(accessToken, { personName: "Ігор" }, "First");
    await renameContact(accessToken, await contactIdFor("Ігор"), "ігор");
    await createLentLoan(accessToken, { personName: "ігор" }, "Second");
  }

  it("counts two loans that share a contact as one person", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await lendTwiceUnderTwoSpellings(accessToken);

    const res = await loanSummary(accessToken);

    expect(res.body.lent.totalCount).toBe(2);
    expect(res.body.lent.peopleCount).toBe(1);
  });

  it("groups the top people by contact rather than by the name stored on the loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await lendTwiceUnderTwoSpellings(accessToken);

    const res = await loanSummary(accessToken);

    expect(res.body.lent.topPeople).toEqual([
      { bookCount: 2, contactId: await contactIdFor("ігор"), covers: [], personName: "ігор" },
    ]);
  });
});

describe("GET /api/loans/summary long-held loans", () => {
  it("keeps only loans held for thirty days or more, oldest first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-31) }, "Held 31");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-47) }, "Held 47");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-30) }, "Held 30");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-29) }, "Held 29");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.longHeldLoans)).toEqual(["Held 47", "Held 31", "Held 30"]);
  });

  it("takes the five oldest loans and carries the person and the book preview", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const age of [40, 45, 50, 55, 60, 65, 70]) {
      await createBorrowedLoan(
        accessToken,
        { loanDate: isoDay(-age), personName: `Person ${age}` },
        `Held ${age}`,
      );
    }

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.longHeldLoans)).toEqual([
      "Held 70",
      "Held 65",
      "Held 60",
      "Held 55",
      "Held 50",
    ]);
    expect(res.body.borrowed.longHeldLoans[0]).toMatchObject({
      book: { cover: null, firstAuthorName: "Frank Herbert", title: "Held 70" },
      loanDate: isoDay(-70),
      personName: "Person 70",
    });
  });

  it("ignores the return date when picking long-held loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-5), loanDate: isoDay(-40) },
      "Overdue and old",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(20), loanDate: isoDay(-35) },
      "On time and old",
    );
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-33) }, "No date and old");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.longHeldLoans)).toEqual([
      "Overdue and old",
      "On time and old",
      "No date and old",
    ]);
  });

  it("keeps the long-held loans of the two directions apart", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-40) }, "Borrowed long ago");
    await createLentLoan(accessToken, { loanDate: isoDay(-60) }, "Lent long ago");

    const res = await loanSummary(accessToken);

    expect(loanTitles(res.body.borrowed.longHeldLoans)).toEqual(["Borrowed long ago"]);
    expect(loanTitles(res.body.lent.longHeldLoans)).toEqual(["Lent long ago"]);
  });

  it("drops a returned loan from the long-held loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, { loanDate: isoDay(-40) });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body.borrowed.longHeldLoans).toEqual([]);
  });
});

describe("GET /api/loans sorting", () => {
  it("sorts by person name ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Carol" }, "Book C");
    await createBorrowedLoan(accessToken, { personName: "Alice" }, "Book A");
    await createBorrowedLoan(accessToken, { personName: "Bob" }, "Book B");

    const res = await listLoans(accessToken, "?sort=person");

    expect(res.body.items.map((item: { personName: string }) => item.personName)).toEqual([
      "Alice",
      "Bob",
      "Carol",
    ]);
  });

  it("sorts by book title ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Zebra Tales");
    await createBorrowedLoan(accessToken, { personName: "Ivan" }, "Apple Tales");
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "Mango Tales");

    const res = await listLoans(accessToken, "?sort=title");

    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Apple Tales",
      "Mango Tales",
      "Zebra Tales",
    ]);
  });

  it("sorts by first author name ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Zed Author" }], ownershipStatus: "none", title: "One" },
      "Olha",
    );
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Ann Author" }], ownershipStatus: "none", title: "Two" },
      "Ivan",
    );
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Mel Author" }], ownershipStatus: "none", title: "Three" },
      "Maria",
    );

    const res = await listLoans(accessToken, "?sort=author");

    expect(
      res.body.items.map(
        (item: { book: { firstAuthorName: string } }) => item.book.firstAuthorName,
      ),
    ).toEqual(["Ann Author", "Mel Author", "Zed Author"]);
  });

  it("sorts by loan date descending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-10), personName: "Olha" }, "Old");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-1), personName: "Ivan" }, "Recent");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-5), personName: "Maria" }, "Middle");

    const res = await listLoans(accessToken, "?sort=loan_date");

    expect(res.body.items.map((item: { loanDate: string }) => item.loanDate)).toEqual([
      isoDay(-1),
      isoDay(-5),
      isoDay(-10),
    ]);
  });

  it("orders loans without a return date last when sorting by return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "NoDate" }, "No Date");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(5), personName: "Later" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(2), personName: "Sooner" },
      "Sooner",
    );

    const res = await listLoans(accessToken, "?sort=return_date");

    expect(
      res.body.items.map(
        (item: { expectedReturnDate: Nullable<string> }) => item.expectedReturnDate,
      ),
    ).toEqual([isoDay(2), isoDay(5), null]);
  });

  it("puts the most overdue first and the dateless loans last when sorting by urgency", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "NoDate" }, "No Date");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(6), personName: "Later" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(2), personName: "Soon" },
      "Soon",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(0), personName: "Today" },
      "Today",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Late" },
      "Late",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-12), loanDate: isoDay(-30), personName: "Worst" },
      "Worst",
    );

    const res = await listLoans(accessToken, "?sort=overdue_first");

    expect(res.body.items.map((item: { personName: string }) => item.personName)).toEqual([
      "Worst",
      "Late",
      "Today",
      "Soon",
      "Later",
      "NoDate",
    ]);
  });

  it("breaks a tie on the return date with the older loan first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), loanDate: isoDay(-2), personName: "Recent" },
      "Recent",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), loanDate: isoDay(-20), personName: "Oldest" },
      "Oldest",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), loanDate: isoDay(-9), personName: "Middle" },
      "Middle",
    );

    const res = await listLoans(accessToken, "?sort=overdue_first");

    expect(res.body.items.map((item: { personName: string }) => item.personName)).toEqual([
      "Oldest",
      "Middle",
      "Recent",
    ]);
  });

  it("sorts by urgency when no sort is asked for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "NoDate" }, "No Date");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(4), personName: "Later" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-5), loanDate: isoDay(-15), personName: "Overdue" },
      "Overdue",
    );

    const res = await listLoans(accessToken);

    expect(res.body.items.map((item: { personName: string }) => item.personName)).toEqual([
      "Overdue",
      "Later",
      "NoDate",
    ]);
  });

  it("rejects the retired return_soonest sort", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?sort=return_soonest");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/loans pagination", () => {
  it("returns the requested page and reports the total counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), personName: "Third" },
      "Third",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(1), personName: "First" },
      "First",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(2), personName: "Second" },
      "Second",
    );

    const res = await listLoans(accessToken, "?pageSize=1&pageNumber=2");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].expectedReturnDate).toBe(isoDay(2));
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.pagesCount).toBe(3);
    expect(res.body.totalCount).toBe(3);
  });
});

describe("GET /api/loans combined filters", () => {
  it("narrows by type, filter and search together without widening past the active type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Olha" },
      "Borrowed Olha",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Olha" },
      "Lent Olha",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Ivan" },
      "Borrowed Ivan",
    );

    const res = await listLoans(
      accessToken,
      "?type=borrowed_from_someone&filter=overdue&search=olha",
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe("borrowed_from_someone");
    expect(res.body.items[0].book.title).toBe("Borrowed Olha");
  });
});

describe("GET /api/loans additional filters", () => {
  it("filters loans due within the return-soon window", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), personName: "Olha" },
      "Soon",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(30), personName: "Ivan" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Maria" },
      "Overdue",
    );

    const res = await listLoans(accessToken, "?filter=return_soon");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Soon");
    expect(res.body.items[0].loanUiStatus).toBe("return_soon");
  });

  it("filters loans that have a return date but no reminder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, {
      expectedReturnDate: isoDay(10),
      personName: "Ivan",
      remindToReturn: true,
    });
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(8), personName: "Olha" },
      "No Reminder",
    );
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "No Date At All");

    const res = await listLoans(accessToken, "?reminder=off");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("No Reminder");
    expect(res.body.items[0].remindToReturn).toBe(false);
  });
});

describe("GET /api/loans advanced filters", () => {
  it("filters by the loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-20), personName: "Olha" }, "Old");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-5), personName: "Olha" }, "Recent");

    const res = await listLoans(
      accessToken,
      `?loanDateFrom=${isoDay(-10)}&loanDateTo=${isoDay(0)}`,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Recent");
  });

  it("keeps a loan date range open at one end", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-20), personName: "Olha" }, "Old");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-5), personName: "Olha" }, "Recent");

    const res = await listLoans(accessToken, `?loanDateFrom=${isoDay(-10)}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Recent");
  });

  it("filters by the expected return date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-9), loanDate: isoDay(-20), personName: "Olha" },
      "Past Due",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(9), personName: "Olha" },
      "Future Due",
    );
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "No Due Date");

    const res = await listLoans(
      accessToken,
      `?expectedReturnDateFrom=${isoDay(5)}&expectedReturnDateTo=${isoDay(15)}`,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Future Due");
  });

  it("reaches into the past with the expected return date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-9), loanDate: isoDay(-20), personName: "Olha" },
      "Past Due",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(9), personName: "Olha" },
      "Future Due",
    );

    const res = await listLoans(
      accessToken,
      `?expectedReturnDateFrom=${isoDay(-15)}&expectedReturnDateTo=${isoDay(-1)}`,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Past Due");
  });

  it("rejects an inverted date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(
      accessToken,
      `?expectedReturnDateFrom=${isoDay(10)}&expectedReturnDateTo=${isoDay(1)}`,
    );

    expect(res.status).toBe(400);
  });

  it("filters loans that carry a note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { note: "handed over in person" }, "With Note");
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Without Note");

    const res = await listLoans(accessToken, "?hasNote=true");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("With Note");
  });

  it("filters loans that carry no note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { note: "handed over in person" }, "With Note");
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Without Note");

    const res = await listLoans(accessToken, "?hasNote=false");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Without Note");
  });

  it("combines the quick status, the person, the reminder, the note and a date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(
      accessToken,
      {
        expectedReturnDate: isoDay(-4),
        loanDate: isoDay(-10),
        note: "asked twice already",
        personName: "Ivan",
      },
      "Wanted",
    );
    await createLentLoan(
      accessToken,
      {
        expectedReturnDate: isoDay(-4),
        loanDate: isoDay(-10),
        personName: "Ivan",
      },
      "No Note",
    );
    await createLentLoan(
      accessToken,
      {
        expectedReturnDate: isoDay(-4),
        loanDate: isoDay(-30),
        note: "too old",
        personName: "Ivan",
      },
      "Too Old",
    );
    await createLentLoan(
      accessToken,
      {
        expectedReturnDate: isoDay(-4),
        loanDate: isoDay(-10),
        note: "someone else",
        personName: "Maria",
      },
      "Other Person",
    );
    const contactId = await contactIdFor("Ivan");

    const res = await listLoans(
      accessToken,
      `?type=lent_to_someone&filter=overdue&contactId=${contactId}&reminder=off&hasNote=true&loanDateFrom=${isoDay(-14)}`,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Wanted");
    expect(res.body.totalCount).toBe(1);
  });

  it("returns nothing when a date range contradicts the no-return-date filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "No Due Date");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(6), personName: "Olha" },
      "Due Soon",
    );

    const res = await listLoans(
      accessToken,
      `?filter=no_return_date&expectedReturnDateFrom=${isoDay(1)}&expectedReturnDateTo=${isoDay(30)}`,
    );

    expect(res.body.items).toHaveLength(0);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/loans search", () => {
  it("searches by contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "A");
    await createBorrowedLoan(accessToken, { personName: "Ivan" }, "B");
    await changeContactDetail(accessToken, await contactIdFor("Olha"), "olha@example.com");
    await changeContactDetail(accessToken, await contactIdFor("Ivan"), "ivan@other.net");

    const res = await listLoans(accessToken, "?search=example.com");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha");
  });

  it("still searches by the contact detail a loan stored when it started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contact = await request(app.getHttpServer())
      .post("/api/loans/contacts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contact: "old@example.com", name: "Olha" });
    expect(contact.status).toBe(201);
    await createBorrowedLoan(accessToken, { loanContactId: contact.body.id }, "A");
    await changeContactDetail(accessToken, contact.body.id, "new@example.com");

    const res = await listLoans(accessToken, "?search=old@example.com");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("A");
  });

  it("searches by note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { note: "hardcover copy", personName: "Olha" }, "A");
    await createBorrowedLoan(accessToken, { note: "paperback edition", personName: "Ivan" }, "B");

    const res = await listLoans(accessToken, "?search=hardcover");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha");
  });

  it("searches by original title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Antoine de Saint-Exupery" }],
        originalTitle: "Le Petit Prince",
        ownershipStatus: "none",
        title: "The Little Prince",
      },
      "Olha",
    );
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Other Author" }],
        originalTitle: "Something Else",
        ownershipStatus: "none",
        title: "Another Book",
      },
      "Ivan",
    );

    const res = await listLoans(accessToken, "?search=petit");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.originalTitle).toBe("Le Petit Prince");
  });

  it("searches by an alternate-locale author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Andrzej Sapkowski" }],
      ownershipStatus: "none",
      title: "The Witcher",
    });
    const bookId = created.body.id;
    await addAlternateAuthorName(bookId, {
      locale: "uk",
      name: "Анджей Сапковський",
      normalizedName: "анджей сапковський",
    });
    await startLoan(accessToken, bookId, {
      direction: "borrowed",
      loanDate: isoDay(0),
      personName: "Olha",
    });

    const res = await listLoans(accessToken, `?search=${encodeURIComponent("Сапковський")}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.id).toBe(bookId);
  });

  it("matches the search term case-insensitively", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha Melnyk" });

    const res = await listLoans(accessToken, "?search=MELNYK");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha Melnyk");
  });
});

describe("GET /api/loans ui status", () => {
  it("reports on_time when the return date is more than a week away", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.body.items[0].loanUiStatus).toBe("on_time");
  });
});

describe("GET /api/loans book preview", () => {
  it("returns null cover, publisher and original title when the book has none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.body.items[0].book).toMatchObject({
      cover: null,
      originalTitle: null,
      publisher: null,
    });
  });

  it("returns the publisher and original title when the book has them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Frank Herbert" }],
        originalTitle: "Original Title",
        ownershipStatus: "none",
        publisherName: "Vintage",
        title: "Dune",
      },
      "Olha",
    );

    const res = await listLoans(accessToken);

    const preview = res.body.items[0].book;
    expect(preview.originalTitle).toBe("Original Title");
    expect(preview.publisher.name).toBe("Vintage");
    expect(preview.publisher.id).toMatch(UUID);
  });
});

describe("GET /api/loans validation", () => {
  it("returns 400 for an invalid sort value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?sort=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid filter value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?filter=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid type value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?type=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 when the page size exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?pageSize=101");

    expect(res.status).toBe(400);
  });

  it("applies default pagination when no query params are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.pagesCount).toBe(1);
    expect(res.body.totalCount).toBe(1);
  });
});

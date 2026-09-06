import type { INestApplication } from "@nestjs/common";

import { LOAN_BATCH_CONFLICT_CODE, LOAN_CONTACT_ERROR_CODES } from "@app/shared";
import { formatInTimeZone } from "date-fns-tz";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { LoansModule } from "../../loans/index.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

const today = (): string => formatInTimeZone(new Date(), "UTC", "yyyy-MM-dd");

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

async function bookOwnership(bookId: string): Promise<null | string> {
  const book = await prisma.book.findUnique({
    select: { ownershipStatus: true },
    where: { id: bookId },
  });
  return book?.ownershipStatus ?? null;
}

function countActiveLoans(): Promise<number> {
  return prisma.bookLoan.count({ where: { status: "active" } });
}

function createBatch(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books/loans/batch")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createBook(accessToken: string, body: Record<string, unknown>): Promise<string> {
  const created = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], ...body });
  return String(created.body.id);
}

async function createContact(accessToken: string, name: string): Promise<string> {
  const created = await request(app.getHttpServer())
    .post("/api/loans/contacts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name });
  return String(created.body.id);
}

describe("POST /api/books/loans/batch authorization and validation", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post("/api/books/loans/batch").send({});

    expect(res.status).toBe(401);
  });

  it("returns 400 when no book was selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");

    const res = await createBatch(accessToken, {
      bookIds: [],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookIds" })]),
    );
  });

  it("offers no way to name the person instead of picking a contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [bookId],
      direction: "lent",
      loanDate: today(),
      personName: "Olha",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanContactId" })]),
    );
    expect(await countActiveLoans()).toBe(0);
  });

  it("returns 404 when the contact does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [bookId],
      direction: "lent",
      loanContactId: MISSING_UUID,
      loanDate: today(),
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.notFound);
    expect(await countActiveLoans()).toBe(0);
  });
});

describe("POST /api/books/loans/batch lending", () => {
  it("lends a single owned book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const bookId = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [bookId],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(200);
    expect(res.body.createdBookIds).toEqual([bookId]);
    expect(await bookOwnership(bookId)).toBe("lent_to_someone");
    expect(await countActiveLoans()).toBe(1);
  });

  it("lends several owned books under one set of terms", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const first = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    const second = await createBook(accessToken, { ownershipStatus: "owned", title: "Solaris" });
    const returnDate = formatInTimeZone(
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      "UTC",
      "yyyy-MM-dd",
    );

    const res = await createBatch(accessToken, {
      bookIds: [first, second],
      direction: "lent",
      expectedReturnDate: returnDate,
      loanContactId: contactId,
      loanDate: today(),
      note: "Обидві до кінця місяця",
      remindToReturn: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.createdBookIds).toEqual([first, second]);

    const loans = await prisma.bookLoan.findMany({ orderBy: { createdAt: "asc" } });
    expect(loans).toHaveLength(2);
    for (const loan of loans) {
      expect(loan.loanContactId).toBe(contactId);
      expect(loan.type).toBe("lent_to_someone");
      expect(loan.note).toBe("Обидві до кінця місяця");
      expect(loan.remindToReturn).toBe(true);
      expect(loan.status).toBe("active");
    }
    expect(await bookOwnership(first)).toBe("lent_to_someone");
    expect(await bookOwnership(second)).toBe("lent_to_someone");
  });

  it("creates one loan per book even when a book id is sent twice", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const bookId = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [bookId, bookId],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(200);
    expect(await countActiveLoans()).toBe(1);
  });

  it("refuses to lend a book that is not owned and names it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const owned = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    const wanted = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Solaris",
    });

    const res = await createBatch(accessToken, {
      bookIds: [owned, wanted],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_BATCH_CONFLICT_CODE);
    expect(res.body.details.conflicts).toEqual([{ bookId: wanted, reason: "lend_requires_owned" }]);
    expect(await countActiveLoans()).toBe(0);
    expect(await bookOwnership(owned)).toBe("owned");
  });
});

describe("POST /api/books/loans/batch borrowing", () => {
  it("borrows books that are unowned or only wanted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const none = await createBook(accessToken, { title: "Dune" });
    const wanted = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Solaris",
    });

    const res = await createBatch(accessToken, {
      bookIds: [none, wanted],
      direction: "borrowed",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(200);
    expect(await bookOwnership(none)).toBe("borrowed_from_someone");
    expect(await bookOwnership(wanted)).toBe("borrowed_from_someone");
    expect(await countActiveLoans()).toBe(2);
  });

  it("clears the wishlist stamp of a book that leaves want_to_buy", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const wanted = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Solaris",
    });

    await createBatch(accessToken, {
      bookIds: [wanted],
      direction: "borrowed",
      loanContactId: contactId,
      loanDate: today(),
    });

    const book = await prisma.book.findUnique({
      select: { wishlistAddedAt: true },
      where: { id: wanted },
    });
    expect(book?.wishlistAddedAt).toBeNull();
  });

  it("refuses to borrow a book the reader already owns", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const owned = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [owned],
      direction: "borrowed",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toEqual([
      { bookId: owned, reason: "borrow_requires_available_ownership" },
    ]);
    expect(await countActiveLoans()).toBe(0);
  });
});

describe("POST /api/books/loans/batch is all or nothing", () => {
  it("creates nothing and moves nothing when one book of three is invalid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const first = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    const second = await createBook(accessToken, { ownershipStatus: "owned", title: "Solaris" });
    const third = await createBook(accessToken, { title: "Hyperion" });

    const res = await createBatch(accessToken, {
      bookIds: [first, second, third],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toEqual([{ bookId: third, reason: "lend_requires_owned" }]);
    expect(await countActiveLoans()).toBe(0);
    expect(await bookOwnership(first)).toBe("owned");
    expect(await bookOwnership(second)).toBe("owned");
    expect(await bookOwnership(third)).toBe("none");
  });

  it("reports every blocking book rather than only the first", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const valid = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    const wanted = await createBook(accessToken, {
      ownershipStatus: "want_to_buy",
      title: "Solaris",
    });
    const none = await createBook(accessToken, { title: "Hyperion" });

    const res = await createBatch(accessToken, {
      bookIds: [valid, wanted, none],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toHaveLength(2);
    expect(res.body.details.conflicts.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      wanted,
      none,
    ]);
    expect(await countActiveLoans()).toBe(0);
  });

  it("refuses the whole batch when a book already carries an active loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const free = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    const lent = await createBook(accessToken, { ownershipStatus: "owned", title: "Solaris" });
    await createBatch(accessToken, {
      bookIds: [lent],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    const res = await createBatch(accessToken, {
      bookIds: [free, lent],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toEqual([{ bookId: lent, reason: "active_loan_exists" }]);
    expect(await countActiveLoans()).toBe(1);
    expect(await bookOwnership(free)).toBe("owned");
  });

  it("refuses the whole batch when one of the books is gone", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const owned = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });

    const res = await createBatch(accessToken, {
      bookIds: [owned, MISSING_UUID],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toEqual([
      { bookId: MISSING_UUID, reason: "book_not_found" },
    ]);
    expect(await countActiveLoans()).toBe(0);
    expect(await bookOwnership(owned)).toBe("owned");
  });

  it("treats another reader's book as missing and creates nothing", async () => {
    const owner = await context.registerVerifyAndLogin();
    const strangerBook = await createBook(owner.accessToken, {
      ownershipStatus: "owned",
      title: "Dune",
    });

    const reader = await context.registerVerifyAndLogin();
    const contactId = await createContact(reader.accessToken, "Olha");
    const ownBook = await createBook(reader.accessToken, {
      ownershipStatus: "owned",
      title: "Solaris",
    });

    const res = await createBatch(reader.accessToken, {
      bookIds: [ownBook, strangerBook],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.details.conflicts).toEqual([
      { bookId: strangerBook, reason: "book_not_found" },
    ]);
    expect(await countActiveLoans()).toBe(0);
    expect(await bookOwnership(strangerBook)).toBe("owned");
  });

  it("refuses the batch when the contact is archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createContact(accessToken, "Olha");
    const bookId = await createBook(accessToken, { ownershipStatus: "owned", title: "Dune" });
    await prisma.loanContact.update({
      data: { archivedAt: new Date() },
      where: { id: contactId },
    });

    const res = await createBatch(accessToken, {
      bookIds: [bookId],
      direction: "lent",
      loanContactId: contactId,
      loanDate: today(),
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.archived);
    expect(await countActiveLoans()).toBe(0);
    expect(await bookOwnership(bookId)).toBe("owned");
  });
});

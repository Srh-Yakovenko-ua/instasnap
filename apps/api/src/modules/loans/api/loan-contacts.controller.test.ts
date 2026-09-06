import type {
  LoanContactCounts,
  LoanContactListItemView,
  LoanContactsView,
  LoanDirection,
  OwnershipStatus,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { LOAN_CONTACT_ERROR_CODES, LoanContactsViewSchema } from "@app/shared";
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

const MISSING_CONTACT_ID = "00000000-0000-4000-8000-000000000000";

const STRANGER = { email: "stranger@example.com", nickname: "stranger" } as const;

const UKRAINIAN_ALPHABET_ORDER = [
  "Ганна",
  "Ґудзик",
  "Дарина",
  "Еней",
  "Євген",
  "Жанна",
  "Ірина",
  "Їжак",
] as const;

const LOAN_START_OWNERSHIP: Record<LoanDirection, OwnershipStatus> = {
  borrowed: "none",
  lent: "owned",
};

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

async function archiveContact(contactId: string): Promise<void> {
  await prisma.loanContact.update({
    data: { archivedAt: new Date() },
    where: { id: contactId },
  });
}

function archiveContactRequest(accessToken: string, contactId: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/loans/contacts/${contactId}/archive`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function contactCounts(res: Response): LoanContactCounts {
  return LoanContactsViewSchema.parse(res.body).counts;
}

function contactItems(res: Response): LoanContactListItemView[] {
  return LoanContactsViewSchema.parse(res.body).items;
}

function contactNames(res: Response): string[] {
  return contactItems(res).map((item) => item.name);
}

function contactPage(res: Response): Omit<LoanContactsView, "counts" | "items"> {
  const { counts: _counts, items: _items, ...page } = LoanContactsViewSchema.parse(res.body);
  return page;
}

function createBook(
  accessToken: string,
  title: string,
  ownershipStatus: OwnershipStatus = "owned",
): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], ownershipStatus, title });
}

function createContact(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/loans/contacts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createNamedContact(accessToken: string, name: string): Promise<string> {
  const res = await createContact(accessToken, { name });
  expect(res.status).toBe(201);
  const contactId: string = res.body.id;
  return contactId;
}

async function deleteBook(accessToken: string, bookId: string): Promise<void> {
  const res = await request(app.getHttpServer())
    .delete(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
}

function getContact(accessToken: string, contactId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function lendBookTo(
  accessToken: string,
  {
    direction = "lent",
    loanContactId,
    title,
  }: { direction?: LoanDirection; loanContactId: string; title: string },
): Promise<string> {
  const created = await createBook(accessToken, title, LOAN_START_OWNERSHIP[direction]);
  expect(created.status).toBe(201);
  const bookId: string = created.body.id;

  const started = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ direction, loanContactId, loanDate: today() });
  expect(started.status).toBe(200);
  return bookId;
}

function listContacts(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/contacts${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function lookupContactByName(accessToken: string, name: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans/contacts/by-name?name=${encodeURIComponent(name)}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function restoreContactRequest(accessToken: string, contactId: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/loans/contacts/${contactId}/restore`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function returnBook(accessToken: string, bookId: string): Promise<void> {
  const res = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/loan/return`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
}

function updateContact(
  accessToken: string,
  contactId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("loan contacts authorization", () => {
  it("returns 401 for the contact list without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/contacts");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a contact creation without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/loans/contacts")
      .send({ name: "Ігор" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a contact rename without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/loans/contacts/${MISSING_CONTACT_ID}`)
      .send({ name: "Ігор" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a contact lookup by name without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/contacts/by-name?name=Ihor");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a contact read without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get(`/api/loans/contacts/${MISSING_CONTACT_ID}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 for an archive without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/loans/contacts/${MISSING_CONTACT_ID}/archive`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 401 for a restore without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/loans/contacts/${MISSING_CONTACT_ID}/restore`,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/loans/contacts", () => {
  it("returns an empty list when the user has no contacts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listContacts(accessToken);

    expect(res.status).toBe(200);
    expect(contactItems(res)).toEqual([]);
  });

  it("leaves the contacts of another user out", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await listContacts(stranger.accessToken);

    expect(contactNames(res)).toEqual([]);
  });

  it("orders the contacts so the Ukrainian letters land where a Ukrainian reader expects", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of [...UKRAINIAN_ALPHABET_ORDER].reverse()) {
      await createNamedContact(accessToken, name);
    }

    const res = await listContacts(accessToken);

    expect(contactNames(res)).toEqual([...UKRAINIAN_ALPHABET_ORDER]);
  });

  it("matches a search fragment regardless of case", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Olha Melnyk");
    await createNamedContact(accessToken, "Ivan Petrenko");

    const res = await listContacts(accessToken, "?search=MELNYK");

    expect(contactNames(res)).toEqual(["Olha Melnyk"]);
  });

  it("matches a search fragment that starts inside a word", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Olha Melnyk");
    await createNamedContact(accessToken, "Ivan Petrenko");

    const res = await listContacts(accessToken, "?search=eln");

    expect(contactNames(res)).toEqual(["Olha Melnyk"]);
  });

  it("finds a person by the way you reach them, not only by their name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await createContact(accessToken, { contact: "olha@example.com", name: "Olha" });
    expect(res.status).toBe(201);
    await createNamedContact(accessToken, "Ivan Petrenko");

    const found = await listContacts(accessToken, "?search=olha%40example");

    expect(contactNames(found)).toEqual(["Olha"]);
    expect(contactCounts(found)).toEqual({ active: 1, all: 1, archived: 0 });
  });

  it("treats a percent sign in the search term as a literal character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor 100%");
    await createNamedContact(accessToken, "Ivan Petrenko");

    const res = await listContacts(accessToken, `?search=${encodeURIComponent("%")}`);

    expect(contactNames(res)).toEqual(["Ihor 100%"]);
  });

  it("caps the list at the requested page size", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Charlie", "Bravo", "Alpha"]) {
      await createNamedContact(accessToken, name);
    }

    const res = await listContacts(accessToken, "?pageSize=2");

    expect(contactNames(res)).toEqual(["Alpha", "Bravo"]);
  });

  it("returns 400 when the page size exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listContacts(accessToken, "?pageSize=101");

    expect(res.status).toBe(400);
  });

  it("returns 400 for a status the list does not know", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listContacts(accessToken, "?status=deleted");

    expect(res.status).toBe(400);
  });

  it("serves the rest of the contacts on the next page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Charlie", "Bravo", "Alpha"]) {
      await createNamedContact(accessToken, name);
    }

    const res = await listContacts(accessToken, "?pageSize=2&pageNumber=2");

    expect(contactNames(res)).toEqual(["Charlie"]);
    expect(contactPage(res)).toEqual(
      expect.objectContaining({ page: 2, pagesCount: 2, pageSize: 2, totalCount: 3 }),
    );
  });

  it("lists only the archived contacts when asked for them alone", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const res = await listContacts(accessToken, "?status=archived");

    expect(contactNames(res)).toEqual(["Ivan"]);
  });

  it("leaves archived contacts out by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const res = await listContacts(accessToken);

    expect(contactNames(res)).toEqual(["Ihor"]);
  });

  it("includes archived contacts when asked for them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const res = await listContacts(accessToken, "?status=all");

    expect(contactNames(res)).toEqual(["Ihor", "Ivan"]);
  });

  it("reports the moment an archived contact was archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const res = await listContacts(accessToken, "?status=all");

    expect(contactItems(res)).toEqual([
      expect.objectContaining({ archivedAt: expect.any(String), name: "Ivan" }),
    ]);
  });
});

describe("GET /api/loans/contacts counts", () => {
  it("splits the contacts of the user into all, active and archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");
    await createNamedContact(accessToken, "Olha");
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const res = await listContacts(accessToken);

    expect(contactCounts(res)).toEqual({ active: 2, all: 3, archived: 1 });
  });

  it("keeps the counts the same whichever status the list is filtered by", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");
    await archiveContact(await createNamedContact(accessToken, "Ivan"));

    const [active, archived, all] = await Promise.all([
      listContacts(accessToken, "?status=active"),
      listContacts(accessToken, "?status=archived"),
      listContacts(accessToken, "?status=all"),
    ]);

    const expected = { active: 1, all: 2, archived: 1 };
    expect(contactCounts(active)).toEqual(expected);
    expect(contactCounts(archived)).toEqual(expected);
    expect(contactCounts(all)).toEqual(expected);
  });

  it("narrows the counts to the contacts the search matches", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Olha Melnyk");
    await archiveContact(await createNamedContact(accessToken, "Olha Kravets"));
    await createNamedContact(accessToken, "Ivan Petrenko");

    const res = await listContacts(accessToken, "?search=Olha&status=all");

    expect(contactCounts(res)).toEqual({ active: 1, all: 2, archived: 1 });
  });

  it("leaves the counts untouched by pagination", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Charlie", "Bravo", "Alpha"]) {
      await createNamedContact(accessToken, name);
    }

    const res = await listContacts(accessToken, "?pageSize=1&pageNumber=2");

    expect(contactNames(res)).toEqual(["Bravo"]);
    expect(contactCounts(res)).toEqual({ active: 3, all: 3, archived: 0 });
  });

  it("counts the contacts of the current user only", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createNamedContact(owner.accessToken, "Ihor");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await listContacts(stranger.accessToken);

    expect(contactCounts(res)).toEqual({ active: 0, all: 0, archived: 0 });
  });
});

describe("GET /api/loans/contacts loan count", () => {
  it("counts the active and the returned loans of a contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ihor");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Still out" });
    const returnedBookId = await lendBookTo(accessToken, {
      loanContactId: contactId,
      title: "Came back",
    });
    await returnBook(accessToken, returnedBookId);

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]?.loanCount).toBe(2);
  });

  it("leaves the loans of a trashed book out of the loan count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ihor");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Kept" });
    const trashedBookId = await lendBookTo(accessToken, {
      loanContactId: contactId,
      title: "Trashed",
    });
    await deleteBook(accessToken, trashedBookId);

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]?.loanCount).toBe(1);
  });

  it("reports a zero loan count for a contact nobody has borrowed from yet", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]?.loanCount).toBe(0);
  });
});

describe("GET /api/loans/contacts active loan counts", () => {
  it("splits the books still out by the direction they went", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ihor");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Lent one" });
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Lent two" });
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Lent three" });
    await lendBookTo(accessToken, {
      direction: "borrowed",
      loanContactId: contactId,
      title: "Borrowed one",
    });
    await lendBookTo(accessToken, {
      direction: "borrowed",
      loanContactId: contactId,
      title: "Borrowed two",
    });

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]).toMatchObject({
      activeBorrowedCount: 2,
      activeLentCount: 3,
      loanCount: 5,
    });
  });

  it("drops a returned book from the active counts but keeps it in the lifetime count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ihor");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Still out" });
    const returnedBookId = await lendBookTo(accessToken, {
      loanContactId: contactId,
      title: "Came back",
    });
    await returnBook(accessToken, returnedBookId);

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]).toMatchObject({
      activeBorrowedCount: 0,
      activeLentCount: 1,
      loanCount: 2,
    });
  });

  it("leaves the loans of a trashed book out of the active counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ihor");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Kept" });
    const trashedBookId = await lendBookTo(accessToken, {
      loanContactId: contactId,
      title: "Trashed",
    });
    await deleteBook(accessToken, trashedBookId);

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]).toMatchObject({ activeLentCount: 1, loanCount: 1 });
  });

  it("reports zero active counts for a contact holding nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ihor");

    const res = await listContacts(accessToken);

    expect(contactItems(res)[0]).toMatchObject({
      activeBorrowedCount: 0,
      activeLentCount: 0,
      loanCount: 0,
    });
  });

  it("keeps the active counts of one contact off another", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ihorId = await createNamedContact(accessToken, "Ihor");
    const martaId = await createNamedContact(accessToken, "Marta");
    await lendBookTo(accessToken, { loanContactId: ihorId, title: "Ihor holds it" });
    await lendBookTo(accessToken, {
      direction: "borrowed",
      loanContactId: martaId,
      title: "From Marta",
    });

    const items = contactItems(await listContacts(accessToken));

    expect(items).toMatchObject([
      { activeBorrowedCount: 0, activeLentCount: 1, name: "Ihor" },
      { activeBorrowedCount: 1, activeLentCount: 0, name: "Marta" },
    ]);
  });
});

describe("POST /api/loans/contacts", () => {
  it("creates a contact and returns it with its details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      archivedAt: null,
      contact: "ihor@example.com",
      loanCount: 0,
      name: "Ігор",
    });
    expect(res.body.id).toMatch(UUID);
  });

  it("collapses the whitespace around the stored name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, { name: "  Ігор   Петренко  " });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Ігор Петренко");
  });

  it("stores an empty contact detail as no contact detail", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, { contact: "", name: "Ігор" });

    expect(res.status).toBe(201);
    expect(res.body.contact).toBeNull();
  });

  it("returns 409 with the duplicate code when the name is already taken", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ігор");

    const res = await createContact(accessToken, { name: "Ігор" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.duplicateName);
  });

  it("treats a name that only differs by surrounding whitespace as taken", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ігор");

    const res = await createContact(accessToken, { name: "  Ігор  " });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.duplicateName);
  });

  it("treats a name that only differs by case as taken", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ігор");

    const res = await createContact(accessToken, { name: "ІГОР" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.duplicateName);
  });

  it("returns 409 with the archived code when the name belongs to an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await archiveContact(await createNamedContact(accessToken, "Ігор"));

    const res = await createContact(accessToken, { name: "Ігор" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.archivedName);
  });

  it("lets two users keep a contact of the same name", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await createContact(stranger.accessToken, { name: "Ігор" });

    expect(res.status).toBe(201);
  });

  it("returns 400 with the name field when the name is empty", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, { name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("returns 400 when the name exceeds 100 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, { name: "a".repeat(101) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a field the contact does not own", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createContact(accessToken, { archivedAt: null, name: "Ігор" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/loans/contacts/:contactId", () => {
  it("renames a contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    const res = await updateContact(accessToken, contactId, { name: "Ігор Петренко" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: contactId, name: "Ігор Петренко" });
  });

  it("frees the previous name for a new contact after a rename", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await updateContact(accessToken, contactId, { name: "Тарас" });

    const res = await createContact(accessToken, { name: "Ігор" });

    expect(res.status).toBe(201);
  });

  it("blocks a rename onto a name that only differs by case from a live contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Ігор");
    const contactId = await createNamedContact(accessToken, "Тарас");

    const res = await updateContact(accessToken, contactId, { name: "ІГОР" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.duplicateName);
  });

  it("returns the archived code when the rename target belongs to an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await archiveContact(await createNamedContact(accessToken, "Ігор"));
    const contactId = await createNamedContact(accessToken, "Тарас");

    const res = await updateContact(accessToken, contactId, { name: "Ігор" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.archivedName);
  });

  it("updates the contact detail without touching the name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    const res = await updateContact(accessToken, contactId, { contact: "ihor@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ contact: "ihor@example.com", name: "Ігор" });
  });

  it("clears the contact detail when it is set to null", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await createContact(accessToken, { contact: "ihor@example.com", name: "Ігор" });
    const contactId: string = res.body.id;

    const cleared = await updateContact(accessToken, contactId, { contact: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.contact).toBeNull();
  });

  it("returns 400 for a patch that changes nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    const res = await updateContact(accessToken, contactId, {});

    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateContact(accessToken, "not-a-uuid", { name: "Ігор" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a contact id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateContact(accessToken, MISSING_CONTACT_ID, { name: "Ігор" });

    expect(res.status).toBe(404);
  });

  it("answers a contact of another user exactly like a missing one", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const foreign = await updateContact(stranger.accessToken, ownerContactId, { name: "Тарас" });
    const missing = await updateContact(stranger.accessToken, MISSING_CONTACT_ID, {
      name: "Тарас",
    });

    expect(foreign.status).toBe(missing.status);
    expect(foreign.body.message).toBe(missing.body.message);
  });

  it("leaves the contact of another user untouched", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    await updateContact(stranger.accessToken, ownerContactId, { name: "Тарас" });

    const res = await listContacts(owner.accessToken);
    expect(contactNames(res)).toEqual(["Ігор"]);
  });
});

describe("GET /api/loans/contacts/:contactId", () => {
  it("returns the contact with its details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const res = await createContact(accessToken, { contact: "ihor@example.com", name: "Ігор" });

    const detail = await getContact(accessToken, res.body.id);

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      archivedAt: null,
      contact: "ihor@example.com",
      id: expect.stringMatching(UUID),
      loanCount: 0,
      name: "Ігор",
    });
  });

  it("counts the loans the contact carries", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });

    const detail = await getContact(accessToken, contactId);

    expect(detail.body.loanCount).toBe(1);
  });

  it("returns an archived contact along with the moment it was archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContact(contactId);

    const detail = await getContact(accessToken, contactId);

    expect(detail.status).toBe(200);
    expect(detail.body.archivedAt).toEqual(expect.any(String));
  });

  it("returns 404 for a contact id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getContact(accessToken, MISSING_CONTACT_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getContact(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("answers a contact of another user exactly like a missing one", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const foreign = await getContact(stranger.accessToken, ownerContactId);
    const missing = await getContact(stranger.accessToken, MISSING_CONTACT_ID);

    expect(foreign.status).toBe(missing.status);
    expect(foreign.body.message).toBe(missing.body.message);
  });
});

describe("GET /api/loans/contacts/by-name", () => {
  it("finds the contact that holds the name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Олена");

    const res = await lookupContactByName(accessToken, "Олена");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: contactId, name: "Олена" }));
  });

  it("finds an archived contact too, because it still holds the name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Олена");
    await archiveContactRequest(accessToken, contactId);

    const res = await lookupContactByName(accessToken, "Олена");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ archivedAt: expect.any(String), id: contactId }),
    );
  });

  it("normalizes the name the same way creation does", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Олена");

    for (const name of ["  Олена  ", "олена", "ОЛЕНА", "Олена   "]) {
      const res = await lookupContactByName(accessToken, name);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(contactId);
    }
  });

  it("matches the whole name, never a fragment of it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createNamedContact(accessToken, "Оленка");

    const res = await lookupContactByName(accessToken, "Олена");

    expect(res.status).toBe(404);
  });

  it("reports the loan count of the contact it found", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Олена");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });

    const res = await lookupContactByName(accessToken, "Олена");

    expect(res.body.loanCount).toBe(1);
  });

  it("returns 404 when nobody holds the name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await lookupContactByName(accessToken, "Олена");

    expect(res.status).toBe(404);
  });

  it("returns 400 for an empty name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await lookupContactByName(accessToken, "   ");

    expect(res.status).toBe(400);
  });

  it("answers the contact of another user exactly like a missing one", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createNamedContact(owner.accessToken, "Олена");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const foreign = await lookupContactByName(stranger.accessToken, "Олена");
    const missing = await lookupContactByName(stranger.accessToken, "Тарас");

    expect(foreign.status).toBe(404);
    expect(foreign.body.message).toBe(missing.body.message);
  });
});

describe("POST /api/loans/contacts/:contactId/archive", () => {
  it("stamps the moment the contact was archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    const res = await archiveContactRequest(accessToken, contactId);

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toEqual(expect.any(String));
  });

  it("keeps the contact row instead of deleting it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    await archiveContactRequest(accessToken, contactId);

    expect(await prisma.loanContact.count({ where: { id: contactId } })).toBe(1);
  });

  it("drops the contact out of the list new loans pick from", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    await archiveContactRequest(accessToken, contactId);

    expect(contactNames(await listContacts(accessToken))).toEqual([]);
  });

  it("still lists the contact when archived ones are asked for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    await archiveContactRequest(accessToken, contactId);

    expect(contactNames(await listContacts(accessToken, "?status=all"))).toEqual(["Ігор"]);
  });

  it("leaves the active loans of the contact untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    const bookId = await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });

    await archiveContactRequest(accessToken, contactId);

    const book = await request(app.getHttpServer())
      .get(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(book.body).toMatchObject({
      loanInfo: { loanContactId: contactId, personName: "Ігор" },
      ownershipStatus: "lent_to_someone",
    });
  });

  it("keeps the completed loans of the contact in the history", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    const bookId = await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });
    await returnBook(accessToken, bookId);

    await archiveContactRequest(accessToken, contactId);

    const history = await request(app.getHttpServer())
      .get("/api/loans/history")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(history.status).toBe(200);
    expect(history.body.items).toEqual([
      expect.objectContaining({ loanContactId: contactId, personName: "Ігор" }),
    ]);
  });

  it("keeps the loan count of an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });

    const res = await archiveContactRequest(accessToken, contactId);

    expect(res.body.loanCount).toBe(1);
  });

  it("archives an already archived contact without complaining", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContactRequest(accessToken, contactId);

    const res = await archiveContactRequest(accessToken, contactId);

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toEqual(expect.any(String));
  });

  it("holds the name of an archived contact against a new one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContactRequest(accessToken, contactId);

    const res = await createContact(accessToken, { name: "Ігор" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(LOAN_CONTACT_ERROR_CODES.archivedName);
  });

  it("returns 404 for a contact id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await archiveContactRequest(accessToken, MISSING_CONTACT_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await archiveContactRequest(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("leaves the contact of another user active", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await createNamedContact(owner.accessToken, "Ігор");
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await archiveContactRequest(stranger.accessToken, ownerContactId);

    expect(res.status).toBe(404);
    expect(contactNames(await listContacts(owner.accessToken))).toEqual(["Ігор"]);
  });
});

describe("POST /api/loans/contacts/:contactId/restore", () => {
  it("clears the moment the contact was archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContactRequest(accessToken, contactId);

    const res = await restoreContactRequest(accessToken, contactId);

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeNull();
  });

  it("brings the contact back into the list new loans pick from", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContactRequest(accessToken, contactId);

    await restoreContactRequest(accessToken, contactId);

    expect(contactNames(await listContacts(accessToken))).toEqual(["Ігор"]);
  });

  it("lets a new loan point at the restored contact again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");
    await archiveContactRequest(accessToken, contactId);
    await restoreContactRequest(accessToken, contactId);

    const bookId = await lendBookTo(accessToken, { loanContactId: contactId, title: "Dune" });

    expect(bookId).toEqual(expect.stringMatching(UUID));
  });

  it("restores an active contact without complaining", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await createNamedContact(accessToken, "Ігор");

    const res = await restoreContactRequest(accessToken, contactId);

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeNull();
  });

  it("returns 404 for a contact id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await restoreContactRequest(accessToken, MISSING_CONTACT_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await restoreContactRequest(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("leaves the archived contact of another user archived", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await createNamedContact(owner.accessToken, "Ігор");
    await archiveContactRequest(owner.accessToken, ownerContactId);
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await restoreContactRequest(stranger.accessToken, ownerContactId);

    expect(res.status).toBe(404);
    expect(contactNames(await listContacts(owner.accessToken))).toEqual([]);
  });
});

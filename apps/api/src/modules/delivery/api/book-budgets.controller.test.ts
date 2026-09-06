import type { BookBudgetOverview } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { BookBudgetOverviewSchema, toBudgetMonth } from "@app/shared";
import { addMonths } from "date-fns";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  cancelBooksOfOrder,
  createBook,
  createOrder,
  deleteJson,
  getJson,
  isoDay,
  ORDER_ROUTES,
  postJson,
} from "./book-order.fixtures.js";

type StoredVersion = {
  monthlyAmount: number;
  validFromMonth: string;
  validToMonth: null | string;
};

const HTTP = { badRequest: 400, notFound: 404, ok: 200 } as const;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function currentMonth(): string {
  return toBudgetMonth(new Date());
}

function monthsFromNow(offset: number): string {
  return toIsoDate(addMonths(parseIsoDate(currentMonth()), offset));
}

async function readOverview(user: AuthenticatedUser = reader): Promise<BookBudgetOverview> {
  const res = await getJson({ accessToken: user.accessToken, app, path: ORDER_ROUTES.budgets });
  if (res.status !== HTTP.ok) {
    throw new Error(`budget read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return BookBudgetOverviewSchema.parse(res.body);
}

function saveBudgets({
  changes,
  effectiveFromMonth = currentMonth(),
  user = reader,
}: {
  changes: Record<string, unknown>[];
  effectiveFromMonth?: string;
  user?: AuthenticatedUser;
}) {
  return postJson({
    accessToken: user.accessToken,
    app,
    body: { changes, effectiveFromMonth },
    path: ORDER_ROUTES.budgetSave,
  });
}

async function seedPastVersion({
  currency = "UAH",
  monthlyAmount,
  monthsBack,
  user = reader,
}: {
  currency?: string;
  monthlyAmount: number;
  monthsBack: number;
  user?: AuthenticatedUser;
}): Promise<void> {
  await prisma.bookBudget.create({
    data: {
      currency,
      monthlyAmount,
      userId: user.userId,
      validFromMonth: parseIsoDate(monthsFromNow(-monthsBack)),
      validToMonth: null,
    },
  });
}

async function spendToday({
  amount,
  cancelled = false,
  currency = "UAH",
  title,
  user = reader,
}: {
  amount: number;
  cancelled?: boolean;
  currency?: "EUR" | "UAH" | "USD";
  title: string;
  user?: AuthenticatedUser;
}): Promise<void> {
  const authed = { accessToken: user.accessToken, app };
  const bookId = await createBook({ ...authed, title });
  const view = await createOrder({
    ...authed,
    input: {
      currency,
      items: [{ bookId, price: amount }],
      orderDate: isoDay(0),
      storeName: "Yakaboo",
    },
  });
  if (cancelled) {
    await cancelBooksOfOrder({ ...authed, bookIds: [bookId], view });
  }
}

function stopBudget({
  currency = "UAH",
  effectiveFromMonth = currentMonth(),
  user = reader,
}: {
  currency?: string;
  effectiveFromMonth?: string;
  user?: AuthenticatedUser;
} = {}) {
  return postJson({
    accessToken: user.accessToken,
    app,
    body: { effectiveFromMonth },
    path: ORDER_ROUTES.budgetStop(currency),
  });
}

function storedVersions(user: AuthenticatedUser = reader): Promise<StoredVersion[]> {
  return prisma.bookBudget
    .findMany({
      orderBy: [{ currency: "asc" }, { validFromMonth: "asc" }],
      where: { userId: user.userId },
    })
    .then((rows) =>
      rows.map((row) => ({
        monthlyAmount: row.monthlyAmount.toNumber(),
        validFromMonth: toIsoDate(row.validFromMonth),
        validToMonth: toNullableIsoDate(row.validToMonth),
      })),
    );
}

function upsertBudget({
  currency = "UAH",
  effectiveFromMonth = currentMonth(),
  monthlyAmount,
  user = reader,
}: {
  currency?: string;
  effectiveFromMonth?: string;
  monthlyAmount: number;
  user?: AuthenticatedUser;
}) {
  return postJson({
    accessToken: user.accessToken,
    app,
    body: { currency, effectiveFromMonth, monthlyAmount },
    path: ORDER_ROUTES.budgets,
  });
}

describe("GET /api/delivery/budgets", () => {
  it("returns an empty set rather than placeholder rows when nothing was ever configured", async () => {
    const overview = await readOverview();

    expect(overview).toEqual({ budgets: [], month: currentMonth() });
  });

  it("leaves a currency the reader never configured out of the answer entirely", async () => {
    await upsertBudget({ monthlyAmount: 8000 });

    const overview = await readOverview();

    expect(overview.budgets.map((budget) => budget.currency)).toEqual(["UAH"]);
  });
});

describe("POST /api/delivery/budgets", () => {
  it("opens a budget for the current month and reports this month's progress against it", async () => {
    await spendToday({ amount: 820, title: "Budget Spend" });

    const res = await upsertBudget({ monthlyAmount: 8000 });

    expect(res.status).toBe(HTTP.ok);
    const [budget] = BookBudgetOverviewSchema.parse(res.body).budgets;
    expect(budget?.currentMonth).toMatchObject({
      budget: 8000,
      remaining: 7180,
      spentToDate: 820,
      usedPercent: 10.25,
      validFromMonth: currentMonth(),
    });
    expect(budget?.upcomingChanges).toEqual([]);
  });

  it("keeps each currency on its own budget, never on a shared one", async () => {
    await spendToday({ amount: 500, title: "Budget UAH" });
    await spendToday({ amount: 30, currency: "USD", title: "Budget USD" });
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ currency: "USD", monthlyAmount: 200 });

    const overview = await readOverview();

    expect(
      overview.budgets.map((budget) => ({
        budget: budget.currentMonth?.budget,
        currency: budget.currency,
        spentToDate: budget.currentMonth?.spentToDate,
      })),
    ).toEqual([
      { budget: 8000, currency: "UAH", spentToDate: 500 },
      { budget: 200, currency: "USD", spentToDate: 30 },
    ]);
  });

  it("counts nothing a cancelled order committed towards the month's spend", async () => {
    await spendToday({ amount: 400, title: "Budget Live" });
    await spendToday({ amount: 900, cancelled: true, title: "Budget Void" });

    const res = await upsertBudget({ monthlyAmount: 5000 });

    expect(BookBudgetOverviewSchema.parse(res.body).budgets[0]?.currentMonth?.spentToDate).toBe(
      400,
    );
  });

  it("refuses a month that has already gone by instead of rewriting history", async () => {
    const res = await upsertBudget({ effectiveFromMonth: monthsFromNow(-1), monthlyAmount: 8000 });

    expect(res.status).toBe(HTTP.badRequest);
    await expect(storedVersions()).resolves.toEqual([]);
  });

  it("schedules a future version and leaves the current month running on the old amount", async () => {
    await upsertBudget({ monthlyAmount: 8000 });

    const res = await upsertBudget({ effectiveFromMonth: monthsFromNow(2), monthlyAmount: 12000 });

    const [budget] = BookBudgetOverviewSchema.parse(res.body).budgets;
    expect(budget?.currentMonth?.budget).toBe(8000);
    expect(budget?.upcomingChanges).toEqual([
      { effectiveFromMonth: monthsFromNow(2), kind: "change", monthlyAmount: 12000 },
    ]);
  });

  it("closes the preceding version exactly where the new one begins", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(2), monthlyAmount: 12000 });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: monthsFromNow(2) },
      { monthlyAmount: 12000, validFromMonth: monthsFromNow(2), validToMonth: null },
    ]);
  });

  it("changes the amount in place when the same month is written twice", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ monthlyAmount: 9500 });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 9500, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("leaves a version of a month already past untouched apart from closing it", async () => {
    await seedPastVersion({ monthlyAmount: 4000, monthsBack: 3 });

    await upsertBudget({ monthlyAmount: 8000 });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 4000, validFromMonth: monthsFromNow(-3), validToMonth: currentMonth() },
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("slots a version between two existing ones without leaving a gap", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(3), monthlyAmount: 12000 });

    await upsertBudget({ effectiveFromMonth: monthsFromNow(1), monthlyAmount: 10000 });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: monthsFromNow(1) },
      { monthlyAmount: 10000, validFromMonth: monthsFromNow(1), validToMonth: monthsFromNow(3) },
      { monthlyAmount: 12000, validFromMonth: monthsFromNow(3), validToMonth: null },
    ]);
  });
});

describe("DELETE /api/delivery/budgets/:currency/scheduled", () => {
  it("drops the scheduled version and hands the open end back to the current one", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(2), monthlyAmount: 12000 });

    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduled("UAH"),
    });

    expect(res.status).toBe(HTTP.ok);
    expect(BookBudgetOverviewSchema.parse(res.body).budgets[0]?.upcomingChanges).toEqual([]);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("hands the freed months to the next scheduled version rather than to the open end", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(1), monthlyAmount: 10000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(3), monthlyAmount: 12000 });

    await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduled("UAH"),
    });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: monthsFromNow(3) },
      { monthlyAmount: 12000, validFromMonth: monthsFromNow(3), validToMonth: null },
    ]);
  });

  it("refuses to reach past the schedule and delete the month already running", async () => {
    await upsertBudget({ monthlyAmount: 8000 });

    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduled("UAH"),
    });

    expect(res.status).toBe(HTTP.notFound);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("rejects a currency that is not a currency at all", async () => {
    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduled("BTC"),
    });

    expect(res.status).toBe(HTTP.badRequest);
  });
});

describe("POST /api/delivery/budgets/:currency/stop", () => {
  it("takes the currency out of the answer once its budget stops this month", async () => {
    await upsertBudget({ monthlyAmount: 8000 });

    const res = await stopBudget();

    expect(res.status).toBe(HTTP.ok);
    expect(BookBudgetOverviewSchema.parse(res.body).budgets).toEqual([]);
    await expect(storedVersions()).resolves.toEqual([]);
  });

  it("keeps the months already budgeted and closes the run at the chosen month", async () => {
    await seedPastVersion({ monthlyAmount: 8000, monthsBack: 3 });

    const res = await stopBudget({ effectiveFromMonth: monthsFromNow(1) });

    expect(res.status).toBe(HTTP.ok);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: monthsFromNow(-3), validToMonth: monthsFromNow(1) },
    ]);
    expect(BookBudgetOverviewSchema.parse(res.body).budgets[0]?.currentMonth).toMatchObject({
      budget: 8000,
      validToMonth: monthsFromNow(1),
    });
  });

  it("stops one currency and leaves the others running", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ currency: "USD", monthlyAmount: 80 });

    const res = await stopBudget({ currency: "USD" });

    expect(res.status).toBe(HTTP.ok);
    expect(BookBudgetOverviewSchema.parse(res.body).budgets.map((entry) => entry.currency)).toEqual(
      ["UAH"],
    );
  });

  it("leaves a version scheduled after the stop month in place", async () => {
    await upsertBudget({ monthlyAmount: 8000 });
    await upsertBudget({ effectiveFromMonth: monthsFromNow(2), monthlyAmount: 12000 });

    await stopBudget({ effectiveFromMonth: monthsFromNow(1) });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: monthsFromNow(1) },
      { monthlyAmount: 12000, validFromMonth: monthsFromNow(2), validToMonth: null },
    ]);
  });

  it("refuses to stop a month that has already gone by", async () => {
    await seedPastVersion({ monthlyAmount: 8000, monthsBack: 3 });

    const res = await stopBudget({ effectiveFromMonth: monthsFromNow(-1) });

    expect(res.status).toBe(HTTP.badRequest);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: monthsFromNow(-3), validToMonth: null },
    ]);
  });

  it("says there is nothing to stop when the currency has no budget that month", async () => {
    await upsertBudget({ monthlyAmount: 8000 });

    const res = await stopBudget({ currency: "USD" });

    expect(res.status).toBe(HTTP.notFound);
  });

  it("rejects a currency that is not a currency at all", async () => {
    const res = await stopBudget({ currency: "BTC" });

    expect(res.status).toBe(HTTP.badRequest);
  });
});

describe("book budgets across readers", () => {
  it("shows one reader nothing of another reader's budget", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await upsertBudget({ monthlyAmount: 8000, user: stranger });

    await expect(readOverview()).resolves.toEqual({ budgets: [], month: currentMonth() });
  });

  it("writes a second reader's budget as a row of their own, overwriting nothing", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await upsertBudget({ monthlyAmount: 8000, user: stranger });

    await upsertBudget({ monthlyAmount: 3000 });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 3000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
    await expect(storedVersions(stranger)).resolves.toEqual([
      { monthlyAmount: 8000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("keeps one reader's spend out of another reader's progress", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await spendToday({ amount: 900, title: "Their Spend", user: stranger });
    await spendToday({ amount: 100, title: "My Spend" });

    const res = await upsertBudget({ monthlyAmount: 5000 });

    expect(BookBudgetOverviewSchema.parse(res.body).budgets[0]?.currentMonth?.spentToDate).toBe(
      100,
    );
  });

  it("cannot cancel a scheduled version that belongs to someone else", async () => {
    const stranger = await context.registerVerifyAndLogin();
    await upsertBudget({ monthlyAmount: 8000, user: stranger });
    await upsertBudget({
      effectiveFromMonth: monthsFromNow(2),
      monthlyAmount: 12000,
      user: stranger,
    });

    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduled("UAH"),
    });

    expect(res.status).toBe(HTTP.notFound);
    await expect(storedVersions(stranger)).resolves.toHaveLength(2);
  });
});

describe("POST /api/delivery/budgets/save", () => {
  it("writes every currency of one dialog save in a single call", async () => {
    const res = await saveBudgets({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 25000 },
        { action: "set", currency: "EUR", monthlyAmount: 60 },
      ],
    });

    expect(res.status).toBe(HTTP.ok);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 60, validFromMonth: currentMonth(), validToMonth: null },
      { monthlyAmount: 25000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("sets one currency and stops another in the same write", async () => {
    await upsertBudget({ currency: "EUR", monthlyAmount: 60 });

    await saveBudgets({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 9000 },
        { action: "stop", currency: "EUR" },
      ],
    });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 9000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("leaves a currency the dialog never touched exactly as it was", async () => {
    await upsertBudget({ currency: "USD", monthlyAmount: 80 });

    await saveBudgets({ changes: [{ action: "set", currency: "UAH", monthlyAmount: 9000 }] });

    const overview = await readOverview();
    expect(overview.budgets.find((entry) => entry.currency === "USD")?.currentMonth?.budget).toBe(
      80,
    );
  });

  it("writes nothing at all when one currency of the save is invalid", async () => {
    const res = await saveBudgets({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 9000 },
        { action: "stop", currency: "EUR" },
      ],
    });

    expect(res.status).toBe(HTTP.notFound);
    await expect(storedVersions()).resolves.toEqual([]);
  });

  it("refuses two changes for the same currency instead of picking one", async () => {
    const res = await saveBudgets({
      changes: [
        { action: "set", currency: "UAH", monthlyAmount: 9000 },
        { action: "set", currency: "UAH", monthlyAmount: 1000 },
      ],
    });

    expect(res.status).toBe(HTTP.badRequest);
  });

  it("creates no version for a change that does not change the amount", async () => {
    await upsertBudget({ monthlyAmount: 25000 });

    await saveBudgets({
      changes: [{ action: "set", currency: "UAH", monthlyAmount: 25000 }],
      effectiveFromMonth: monthsFromNow(2),
    });

    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 25000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("schedules the whole save from a future month without touching this one", async () => {
    await upsertBudget({ monthlyAmount: 25000 });

    await saveBudgets({
      changes: [{ action: "set", currency: "UAH", monthlyAmount: 30000 }],
      effectiveFromMonth: monthsFromNow(1),
    });

    const overview = await readOverview();
    expect({
      current: overview.budgets[0]?.currentMonth?.budget,
      upcoming: overview.budgets[0]?.upcomingChanges,
    }).toEqual({
      current: 25000,
      upcoming: [{ effectiveFromMonth: monthsFromNow(1), kind: "change", monthlyAmount: 30000 }],
    });
  });
});

describe("DELETE /api/delivery/budgets/:currency/scheduled-stop", () => {
  it("lets a budget keep running after its scheduled stop is cancelled", async () => {
    await upsertBudget({ monthlyAmount: 25000 });
    await stopBudget({ effectiveFromMonth: monthsFromNow(2) });

    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduledStop("UAH"),
    });

    expect(res.status).toBe(HTTP.ok);
    await expect(storedVersions()).resolves.toEqual([
      { monthlyAmount: 25000, validFromMonth: currentMonth(), validToMonth: null },
    ]);
  });

  it("reports a scheduled stop among the upcoming changes before it is cancelled", async () => {
    await upsertBudget({ monthlyAmount: 25000 });
    await stopBudget({ effectiveFromMonth: monthsFromNow(2) });

    const overview = await readOverview();

    expect(overview.budgets[0]?.upcomingChanges).toEqual([
      { effectiveFromMonth: monthsFromNow(2), kind: "stop", monthlyAmount: null },
    ]);
  });

  it("refuses to cancel a stop that was never scheduled", async () => {
    await upsertBudget({ monthlyAmount: 25000 });

    const res = await deleteJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.budgetScheduledStop("UAH"),
    });

    expect(res.status).toBe(HTTP.notFound);
  });
});

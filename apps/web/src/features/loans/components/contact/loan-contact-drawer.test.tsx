import "@testing-library/jest-dom/vitest";

import type {
  BookView,
  LoanContactView,
  LoanHistoryListItemView,
  LoanHistoryOverviewView,
  LoanHistoryResult,
  LoanListItemView,
  LoanType,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LoanContactDrawer } from "./loan-contact-drawer";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

const copy = messages.loans.contactDrawer;

type FetchCall = { init?: RequestInit; url: string };

type MockOptions = {
  archiveStatus?: number;
  borrowed?: LoanListItemView[];
  candidateBooks?: BookView[];
  contact?: Partial<LoanContactView>;
  contactStatus?: number;
  history?: LoanHistoryListItemView[];
  lent?: LoanListItemView[];
  overview?: Partial<LoanHistoryOverviewView["summary"]>;
  totalCounts?: { borrowed?: number; lent?: number };
  updateConflictCode?: string;
};

const calls: FetchCall[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  calls.length = 0;
});

describe("LoanContactDrawer", () => {
  it("tells the reader it is loading before the contact arrives", () => {
    mockApi({ contactStatus: 0 });

    renderDrawer();

    expect(screen.getByText(copy.loading)).toBeInTheDocument();
  });

  it("offers a retry when the contact fails to load", async () => {
    mockApi({ contactStatus: 500 });

    renderDrawer();

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.error);
    expect(screen.getByRole("button", { name: copy.retry })).toBeInTheDocument();
  });

  it("shows the name, the way to reach the person and how many loans they had", async () => {
    mockApi({ contact: { contact: "ihor@example.com", loanCount: 4, name: "Ігор" } });

    renderDrawer();

    expect(await screen.findByRole("heading", { name: "Ігор" })).toBeInTheDocument();
    expect(screen.getByText("ihor@example.com")).toBeInTheDocument();
    expect(screen.getByText("4 позики усього")).toBeInTheDocument();
    expect(screen.queryByText(copy.archivedBadge)).not.toBeInTheDocument();
  });

  it("splits the active loans into what the person holds and what is owed to them", async () => {
    mockApi({
      borrowed: [loanItem("borrowed_from_someone", "Дюна")],
      lent: [loanItem("lent_to_someone", "Гобіт")],
    });

    renderDrawer();

    const lent = await findSection(copy.active.lent.title);
    expect(await within(lent).findByText("Гобіт")).toBeInTheDocument();
    expect(within(lent).queryByText("Дюна")).not.toBeInTheDocument();

    const borrowed = await findSection(copy.active.borrowed.title);
    expect(await within(borrowed).findByText("Дюна")).toBeInTheDocument();

    expect(listUrl("lent_to_someone")).toContain(`contactId=${CONTACT_ID}`);
    expect(listUrl("lent_to_someone")).toContain("pageSize=3");
    expect(listUrl("borrowed_from_someone")).toContain(`contactId=${CONTACT_ID}`);
  });

  it("says so when the person holds nothing of yours", async () => {
    mockApi();

    renderDrawer();

    const lent = await findSection(copy.active.lent.title);
    expect(await within(lent).findByText(copy.active.lent.empty)).toBeInTheDocument();
  });

  it("sends the reader to the loans page filtered by this person when there are more books", async () => {
    mockApi({
      lent: [loanItem("lent_to_someone", "Гобіт")],
      totalCounts: { lent: 7 },
    });

    const lent = await findSection(copy.active.lent.title, renderDrawer);
    const viewAll = await within(lent).findByRole("link", { name: copy.active.viewAll });

    expect(viewAll).toHaveAttribute("href", `/loans/lent?contactId=${CONTACT_ID}`);
  });

  it("hides the view-all link while the preview already shows everything", async () => {
    mockApi({ lent: [loanItem("lent_to_someone", "Гобіт")], totalCounts: { lent: 1 } });

    const lent = await findSection(copy.active.lent.title, renderDrawer);
    await within(lent).findByText("Гобіт");

    expect(within(lent).queryByRole("link", { name: copy.active.viewAll })).not.toBeInTheDocument();
  });

  it("sums the completed loans into one readable summary", async () => {
    mockApi({
      history: [historyItem("Гобіт")],
      overview: {
        averageDurationDays: 29,
        borrowedCount: 3,
        lateCount: 2,
        lentCount: 5,
        onTimeCount: 6,
        totalCompleted: 8,
      },
    });

    const history = await findSection(copy.history.title, renderDrawer);

    expect(await within(history).findByText("8 завершених позик")).toBeInTheDocument();
    expect(within(history).queryByText(/Контакт:/)).not.toBeInTheDocument();
    expect(within(history).getByText("5 ви передавали · 3 брали")).toBeInTheDocument();
    expect(within(history).getByText("6 вчасно")).toBeInTheDocument();
    expect(within(history).getByText("2 із запізненням")).toBeInTheDocument();
    expect(within(history).queryByText(/без строку/)).not.toBeInTheDocument();
    expect(within(history).getByText(copy.history.averageDurationLabel)).toBeInTheDocument();
    expect(within(history).getByText("29 днів")).toBeInTheDocument();
    expect(historyUrl()).toContain(`contactId=${CONTACT_ID}`);
  });

  it("keeps the result breakdown adding up when a loan had no due date", async () => {
    mockApi({
      overview: {
        borrowedCount: 3,
        lateCount: 2,
        lentCount: 5,
        noDueDateCount: 1,
        onTimeCount: 5,
        totalCompleted: 8,
      },
    });

    const history = await findSection(copy.history.title, renderDrawer);

    expect(await within(history).findByText("8 завершених позик")).toBeInTheDocument();
    expect(within(history).getByText("5 вчасно")).toBeInTheDocument();
    expect(within(history).getByText("2 із запізненням")).toBeInTheDocument();
    expect(within(history).getByText("1 без строку")).toBeInTheDocument();
  });

  it("drops the average length when no completed loan can be measured", async () => {
    mockApi({ overview: { lentCount: 1, onTimeCount: 1, totalCompleted: 1 } });

    const history = await findSection(copy.history.title, renderDrawer);

    expect(await within(history).findByText("1 завершена позика")).toBeInTheDocument();
    expect(within(history).getByText("1 ви передавали")).toBeInTheDocument();
    expect(within(history).queryByText(copy.history.averageDurationLabel)).not.toBeInTheDocument();
  });

  it("spells out how each of the last loans ended", async () => {
    mockApi({
      history: [
        historyItem("Місто", { delayDays: 18, result: "late" }),
        historyItem("Записки", { result: "on_time", type: "borrowed_from_someone" }),
        historyItem("Гобіт", { result: "no_due_date", type: "borrowed_from_someone" }),
      ],
      overview: { borrowedCount: 2, lateCount: 1, lentCount: 1, onTimeCount: 2, totalCompleted: 3 },
    });

    const history = await findSection(copy.history.title, renderDrawer);

    expect(
      await within(history).findByText("Ви передавали · повернено із запізненням на 18 днів"),
    ).toBeInTheDocument();
    expect(within(history).getByText("Ви брали · повернено 3 лют.")).toBeInTheDocument();
    expect(within(history).getByText("Ви брали · без визначеного строку")).toBeInTheDocument();
  });

  it("sends the reader to the full history of this contact", async () => {
    mockApi({ overview: { lentCount: 4, onTimeCount: 4, totalCompleted: 4 } });

    const history = await findSection(copy.history.title, renderDrawer);

    const link = await within(history).findByRole("link", { name: copy.history.viewAll });
    expect(link).toHaveAttribute("href", `/loans/history?contactId=${CONTACT_ID}`);
  });

  it("keeps the history block short when nothing was ever returned", async () => {
    mockApi();

    const history = await findSection(copy.history.title, renderDrawer);

    expect(await within(history).findByText(copy.history.empty.title)).toBeInTheDocument();
    expect(within(history).getByText(copy.history.empty.description)).toBeInTheDocument();
    expect(within(history).queryByText(/завершен/)).not.toBeInTheDocument();
    expect(
      within(history).queryByRole("link", { name: copy.history.viewAll }),
    ).not.toBeInTheDocument();
  });

  it("saves a new name and contact through the contact endpoint", async () => {
    mockApi({ contact: { name: "Ігор" } });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.edit }));

    const name = await screen.findByLabelText(copy.edit.name);
    await userEvent.clear(name);
    await userEvent.type(name, "Ігор Петренко");
    await userEvent.type(screen.getByLabelText(new RegExp(copy.edit.contact)), "+380001112233");
    await userEvent.click(screen.getByRole("button", { name: copy.edit.submit }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateCall()?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(updateCall()?.init?.body))).toEqual({
      contact: "+380001112233",
      name: "Ігор Петренко",
    });
  });

  it("blames the name field when another contact already uses it", async () => {
    mockApi({ updateConflictCode: "LOAN_CONTACT_DUPLICATE_NAME" });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.edit }));

    const name = await screen.findByLabelText(copy.edit.name);
    await userEvent.clear(name);
    await userEvent.type(name, "Оля");
    await userEvent.click(screen.getByRole("button", { name: copy.edit.submit }));

    expect(await screen.findByText(copy.edit.errors.duplicateName)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.edit.name)).toBeInTheDocument();
  });

  it("names the archived contact in the conflict when the name is taken by one", async () => {
    mockApi({ updateConflictCode: "LOAN_CONTACT_ARCHIVED_NAME" });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.edit }));

    const name = await screen.findByLabelText(copy.edit.name);
    await userEvent.clear(name);
    await userEvent.type(name, "Оля");
    await userEvent.click(screen.getByRole("button", { name: copy.edit.submit }));

    expect(await screen.findByText(copy.edit.errors.archivedName)).toBeInTheDocument();
  });

  it("asks before archiving and keeps the drawer on the archived contact", async () => {
    mockApi({ contact: { name: "Ігор" } });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.archive }));

    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(copy.archive.description)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: copy.archive.confirm }));

    await waitFor(() => expect(archiveCall()).toBeDefined());
    expect(archiveCall()?.init?.method).toBe("POST");
    expect(await screen.findByText(copy.archivedBadge)).toBeInTheDocument();
  });

  it("marks an archived contact and offers restore instead of archive", async () => {
    mockApi({ contact: { archivedAt: "2026-08-01T10:00:00.000Z" } });

    renderDrawer();

    expect(await screen.findByText(copy.archivedBadge)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.actions.restore })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.actions.archive })).not.toBeInTheDocument();
  });

  it("offers lending and borrowing straight from an active contact", async () => {
    mockApi();

    renderDrawer();

    expect(await screen.findByRole("button", { name: copy.actions.lend })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.actions.borrow })).toBeInTheDocument();
  });

  it("withholds both loan actions while the contact is archived", async () => {
    mockApi({ contact: { archivedAt: "2026-08-01T10:00:00.000Z" } });

    renderDrawer();

    await screen.findByText(copy.archivedBadge);
    expect(screen.queryByRole("button", { name: copy.actions.lend })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.actions.borrow })).not.toBeInTheDocument();
  });

  it("brings the loan actions back once the contact is restored", async () => {
    mockApi({ contact: { archivedAt: "2026-08-01T10:00:00.000Z" } });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.restore }));

    expect(await screen.findByRole("button", { name: copy.actions.lend })).toBeInTheDocument();
  });

  it("starts the lending flow on the book picker without losing the drawer", async () => {
    mockApi();

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.lend }));

    const bookStep = messages.books.details.loan.bookStep;
    expect(
      await screen.findByRole("heading", { name: bookStep.lent.multiTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { hidden: true, name: copy.active.lent.title }),
    ).toBeInTheDocument();
  });

  it("restores an archived contact without asking", async () => {
    mockApi({ contact: { archivedAt: "2026-08-01T10:00:00.000Z" } });

    renderDrawer();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.restore }));

    await waitFor(() => expect(restoreCall()).toBeDefined());
    expect(restoreCall()?.init?.method).toBe("POST");
    await waitFor(() => expect(screen.queryByText(copy.archivedBadge)).not.toBeInTheDocument());
  });
});

function archiveCall(): FetchCall | undefined {
  return calls.find((call) => call.url.includes("/archive"));
}

function bookPreview(title: string) {
  return {
    cover: null,
    firstAuthorName: "Дж. Р. Р. Толкін",
    id: `book-${title}`,
    originalTitle: null,
    ownershipStatus: "owned" as const,
    publisher: null,
    title,
  };
}

function contactView(overrides: Partial<LoanContactView> = {}): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    id: CONTACT_ID,
    loanCount: 0,
    name: "Оля",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function emptyOverview(): LoanHistoryOverviewView {
  return {
    duration: { averageDays: null, longestDays: null, shortestDays: null },
    reliability: { lateCount: 0, noDueDateCount: 0, onTimeCount: 0, onTimePercent: null },
    summary: overviewSummary(),
    topPeople: [],
  };
}

async function findSection(title: string, render?: () => void): Promise<HTMLElement> {
  render?.();
  const heading = await screen.findByRole("heading", { name: title });
  const section = heading.closest("section");
  if (section === null) throw new Error(`no section around "${title}"`);
  return section;
}

function historyItem(
  title: string,
  {
    delayDays = null,
    result = "on_time",
    type = "lent_to_someone",
  }: {
    delayDays?: Nullable<number>;
    result?: LoanHistoryResult;
    type?: LoanType;
  } = {},
): LoanHistoryListItemView {
  return {
    book: bookPreview(title),
    delayDays,
    durationDays: 12,
    expectedReturnDate: result === "no_due_date" ? null : "2026-02-01",
    historyResult: result,
    id: `history-${title}`,
    loanContactId: CONTACT_ID,
    loanDate: "2026-01-05",
    personName: "Оля",
    returnedAt: "2026-02-03T10:00:00.000Z",
    returnedDate: "2026-02-03",
    type,
  };
}

function historyUrl(): string {
  const found = calls.find(
    (call) => call.url.includes("/api/loans/history") && !call.url.includes("/overview"),
  );
  if (found === undefined) throw new Error("the contact history was never requested");
  return found.url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listUrl(type: LoanType): string {
  const found = calls.find(
    (call) => call.url.startsWith("/api/loans?") && call.url.includes(`type=${type}`),
  );
  if (found === undefined) throw new Error(`the ${type} preview was never requested`);
  return found.url;
}

function loanItem(type: LoanType, title: string): LoanListItemView {
  return {
    book: bookPreview(title),
    contact: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    expectedReturnDate: "2026-02-01",
    id: `loan-${title}`,
    loanContactId: CONTACT_ID,
    loanDate: "2026-01-05",
    loanUiStatus: "on_time",
    note: null,
    personName: "Оля",
    remindBeforeDays: null,
    remindToReturn: false,
    type,
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

function mockApi(options: MockOptions = {}) {
  const summary = overviewSummary(options.overview);
  let contact = contactView(options.contact);

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ init, url });

      if (url.includes("/archive")) {
        contact = { ...contact, archivedAt: "2026-08-21T10:00:00.000Z" };
        return Promise.resolve(jsonResponse(contact));
      }
      if (url.includes("/restore")) {
        contact = { ...contact, archivedAt: null };
        return Promise.resolve(jsonResponse(contact));
      }
      if (url.includes("/api/loans/contacts/")) {
        if (init?.method === "PATCH") {
          if (options.updateConflictCode !== undefined) {
            return Promise.resolve(
              jsonResponse({ code: options.updateConflictCode, message: "taken" }, 409),
            );
          }
          return Promise.resolve(jsonResponse(contact));
        }
        if (options.contactStatus === 0) return new Promise<Response>(() => {});
        if (options.contactStatus !== undefined) {
          return Promise.resolve(jsonResponse({ message: "boom" }, options.contactStatus));
        }
        return Promise.resolve(jsonResponse(contact));
      }
      if (url.includes("/api/loans/history/overview")) {
        return Promise.resolve(jsonResponse({ ...emptyOverview(), summary }));
      }
      if (url.includes("/api/loans/history")) {
        const history = options.history ?? [];
        return Promise.resolve(
          jsonResponse({
            ...page(history),
            resultCounts: { all: history.length, late: 0, no_due_date: 0, on_time: history.length },
          }),
        );
      }
      if (url.startsWith("/api/books?")) {
        return Promise.resolve(jsonResponse(page(options.candidateBooks ?? [])));
      }
      if (url.startsWith("/api/loans?")) {
        const isLent = url.includes("type=lent_to_someone");
        const items = (isLent ? options.lent : options.borrowed) ?? [];
        const totalCount = isLent ? options.totalCounts?.lent : options.totalCounts?.borrowed;
        return Promise.resolve(jsonResponse(page(items, totalCount)));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function overviewSummary(
  overrides: Partial<LoanHistoryOverviewView["summary"]> = {},
): LoanHistoryOverviewView["summary"] {
  return {
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
    ...overrides,
  };
}

function page<T>(items: T[], totalCount = items.length) {
  return { items, page: 1, pagesCount: 1, pageSize: 3, totalCount };
}

function renderDrawer() {
  renderWithProviders(<LoanContactDrawer contactId={CONTACT_ID} onOpenChange={vi.fn()} open />);
}

function restoreCall(): FetchCall | undefined {
  return calls.find((call) => call.url.includes("/restore"));
}

function updateCall(): FetchCall | undefined {
  return calls.find((call) => call.init?.method === "PATCH");
}

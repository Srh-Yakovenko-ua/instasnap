import "@testing-library/jest-dom/vitest";

import type { LoanContactListItemView } from "@app/shared";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LoanContactsView } from "./loan-contacts-view";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.loans.contactsPage;

const CONTACT_IDS = {
  ihor: "11111111-1111-4111-8111-111111111111",
  marta: "22222222-2222-4222-8222-222222222222",
  olha: "33333333-3333-4333-8333-333333333333",
} as const;

const COUNTS = { active: 2, all: 3, archived: 1 } as const;

type ContactsStub = {
  counts?: { active: number; all: number; archived: number };
  items: LoanContactListItemView[];
  pagesCount?: number;
  totalCount?: number;
};

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoanContactsView", () => {
  it("lists the contacts with their contact detail and loan count", async () => {
    renderView();

    expect(await screen.findByText("Ігор")).toBeInTheDocument();
    expect(screen.getByText("ihor@example.com")).toBeInTheDocument();
    expect(screen.getByText("3 позики")).toBeInTheDocument();
  });

  it("marks an archived contact as archived", async () => {
    renderView();

    const archived = await screen.findByRole("button", {
      name: messages.loans.contactDrawer.openContact.replace("{name}", "Марта"),
    });
    expect(within(archived).getByText(messages.loans.contactDrawer.archivedBadge)).toBeVisible();
  });

  it("asks the backend for the unarchived contacts by default", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");

    expect(lastListUrl(fetchMock)).toContain("status=active");
  });

  it("keeps the archived state out of the toolbar", async () => {
    renderView();

    await screen.findByText("Ігор");

    expect(
      screen.queryByRole("radio", { name: new RegExp(`^${copy.filters.statusOptions.archived}`) }),
    ).not.toBeInTheDocument();
  });

  it("shows the backend counts inside the filters sheet", async () => {
    renderView();

    await screen.findByText("Ігор");
    await openFilters();

    for (const [status, count] of [
      [copy.filters.statusOptions.active, COUNTS.active],
      [copy.filters.statusOptions.archived, COUNTS.archived],
      [copy.filters.statusOptions.all, COUNTS.all],
    ] as const) {
      const chip = screen.getByRole("radio", { name: new RegExp(`^${status}`) });
      expect(within(chip).getByText(String(count))).toBeInTheDocument();
    }
  });

  it("asks the backend for the archived contacts once the filter is applied", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");
    await applyStatusFilter(copy.filters.statusOptions.archived);

    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("status=archived"));
    expect(await screen.findByText(copy.filters.statusOptions.archived)).toBeInTheDocument();
  });

  it("leaves the list alone until the filter is applied", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");
    await openFilters();
    await userEvent.click(
      screen.getByRole("radio", { name: new RegExp(`^${copy.filters.statusOptions.all}`) }),
    );

    expect(lastListUrl(fetchMock)).toContain("status=active");
  });

  it("returns to the unarchived contacts when the status chip is removed", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");
    await applyStatusFilter(copy.filters.statusOptions.archived);
    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("status=archived"));

    await userEvent.click(
      screen.getByRole("button", {
        name: messages.books.library.activeFilters.remove.replace(
          "{label}",
          copy.filters.statusOptions.archived,
        ),
      }),
    );

    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("status=active"));
  });

  it("clears the search and the status filter together", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");
    await applyStatusFilter(copy.filters.statusOptions.archived);
    await userEvent.type(screen.getByLabelText(copy.toolbar.searchLabel), "Оль");
    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("search="));

    await userEvent.click(
      screen.getByRole("button", { name: messages.books.library.activeFilters.clearAll }),
    );

    await waitFor(() => {
      const url = lastListUrl(fetchMock);
      expect(url).toContain("status=active");
      expect(url).not.toContain("search=");
    });
  });

  it("sends the search term to the backend", async () => {
    const { fetchMock } = renderView();

    await screen.findByText("Ігор");
    await userEvent.type(screen.getByLabelText(copy.toolbar.searchLabel), "Оль");

    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("search=%D0%9E%D0%BB%D1%8C"));
  });

  it("keeps the counts while the page moves on", async () => {
    const { fetchMock } = renderView({ pagesCount: 2, totalCount: 4 });

    await userEvent.click(await screen.findByRole("button", { name: copy.loadMore }));

    await waitFor(() => expect(lastListUrl(fetchMock)).toContain("pageNumber=2"));
    await openFilters();
    const chip = screen.getByRole("radio", {
      name: new RegExp(`^${copy.filters.statusOptions.all}`),
    });
    expect(within(chip).getByText(String(COUNTS.all))).toBeInTheDocument();
  });

  it("opens the contact drawer from a row", async () => {
    renderView();

    await userEvent.click(await screen.findByText("Ігор"));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Ігор" })).toBeInTheDocument();
  });

  it("creates a contact from the page header", async () => {
    const { fetchMock } = renderView();

    await userEvent.click(screen.getByRole("button", { name: copy.create.cta }));
    await userEvent.type(
      await screen.findByLabelText(messages.loans.contactCreate.name),
      "Соломія",
    );
    await userEvent.click(
      screen.getByRole("button", { name: messages.loans.contactCreate.submit }),
    );

    await waitFor(() => expect(createCall(fetchMock)).toBeDefined());
    expect(JSON.parse(String(createCall(fetchMock)?.[1]?.body))).toEqual({
      contact: null,
      name: "Соломія",
    });
  });

  it("opens the existing contact when the typed name is already taken", async () => {
    const { fetchMock } = renderView();
    fetchMock.mockImplementation(respondWith({ conflict: "LOAN_CONTACT_DUPLICATE_NAME" }));

    await userEvent.click(screen.getByRole("button", { name: copy.create.cta }));
    await userEvent.type(await screen.findByLabelText(messages.loans.contactCreate.name), "Ігор");
    await userEvent.click(
      screen.getByRole("button", { name: messages.loans.contactCreate.submit }),
    );

    expect(await screen.findByText("Контакт «Ігор» вже існує")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: messages.loans.contactCreate.conflict.open }),
    );

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Ігор" })).toBeInTheDocument();
  });

  it("tells the reader nothing matched the query", async () => {
    renderView({ counts: { active: 0, all: 0, archived: 0 }, items: [], totalCount: 0 });

    await userEvent.type(screen.getByLabelText(copy.toolbar.searchLabel), "Хтось");

    expect(await screen.findByText(copy.states.noResults.title)).toBeInTheDocument();
  });
});

function applyStatusFilter(label: string) {
  return openFilters()
    .then(() => userEvent.click(screen.getByRole("radio", { name: new RegExp(`^${label}`) })))
    .then(() => userEvent.click(screen.getByRole("button", { name: copy.filters.apply })));
}

function contactView(overrides: Partial<LoanContactListItemView> = {}): LoanContactListItemView {
  return {
    activeBorrowedCount: 0,
    activeLentCount: 0,
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_IDS.ihor,
    loanCount: 0,
    name: "Ігор",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function createCall(fetchMock: FetchMock) {
  return fetchMock.mock.calls.find(
    (call) =>
      String(call[0]).endsWith("/api/loans/contacts") &&
      (call[1]?.method ?? "GET").toUpperCase() === "POST",
  );
}

function defaultContacts(): LoanContactListItemView[] {
  return [
    contactView({ contact: "ihor@example.com", loanCount: 3, name: "Ігор" }),
    contactView({
      archivedAt: "2026-02-01T10:00:00.000Z",
      id: CONTACT_IDS.marta,
      loanCount: 1,
      name: "Марта",
    }),
    contactView({ id: CONTACT_IDS.olha, loanCount: 0, name: "Ольга" }),
  ];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastListUrl(fetchMock: FetchMock): string {
  const calls = fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("/api/loans/contacts?"),
  );
  return String(calls.at(-1)?.[0] ?? "");
}

function openFilters() {
  return userEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${copy.filters.trigger}`) }),
  );
}

function renderView(stub: Partial<ContactsStub> = {}) {
  const fetchMock: FetchMock = vi.fn(respondWith({ stub }));
  vi.stubGlobal("fetch", fetchMock);

  renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <LoanContactsView />
    </NuqsTestingAdapter>,
  );

  return { fetchMock };
}

function respondWith({ conflict, stub = {} }: { conflict?: string; stub?: Partial<ContactsStub> }) {
  const items = stub.items ?? defaultContacts();
  const counts = stub.counts ?? COUNTS;

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/loans/contacts/by-name")) {
      return Promise.resolve(
        jsonResponse(contactView({ contact: "ihor@example.com", loanCount: 3, name: "Ігор" })),
      );
    }
    if (url.endsWith("/api/loans/contacts") && method === "POST") {
      return Promise.resolve(
        conflict === undefined
          ? jsonResponse(contactView({ id: CONTACT_IDS.olha, name: "Соломія" }), 201)
          : jsonResponse({ code: conflict, message: "taken" }, 409),
      );
    }
    if (url.includes("/api/loans/contacts?")) {
      return Promise.resolve(
        jsonResponse({
          counts,
          items,
          page: Number(new URL(url, "http://localhost").searchParams.get("pageNumber") ?? 1),
          pagesCount: stub.pagesCount ?? 1,
          pageSize: 20,
          totalCount: stub.totalCount ?? items.length,
        }),
      );
    }
    if (url.includes("/api/loans/contacts/")) {
      return Promise.resolve(
        jsonResponse(contactView({ contact: "ihor@example.com", loanCount: 3, name: "Ігор" })),
      );
    }
    if (url.includes("/api/loans")) {
      return Promise.resolve(
        jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 3, totalCount: 0 }),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  };
}

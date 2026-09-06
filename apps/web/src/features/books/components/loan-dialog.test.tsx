import "@testing-library/jest-dom/vitest";
import type { BookView, LoanContactListItemView } from "@app/shared";
import type { ReactNode } from "react";

import { LOAN_BATCH_CONFLICT_CODE, LOAN_CONTACT_ERROR_CODES, LOAN_ERROR_CODES } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { LoanDialog } from "./loan-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const NEW_CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CANDIDATE_BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECOND_BOOK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const bookStep = messages.books.details.loan.bookStep;
const contactCreate = messages.loans.contactCreate;
const loanCopy = messages.books.details.loan;
const booksPicker = messages.books.details.loan.booksPicker;
const loanErrors = messages.books.details.loan.errors;

const fetchMock = vi.fn();

let batchResponse: unknown = { createdBookIds: [CANDIDATE_BOOK_ID] };
let candidateBooks: BookView[] = [];
let searchResults: LoanContactListItemView[] = [];

function batchLoanCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/books/loans/batch") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function booksPage(items: BookView[]) {
  return {
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

function candidateBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: CANDIDATE_BOOK_ID,
    loanInfo: null,
    ownershipStatus: "owned",
    title: "Тигролови",
    ...overrides,
  });
}

function candidateListUrl(): string | undefined {
  const call = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/books?"));
  return call === undefined ? undefined : String(call[0]);
}

function contactCreateCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/api/loans/contacts") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function contactsPage(items: LoanContactListItemView[]) {
  return {
    counts: { active: items.length, all: items.length, archived: 0 },
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

function contactView(overrides: Partial<LoanContactListItemView> = {}): LoanContactListItemView {
  return {
    activeBorrowedCount: 0,
    activeLentCount: 0,
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_ID,
    loanCount: 2,
    name: "Ігор",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function loanCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${BOOK_ID}/loan`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

async function reachLoanForm(books: BookView[] = [candidateBook()]) {
  const { onOpenChange } = renderContactFirst(books);
  for (const book of books) {
    await userEvent.click(await screen.findByRole("checkbox", { name: book.title }));
  }
  await userEvent.click(screen.getByRole("button", { name: bookStep.next }));
  return { onOpenChange };
}

function renderContactFirst(books: BookView[] = [candidateBook()]) {
  candidateBooks = books;
  const onOpenChange = vi.fn();
  renderWithProviders(
    <LoanDialog
      context={{ contact: contactView(), kind: "contact" }}
      direction="lent"
      onOpenChange={onOpenChange}
      open
    />,
  );
  return { onOpenChange };
}

function renderDialog() {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <LoanDialog
      context={{
        book: makeBookView({ id: BOOK_ID, loanInfo: null, ownershipStatus: "none" }),
        kind: "book",
      }}
      direction="borrowed"
      onOpenChange={onOpenChange}
      open
    />,
  );
  return { onOpenChange };
}

function secondBook(): BookView {
  return candidateBook({ id: SECOND_BOOK_ID, title: "Місто" });
}

beforeEach(() => {
  searchResults = [contactView()];
  candidateBooks = [];
  batchResponse = { createdBookIds: [CANDIDATE_BOOK_ID] };
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/loans/contacts") && method === "POST") {
      return Promise.resolve(
        jsonResponse(contactView({ id: NEW_CONTACT_ID, loanCount: 0, name: "Марта" }), 201),
      );
    }
    if (url.includes("/api/loans/contacts")) {
      return Promise.resolve(jsonResponse(contactsPage(searchResults)));
    }
    if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
      return Promise.resolve(
        jsonResponse(makeBookView({ id: BOOK_ID, ownershipStatus: "borrowed_from_someone" })),
      );
    }
    if (url.includes("/api/books/loans/batch") && method === "POST") {
      return Promise.resolve(jsonResponse(batchResponse));
    }
    if (url.startsWith("/api/books?")) {
      return Promise.resolve(jsonResponse(booksPage(candidateBooks)));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoanDialog", () => {
  it("sends the picked contact as the identity of the loan", async () => {
    const { onOpenChange } = renderDialog();

    await userEvent.click(screen.getByLabelText(messages.books.details.loan.borrowed.personName));
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(loanCall()).toBeDefined());
    const payload = JSON.parse(String(loanCall()?.[1].body));
    expect(payload).toMatchObject({ loanContactId: CONTACT_ID });
    expect(payload).not.toHaveProperty("personName");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends the contact created from the typed name", async () => {
    searchResults = [];
    const created = contactView({ id: NEW_CONTACT_ID, loanCount: 0, name: "Марта" });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/loans/contacts") && method === "POST") {
        return Promise.resolve(jsonResponse(created, 201));
      }
      if (url.includes("/api/loans/contacts")) {
        return Promise.resolve(jsonResponse(contactsPage(searchResults)));
      }
      if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
        return Promise.resolve(
          jsonResponse(makeBookView({ id: BOOK_ID, ownershipStatus: "borrowed_from_someone" })),
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    renderDialog();

    await userEvent.type(
      screen.getByLabelText(messages.books.details.loan.borrowed.personName),
      "Марта",
    );
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(
      await screen.findByRole("button", { name: messages.loans.contactCreate.submit }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(messages.books.details.loan.borrowed.personName)).toHaveValue(
        "Марта",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(loanCall()).toBeDefined());
    expect(JSON.parse(String(loanCall()?.[1].body))).toMatchObject({
      loanContactId: NEW_CONTACT_ID,
    });
  });

  it("creates the contact without stacking a second dialog over the loan", async () => {
    searchResults = [];
    renderDialog();

    await userEvent.type(screen.getByLabelText(loanCopy.borrowed.personName), "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));

    expect(await screen.findByRole("heading", { name: contactCreate.title })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByLabelText(loanCopy.borrowed.personName)).not.toBeInTheDocument();
  });

  it("keeps the loan draft while the reader steps away to create a contact", async () => {
    searchResults = [];
    renderDialog();

    await userEvent.type(screen.getByLabelText(loanCopy.fields.note), "до вересня");
    await userEvent.type(screen.getByLabelText(loanCopy.borrowed.personName), "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(
      await screen.findByRole("button", { name: messages.loans.contactCreate.submit }),
    );

    expect(await screen.findByLabelText(loanCopy.fields.note)).toHaveValue("до вересня");
    expect(screen.getByLabelText(loanCopy.borrowed.personName)).toHaveValue("Марта");
  });

  it("creates nothing when the contact step is left through back", async () => {
    searchResults = [];
    renderDialog();

    await userEvent.type(screen.getByLabelText(loanCopy.fields.note), "до вересня");
    await userEvent.type(screen.getByLabelText(loanCopy.borrowed.personName), "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(await screen.findByRole("button", { name: contactCreate.back }));

    expect(await screen.findByLabelText(loanCopy.fields.note)).toHaveValue("до вересня");
    expect(contactCreateCall()).toBeUndefined();
  });

  it("closes the whole flow when the contact step is cancelled", async () => {
    searchResults = [];
    const { onOpenChange } = renderDialog();

    await userEvent.type(screen.getByLabelText(loanCopy.borrowed.personName), "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(await screen.findByRole("button", { name: contactCreate.cancel }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers no field for typing a contact detail on the loan", () => {
    renderDialog();

    expect(screen.queryByLabelText("Контакт")).not.toBeInTheDocument();
  });

  it("keeps the loan unsaved until a contact is picked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    expect(await screen.findByText(messages.loans.contactPicker.required)).toBeInTheDocument();
    expect(loanCall()).toBeUndefined();
  });

  it("explains a rejected loan in the reader's language instead of the server's", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/loans/contacts")) {
        return Promise.resolve(jsonResponse(contactsPage(searchResults)));
      }
      if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              code: LOAN_ERROR_CODES.borrowRequiresFreeBook,
              message: 'Book must have ownership status "none" or "want to buy" to be borrowed',
            },
            409,
          ),
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    renderDialog();

    await userEvent.click(screen.getByLabelText(messages.books.details.loan.borrowed.personName));
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(loanErrors.borrowRequiresFreeBook);
    expect(alert).not.toHaveTextContent("ownership status");
  });

  it("names the archived contact as the reason the loan was refused", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/loans/contacts")) {
        return Promise.resolve(jsonResponse(contactsPage(searchResults)));
      }
      if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
        return Promise.resolve(
          jsonResponse(
            { code: LOAN_CONTACT_ERROR_CODES.archived, message: "This contact is archived" },
            409,
          ),
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    renderDialog();

    await userEvent.click(screen.getByLabelText(messages.books.details.loan.borrowed.personName));
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(loanErrors.contactArchived);
  });

  it("falls back to the generic wording for an error it does not know", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/loans/contacts")) {
        return Promise.resolve(jsonResponse(contactsPage(searchResults)));
      }
      if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
        return Promise.resolve(jsonResponse({ message: "Boom" }, 500));
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    renderDialog();

    await userEvent.click(screen.getByLabelText(messages.books.details.loan.borrowed.personName));
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(loanErrors.generic);
  });

  it("asks only for eligible books when the flow starts from a contact", async () => {
    renderContactFirst();

    expect(
      await screen.findByRole("heading", { name: bookStep.lent.multiTitle }),
    ).toBeInTheDocument();
    await waitFor(() => expect(candidateListUrl()).toBeDefined());
    expect(candidateListUrl()).toContain("owner=owned");
    expect(candidateListUrl()).not.toContain("owner=none");
  });

  it("narrows the picker to books the person could borrow from you", async () => {
    candidateBooks = [candidateBook()];
    renderWithProviders(
      <LoanDialog
        context={{ contact: contactView(), kind: "contact" }}
        direction="borrowed"
        onOpenChange={vi.fn()}
        open
      />,
    );

    await waitFor(() => expect(candidateListUrl()).toBeDefined());
    expect(candidateListUrl()).toContain("owner=none");
    expect(candidateListUrl()).toContain("want_to_buy");
  });

  it("never offers to select every shown book at once for a loan", async () => {
    renderContactFirst([candidateBook(), secondBook()]);

    await screen.findByRole("checkbox", { name: "Тигролови" });
    expect(screen.queryByRole("button", { name: /Вибрати всі/ })).not.toBeInTheDocument();
  });

  it("holds the reader on the list until at least one book is chosen", async () => {
    renderContactFirst();

    await screen.findByRole("checkbox", { name: "Тигролови" });
    expect(screen.getByRole("button", { name: bookStep.next })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: "Тигролови" }));
    expect(screen.getByRole("button", { name: bookStep.next })).toBeEnabled();
  });

  it("fixes the contact and every chosen book once the reader moves on to the form", async () => {
    await reachLoanForm([candidateBook(), secondBook()]);

    expect(
      await screen.findByRole("heading", { name: messages.books.details.loan.lent.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ігор")).toBeInTheDocument();
    expect(screen.getByText("Тигролови")).toBeInTheDocument();
    expect(screen.getByText("Місто")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(messages.books.details.loan.lent.personName),
    ).not.toBeInTheDocument();
  });

  it("says the terms cover every book the reader picked", async () => {
    await reachLoanForm([candidateBook(), secondBook()]);

    expect(
      await screen.findByText(/Ці умови будуть застосовані до 2 вибраних книг/),
    ).toBeInTheDocument();
  });

  it("creates one loan per chosen book in a single request", async () => {
    batchResponse = { createdBookIds: [CANDIDATE_BOOK_ID, SECOND_BOOK_ID] };
    const { onOpenChange } = await reachLoanForm([candidateBook(), secondBook()]);

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(batchLoanCall()).toBeDefined());
    expect(JSON.parse(String(batchLoanCall()?.[1].body))).toMatchObject({
      bookIds: [CANDIDATE_BOOK_ID, SECOND_BOOK_ID],
      direction: "lent",
      loanContactId: CONTACT_ID,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the chosen books when the reader steps back to the list", async () => {
    await reachLoanForm([candidateBook(), secondBook()]);

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.back }));

    expect(await screen.findByRole("checkbox", { name: "Тигролови" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Місто" })).toBeChecked();
    expect(screen.getByRole("button", { name: bookStep.next })).toBeEnabled();
  });

  it("keeps the terms already typed when the reader steps back to the list", async () => {
    await reachLoanForm([candidateBook(), secondBook()]);

    await userEvent.type(screen.getByLabelText(loanCopy.fields.note), "до вересня");
    await userEvent.click(screen.getByRole("button", { name: loanCopy.back }));
    await userEvent.click(screen.getByRole("button", { name: bookStep.next }));

    expect(await screen.findByLabelText(loanCopy.fields.note)).toHaveValue("до вересня");
  });

  it("names the books that blocked the batch and keeps the reader in the form", async () => {
    const { onOpenChange } = await reachLoanForm([candidateBook(), secondBook()]);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/books/loans/batch") && method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              code: LOAN_BATCH_CONFLICT_CODE,
              details: { conflicts: [{ bookId: SECOND_BOOK_ID, reason: "active_loan_exists" }] },
              message: "rejected",
            },
            409,
          ),
        );
      }
      return Promise.resolve(jsonResponse(contactsPage(searchResults)));
    });

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Місто");
    expect(alert).not.toHaveTextContent("Тигролови");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("points the reader at adding a book when nothing is eligible yet", async () => {
    renderContactFirst([]);

    expect(await screen.findByText(bookStep.lent.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: bookStep.createBook })).toHaveAttribute(
      "href",
      "/books/new",
    );
  });

  it("does not push adding a book when only the search came up empty", async () => {
    renderContactFirst([]);
    await screen.findByText(bookStep.lent.emptyTitle);

    await userEvent.type(screen.getByLabelText(booksPicker.search), "zzz");

    expect(await screen.findByText(bookStep.notFound)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: bookStep.createBook })).not.toBeInTheDocument();
  });
});

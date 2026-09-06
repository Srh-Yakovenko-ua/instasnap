import "@testing-library/jest-dom/vitest";
import type { LoanContactListItemView, LoanDirection } from "@app/shared";

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { LoanContactSelection } from "../model/loan-contact-selection";

import { LoanContactPicker } from "./loan-contact-picker";

const PICKER_LABEL = "Кому даєте";

const CONTACT_IDS = {
  ihor: "11111111-1111-4111-8111-111111111111",
  marta: "22222222-2222-4222-8222-222222222222",
} as const;

const fetchMock = vi.fn();

let searchResults: LoanContactListItemView[] = [];

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
    id: CONTACT_IDS.ihor,
    loanCount: 3,
    name: "Ігор",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function Harness({
  direction,
  onChange,
  onRequestCreate,
}: {
  direction: LoanDirection;
  onChange: (selection: LoanContactSelection | null) => void;
  onRequestCreate: (name: string) => void;
}) {
  const [value, setValue] = useState<LoanContactSelection | null>(null);

  return (
    <div>
      <label htmlFor="contact-picker">{PICKER_LABEL}</label>
      <LoanContactPicker
        direction={direction}
        id="contact-picker"
        invalid={false}
        label={PICKER_LABEL}
        onChange={(selection) => {
          setValue(selection);
          onChange(selection);
        }}
        onRequestCreate={onRequestCreate}
        placeholder="Імʼя людини"
        value={value}
      />
    </div>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderPicker(direction: LoanDirection = "lent") {
  const onChange = vi.fn<(selection: LoanContactSelection | null) => void>();
  const onRequestCreate = vi.fn<(name: string) => void>();
  renderWithProviders(
    <Harness direction={direction} onChange={onChange} onRequestCreate={onRequestCreate} />,
  );
  return { input: screen.getByLabelText(PICKER_LABEL), onChange, onRequestCreate };
}

beforeEach(() => {
  searchResults = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/loans/contacts")) {
      return Promise.resolve(jsonResponse(contactsPage(searchResults)));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoanContactPicker", () => {
  it("reports the contact picked from the list", async () => {
    searchResults = [contactView()];
    const { input, onChange } = renderPicker();

    await userEvent.click(input);

    expect(await screen.findByText("Ігор")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Ігор"));

    expect(onChange).toHaveBeenCalledWith({
      contactId: CONTACT_IDS.ihor,
      kind: "picked",
      name: "Ігор",
    });
    expect(input).toHaveValue("Ігор");
  });

  it("counts only the books this person still holds when lending one out", async () => {
    searchResults = [contactView({ activeBorrowedCount: 2, activeLentCount: 3, loanCount: 9 })];
    const { input } = renderPicker("lent");

    await userEvent.click(input);

    expect(await screen.findByText("передано 3 книги")).toBeInTheDocument();
    expect(screen.queryByText("9 позик")).not.toBeInTheDocument();
  });

  it("counts only the books taken from this person when marking one as borrowed", async () => {
    searchResults = [contactView({ activeBorrowedCount: 2, activeLentCount: 3, loanCount: 9 })];
    const { input } = renderPicker("borrowed");

    await userEvent.click(input);

    expect(await screen.findByText("позичено 2 книги")).toBeInTheDocument();
    expect(screen.queryByText("передано 3 книги")).not.toBeInTheDocument();
  });

  it("leaves the caption out for a person holding nothing right now", async () => {
    searchResults = [contactView({ activeLentCount: 0, loanCount: 4 })];
    const { input } = renderPicker("lent");

    await userEvent.click(input);

    expect(await screen.findByText("Ігор")).toBeInTheDocument();
    expect(screen.queryByText(/передано/)).not.toBeInTheDocument();
  });

  it("declines a single book with the right case", async () => {
    searchResults = [
      contactView({ activeLentCount: 1, id: CONTACT_IDS.ihor, name: "Ігор" }),
      contactView({ activeLentCount: 5, id: CONTACT_IDS.marta, name: "Марта" }),
    ];
    const { input } = renderPicker("lent");

    await userEvent.click(input);

    expect(await screen.findByText("передано 1 книгу")).toBeInTheDocument();
    expect(screen.getByText("передано 5 книг")).toBeInTheDocument();
  });

  it("offers no inline create for a name an existing contact already normalizes to", async () => {
    searchResults = [contactView()];
    const { input } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "  ІГОР ");

    expect(await screen.findByText("Ігор")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Створити «ІГОР»")).not.toBeInTheDocument());
  });

  it("hands the typed name to the host instead of opening a second dialog", async () => {
    const { input, onRequestCreate } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "  Марта  ");

    await userEvent.click(await screen.findByText("Створити «Марта»"));

    expect(onRequestCreate).toHaveBeenCalledWith("Марта");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

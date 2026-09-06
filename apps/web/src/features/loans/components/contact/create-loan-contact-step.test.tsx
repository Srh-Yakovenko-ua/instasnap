import "@testing-library/jest-dom/vitest";
import type { LoanContactView } from "@app/shared";

import { LOAN_CONTACT_ERROR_CODES } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { LoanContactResolution } from "./create-loan-contact-form";

import { CreateLoanContactStep } from "./create-loan-contact-step";

const CONTACT_ID = "22222222-2222-4222-8222-222222222222";

const copy = messages.loans.contactCreate;

const fetchMock = vi.fn();

let respondToCreate: () => Response;
let respondToLookup: () => Response;

function contactView(overrides: Partial<LoanContactView> = {}): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_ID,
    loanCount: 0,
    name: "Марта",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/api/loans/contacts") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderStep(initialName = "Марта") {
  const onBack = vi.fn();
  const onCancel = vi.fn();
  const onResolved = vi.fn<(resolution: LoanContactResolution) => void>();

  renderWithProviders(
    <Dialog open>
      <DialogContent>
        <CreateLoanContactStep
          initialName={initialName}
          onBack={onBack}
          onCancel={onCancel}
          onResolved={onResolved}
        />
      </DialogContent>
    </Dialog>,
  );

  return { onBack, onCancel, onResolved };
}

function restoreCall() {
  return fetchMock.mock.calls.find(([url]) => String(url).includes("/restore")) as
    [string, RequestInit] | undefined;
}

beforeEach(() => {
  respondToCreate = () => jsonResponse(contactView(), 201);
  respondToLookup = () => jsonResponse({ message: "not found" }, 404);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/restore") && method === "POST") {
      return Promise.resolve(jsonResponse(contactView()));
    }
    if (url.includes("/api/loans/contacts/by-name")) return Promise.resolve(respondToLookup());
    if (url.endsWith("/api/loans/contacts") && method === "POST") {
      return Promise.resolve(respondToCreate());
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CreateLoanContactStep", () => {
  it("opens with the name the picker passed along", () => {
    renderStep();

    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByLabelText(copy.name)).toHaveValue("Марта");
  });

  it("goes back without creating anything", async () => {
    const { onBack } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: copy.back }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(createCall()).toBeUndefined();
  });

  it("closes the whole flow from cancel", async () => {
    const { onBack, onCancel } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: copy.cancel }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("sends the contact detail and reports the new contact back", async () => {
    const { onResolved } = renderStep();

    await userEvent.type(screen.getByLabelText(/^Контакт/), "marta@example.com");
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(String(createCall()?.[1].body))).toEqual({
      contact: "marta@example.com",
      name: "Марта",
    });
    await waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith({ contact: contactView(), kind: "created" }),
    );
  });

  it("offers the existing contact when the name is already taken by a live one", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.duplicateName, message: "duplicate" }, 409);
    respondToLookup = () => jsonResponse(contactView());
    const { onResolved } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText("Контакт «Марта» вже існує")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Обрати Марта" }));

    expect(onResolved).toHaveBeenCalledWith({ contact: contactView(), kind: "existing" });
  });

  it("restores the archived contact that holds the name", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.archivedName, message: "archived" }, 409);
    respondToLookup = () => jsonResponse(contactView({ archivedAt: "2026-02-01T10:00:00.000Z" }));
    const { onResolved } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText("Контакт «Марта» є в архіві")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Відновити Марта" }));

    await waitFor(() => expect(restoreCall()).toBeDefined());
    expect(String(restoreCall()?.[0])).toContain(`/api/loans/contacts/${CONTACT_ID}/restore`);
    await waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith({ contact: contactView(), kind: "restored" }),
    );
  });

  it("falls back to a field error when no contact holds the conflicting name", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.duplicateName, message: "duplicate" }, 409);
    const { onResolved } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText(copy.errors.duplicateName)).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
  });
});

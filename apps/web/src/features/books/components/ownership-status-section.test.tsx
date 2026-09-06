import "@testing-library/jest-dom/vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { CreateBookFormOutput, CreateBookFormValues } from "../model/create-book-form";

import { pruneStatusPayload } from "../model/book-status-fields";
import { bookViewToFormState } from "../model/book-view-to-form";
import { createBookFormDefaults, CreateBookFormSchema } from "../model/create-book-form";
import { makeBookView } from "./book-details.fixtures";
import { OwnershipStatusSection } from "./ownership-status-section";

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_LABEL = messages.books.ownershipStatus.fields.note;
const PERSON_LABEL = messages.books.loanInfo.fields.personName;
const PERSON_REQUIRED = messages.loans.contactPicker.required;
const STORE_URL = "https://www.yakaboo.ua/ostannie-bazhannja.html";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function borrowedBook() {
  return makeBookView({
    loanInfo: {
      contact: null,
      expectedReturnDate: null,
      loanContactId: "66666666-6666-4666-8666-666666666666",
      loanDate: "2026-06-01",
      loanType: "borrowed_from_someone",
      loanUiStatus: "on_time",
      note: "Повернути після відпустки",
      personName: "Ольга",
      remindBeforeDays: null,
      remindToReturn: false,
    },
    ownershipStatus: "borrowed_from_someone",
  });
}

function contactsPage() {
  return {
    counts: { active: 1, all: 1, archived: 0 },
    items: [
      {
        activeBorrowedCount: 0,
        activeLentCount: 0,
        archivedAt: null,
        contact: null,
        createdAt: "2026-01-10T10:00:00.000Z",
        id: CONTACT_ID,
        loanCount: 0,
        name: "Ігор",
        updatedAt: "2026-01-10T10:00:00.000Z",
      },
    ],
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: 1,
  };
}

function Harness({
  initialLoanContact,
  initialValues,
  mode = "edit",
  onSubmit,
}: {
  initialLoanContact: LoanContactSelection | null;
  initialValues: CreateBookFormValues;
  mode?: "create" | "edit";
  onSubmit: (values: CreateBookFormOutput) => void;
}) {
  const form = useForm<CreateBookFormValues, unknown, CreateBookFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(CreateBookFormSchema),
  });
  const [loanContact, setLoanContact] = useState(initialLoanContact);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <OwnershipStatusSection
        control={form.control}
        errors={form.formState.errors}
        loanContact={loanContact}
        mode={mode}
        onLoanContactChange={setLoanContact}
        register={form.register}
        setValue={form.setValue}
      />
      <button type="submit">submit</button>
    </form>
  );
}

function inTransitCreateValues(): CreateBookFormValues {
  return {
    ...createBookFormDefaults,
    authors: [{ name: "Автор" }],
    deliveryInfo: { deliveryStatus: "ordered", isShipped: false },
    ownershipStatus: "in_transit",
    title: "Книга",
  };
}

function renderSection(
  initialValues: CreateBookFormValues,
  initialLoanContact: LoanContactSelection | null = null,
  mode: "create" | "edit" = "edit",
) {
  const onSubmit = vi.fn<(values: CreateBookFormOutput) => void>();
  renderWithProviders(
    <Harness
      initialLoanContact={initialLoanContact}
      initialValues={initialValues}
      mode={mode}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe("OwnershipStatusSection create delivery quick flow", () => {
  it("starts without shipment fields", () => {
    renderSection(inTransitCreateValues(), null, "create");

    expect(screen.getByText(messages.books.deliveryInfo.orderDetails)).toBeInTheDocument();
    expect(screen.getByText(messages.books.deliveryInfo.shippedQuestion)).toBeInTheDocument();
    expect(screen.queryByLabelText(messages.books.deliveryInfo.fields.deliveryService)).toBeNull();
    expect(screen.queryByLabelText(messages.books.deliveryInfo.fields.trackingNumber)).toBeNull();
    expect(
      screen.queryByLabelText(messages.books.deliveryInfo.fields.expectedDeliveryDate),
    ).toBeNull();
    expect(screen.queryByLabelText(messages.books.deliveryInfo.fields.deliveryStatus)).toBeNull();
  });

  it("shows shipment fields and collapses optional tracking details", async () => {
    renderSection(inTransitCreateValues(), null, "create");

    await userEvent.click(screen.getByText(messages.books.deliveryInfo.shippedOptions.yes));

    expect(screen.getByLabelText(messages.books.deliveryInfo.fields.deliveryService)).toBeVisible();
    expect(screen.getByLabelText(messages.books.deliveryInfo.fields.trackingNumber)).toBeVisible();
    expect(
      screen.getByLabelText(messages.books.deliveryInfo.fields.expectedDeliveryDate),
    ).toBeVisible();
    expect(screen.queryByLabelText(messages.books.deliveryInfo.fields.trackingUrl)).toBeNull();
    expect(screen.queryByLabelText(NOTE_LABEL)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: messages.books.deliveryInfo.additional }),
    );

    expect(screen.getByLabelText(messages.books.deliveryInfo.fields.trackingUrl)).toBeVisible();
    expect(screen.getByLabelText(NOTE_LABEL)).toBeVisible();
  });
});

function wishlistValues(): CreateBookFormValues {
  return bookViewToFormState(
    makeBookView({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: "Дочекатися знижки",
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: STORE_URL,
      },
    }),
  ).values;
}

describe("OwnershipStatusSection purchase note removal", () => {
  it("renders no note field for a wishlist book", () => {
    renderSection(wishlistValues());

    expect(screen.queryByLabelText(NOTE_LABEL)).toBeNull();
  });

  it("keeps the note field of a borrowed book", () => {
    const borrowed = bookViewToFormState(borrowedBook());
    renderSection(borrowed.values, borrowed.loanContactSelection);

    expect(screen.getByLabelText(NOTE_LABEL)).toHaveValue("Повернути після відпустки");
  });

  it("shows the person of a saved loan even when the contact search returns nothing", () => {
    const borrowed = bookViewToFormState(borrowedBook());
    renderSection(borrowed.values, borrowed.loanContactSelection);

    expect(screen.getByLabelText(messages.books.loanInfo.fields.personName)).toHaveValue("Ольга");
  });

  it("omits the purchase note from the submitted payload of a book that still stores one", async () => {
    const { onSubmit } = renderSection(wishlistValues());

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0]?.[0];
    if (values === undefined) throw new Error("form did not submit");

    const payload = pruneStatusPayload(values);

    expect(payload.purchaseInfo).toStrictEqual({
      currency: "UAH",
      expectedPrice: 450,
      storeName: "Yakaboo",
      storeUrl: STORE_URL,
    });
    expect(payload.purchaseInfo).not.toHaveProperty("note");
    expect(JSON.stringify(payload.purchaseInfo)).not.toContain("note");
  });
});

describe("OwnershipStatusSection contact creation", () => {
  it("opens the contact dialog on a page where nothing else is modal", async () => {
    const borrowed = bookViewToFormState(borrowedBook());
    renderSection(borrowed.values, borrowed.loanContactSelection);

    await userEvent.click(screen.getByRole("button", { name: messages.loans.contactPicker.clear }));
    await userEvent.type(screen.getByLabelText(messages.books.loanInfo.fields.personName), "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(messages.loans.contactCreate.title);
    expect(screen.getByLabelText(messages.loans.contactCreate.name)).toHaveValue("Марта");
  });
});

function LoanContactHarness() {
  const form = useForm<CreateBookFormValues, unknown, CreateBookFormOutput>({
    defaultValues: {
      ...createBookFormDefaults,
      authors: [{ name: "Автор" }],
      ownershipStatus: "lent_to_someone",
      title: "Книга",
    },
    mode: "onTouched",
    resolver: zodResolver(CreateBookFormSchema),
    reValidateMode: "onChange",
  });
  const [loanContact, setLoanContact] = useState<LoanContactSelection | null>(null);

  function handleLoanContactChange(selection: LoanContactSelection | null) {
    setLoanContact(selection);
    form.setValue(
      "loanInfo.loanContactId",
      selection?.kind === "picked" ? selection.contactId : undefined,
      { shouldDirty: true },
    );
    void form.trigger(["loanInfo.loanContactId", "loanInfo.personName"]);
  }

  return (
    <form onSubmit={form.handleSubmit(() => {})}>
      <OwnershipStatusSection
        control={form.control}
        errors={form.formState.errors}
        loanContact={loanContact}
        mode="create"
        onLoanContactChange={handleLoanContactChange}
        register={form.register}
        setValue={form.setValue}
      />
      <button type="submit">submit</button>
    </form>
  );
}

describe("OwnershipStatusSection loan person error", () => {
  beforeEach(() => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(input).includes("/api/loans/contacts") ? contactsPage() : { items: [] },
          ),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
  });

  it("asks for the person in the reader's language, not the schema's", async () => {
    renderWithProviders(<LoanContactHarness />);

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(await screen.findByText(PERSON_REQUIRED)).toBeInTheDocument();
    expect(screen.queryByText("Enter the person's name")).not.toBeInTheDocument();
  });

  it("drops the missing-person error once a contact is picked", async () => {
    renderWithProviders(<LoanContactHarness />);

    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(await screen.findByText(PERSON_REQUIRED)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(PERSON_LABEL));
    await userEvent.click(await screen.findByText("Ігор"));

    expect(screen.queryByText(PERSON_REQUIRED)).not.toBeInTheDocument();
  });
});

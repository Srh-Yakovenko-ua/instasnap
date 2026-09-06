import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LoanNoteButton } from "./loan-note-button";

const LONG_NOTE = "Нотатка ".repeat(38).slice(0, 300).trim();

describe("LoanNoteButton", () => {
  it("keeps the note out of the row until the reader asks for it", () => {
    renderWithProviders(<LoanNoteButton bookTitle="Тигролови" note={LONG_NOTE} onEdit={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Є нотатка" })).toBeInTheDocument();
    expect(screen.queryByText(LONG_NOTE)).not.toBeInTheDocument();
  });

  it("shows the whole note in a dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoanNoteButton bookTitle="Тигролови" note={LONG_NOTE} onEdit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Є нотатка" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Нотатка")).toBeInTheDocument();
    expect(within(dialog).getByText("Тигролови")).toBeInTheDocument();
    expect(within(dialog).getByText(LONG_NOTE)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoanNoteButton bookTitle="Місто" note="Коротка" onEdit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Є нотатка" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes on the close button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoanNoteButton bookTitle="Місто" note="Коротка" onEdit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Є нотатка" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Закрити" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hands the reader over to the loan editor and closes itself", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<LoanNoteButton bookTitle="Місто" note="Коротка" onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "Є нотатка" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Редагувати нотатку" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

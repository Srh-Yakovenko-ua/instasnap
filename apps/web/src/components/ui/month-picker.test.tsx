import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { MonthPicker } from "./month-picker";

const LABELS = { nextYearLabel: "Наступний рік", previousYearLabel: "Попередній рік" };

function renderPicker(overrides: Partial<Parameters<typeof MonthPicker>[0]> = {}): {
  onChange: ReturnType<typeof vi.fn>;
} {
  const onChange = vi.fn();
  renderWithProviders(
    <MonthPicker
      ariaLabel="Застосувати з"
      id="month"
      min="2026-08-01"
      onChange={onChange}
      value="2026-08-01"
      {...LABELS}
      {...overrides}
    />,
  );
  return { onChange };
}

function trigger() {
  return screen.getByRole("button", { name: "Застосувати з" });
}

describe("MonthPicker", () => {
  it("reads the value as a month and a year", () => {
    renderPicker();

    expect(trigger()).toHaveTextContent("серпень 2026");
  });

  it("hands back the first day of the month it was given", async () => {
    const { onChange } = renderPicker();

    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "грудень" }));

    expect(onChange).toHaveBeenCalledWith("2026-12-01");
  });

  it("closes the months before the lower bound", async () => {
    renderPicker();

    await userEvent.click(trigger());

    expect(screen.getByRole("button", { name: "січень" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "серпень" })).toBeEnabled();
  });

  it("refuses to walk back past the year of the lower bound", async () => {
    renderPicker();

    await userEvent.click(trigger());

    expect(screen.getByRole("button", { name: LABELS.previousYearLabel })).toBeDisabled();
    expect(screen.getByRole("button", { name: LABELS.nextYearLabel })).toBeEnabled();
  });

  it("walks to the next year and offers its months", async () => {
    const { onChange } = renderPicker();

    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: LABELS.nextYearLabel }));
    await userEvent.click(screen.getByRole("button", { name: "січень" }));

    expect(onChange).toHaveBeenCalledWith("2027-01-01");
  });

  it("stops at the upper bound", async () => {
    renderPicker({ max: "2026-12-01" });

    await userEvent.click(trigger());

    expect(screen.getByRole("button", { name: LABELS.nextYearLabel })).toBeDisabled();
  });
});

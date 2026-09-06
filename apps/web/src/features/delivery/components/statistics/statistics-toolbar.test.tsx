import type { BookOrderStatisticsMeta } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { StatisticsToolbar } from "./statistics-toolbar";

const META: BookOrderStatisticsMeta = {
  activeSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
  comparisonPeriod: null,
  comparisonSource: null,
  currentPeriod: { from: "2026-01-01", to: "2026-08-21" },
  currentSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
};

function buildParams(
  overrides: Partial<UseStatisticsParamsResult> = {},
): UseStatisticsParamsResult {
  return {
    budgetCurrency: null,
    canCompare: true,
    clearFilters: vi.fn(),
    compareMode: null,
    filterCount: 0,
    hasActiveFilters: false,
    periodRange: { from: "2026-01-01", to: "2026-08-21" },
    queryParams: { includeCancelled: "false" },
    requestedDisplayCurrency: null,
    setBudgetCurrency: vi.fn(),
    setCompareMode: vi.fn(),
    setCustomRange: vi.fn(),
    setDisplayCurrency: vi.fn(),
    setFilters: vi.fn(),
    setIncludeCancelled: vi.fn(),
    setPeriod: vi.fn(),
    state: {
      budgetCurrency: null,
      compare: null,
      currency: null,
      from: "",
      includeCancelled: false,
      money: null,
      orderState: null,
      period: "this_year",
      store: "",
      to: "",
    },
    today: "2026-08-21",
    ...overrides,
  };
}

describe("StatisticsToolbar", () => {
  it("spells out the exact period rather than just its name", () => {
    renderWithProviders(<StatisticsToolbar meta={META} params={buildParams()} stores={[]} />);

    expect(screen.getByText(/Період: 1 січня – 21 серпня 2026/)).toBeInTheDocument();
  });

  it("spells out the comparison period too", () => {
    renderWithProviders(
      <StatisticsToolbar
        meta={{
          ...META,
          comparisonPeriod: { from: "2025-01-01", mode: "same_period_last_year", to: "2025-08-21" },
        }}
        params={buildParams({ compareMode: "same_period_last_year" })}
        stores={[]}
      />,
    );

    expect(screen.getByText(/Порівняння: 1 січня – 21 серпня 2025/)).toBeInTheDocument();
  });

  it("says all time when the period has no lower bound", () => {
    renderWithProviders(
      <StatisticsToolbar
        meta={{ ...META, currentPeriod: { from: null, to: "2026-08-21" } }}
        params={buildParams({ canCompare: false })}
        stores={[]}
      />,
    );

    expect(screen.getByText("Період: за весь час")).toBeInTheDocument();
  });

  it("turns the comparison on with the mode that suits the period", async () => {
    const setCompareMode = vi.fn();
    renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams({ setCompareMode })} stores={[]} />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith("same_period_last_year");
  });

  it("turns the comparison back off", async () => {
    const setCompareMode = vi.fn();
    renderWithProviders(
      <StatisticsToolbar
        meta={META}
        params={buildParams({ compareMode: "previous_period", setCompareMode })}
        stores={[]}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith(null);
  });

  it("blocks the comparison when the period cannot carry one", () => {
    renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams({ canCompare: false })} stores={[]} />,
    );

    expect(screen.getByRole("switch", { name: "Порівняти" })).toBeDisabled();
  });

  it("hides the comparator until the comparison is on", () => {
    renderWithProviders(<StatisticsToolbar meta={META} params={buildParams()} stores={[]} />);

    expect(screen.queryByRole("combobox", { name: "Із чим порівнювати" })).not.toBeInTheDocument();
  });

  it("offers the custom dates only for the custom preset", () => {
    const { rerender } = renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams()} stores={[]} />,
    );

    expect(screen.queryByLabelText("Від")).not.toBeInTheDocument();

    rerender(
      <StatisticsToolbar
        meta={META}
        params={buildParams({
          state: { ...buildParams().state, period: "custom" },
        })}
        stores={[]}
      />,
    );

    expect(screen.getByLabelText("Від")).toBeInTheDocument();
    expect(screen.getByLabelText("До")).toBeInTheDocument();
  });

  it("keeps the cancelled toggle with the other dataset filters", async () => {
    const setIncludeCancelled = vi.fn();
    renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams({ setIncludeCancelled })} stores={[]} />,
    );

    expect(screen.queryByRole("switch", { name: "Враховувати скасовані" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    await userEvent.click(await screen.findByRole("switch", { name: "Враховувати скасовані" }));

    expect(setIncludeCancelled).toHaveBeenCalledWith(true);
  });

  it("offers a reset only while filters are on", () => {
    const { rerender } = renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams()} stores={[]} />,
    );

    expect(screen.queryByRole("button", { name: "Скинути фільтри" })).not.toBeInTheDocument();

    rerender(
      <StatisticsToolbar
        meta={META}
        params={buildParams({ filterCount: 1, hasActiveFilters: true })}
        stores={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Скинути фільтри" })).toBeInTheDocument();
  });
});

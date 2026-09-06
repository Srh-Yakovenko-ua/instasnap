import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { overviewFixture } from "../../model/statistics.fixtures";
import { StatisticsPeriodControls } from "./statistics-period-controls";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const overview = overviewFixture();

function makeParams(overrides: Partial<UseStatisticsParamsResult> = {}): UseStatisticsParamsResult {
  return {
    canCompare: true,
    compareMode: null,
    isRequestable: true,
    queryParams: { period: "year", year: 2026 },
    rangeIssue: null,
    setCompareMode: vi.fn(),
    setCustomRange: vi.fn(),
    setPeriod: vi.fn(),
    setYear: vi.fn(),
    state: { compare: null, from: "", period: "year", to: "", year: 2026 },
    today: "2026-03-31",
    ...overrides,
  };
}

function render(params: UseStatisticsParamsResult, comparison = overview.comparison) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams="">
      <StatisticsPeriodControls comparison={comparison} params={params} period={overview.period} />
    </NuqsTestingAdapter>,
  );
}

describe("StatisticsPeriodControls", () => {
  it("shows the backend-normalized period range", () => {
    render(makeParams());

    expect(screen.getByText(/Період:/)).toBeInTheDocument();
    expect(screen.getByText(/1 січня\s*–\s*31 березня 2026 р\./)).toBeInTheDocument();
  });

  it("shows the backend-normalized comparison range when comparison is on", () => {
    render(makeParams({ compareMode: "same_period_last_year" }), {
      from: "2025-01-01",
      mode: "same_period_last_year",
      to: "2025-03-31",
    });

    expect(screen.getByText(/Порівнюється з/)).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("disables comparison for all time", () => {
    render(
      makeParams({
        canCompare: false,
        state: { compare: null, from: "", period: "all_time", to: "", year: null },
      }),
    );

    expect(screen.getByRole("switch", { name: "Порівняти" })).toBeDisabled();
  });

  it("turns comparison on with the mode the period defaults to", async () => {
    const setCompareMode = vi.fn();
    render(makeParams({ setCompareMode }));

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith("same_period_last_year");
  });

  it("reports a reversed custom range instead of swapping it", () => {
    render(
      makeParams({
        isRequestable: false,
        rangeIssue: "reversed",
        state: {
          compare: null,
          from: "2026-05-31",
          period: "custom",
          to: "2026-03-01",
          year: null,
        },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Початок періоду не може бути пізнішим за кінець.",
    );
  });

  it("reports a future custom bound instead of clamping it", () => {
    render(
      makeParams({
        isRequestable: false,
        rangeIssue: "future",
        state: {
          compare: null,
          from: "2026-01-01",
          period: "custom",
          to: "2027-01-01",
          year: null,
        },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Період не може сягати у майбутнє.");
  });
});

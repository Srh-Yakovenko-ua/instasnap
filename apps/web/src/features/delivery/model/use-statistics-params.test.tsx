import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useStatisticsParams } from "./use-statistics-params";

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

function renderParams(searchParams = "") {
  currentSearchParams = new URLSearchParams(searchParams);

  return renderHook(() => useStatisticsParams(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NuqsTestingAdapter hasMemory searchParams={searchParams}>
        {children}
      </NuqsTestingAdapter>
    ),
  });
}

describe("useStatisticsParams", () => {
  it("opens on the current year", () => {
    const { result } = renderParams();

    expect(result.current.state.period).toBe("this_year");
    expect(result.current.periodRange.from).toMatch(/-01-01$/);
  });

  it("starts with the comparison off", () => {
    const { result } = renderParams();

    expect(result.current.compareMode).toBeNull();
    expect(result.current.canCompare).toBe(true);
  });

  it("cannot compare all time", async () => {
    const { result } = renderParams("?period=all_time");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.canCompare).toBe(false);
    expect(result.current.queryParams).not.toHaveProperty("compare");
  });

  it("ignores a comparison mode that the period cannot support", async () => {
    const { result } = renderParams("?period=all_time&compare=previous_period");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.compareMode).toBeNull();
  });

  it("switches the comparison to last year when the reader picks the year", async () => {
    const { result } = renderParams("?period=this_month&compare=previous_period");

    result.current.setPeriod("this_year");

    await waitFor(() => expect(result.current.state.period).toBe("this_year"));
    expect(result.current.compareMode).toBe("same_period_last_year");
  });

  it("turns the comparison off when the reader moves to all time", async () => {
    const { result } = renderParams("?period=this_month&compare=previous_period");

    result.current.setPeriod("all_time");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.state.compare).toBeNull();
  });

  it("keeps the comparison off while switching periods when it was never on", async () => {
    const { result } = renderParams("?period=this_month");

    result.current.setPeriod("last_month");

    await waitFor(() => expect(result.current.state.period).toBe("last_month"));
    expect(result.current.compareMode).toBeNull();
  });

  it("clears a leftover custom range when a preset takes over", async () => {
    const { result } = renderParams("?period=custom&from=2026-03-01&to=2026-05-31");

    result.current.setPeriod("this_month");

    await waitFor(() => expect(result.current.state.period).toBe("this_month"));
    expect(result.current.state.from).toBe("");
    expect(result.current.state.to).toBe("");
  });

  it("stores a custom range and switches the preset with it", async () => {
    const { result } = renderParams();

    result.current.setCustomRange({ from: "2026-03-01", to: "2026-05-31" });

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.queryParams).toMatchObject({ from: "2026-03-01", to: "2026-05-31" });
  });

  it("counts the filters without counting the period", async () => {
    const { result } = renderParams("?period=last_month&currency=EUR&store=Vivat");

    await waitFor(() => expect(result.current.filterCount).toBe(2));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("keeps the budget currency apart from the display currency", async () => {
    const { result } = renderParams("?money=UAH");

    result.current.setBudgetCurrency("EUR");

    await waitFor(() => expect(result.current.budgetCurrency).toBe("EUR"));
    expect(result.current.requestedDisplayCurrency).toBe("UAH");
  });
});

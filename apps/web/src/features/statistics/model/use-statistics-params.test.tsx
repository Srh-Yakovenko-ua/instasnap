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
  it("opens on the current calendar year with the comparison off", () => {
    const { result } = renderParams();

    expect(result.current.state.period).toBe("year");
    expect(result.current.compareMode).toBeNull();
    expect(result.current.canCompare).toBe(true);
    expect(result.current.isRequestable).toBe(true);
  });

  it("cannot compare all time", async () => {
    const { result } = renderParams("?period=all_time&compare=previous_period");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.canCompare).toBe(false);
    expect(result.current.compareMode).toBeNull();
    expect(result.current.queryParams).not.toHaveProperty("compare");
  });

  it("turns the comparison off when the reader moves to all time", async () => {
    const { result } = renderParams("?period=year&compare=same_period_last_year");

    result.current.setPeriod("all_time");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.state.compare).toBeNull();
  });

  it("keeps a custom range in the url and requests it", async () => {
    const { result } = renderParams();

    result.current.setCustomRange({ from: "2026-01-05", to: "2026-02-05" });

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.queryParams).toMatchObject({
      from: "2026-01-05",
      period: "custom",
      to: "2026-02-05",
    });
  });

  it("refuses to request a reversed custom range instead of swapping it", async () => {
    const { result } = renderParams("?period=custom&from=2026-05-31&to=2026-03-01");

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.rangeIssue).toBe("reversed");
    expect(result.current.isRequestable).toBe(false);
    expect(result.current.state.from).toBe("2026-05-31");
    expect(result.current.state.to).toBe("2026-03-01");
  });

  it("clears a leftover custom range when another period takes over", async () => {
    const { result } = renderParams("?period=custom&from=2026-03-01&to=2026-05-31");

    result.current.setPeriod("last_12_months");

    await waitFor(() => expect(result.current.state.period).toBe("last_12_months"));
    expect(result.current.state.from).toBe("");
    expect(result.current.state.to).toBe("");
  });

  it("moves to a picked calendar year", async () => {
    const { result } = renderParams("?period=all_time");

    result.current.setYear(2024);

    await waitFor(() => expect(result.current.state.period).toBe("year"));
    expect(result.current.queryParams).toMatchObject({ period: "year", year: 2024 });
  });
});

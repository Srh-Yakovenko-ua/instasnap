import { describe, expect, it, vi } from "vitest";

import type { StatisticsQueryLike } from "./statistics-scope-state";

import { toStatisticsScopeState } from "./statistics-scope-state";

function query<TData>(
  overrides: Partial<StatisticsQueryLike<TData>> = {},
): StatisticsQueryLike<TData> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("toStatisticsScopeState", () => {
  it("calls the first fetch loading rather than empty", () => {
    const scope = toStatisticsScopeState(query<number>({ isFetching: true }));

    expect(scope.isInitialLoading).toBe(true);
    expect(scope.isRefreshing).toBe(false);
    expect(scope.hasUsableData).toBe(false);
  });

  it("separates a failure with nothing to show from one with last data", () => {
    const blocking = toStatisticsScopeState(query<number>({ isError: true }));
    const recoverable = toStatisticsScopeState(query({ data: 7, isError: true }));

    expect(blocking.isInitialError).toBe(true);
    expect(blocking.isRefetchError).toBe(false);
    expect(recoverable.isInitialError).toBe(false);
    expect(recoverable.isRefetchError).toBe(true);
    expect(recoverable.data).toBe(7);
  });

  it("calls a fetch over existing data refreshing, never loading", () => {
    const scope = toStatisticsScopeState(query({ data: 7, isFetching: true }));

    expect(scope.isRefreshing).toBe(true);
    expect(scope.isInitialLoading).toBe(false);
  });

  it("retries through the query it belongs to", () => {
    const refetch = vi.fn();

    toStatisticsScopeState(query<number>({ refetch })).retry();

    expect(refetch).toHaveBeenCalledOnce();
  });
});

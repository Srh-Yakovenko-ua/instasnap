import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChangeReadingStatus } from "@/features/books/api/use-reading-progress";
import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { useCreateGoal } from "@/features/reading-goals/api/use-create-goal";
import { makeReadingGoalView } from "@/features/reading-goals/model/reading-goals.fixtures";
import { useUpdateSettings } from "@/features/settings/api/use-update-settings";
import { getStatisticsControllerGetOverviewQueryKey } from "@/shared/api/generated/endpoints/statistics/statistics";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const STATISTICS_KEY = getStatisticsControllerGetOverviewQueryKey({ period: "year", year: 2026 });

const BOOKS_KEY = ["/api/books", "list"];

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  client.setQueryData(STATISTICS_KEY, { marker: "statistics" });
  client.setQueryData(BOOKS_KEY, { marker: "books" });
  return client;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("statistics cache freshness after mutations", () => {
  it("invalidates statistics after a successful reading-status change", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeBookView()));
    const client = seededClient();

    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: makeBookView().id, payload: { status: "finished" } });

    await waitFor(() => expect(isInvalidated(client, STATISTICS_KEY)).toBe(true));
  });

  it("does not invalidate statistics when the reading mutation fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "nope" }, 500));
    const client = seededClient();

    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: makeBookView().id, payload: { status: "finished" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(client, STATISTICS_KEY)).toBe(false);
  });

  it("invalidates statistics after a successful reading-goal mutation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeReadingGoalView()));
    const client = seededClient();

    const { result } = renderHook(() => useCreateGoal(), { wrapper: makeWrapper(client) });
    result.current.mutate({
      input: { deadline: "2026-12-31", targetCount: 12 },
      listId: "11111111-1111-4111-8111-111111111111",
    });

    await waitFor(() => expect(isInvalidated(client, STATISTICS_KEY)).toBe(true));
  });

  it("invalidates statistics after a successful timezone or week-start change", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...defaultUserProfileSettings, weekStartDay: "sunday" }),
    );
    const client = seededClient();

    const { result } = renderHook(() => useUpdateSettings(), { wrapper: makeWrapper(client) });
    result.current.mutate({ weekStartDay: "sunday" });

    await waitFor(() => expect(isInvalidated(client, STATISTICS_KEY)).toBe(true));
  });

  it("does not invalidate statistics when a settings update fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "nope" }, 500));
    const client = seededClient();

    const { result } = renderHook(() => useUpdateSettings(), { wrapper: makeWrapper(client) });
    result.current.mutate({ weekStartDay: "sunday" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(client, STATISTICS_KEY)).toBe(false);
  });
});

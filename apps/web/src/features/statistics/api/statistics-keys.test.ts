import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  getStatisticsControllerGetOverviewQueryKey,
  getStatisticsControllerGetReadingDayQueryKey,
} from "@/shared/api/generated/endpoints/statistics/statistics";

import { invalidateStatisticsQueries, matchesStatisticsKey } from "./statistics-keys";

describe("matchesStatisticsKey", () => {
  it("matches every overview variant", () => {
    const keys = [
      getStatisticsControllerGetOverviewQueryKey(),
      getStatisticsControllerGetOverviewQueryKey({ period: "year", year: 2026 }),
      getStatisticsControllerGetOverviewQueryKey({
        compare: "same_period_last_year",
        period: "year",
        year: 2025,
      }),
      getStatisticsControllerGetOverviewQueryKey({ period: "all_time" }),
    ];

    for (const queryKey of keys) {
      expect(matchesStatisticsKey({ queryKey })).toBe(true);
    }
  });

  it("matches a lazy reading-day detail key", () => {
    const queryKey = getStatisticsControllerGetReadingDayQueryKey("2026-03-02");

    expect(matchesStatisticsKey({ queryKey })).toBe(true);
  });

  it("does not match neighbouring api families", () => {
    const foreignKeys = [
      ["/api/books", "list"],
      ["/api/books/123/reading-history"],
      ["/api/delivery/orders/statistics", {}],
      ["/api/goals", "detail", "1"],
      ["/api/series", "overview"],
      ["/api/profile/settings"],
      ["/api/statisticsx"],
      [42],
    ];

    for (const queryKey of foreignKeys) {
      expect(matchesStatisticsKey({ queryKey })).toBe(false);
    }
  });
});

describe("invalidateStatisticsQueries", () => {
  it("invalidates only the statistics family", async () => {
    const queryClient = new QueryClient();
    const statisticsKey = getStatisticsControllerGetOverviewQueryKey({ period: "year" });
    const booksKey = ["/api/books", "list"];

    queryClient.setQueryData(statisticsKey, { marker: "statistics" });
    queryClient.setQueryData(booksKey, { marker: "books" });

    await invalidateStatisticsQueries(queryClient);

    expect(queryClient.getQueryState(statisticsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(booksKey)?.isInvalidated).toBe(false);
  });
});

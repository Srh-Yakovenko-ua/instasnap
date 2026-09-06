"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import { ReadingStatisticsOverviewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { StatisticsControllerGetOverviewParams } from "@/shared/api/generated/model";

import {
  getStatisticsControllerGetOverviewQueryKey,
  statisticsControllerGetOverview,
} from "@/shared/api/generated/endpoints/statistics/statistics";

export function useReadingStatisticsOverview(
  params: StatisticsControllerGetOverviewParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ReadingStatisticsOverview> =>
      ReadingStatisticsOverviewSchema.parse(await statisticsControllerGetOverview(params)),
    queryKey: getStatisticsControllerGetOverviewQueryKey(params),
  });
}

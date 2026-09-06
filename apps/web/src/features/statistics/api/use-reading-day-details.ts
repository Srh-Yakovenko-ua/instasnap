"use client";

import type { ReadingDayDetails } from "@app/shared";

import { ReadingDayDetailsSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import {
  getStatisticsControllerGetReadingDayQueryKey,
  statisticsControllerGetReadingDay,
} from "@/shared/api/generated/endpoints/statistics/statistics";

export function useReadingDayDetails(date: string) {
  return useQuery({
    queryFn: async (): Promise<ReadingDayDetails> =>
      ReadingDayDetailsSchema.parse(await statisticsControllerGetReadingDay(date)),
    queryKey: getStatisticsControllerGetReadingDayQueryKey(date),
  });
}

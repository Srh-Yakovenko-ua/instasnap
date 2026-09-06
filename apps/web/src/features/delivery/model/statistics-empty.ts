import type { StatisticsPeriodPreset } from "./statistics-period";

export type StatisticsEmptyKind = "all_time" | "filters" | "period";

export function statisticsEmptyKind({
  hasActiveFilters,
  preset,
}: {
  hasActiveFilters: boolean;
  preset: StatisticsPeriodPreset;
}): StatisticsEmptyKind {
  if (hasActiveFilters) {
    return "filters";
  }
  return preset === "all_time" ? "all_time" : "period";
}

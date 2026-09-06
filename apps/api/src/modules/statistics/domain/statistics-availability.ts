import type { StatisticsAvailability, StatisticsCoverage } from "@app/shared";

export function resolveCoverageAvailability(coverage: StatisticsCoverage): StatisticsAvailability {
  if (coverage.eligibleCount === 0 || coverage.knownCount === coverage.eligibleCount) {
    return "available";
  }
  return coverage.knownCount === 0 ? "unavailable" : "partial";
}

export function toCoverage({
  eligibleCount,
  knownCount,
}: {
  eligibleCount: number;
  knownCount: number;
}): StatisticsCoverage {
  return {
    eligibleCount,
    knownCount,
    percent: eligibleCount === 0 ? null : knownCount / eligibleCount,
  };
}

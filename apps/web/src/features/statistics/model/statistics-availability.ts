import type { Nullable, StatisticsCoverage } from "@app/shared";

export type StatisticsCoverageCaption = {
  eligibleCount: number;
  knownCount: number;
};

export function coverageCaption(
  coverage: Nullable<StatisticsCoverage> | undefined,
): Nullable<StatisticsCoverageCaption> {
  if (coverage === null || coverage === undefined) return null;
  if (coverage.percent === null) return null;
  if (coverage.knownCount >= coverage.eligibleCount) return null;
  return { eligibleCount: coverage.eligibleCount, knownCount: coverage.knownCount };
}

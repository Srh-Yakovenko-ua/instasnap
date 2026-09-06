import type {
  Nullable,
  NumericMetricComparison,
  RateMetricComparison,
  ScoreMetricComparison,
} from "@app/shared";

const PERCENT = 100;

export function toNumericComparison({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): NumericMetricComparison {
  return {
    absoluteDelta: current - previous,
    percentDelta: previous > 0 ? ((current - previous) / previous) * PERCENT : null,
    previous,
  };
}

export function toRateComparison({
  currentRate,
  previousRate,
}: {
  currentRate: number;
  previousRate: number;
}): RateMetricComparison {
  return { percentagePointDelta: (currentRate - previousRate) * PERCENT, previousRate };
}

export function toScoreComparison({
  current,
  previous,
}: {
  current: Nullable<number>;
  previous: Nullable<number>;
}): Nullable<ScoreMetricComparison> {
  if (current === null || previous === null) {
    return null;
  }
  return { absoluteDelta: current - previous, previous };
}

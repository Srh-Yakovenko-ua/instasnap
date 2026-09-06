import type { Nullable, ReadingStatisticsBucket, ReadingStatisticsGranularity } from "@app/shared";

import { formatDayShort, formatMonthShort } from "./statistics-format";

export const DYNAMICS_METRICS = ["reads", "pages"] as const;

export type DynamicsMetric = (typeof DYNAMICS_METRICS)[number];

export type DynamicsPoint = {
  bucket: ReadingStatisticsBucket;
  comparisonValue: Nullable<number>;
  key: string;
  label: string;
  value: number;
};

export function bucketValue(bucket: ReadingStatisticsBucket, metric: DynamicsMetric): number {
  return metric === "pages" ? bucket.pagesRead : bucket.completedReads;
}

export function dynamicsPoints({
  buckets,
  comparisonBuckets,
  granularity,
  locale,
  metric,
}: {
  buckets: readonly ReadingStatisticsBucket[];
  comparisonBuckets: Nullable<readonly ReadingStatisticsBucket[]>;
  granularity: ReadingStatisticsGranularity;
  locale: string;
  metric: DynamicsMetric;
}): DynamicsPoint[] {
  return buckets.map((bucket, index) => {
    const comparison = comparisonBuckets?.[index] ?? null;

    return {
      bucket,
      comparisonValue: comparison === null ? null : bucketValue(comparison, metric),
      key: bucket.start,
      label: bucketLabel({ bucket, granularity, locale }),
      value: bucketValue(bucket, metric),
    };
  });
}

function bucketLabel({
  bucket,
  granularity,
  locale,
}: {
  bucket: ReadingStatisticsBucket;
  granularity: ReadingStatisticsGranularity;
  locale: string;
}): string {
  switch (granularity) {
    case "day":
      return formatDayShort(bucket.start, locale);
    case "month":
      return formatMonthShort(bucket.start, locale);
    case "week":
      return formatDayShort(bucket.start, locale);
    case "year":
      return bucket.start.slice(0, 4);
  }
}

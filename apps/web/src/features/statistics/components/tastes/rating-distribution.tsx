"use client";

import type { ReadingStatisticsRatingBucket } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { formatRatingScore } from "../../model/statistics-format";

export function RatingDistribution({
  distribution,
}: {
  distribution: readonly ReadingStatisticsRatingBucket[];
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.ratings");
  const peak = distribution.reduce((max, bucket) => Math.max(max, bucket.completedReadCount), 0);

  return (
    <ul className="flex flex-col gap-1.5">
      {distribution.map((bucket) => (
        <li className="flex items-center gap-2" key={bucket.rating}>
          <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatRatingScore(bucket.rating, locale)}
          </span>
          <span
            aria-label={t("distributionRow", {
              count: bucket.completedReadCount,
              rating: formatRatingScore(bucket.rating, locale),
            })}
            className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
            role="img"
          >
            <span
              className="block h-full rounded-full bg-primary"
              style={{
                width: `${peak <= 0 ? 0 : (bucket.completedReadCount / peak) * 100}%`,
              }}
            />
          </span>
          <span className="w-8 shrink-0 text-end text-xs font-medium text-ink tabular-nums">
            {formatNumber(bucket.completedReadCount, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

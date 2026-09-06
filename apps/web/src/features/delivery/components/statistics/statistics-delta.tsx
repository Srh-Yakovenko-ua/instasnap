"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { StatisticsDeltaView } from "../../model/statistics-view-model";

import { formatPercentValue } from "../../model/statistics-format";

const DIRECTION_ICON = {
  down: "arrow-down",
  flat: "minus",
  up: "arrow-up",
} as const;

export function StatisticsDelta({
  className,
  delta,
  flatLabel,
  previousText,
}: {
  className?: string;
  delta: Nullable<StatisticsDeltaView>;
  flatLabel: string;
  previousText: Nullable<ReactNode>;
}) {
  const locale = useLocale();

  if (delta === null) return null;

  if (delta.direction === "flat" && delta.percent === null) {
    return (
      <span className={cn("text-[0.8125rem] text-muted-foreground", className)}>{flatLabel}</span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted-foreground",
        className,
      )}
    >
      <UiIcon className="text-icon" name={DIRECTION_ICON[delta.direction]} size={13} />
      {delta.percent === null ? null : (
        <span className="font-medium text-foreground tabular-nums">
          {formatPercentValue(Math.abs(delta.percent), locale)}
        </span>
      )}
      {previousText === null ? null : (
        <>
          {delta.percent === null ? null : <span aria-hidden="true">·</span>}
          <span>{previousText}</span>
        </>
      )}
    </span>
  );
}

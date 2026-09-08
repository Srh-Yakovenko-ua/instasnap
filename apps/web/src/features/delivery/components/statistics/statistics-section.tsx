"use client";

import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type StatisticsSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  headerClassName?: string;
  icon?: UiIconName;
  snapshotLabel?: ReactNode;
  title: ReactNode;
};

export function StatisticsMetricTabs<Metric extends string>({
  label,
  metrics,
  onChange,
  optionLabel,
  value,
}: {
  label: string;
  metrics: readonly Metric[];
  onChange: (metric: Metric) => void;
  optionLabel: (metric: Metric) => string;
  value: Metric;
}) {
  return (
    <Segmented
      label={label}
      onValueChange={(next) => onChange(next as Metric)}
      options={metrics.map((metric) => ({ label: optionLabel(metric), value: metric }))}
      value={value}
    />
  );
}

export function StatisticsSection({
  action,
  children,
  className,
  contentClassName,
  description,
  headerClassName,
  icon,
  snapshotLabel,
  title,
}: StatisticsSectionProps) {
  const heading = (
    <div
      className={
        icon === undefined
          ? "flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1"
          : "flex min-w-0 flex-col gap-0.5"
      }
    >
      <CardTitle className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold text-ink">
        {title}
        {snapshotLabel === undefined ? null : (
          <span className="rounded-full bg-info-soft px-2 py-0.5 text-[0.6875rem] font-medium text-info">
            {snapshotLabel}
          </span>
        )}
      </CardTitle>
      {description === undefined ? null : <CardDescription>{description}</CardDescription>}
    </div>
  );

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader
        className={cn(
          "flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5",
          headerClassName,
        )}
      >
        {icon === undefined ? (
          heading
        ) : (
          <div className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <UiIcon aria-hidden name={icon} size={18} />
            </span>
            {heading}
          </div>
        )}
        {action === undefined ? null : <div className="max-w-full">{action}</div>}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type StatisticsSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  note?: ReactNode;
  title: ReactNode;
};

export function StatisticsDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

export function StatisticsMetricTabs<TMetric extends string>({
  label,
  metrics,
  onChange,
  optionLabel,
  value,
}: {
  label: string;
  metrics: readonly TMetric[];
  onChange: (metric: TMetric) => void;
  optionLabel: (metric: TMetric) => string;
  value: TMetric;
}) {
  return (
    <Segmented
      label={label}
      onValueChange={(next) => {
        const picked = metrics.find((metric) => metric === next);
        if (picked !== undefined) onChange(picked);
      }}
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
  note,
  title,
}: StatisticsSectionProps) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
          <CardTitle className="font-heading text-base font-semibold text-ink">{title}</CardTitle>
          {description === undefined ? null : <CardDescription>{description}</CardDescription>}
        </div>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4", contentClassName)}>
        {children}
        {note}
      </CardContent>
    </Card>
  );
}

"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon, type UiIconName } from "@/components/icons/ui-icon";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const statCardVariants = cva(
  "flex flex-col justify-between overflow-hidden border border-border bg-card shadow-card",
  {
    variants: {
      size: {
        default: "px-[22px] py-5",
        compact: "px-3 py-3 sm:px-4 sm:py-3.5",
      },
      interactive: {
        true: "cursor-pointer transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      interactive: false,
    },
  },
);

const statCardIconBadge = cva("grid shrink-0 place-items-center rounded-full [&_svg]:size-[26px]", {
  variants: {
    size: {
      default: "size-[54px]",
      compact: "size-10 sm:size-11 [&_svg]:size-5",
    },
    tone: {
      primary: "bg-accent text-primary",
      ink: "bg-accent text-icon",
      info: "bg-info-soft text-info",
      success: "bg-success-soft text-success",
      favorite: "bg-favorite-soft text-favorite",
      genre: "bg-genre-soft text-genre",
      tag: "bg-chip-soft text-chip",
    },
  },
  defaultVariants: {
    size: "default",
    tone: "primary",
  },
});

type StatCardIconTone = "favorite" | "genre" | "info" | "ink" | "primary" | "success" | "tag";

const valueVariants = cva("font-heading leading-[1.12] font-bold text-ink tabular-nums", {
  variants: {
    size: {
      default: "text-[2rem]",
      compact: "text-2xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type StatCardProps = Omit<React.ComponentProps<typeof Card>, "children" | "size"> &
  Pick<VariantProps<typeof statCardVariants>, "size"> & {
    caption?: React.ReactNode;
    footer?: React.ReactNode;
    icon: UiIconName;
    iconSlot?: React.ReactNode;
    iconTone?: StatCardIconTone;
    label: React.ReactNode;
    microfact?: React.ReactNode;
    trend?: StatTrend;
    unit?: React.ReactNode;
    value: React.ReactNode;
    valueClassName?: string;
  };

type StatTrend = {
  direction: "down" | "up";
  label: React.ReactNode;
};

function StatCard({
  className,
  size = "default",
  icon,
  iconSlot,
  label,
  value,
  iconTone = "primary",
  caption,
  microfact,
  footer,
  trend,
  unit,
  valueClassName,
  onClick,
  ...props
}: StatCardProps) {
  const interactive = onClick !== undefined;

  const header = (
    <div
      className={cn("flex w-full items-center", size === "compact" ? "gap-2.5 sm:gap-3" : "gap-4")}
    >
      <span className={statCardIconBadge({ size, tone: iconTone })}>
        {iconSlot ?? <UiIcon name={icon} />}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
        {unit === undefined ? (
          <span className={cn(valueVariants({ size }), valueClassName)}>{value}</span>
        ) : (
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className={cn(valueVariants({ size }), valueClassName)}>{value}</span>
            <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          </span>
        )}
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[0.8125rem] font-medium [&_svg]:size-3.5",
              trend.direction === "up" ? "text-success" : "text-error",
            )}
          >
            <UiIcon name={trend.direction === "up" ? "trend-up" : "trend-down"} />
            {trend.label}
          </span>
        ) : caption === undefined ? null : (
          <span className="text-[0.8125rem] text-muted-foreground">{caption}</span>
        )}
      </div>
    </div>
  );

  const microfactBlock =
    microfact === undefined ? null : (
      <div className="mt-2.5 text-xs text-muted-foreground">{microfact}</div>
    );

  return (
    <Card
      className={cn(statCardVariants({ size, interactive }), className)}
      data-slot="stat-card"
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.currentTarget.click();
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      {footer === undefined ? (
        <>
          {header}
          {microfactBlock}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-col">
            {header}
            {microfactBlock}
          </div>
          <div className="mt-auto border-t border-border pt-2.5">{footer}</div>
        </>
      )}
    </Card>
  );
}

export { StatCard, statCardIconBadge };
export type { StatCardIconTone, StatTrend };

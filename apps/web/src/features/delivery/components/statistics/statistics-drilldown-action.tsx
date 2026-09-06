"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownLink } from "../../model/statistics-drilldown";

export type StatisticsDrilldownUnit = "books" | "orders";

type StatisticsDrilldownActionProps = {
  children: ReactNode;
  className?: string;
  isDisabled?: boolean;
  label: string;
  links: StatisticsDrilldownLink[];
  unit: StatisticsDrilldownUnit;
};

export function StatisticsDrilldownAction({
  children,
  className,
  isDisabled = false,
  label,
  links,
  unit,
}: StatisticsDrilldownActionProps) {
  const only = links.at(0);

  if (isDisabled || only === undefined) {
    return <div className={className}>{children}</div>;
  }

  if (links.length === 1) {
    return (
      <Link aria-label={label} className={cn("block", className)} href={only.href}>
        {children}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn("block w-full cursor-pointer text-left", className)}
      >
        {children}
      </DropdownMenuTrigger>
      <StatisticsDrilldownMenuContent links={links} unit={unit} />
    </DropdownMenu>
  );
}

export function StatisticsDrilldownMenuContent({
  align = "end",
  links,
  unit,
}: {
  align?: "center" | "end" | "start";
  links: StatisticsDrilldownLink[];
  unit: StatisticsDrilldownUnit;
}) {
  const t = useTranslations("delivery.statistics.drilldown");

  return (
    <DropdownMenuContent align={align} className="w-64">
      <DropdownMenuLabel>{t("openOrders")}</DropdownMenuLabel>
      {links.map((link) => (
        <DropdownMenuItem asChild key={link.destination}>
          <Link className="flex items-center justify-between gap-3" href={link.href}>
            <span>{t(`destination.${link.destination}`)}</span>
            <span className="text-muted-foreground tabular-nums">
              {t(`unit.${unit}`, {
                count: unit === "books" ? link.booksCount : link.ordersCount,
              })}
            </span>
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}

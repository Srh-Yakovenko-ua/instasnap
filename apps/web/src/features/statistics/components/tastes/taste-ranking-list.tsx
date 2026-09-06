"use client";

import type { ReadingStatisticsContextAction } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { toContextActionLinks } from "../../model/statistics-drilldown";

const COLLAPSED_ROWS = 3;

export type TasteRankingRow = {
  contextActions?: readonly ReadingStatisticsContextAction[];
  key: string;
  label: string;
  secondary?: ReactNode;
  value: number;
  valueLabel: string;
};

export function TasteRankingList({ rows }: { rows: readonly TasteRankingRow[] }) {
  const t = useTranslations("statistics.rankings");
  const [expanded, setExpanded] = useState(false);
  const peak = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const hiddenCount = Math.max(rows.length - COLLAPSED_ROWS, 0);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            className={cn(
              "flex flex-col gap-1.5",
              index >= COLLAPSED_ROWS && !expanded && "hidden lg:flex",
            )}
            key={row.key}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                <TasteContextActions actions={row.contextActions ?? []} />
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {row.secondary === undefined ? null : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {row.secondary}
                  </span>
                )}
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {row.valueLabel}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${peak <= 0 ? 0 : (row.value / peak) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {hiddenCount === 0 ? null : (
        <Button
          className="self-start lg:hidden"
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          variant="ghost"
        >
          {expanded ? t("showLess") : t("showMore", { count: hiddenCount })}
        </Button>
      )}
    </div>
  );
}

function TasteContextActions({ actions }: { actions: readonly ReadingStatisticsContextAction[] }) {
  const tActions = useTranslations("statistics.contextActions");
  const links = toContextActionLinks(actions);

  if (links.length === 0) return null;

  return (
    <>
      {links.map((link) => (
        <Link
          aria-label={tActions(link.kind)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          href={link.href}
          key={link.kind}
        >
          <UiIcon aria-hidden name="arrow-up-right" size={14} />
        </Link>
      ))}
    </>
  );
}

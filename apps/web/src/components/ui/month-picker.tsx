"use client";

import { addMonths, format, getYear, isBefore, parseISO } from "date-fns";
import { useLocale } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateFnsLocale } from "@/lib/format";

const MONTH_PICKER = {
  isoFormat: "yyyy-MM-dd",
  monthsPerYear: 12,
  optionFormat: "LLLL",
  triggerFormat: "LLLL yyyy",
} as const;

const triggerClassName =
  "flex h-10 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-field px-3 text-sm whitespace-nowrap transition-colors outline-none select-none hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

type MonthPickerProps = {
  ariaLabel?: string;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  max?: string;
  min?: string;
  nextYearLabel: string;
  onChange: (month: string) => void;
  previousYearLabel: string;
  value: string;
};

export function MonthPicker({
  ariaLabel,
  describedBy,
  id,
  invalid,
  max,
  min,
  nextYearLabel,
  onChange,
  previousYearLabel,
  value,
}: MonthPickerProps) {
  const locale = useLocale();
  const dfLocale = dateFnsLocale(locale);
  const selected = parseISO(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => getYear(selected));

  const yearStart = parseISO(`${year}-01-01`);
  const months = Array.from({ length: MONTH_PICKER.monthsPerYear }, (_, index) =>
    addMonths(yearStart, index),
  );
  const canGoPrevious = min === undefined || year - 1 >= getYear(parseISO(min));
  const canGoNext = max === undefined || year + 1 <= getYear(parseISO(max));

  function handleOpenChange(next: boolean) {
    if (next) setYear(getYear(selected));
    setOpen(next);
  }

  function handleSelect(month: Date) {
    onChange(format(month, MONTH_PICKER.isoFormat));
    setOpen(false);
  }

  function isOutOfRange(month: Date): boolean {
    if (min !== undefined && isBefore(month, parseISO(min))) return true;
    return max !== undefined && isBefore(parseISO(max), month);
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid === true || undefined}
        aria-label={ariaLabel}
        className={triggerClassName}
        id={id}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <UiIcon
            aria-hidden
            className="shrink-0 text-muted-foreground"
            name="calendar"
            size={16}
          />
          <span className="truncate">
            {format(selected, MONTH_PICKER.triggerFormat, { locale: dfLocale })}
          </span>
        </span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground"
          name="chevron-down"
          size={16}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-center justify-between gap-1">
          <Button
            aria-label={previousYearLabel}
            disabled={!canGoPrevious}
            onClick={() => setYear((current) => current - 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="chevron-left" size={16} />
          </Button>
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <Button
            aria-label={nextYearLabel}
            disabled={!canGoNext}
            onClick={() => setYear((current) => current + 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="chevron-right" size={16} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {months.map((month) => {
            const iso = format(month, MONTH_PICKER.isoFormat);
            return (
              <Button
                className="w-full px-1 text-xs capitalize"
                disabled={isOutOfRange(month)}
                key={iso}
                onClick={() => handleSelect(month)}
                size="sm"
                type="button"
                variant={iso === value ? "default" : "ghost"}
              >
                {format(month, MONTH_PICKER.optionFormat, { locale: dfLocale })}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

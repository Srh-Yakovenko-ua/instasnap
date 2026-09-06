"use client";

import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { type DropdownProps, type Matcher } from "react-day-picker";

import { UiIcon } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateFnsLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  allowFuture?: boolean;
  ariaLabel?: string;
  className?: string;
  defaultMonth?: Date;
  describedBy?: string;
  disabled?: boolean;
  disablePast?: boolean;
  endMonth?: Date;
  id: string;
  invalid?: boolean;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  startMonth?: Date;
  value?: Date;
  weekStartsOn?: WeekStartsOn;
};

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_PICKER = { dayFormat: "d MMMM yyyy" } as const;

export function DatePicker({
  allowFuture = false,
  ariaLabel,
  className,
  defaultMonth,
  describedBy,
  disabled,
  disablePast = false,
  endMonth,
  id,
  invalid,
  onChange,
  placeholder,
  startMonth,
  value,
  weekStartsOn,
}: DatePickerProps) {
  const t = useTranslations("auth.datePicker");
  const locale = useLocale();
  const dfLocale = dateFnsLocale(locale);
  const [open, setOpen] = useState(false);

  const today = new Date();
  const disabledMatchers: Matcher[] = [
    ...(allowFuture ? [] : [{ after: today }]),
    ...(disablePast ? [{ before: today }] : []),
  ];

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid === true || undefined}
        aria-label={ariaLabel ?? t("triggerLabel")}
        className={cn(
          "relative flex h-12 w-full cursor-pointer items-center rounded-md border border-border bg-card pr-3.5 pl-11 text-left text-base transition-[border-color,box-shadow] duration-150 outline-none",
          "hover:border-accent-border",
          "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/20",
          "data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-ring/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid === true &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15 data-[state=open]:border-destructive data-[state=open]:ring-destructive/15",
          value ? "text-foreground" : "text-muted-foreground",
          className,
        )}
        disabled={disabled}
        id={id}
      >
        <UiIcon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3.5",
            invalid === true ? "text-destructive" : "text-muted-foreground",
          )}
          name="calendar"
          size={18}
        />
        {value
          ? format(value, DATE_PICKER.dayFormat, { locale: dfLocale })
          : (placeholder ?? t("placeholder"))}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2.5"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const content = event.currentTarget;
          if (!(content instanceof HTMLElement)) return;
          const day = content.querySelector<HTMLButtonElement>(
            '[role="grid"] button[tabindex="0"]',
          );
          day?.focus();
        }}
      >
        <Calendar
          captionLayout="dropdown"
          className="p-0 [--cell-size:--spacing(8.5)]"
          classNames={{
            dropdowns: "flex w-full items-center gap-2",
            month_caption: "mb-3 flex h-auto w-full items-center justify-center px-0",
            months: "gap-3",
            nav: "hidden",
          }}
          components={{ Dropdown: CalendarDropdown }}
          defaultMonth={value ?? defaultMonth}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          endMonth={endMonth}
          labels={{
            labelMonthDropdown: () => t("monthLabel"),
            labelYearDropdown: () => t("yearLabel"),
          }}
          locale={dfLocale}
          mode="single"
          onSelect={(date) => {
            onChange(date);
            if (date) setOpen(false);
          }}
          selected={value}
          startMonth={startMonth}
          weekStartsOn={weekStartsOn}
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarDropdown({ options, value, onChange, "aria-label": ariaLabel }: DropdownProps) {
  const handleValueChange = (next: string) => {
    onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <Select onValueChange={handleValueChange} value={value?.toString()}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-9 flex-1 gap-1 rounded-sm border-border bg-card px-2.5 font-medium"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options?.map((option) => (
          <SelectItem disabled={option.disabled} key={option.value} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

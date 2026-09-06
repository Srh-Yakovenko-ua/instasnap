"use client";

import type { StatisticsCalendarDay } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { StatisticsBookCover } from "../details/statistics-book-cover";

export function ReadingDayPreview({
  className,
  day,
}: {
  className?: string;
  day: StatisticsCalendarDay;
}) {
  const t = useTranslations("statistics.calendar.books");

  return (
    <span className={cn("flex items-center gap-1", className)}>
      {day.booksPreview.map((book) => (
        <StatisticsBookCover
          className="w-6"
          coverThumbUrl={book.coverThumbUrl}
          key={book.bookId}
          title={book.title}
        />
      ))}
      {day.remainingBooksCount === 0 ? null : (
        <span className="text-[0.625rem] font-medium text-muted-foreground tabular-nums">
          {t("more", { count: day.remainingBooksCount })}
        </span>
      )}
    </span>
  );
}

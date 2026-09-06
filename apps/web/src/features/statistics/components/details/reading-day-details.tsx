"use client";

import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import { useReadingDayDetails } from "../../api/use-reading-day-details";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { StatisticsBookCover } from "./statistics-book-cover";

export function ReadingDayDetails({ date }: { date: string }) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.day");
  const { data, isError, isPending, refetch } = useReadingDayDetails(date);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </output>
    );
  }

  if (isError || data === undefined) {
    return (
      <StatisticsSectionState
        action={
          <button
            className="cursor-pointer text-xs font-medium text-primary underline"
            onClick={() => void refetch()}
            type="button"
          >
            {t("retry")}
          </button>
        }
        kind="error"
        title={t("error")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        {t("summary", { books: data.booksCount, pages: formatNumber(data.pagesRead, locale) })}
      </p>

      {data.books.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.books.map((book) => (
            <li className="flex items-center gap-3" key={book.bookId}>
              <StatisticsBookCover
                className="w-9 shrink-0"
                coverThumbUrl={book.coverThumbUrl}
                title={book.title}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{book.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("bookPages", { pages: formatNumber(book.pagesRead, locale) })}
                </span>
                {book.bookState === "soft_deleted" ? (
                  <span className="text-xs text-muted-foreground">{t("deletedBook")}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.historyQuality === "legacy_observed_only" ? (
        <StatisticsNote>{t("legacyQuality")}</StatisticsNote>
      ) : null}
    </div>
  );
}

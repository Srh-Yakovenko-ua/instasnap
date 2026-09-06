"use client";

import type { CompletedReadRef } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { RatingScore } from "@/components/ui/rating-score";
import { Link } from "@/i18n/navigation";

import { toContextActionLinks } from "../../model/statistics-drilldown";
import { formatDayLong } from "../../model/statistics-format";
import { StatisticsBookCover } from "./statistics-book-cover";

export function CompletedReadDetails({ read }: { read: CompletedReadRef }) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.completedRead");
  const tActions = useTranslations("statistics.contextActions");
  const links = toContextActionLinks(read.contextActions);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <StatisticsBookCover
          className="w-14 shrink-0"
          coverThumbUrl={read.book.coverThumbUrl}
          title={read.book.title}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{read.book.title}</span>
          {read.authorName === null ? null : (
            <span className="text-xs text-muted-foreground">{read.authorName}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {t("finishedAt", { date: formatDayLong(read.finishedAt, locale) })}
          </span>
          {read.rating === null ? (
            <span className="text-xs text-muted-foreground">{t("noRating")}</span>
          ) : (
            <RatingScore value={read.rating} />
          )}
        </div>
      </div>

      {read.book.bookState === "soft_deleted" ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon aria-hidden name="book-x" size={13} />
          {t("deletedBook")}
        </p>
      ) : null}

      {links.length === 0 ? null : (
        <div className="flex flex-col gap-1 border-t border-border pt-2.5">
          <span className="text-xs font-medium text-muted-foreground">{t("relatedTitle")}</span>
          {links.map((link) => (
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              href={link.href}
              key={link.kind}
            >
              <UiIcon aria-hidden name="arrow-up-right" size={14} />
              {tActions(link.kind)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { ReadingStatisticsRecord, ReadingStatisticsRecordsSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthKey } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

const RECORD_ICON = {
  fastest_completed_read: "clock",
  longest_completed_book: "pages",
  longest_series_marathon: "book-copy",
  longest_streak: "flame",
  most_pages_in_day: "chart-increasing",
  peak_month: "calendar",
  shortest_completed_book: "book",
} as const satisfies Record<ReadingStatisticsRecord["type"], UiIconName>;

export function RecordsSection({ records }: { records: ReadingStatisticsRecordsSection }) {
  const t = useTranslations("statistics.records");

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      {records.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {records.items.map((record) => (
            <li className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink" key={record.type}>
              <RecordCard record={record} />
            </li>
          ))}
        </ul>
      )}
    </StatisticsSection>
  );
}

function RecordBody({ record }: { record: ReadingStatisticsRecord }): ReactNode {
  const locale = useLocale();
  const t = useTranslations("statistics.records");

  switch (record.type) {
    case "fastest_completed_read":
      return (
        <RecordText
          detail={formatDayLong(record.data.finishedAt, locale)}
          headline={record.data.book.title}
          value={t("values.elapsedDays", { count: record.data.elapsedDays })}
        />
      );
    case "longest_completed_book":
    case "shortest_completed_book":
      return (
        <RecordText
          detail={formatDayLong(record.data.finishedAt, locale)}
          headline={record.data.book.title}
          value={t("values.pages", { count: record.data.pagesCount })}
        />
      );
    case "longest_series_marathon":
      return (
        <RecordText
          detail={formatDayLong(record.data.endFinishedAt, locale)}
          headline={record.data.name}
          value={t("values.marathon", { count: record.data.length })}
        />
      );
    case "longest_streak":
      return (
        <RecordText
          detail={
            record.data.startDate === null || record.data.endDate === null
              ? undefined
              : `${formatDayLong(record.data.startDate, locale)} – ${formatDayLong(record.data.endDate, locale)}`
          }
          headline={t("values.streakDays", { count: record.data.days })}
        />
      );
    case "most_pages_in_day":
      return (
        <RecordText
          detail={formatDayLong(record.data.date, locale)}
          headline={t("values.pages", { count: record.data.pagesRead })}
        />
      );
    case "peak_month":
      return (
        <RecordText
          detail={t("values.peakMonthDetail", {
            pages: formatNumber(record.data.pagesRead, locale),
            reads: record.data.completedReads,
          })}
          headline={formatMonthKey(record.data.month, locale)}
        />
      );
  }
}

function RecordCard({ record }: { record: ReadingStatisticsRecord }) {
  const locale = useLocale();
  const t = useTranslations("statistics.records");

  const card = (
    <Card className="flex h-full flex-col gap-1.5 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <UiIcon aria-hidden className="text-primary" name={RECORD_ICON[record.type]} size={14} />
        {t(`types.${record.type}`)}
      </span>
      <RecordBody record={record} />
    </Card>
  );

  if (record.type !== "most_pages_in_day") return card;

  const detailDate = resolveReadingDayTarget(record.data.drilldown);
  if (detailDate === null) return card;

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      label={t(`types.${record.type}`)}
      title={formatDayLong(detailDate, locale)}
      triggerClassName="w-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {card}
    </StatisticsDetailSurface>
  );
}

function RecordText({
  detail,
  headline,
  value,
}: {
  detail?: string;
  headline: string;
  value?: string;
}) {
  return (
    <>
      <span className="font-heading text-base leading-snug font-semibold text-ink">{headline}</span>
      {value === undefined ? null : (
        <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
      )}
      {detail === undefined ? null : (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </>
  );
}

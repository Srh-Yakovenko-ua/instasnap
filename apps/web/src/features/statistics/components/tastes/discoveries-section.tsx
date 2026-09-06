"use client";

import type { Nullable, ReadingStatisticsDiscoveriesSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";

import { formatDayShort, formatRatingScore } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";

type DiscoveryCard = {
  averageRating: Nullable<number>;
  completedReadsAfterDiscovery: number;
  firstFinishedAt: string;
  kind: "author" | "genre" | "publisher";
  name: string;
};

export function DiscoveriesSection({
  discoveries,
}: {
  discoveries: ReadingStatisticsDiscoveriesSection;
}) {
  const t = useTranslations("statistics.discoveries");
  const cards = toCards(discoveries);

  if (discoveries.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t(`reason.${discoveries.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      description={t("description")}
      note={
        discoveries.availability === "partial" ? (
          <StatisticsNote>{t("partialNote")}</StatisticsNote>
        ) : null
      }
      title={t("title")}
    >
      <p className="text-sm text-muted-foreground">
        {t("counts", {
          authors: discoveries.newAuthorsCount,
          genres: discoveries.newGenresCount,
          publishers: discoveries.newPublishersCount,
        })}
      </p>

      {cards.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {cards.map((card) => (
            <li className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink" key={card.kind}>
              <DiscoveryCardView card={card} />
            </li>
          ))}
        </ul>
      )}
    </StatisticsSection>
  );
}

function DiscoveryCardView({ card }: { card: DiscoveryCard }): ReactNode {
  const locale = useLocale();
  const t = useTranslations("statistics.discoveries");

  return (
    <Card className="flex h-full flex-col gap-1 px-4 py-3.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t(`kinds.${card.kind}`)}
      </span>
      <span className="font-heading text-base font-semibold text-ink">{card.name}</span>
      <span className="text-xs text-muted-foreground">
        {t("firstRead", { date: formatDayShort(card.firstFinishedAt, locale) })}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("afterDiscovery", { count: card.completedReadsAfterDiscovery })}
        {card.averageRating === null
          ? null
          : ` · ${t("averageRating", { value: formatRatingScore(card.averageRating, locale) })}`}
      </span>
    </Card>
  );
}

function toCards(discoveries: ReadingStatisticsDiscoveriesSection): DiscoveryCard[] {
  const cards: DiscoveryCard[] = [];

  if (discoveries.author !== null) {
    cards.push({ ...discoveries.author, kind: "author" });
  }
  if (discoveries.genre !== null) {
    cards.push({ ...discoveries.genre, kind: "genre", name: discoveries.genre.genreKey });
  }
  if (discoveries.publisher !== null) {
    cards.push({ ...discoveries.publisher, kind: "publisher" });
  }

  return cards;
}

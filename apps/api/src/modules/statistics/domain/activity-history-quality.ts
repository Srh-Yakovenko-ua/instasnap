import type {
  Nullable,
  ReadingStatisticsMeta,
  StatisticsCalendarHistoryQuality,
} from "@app/shared";

export type ActivityHistoryQuality = ReadingStatisticsMeta["activityHistory"];

export function isRangeFullyReliable({
  from,
  reliableFrom,
}: {
  from: Nullable<string>;
  reliableFrom: string;
}): boolean {
  return from !== null && from >= reliableFrom;
}

export function resolveActivityHistoryQuality({
  periodFrom,
  reliableFrom,
}: {
  periodFrom: Nullable<string>;
  reliableFrom: string;
}): ActivityHistoryQuality {
  if (periodFrom !== null && periodFrom >= reliableFrom) {
    return { reliableFrom, selectedPeriodQuality: "exact" };
  }

  return {
    reason: "LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED",
    reliableFrom,
    selectedPeriodQuality: "legacy_lower_bound",
  };
}

export function resolveDayHistoryQuality({
  date,
  reliableFrom,
}: {
  date: string;
  reliableFrom: string;
}): StatisticsCalendarHistoryQuality {
  return date >= reliableFrom ? "exact" : "legacy_observed_only";
}

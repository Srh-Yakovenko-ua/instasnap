import type { Nullable, ReadingStatus } from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";
import { toNullableIsoDate } from "../../../core/iso-date.js";

export type ReadingLifecycleDates = {
  abandonedAt: Nullable<Date>;
  finishedAt: Nullable<Date>;
  pausedAt: Nullable<Date>;
  startedAt: Nullable<Date>;
};

export function resolveReadingLifecycleDate({
  dates,
  readingStatus,
  today,
}: {
  dates: ReadingLifecycleDates;
  readingStatus: ReadingStatus;
  today: string;
}): string {
  return toNullableIsoDate(anchorDate({ dates, readingStatus })) ?? today;
}

function anchorDate({
  dates,
  readingStatus,
}: {
  dates: ReadingLifecycleDates;
  readingStatus: ReadingStatus;
}): Nullable<Date> {
  switch (readingStatus) {
    case "dnf":
      return dates.abandonedAt;
    case "finished":
      return dates.finishedAt;
    case "not_started":
    case "want_to_read":
      return null;
    case "paused":
      return dates.pausedAt;
    case "reading":
    case "rereading":
      return dates.startedAt;
    default:
      return assertNever(readingStatus);
  }
}

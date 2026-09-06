import type { Nullable, StatisticsStreakSpan } from "@app/shared";

import { addDays, format, parseISO } from "date-fns";

const ISO_DAY_FORMAT = "yyyy-MM-dd";

export type CurrentStreakSpan = StatisticsStreakSpan & {
  continuesBeforeRange: boolean;
  continuesBeforeReliableHistory: boolean;
};

export function findCurrentStreak({
  activeBeforeRange,
  activeDays,
  rangeFrom,
  reliableFrom,
  today,
}: {
  activeBeforeRange: boolean;
  activeDays: string[];
  rangeFrom: string;
  reliableFrom: string;
  today: string;
}): CurrentStreakSpan {
  const active = new Set(activeDays);
  const yesterday = shiftDay(today, -1);
  const anchor = active.has(today) ? today : active.has(yesterday) ? yesterday : null;

  if (anchor === null) {
    return {
      continuesBeforeRange: false,
      continuesBeforeReliableHistory: false,
      days: 0,
      endDate: null,
      startDate: null,
    };
  }

  let start = anchor;
  let days = 1;
  let previous = shiftDay(start, -1);
  while (previous >= rangeFrom && active.has(previous)) {
    start = previous;
    days += 1;
    previous = shiftDay(start, -1);
  }

  return {
    continuesBeforeRange: start === rangeFrom && activeBeforeRange,
    continuesBeforeReliableHistory: start <= reliableFrom,
    days,
    endDate: anchor,
    startDate: start,
  };
}

export function findLongestStreak(activeDays: string[]): StatisticsStreakSpan {
  const sorted = [...new Set(activeDays)].sort();
  let best: StatisticsStreakSpan = { days: 0, endDate: null, startDate: null };
  let runStart: Nullable<string> = null;
  let runLength = 0;
  let previous: Nullable<string> = null;

  for (const day of sorted) {
    const continues = previous !== null && shiftDay(previous, 1) === day;
    runStart = continues ? runStart : day;
    runLength = continues ? runLength + 1 : 1;
    if (runLength > best.days && runStart !== null) {
      best = { days: runLength, endDate: day, startDate: runStart };
    }
    previous = day;
  }

  return best;
}

function shiftDay(isoDay: string, offset: number): string {
  return format(addDays(parseISO(isoDay), offset), ISO_DAY_FORMAT);
}

import type {
  Nullable,
  ReadingStatisticsBucket,
  ReadingStatisticsRecord,
  StatisticsStreakSpan,
} from "@app/shared";

import { RECORDS_LIMIT } from "@app/shared";

import type { CompletedRead } from "./completed-read.js";
import type { DayActivity } from "./reading-calendar.js";
import type { SeriesMarathon } from "./reading-series.js";
import type { StatisticsPeriodScope } from "./statistics-drilldown.js";

import { toBookRef } from "./completed-read.js";
import { compareByDuration, toDurationSamples } from "./reading-duration.js";
import { toReadingCycleDrilldown, toReadingDayDrilldown } from "./statistics-drilldown.js";

const MIN_STREAK_RECORD_DAYS = 2;

const MIN_PEAK_MONTH_BUCKETS = 2;

export type RecordEngineInput = {
  activity: DayActivity[];
  marathon: Nullable<SeriesMarathon>;
  monthlyBuckets: ReadingStatisticsBucket[];
  periodScope: StatisticsPeriodScope;
  reads: CompletedRead[];
  streak: StatisticsStreakSpan;
};

export function buildReadingRecords(input: RecordEngineInput): ReadingStatisticsRecord[] {
  const candidates = [
    longestBook(input),
    mostPagesInDay(input),
    fastestRead(input),
    longestMarathon(input),
    longestStreak(input),
    peakMonth(input),
    shortestBook(input),
  ];

  return candidates.flatMap((record) => (record === null ? [] : [record])).slice(0, RECORDS_LIMIT);
}

function bookLengthRecord({
  input,
  order,
  type,
}: {
  input: RecordEngineInput;
  order: "longest" | "shortest";
  type: "longest_completed_book" | "shortest_completed_book";
}): Nullable<ReadingStatisticsRecord> {
  const measured = input.reads.filter((read) => read.pagesCount !== null && read.pagesCount > 0);
  const winner = [...measured].sort((left, right) => {
    const leftPages = left.pagesCount ?? 0;
    const rightPages = right.pagesCount ?? 0;
    if (leftPages !== rightPages) {
      return order === "longest" ? rightPages - leftPages : leftPages - rightPages;
    }
    if (left.finishedAt !== right.finishedAt) {
      return right.finishedAt.localeCompare(left.finishedAt);
    }
    return left.readingCycleId.localeCompare(right.readingCycleId);
  })[0];

  if (winner === undefined || winner.pagesCount === null) {
    return null;
  }

  return {
    data: {
      book: toBookRef(winner),
      drilldown: toReadingCycleDrilldown(winner),
      finishedAt: winner.finishedAt,
      pagesCount: winner.pagesCount,
      readingCycleId: winner.readingCycleId,
    },
    type,
  };
}

function fastestRead(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  const winner = toDurationSamples(input.reads).sort(compareByDuration)[0];
  if (winner === undefined) {
    return null;
  }

  return {
    data: {
      book: toBookRef(winner.read),
      drilldown: toReadingCycleDrilldown(winner.read),
      elapsedDays: winner.elapsedDays,
      finishedAt: winner.read.finishedAt,
      readingCycleId: winner.read.readingCycleId,
    },
    type: "fastest_completed_read",
  };
}

function longestBook(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  return bookLengthRecord({ input, order: "longest", type: "longest_completed_book" });
}

function longestMarathon(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  const { marathon } = input;
  if (marathon === null) {
    return null;
  }

  return {
    data: {
      endFinishedAt: marathon.endFinishedAt,
      length: marathon.length,
      name: marathon.name,
      seriesId: marathon.seriesId,
    },
    type: "longest_series_marathon",
  };
}

function longestStreak(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  return input.streak.days >= MIN_STREAK_RECORD_DAYS
    ? { data: input.streak, type: "longest_streak" }
    : null;
}

function mostPagesInDay(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  const winner = [...input.activity]
    .filter((day) => day.pagesRead > 0)
    .sort((left, right) => {
      if (left.pagesRead !== right.pagesRead) {
        return right.pagesRead - left.pagesRead;
      }
      return right.date.localeCompare(left.date);
    })[0];

  if (winner === undefined) {
    return null;
  }

  return {
    data: {
      date: winner.date,
      drilldown: toReadingDayDrilldown(winner.date),
      pagesRead: winner.pagesRead,
    },
    type: "most_pages_in_day",
  };
}

function peakMonth(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  if (input.monthlyBuckets.length < MIN_PEAK_MONTH_BUCKETS) {
    return null;
  }

  const winner = [...input.monthlyBuckets]
    .filter((bucket) => bucket.completedReads > 0)
    .sort((left, right) => {
      if (left.completedReads !== right.completedReads) {
        return right.completedReads - left.completedReads;
      }
      return right.start.localeCompare(left.start);
    })[0];

  if (winner === undefined) {
    return null;
  }

  return {
    data: {
      completedReads: winner.completedReads,
      month: winner.start.slice(0, 7),
      pagesRead: winner.pagesRead,
    },
    type: "peak_month",
  };
}

function shortestBook(input: RecordEngineInput): Nullable<ReadingStatisticsRecord> {
  return bookLengthRecord({ input, order: "shortest", type: "shortest_completed_book" });
}

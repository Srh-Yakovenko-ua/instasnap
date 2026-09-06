import type { Nullable } from "@app/shared";

import { differenceInCalendarDays, parseISO } from "date-fns";

import type { CompletedRead } from "./completed-read.js";

export type CompletedReadDuration = { elapsedDays: number; read: CompletedRead };

export function compareByDuration(
  left: CompletedReadDuration,
  right: CompletedReadDuration,
): number {
  if (left.elapsedDays !== right.elapsedDays) {
    return left.elapsedDays - right.elapsedDays;
  }
  if (left.read.finishedAt !== right.read.finishedAt) {
    return right.read.finishedAt.localeCompare(left.read.finishedAt);
  }
  return left.read.readingCycleId.localeCompare(right.read.readingCycleId);
}

export function elapsedDaysOf(read: CompletedRead): Nullable<number> {
  const { finishedAt, startedAt } = read;
  if (startedAt === null || startedAt > finishedAt) {
    return null;
  }
  return differenceInCalendarDays(parseISO(finishedAt), parseISO(startedAt)) + 1;
}

export function toDurationSamples(reads: CompletedRead[]): CompletedReadDuration[] {
  return reads.flatMap((read) => {
    const elapsedDays = elapsedDaysOf(read);
    return elapsedDays === null ? [] : [{ elapsedDays, read }];
  });
}

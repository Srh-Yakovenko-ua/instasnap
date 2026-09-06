import type { Nullable, ReadingStatus, ValueOf } from "@app/shared";

import { isBefore } from "date-fns";
import { z } from "zod";

import { assertNever } from "../../../core/assert-never.js";
import { toNullableIsoDate } from "../../../core/iso-date.js";

export const READING_CYCLE_STATE = {
  abandoned: "abandoned",
  active: "active",
  dnf: "dnf",
  finished: "finished",
} as const;

export const FIRST_COMPLETION_RELIABILITY = {
  firstKnownOnly: "first_known_only",
  notFirst: "not_first",
  provenFirst: "proven_first",
} as const;

export const READING_CYCLE_METADATA_PROVENANCE = {
  legacyCurrentMetadata: "legacy_current_metadata",
  trackedAtCompletion: "tracked_at_completion",
} as const;

export const ReadingCycleStateSchema = z.enum([
  READING_CYCLE_STATE.active,
  READING_CYCLE_STATE.finished,
  READING_CYCLE_STATE.dnf,
  READING_CYCLE_STATE.abandoned,
]);

export type FirstCompletionReliability = ValueOf<typeof FIRST_COMPLETION_RELIABILITY>;

export type ReadingCycleCommand =
  | { cycleId: string; date: string; kind: "edit_terminal"; state: TerminalReadingCycleState }
  | { date: string; kind: "finalize_active"; state: TerminalReadingCycleState }
  | {
      date: string;
      kind: "repair_finalized";
      startedAt: Nullable<string>;
      state: TerminalReadingCycleState;
    }
  | { kind: "keep_active" }
  | { kind: "noop" }
  | { kind: "start"; startedAt: string };

export type ReadingCycleSnapshot = {
  endedAt: Nullable<Date>;
  finishedAt: Nullable<Date>;
  id: string;
  startedAt: Nullable<Date>;
  state: ReadingCycleState;
};

export type ReadingCycleState = z.infer<typeof ReadingCycleStateSchema>;

export type ReadingCycleTransitionInput = {
  activeCycle: Nullable<ReadingCycleSnapshot>;
  currentStatus: ReadingStatus;
  date: string;
  existingStartedAt: Nullable<Date>;
  latestTerminalCycle: Nullable<ReadingCycleSnapshot>;
  targetStatus: ReadingStatus;
};

export type TerminalReadingCycleState = Exclude<ReadingCycleState, "active">;

export function planReadingCycleCommand(input: ReadingCycleTransitionInput): ReadingCycleCommand {
  switch (input.targetStatus) {
    case "dnf":
      return planTerminalCommand({ input, state: READING_CYCLE_STATE.dnf });
    case "finished":
      return planTerminalCommand({ input, state: READING_CYCLE_STATE.finished });
    case "not_started":
    case "want_to_read":
      return input.activeCycle === null
        ? { kind: "noop" }
        : { date: input.date, kind: "finalize_active", state: READING_CYCLE_STATE.abandoned };
    case "paused":
    case "reading":
      return input.activeCycle === null
        ? { kind: "start", startedAt: resumeStartDate(input) }
        : { kind: "keep_active" };
    case "rereading":
      return input.activeCycle === null
        ? { kind: "start", startedAt: input.date }
        : { kind: "keep_active" };
    default:
      return assertNever(input.targetStatus);
  }
}

export function resolveFirstCompletionReliability({
  bookCreatedAt,
  cycleHistoryCutoverAt,
  hasEarlierFinishedCycle,
}: {
  bookCreatedAt: Date;
  cycleHistoryCutoverAt: Date;
  hasEarlierFinishedCycle: boolean;
}): FirstCompletionReliability {
  if (hasEarlierFinishedCycle) {
    return FIRST_COMPLETION_RELIABILITY.notFirst;
  }
  return isBefore(bookCreatedAt, cycleHistoryCutoverAt)
    ? FIRST_COMPLETION_RELIABILITY.firstKnownOnly
    : FIRST_COMPLETION_RELIABILITY.provenFirst;
}

function planTerminalCommand({
  input,
  state,
}: {
  input: ReadingCycleTransitionInput;
  state: TerminalReadingCycleState;
}): ReadingCycleCommand {
  const { activeCycle, currentStatus, latestTerminalCycle, targetStatus } = input;
  if (activeCycle !== null) {
    return { date: input.date, kind: "finalize_active", state };
  }
  if (
    currentStatus === targetStatus &&
    latestTerminalCycle !== null &&
    latestTerminalCycle.state === state
  ) {
    return { cycleId: latestTerminalCycle.id, date: input.date, kind: "edit_terminal", state };
  }
  return {
    date: input.date,
    kind: "repair_finalized",
    startedAt: repairStartDate(input),
    state,
  };
}

function repairStartDate({
  date,
  existingStartedAt,
}: ReadingCycleTransitionInput): Nullable<string> {
  const startedAt = toNullableIsoDate(existingStartedAt);
  if (startedAt === null || startedAt > date) {
    return null;
  }
  return startedAt;
}

function resumeStartDate({ date, existingStartedAt }: ReadingCycleTransitionInput): string {
  const startedAt = toNullableIsoDate(existingStartedAt);
  if (startedAt === null || startedAt > date) {
    return date;
  }
  return startedAt;
}

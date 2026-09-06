import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingCompletionSnapshot } from "../domain/reading-completion-snapshot.js";
import type {
  FirstCompletionReliability,
  ReadingCycleSnapshot,
  TerminalReadingCycleState,
} from "../domain/reading-cycle.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { READING_CYCLE_STATE, ReadingCycleStateSchema } from "../domain/reading-cycle.js";

const completionMetadataSelect = {
  authors: {
    orderBy: { position: "asc" },
    select: { author: { select: { id: true, name: true } } },
  },
  createdAt: true,
  genres: true,
  language: true,
  pagesCount: true,
  partNumber: true,
  publisher: { select: { id: true, name: true } },
  series: { select: { id: true, name: true, status: true, totalBooks: true } },
  title: true,
} satisfies Prisma.BookSelect;

const cycleSnapshotSelect = {
  endedAt: true,
  finishedAt: true,
  id: true,
  startedAt: true,
  state: true,
} satisfies Prisma.BookReadingCycleSelect;

export type CompletionMetadataSource = Prisma.BookGetPayload<{
  select: typeof completionMetadataSelect;
}>;

export type LegacyBackfillCandidate = {
  bookId: string;
  finishedAt: Date;
  rating: Nullable<number>;
  startedAt: Nullable<Date>;
  userId: string;
};

export type OwnedReadingCycle = ReadingCycleSnapshot & { bookId: string };

export type ReadingCycleContext = {
  activeCycle: Nullable<ReadingCycleSnapshot>;
  hasFinishedCycle: boolean;
  latestTerminalCycle: Nullable<ReadingCycleSnapshot>;
};

export type ReadingCycleFinalization = {
  completionMetadata: Nullable<ReadingCompletionSnapshot>;
  date: string;
  firstCompletionReliability: Nullable<FirstCompletionReliability>;
  rating: Nullable<number>;
  state: TerminalReadingCycleState;
};

@Injectable()
export class ReadingCycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countDuplicateActiveCycles(
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const rows = await client.bookReadingCycle.groupBy({
      _count: { _all: true },
      by: ["bookId"],
      having: { bookId: { _count: { gt: 1 } } },
      where: { state: READING_CYCLE_STATE.active },
    });
    return rows.length;
  }

  countSeriesKnownBooks(
    { seriesId, userId }: { seriesId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.book.count({ where: { ...SOFT_DELETE_SCOPE.active, seriesId, userId } });
  }

  async createActiveCycle(
    { bookId, startedAt, userId }: { bookId: string; startedAt: Nullable<string>; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const created = await client.bookReadingCycle.create({
      data: {
        bookId,
        startedAt: toNullableDate(startedAt),
        state: READING_CYCLE_STATE.active,
        userId,
      },
      select: { id: true },
    });
    return created.id;
  }

  async createFinalizedCycle(
    {
      bookId,
      finalization,
      legacySourceKey,
      startedAt,
      userId,
    }: {
      bookId: string;
      finalization: ReadingCycleFinalization;
      legacySourceKey: Nullable<string>;
      startedAt: Nullable<string>;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const created = await client.bookReadingCycle.create({
      data: {
        bookId,
        legacySourceKey,
        startedAt: toNullableDate(startedAt),
        userId,
        ...terminalCycleFields(finalization),
      },
      select: { id: true },
    });
    return created.id;
  }

  async editTerminalCycle(
    {
      cycleId,
      date,
      rating,
      state,
      userId,
    }: {
      cycleId: string;
      date: string;
      rating: Nullable<number>;
      state: TerminalReadingCycleState;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const terminalDate = parseIsoDate(date);
    const isFinished = state === READING_CYCLE_STATE.finished;
    await client.bookReadingCycle.updateMany({
      data: {
        endedAt: isFinished ? null : terminalDate,
        finishedAt: isFinished ? terminalDate : null,
        rating: isFinished ? rating : null,
      },
      where: { id: cycleId, state, userId },
    });
  }

  async finalizeActiveCycle(
    {
      cycleId,
      finalization,
      userId,
    }: { cycleId: string; finalization: ReadingCycleFinalization; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.bookReadingCycle.updateMany({
      data: terminalCycleFields(finalization),
      where: { id: cycleId, state: READING_CYCLE_STATE.active, userId },
    });
    return updated.count;
  }

  findCompletionMetadataSource(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CompletionMetadataSource>> {
    return client.book.findFirst({
      select: completionMetadataSelect,
      where: { id: bookId, userId },
    });
  }

  async findContext(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingCycleContext> {
    const rows = await client.bookReadingCycle.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: cycleSnapshotSelect,
      where: { bookId, userId },
    });
    const cycles = rows.map(toCycleSnapshot);

    return {
      activeCycle: cycles.find((cycle) => cycle.state === READING_CYCLE_STATE.active) ?? null,
      hasFinishedCycle: cycles.some((cycle) => cycle.state === READING_CYCLE_STATE.finished),
      latestTerminalCycle:
        cycles.find((cycle) => cycle.state !== READING_CYCLE_STATE.active) ?? null,
    };
  }

  async findLegacyBackfillCandidates(
    { cursorBookId, take }: { cursorBookId: Nullable<string>; take: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LegacyBackfillCandidate[]> {
    const rows = await client.bookReadingProgress.findMany({
      orderBy: { bookId: "asc" },
      select: {
        book: { select: { userId: true } },
        bookId: true,
        finishedAt: true,
        rating: true,
        startedAt: true,
      },
      take,
      where: {
        bookId: cursorBookId === null ? undefined : { gt: cursorBookId },
        finishedAt: { not: null },
      },
    });

    return rows.flatMap((row) =>
      row.finishedAt === null
        ? []
        : [
            {
              bookId: row.bookId,
              finishedAt: row.finishedAt,
              rating: row.rating,
              startedAt: row.startedAt,
              userId: row.book.userId,
            },
          ],
    );
  }

  async findOwnedCycle(
    { cycleId, userId }: { cycleId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<OwnedReadingCycle>> {
    const cycle = await client.bookReadingCycle.findFirst({
      select: { ...cycleSnapshotSelect, bookId: true },
      where: { id: cycleId, userId },
    });
    return cycle === null ? null : { ...toCycleSnapshot(cycle), bookId: cycle.bookId };
  }

  listExistingLegacySourceKeys(
    legacySourceKeys: string[],
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<{ legacySourceKey: Nullable<string> }[]> {
    return client.bookReadingCycle.findMany({
      select: { legacySourceKey: true },
      where: { legacySourceKey: { in: legacySourceKeys } },
    });
  }
}

function terminalCycleFields({
  completionMetadata,
  date,
  firstCompletionReliability,
  rating,
  state,
}: ReadingCycleFinalization): {
  completionMetadata?: Prisma.InputJsonValue;
  endedAt: Nullable<Date>;
  finishedAt: Nullable<Date>;
  firstCompletionReliability: Nullable<string>;
  rating: Nullable<number>;
  state: TerminalReadingCycleState;
} {
  const terminalDate = parseIsoDate(date);
  const isFinished = state === READING_CYCLE_STATE.finished;

  return {
    endedAt: isFinished ? null : terminalDate,
    finishedAt: isFinished ? terminalDate : null,
    firstCompletionReliability,
    rating: isFinished ? rating : null,
    state,
    ...(completionMetadata === null ? {} : { completionMetadata }),
  };
}

function toCycleSnapshot(cycle: {
  endedAt: Nullable<Date>;
  finishedAt: Nullable<Date>;
  id: string;
  startedAt: Nullable<Date>;
  state: string;
}): ReadingCycleSnapshot {
  return {
    endedAt: cycle.endedAt,
    finishedAt: cycle.finishedAt,
    id: cycle.id,
    startedAt: cycle.startedAt,
    state: ReadingCycleStateSchema.parse(cycle.state),
  };
}

function toNullableDate(isoDate: Nullable<string>): Nullable<Date> {
  return isoDate === null ? null : parseIsoDate(isoDate);
}

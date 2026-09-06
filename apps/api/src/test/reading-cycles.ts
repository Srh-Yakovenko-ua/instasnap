import type { Nullable } from "@app/shared";

import type { PrismaService } from "../core/database/prisma.service.js";

import { parseIsoDate } from "../core/iso-date.js";

const FINISHED_STATE = "finished";

export async function insertFinishedReadingCycle(
  prisma: PrismaService,
  {
    bookId,
    finishedIsoDate,
    rating = null,
    startedIsoDate = null,
    userId,
  }: {
    bookId: string;
    finishedIsoDate: string;
    rating?: Nullable<number>;
    startedIsoDate?: Nullable<string>;
    userId: string;
  },
): Promise<string> {
  const created = await prisma.bookReadingCycle.create({
    data: {
      bookId,
      finishedAt: parseIsoDate(finishedIsoDate),
      rating,
      startedAt: startedIsoDate === null ? null : parseIsoDate(startedIsoDate),
      state: FINISHED_STATE,
      userId,
    },
    select: { id: true },
  });
  return created.id;
}

export async function moveFinishedReadingCycle(
  prisma: PrismaService,
  {
    bookId,
    finishedIsoDate,
    userId,
  }: { bookId: string; finishedIsoDate: Nullable<string>; userId: string },
): Promise<void> {
  if (finishedIsoDate === null) {
    await prisma.bookReadingCycle.deleteMany({ where: { bookId, state: FINISHED_STATE, userId } });
    return;
  }

  const updated = await prisma.bookReadingCycle.updateMany({
    data: { finishedAt: parseIsoDate(finishedIsoDate) },
    where: { bookId, state: FINISHED_STATE, userId },
  });
  if (updated.count > 0) {
    return;
  }

  await insertFinishedReadingCycle(prisma, { bookId, finishedIsoDate, userId });
}

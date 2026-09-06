import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate } from "../../../core/iso-date.js";

export type ReadingHistoryStateRow = {
  activityReliableFrom: Date;
  cycleHistoryCutoverAt: Date;
};

@Injectable()
export class ReadingHistoryStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReadingHistoryStateRow>> {
    return client.userReadingHistoryState.findUnique({
      select: { activityReliableFrom: true, cycleHistoryCutoverAt: true },
      where: { userId },
    });
  }

  async findEarliestCutover(
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<Date>> {
    const earliest = await client.userReadingHistoryState.aggregate({
      _min: { cycleHistoryCutoverAt: true },
    });
    return earliest._min.cycleHistoryCutoverAt;
  }

  findUserCreatedAt(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<{ createdAt: Date }>> {
    return client.user.findUnique({ select: { createdAt: true }, where: { id: userId } });
  }

  async insertIfMissing(
    {
      activityReliableFrom,
      cycleHistoryCutoverAt,
      userId,
    }: { activityReliableFrom: string; cycleHistoryCutoverAt: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.userReadingHistoryState.upsert({
      create: {
        activityReliableFrom: parseIsoDate(activityReliableFrom),
        cycleHistoryCutoverAt,
        userId,
      },
      select: { userId: true },
      update: {},
      where: { userId },
    });
  }
}

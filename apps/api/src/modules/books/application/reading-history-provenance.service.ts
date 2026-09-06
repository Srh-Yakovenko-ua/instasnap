import { Injectable } from "@nestjs/common";
import { isAfter } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, toIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingHistoryStateRepository } from "../infrastructure/reading-history-state.repository.js";

export type ReadingHistoryProvenance = {
  activityReliableFrom: string;
  cycleHistoryCutoverAt: Date;
};

const FIRST_FULL_DAY_OFFSET = 1;

@Injectable()
export class ReadingHistoryProvenanceService {
  constructor(
    private readonly readingHistoryStateRepository: ReadingHistoryStateRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async ensure(
    userId: string,
    client?: Prisma.TransactionClient,
  ): Promise<ReadingHistoryProvenance> {
    const existing = await this.readingHistoryStateRepository.findByUserId(userId, client);
    if (existing !== null) {
      return toProvenance(existing);
    }

    const resolved = await this.resolveForNewState(userId, client);
    await this.readingHistoryStateRepository.insertIfMissing(
      {
        activityReliableFrom: resolved.activityReliableFrom,
        cycleHistoryCutoverAt: resolved.cycleHistoryCutoverAt,
        userId,
      },
      client,
    );

    const stored = await this.readingHistoryStateRepository.findByUserId(userId, client);
    return stored === null ? resolved : toProvenance(stored);
  }

  private async resolveForNewState(
    userId: string,
    client?: Prisma.TransactionClient,
  ): Promise<ReadingHistoryProvenance> {
    const user = await this.readingHistoryStateRepository.findUserCreatedAt(userId, client);
    if (user === null) {
      throw new NotFoundError("User not found");
    }

    const { timezone } = await this.userSettingsContextService.resolve(userId, client);
    const rolloutAt = await this.readingHistoryStateRepository.findEarliestCutover(client);
    const userStart = toZonedIsoDate({ instant: user.createdAt, timeZone: timezone });

    if (rolloutAt === null) {
      return { activityReliableFrom: userStart, cycleHistoryCutoverAt: user.createdAt };
    }

    const rolloutBoundary = addDaysToIsoDate(
      toZonedIsoDate({ instant: rolloutAt, timeZone: timezone }),
      FIRST_FULL_DAY_OFFSET,
    );

    return {
      activityReliableFrom: userStart > rolloutBoundary ? userStart : rolloutBoundary,
      cycleHistoryCutoverAt: isAfter(user.createdAt, rolloutAt) ? user.createdAt : rolloutAt,
    };
  }
}

function toProvenance(row: {
  activityReliableFrom: Date;
  cycleHistoryCutoverAt: Date;
}): ReadingHistoryProvenance {
  return {
    activityReliableFrom: toIsoDate(row.activityReliableFrom),
    cycleHistoryCutoverAt: row.cycleHistoryCutoverAt,
  };
}

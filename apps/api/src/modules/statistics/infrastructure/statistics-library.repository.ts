import { UNREAD_READING_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const OWNED_STATUSES = ["owned", "borrowed_from_someone"] as const;

export type LibrarySnapshot = {
  finishedCount: number;
  ownedTotal: number;
  tbrCount: number;
};

@Injectable()
export class StatisticsLibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadSnapshot(userId: string): Promise<LibrarySnapshot> {
    const activeOwned = {
      ...SOFT_DELETE_SCOPE.active,
      ownershipStatus: { in: [...OWNED_STATUSES] },
      userId,
    };

    const [finishedCount, ownedTotal, tbrCount] = await Promise.all([
      this.prisma.book.count({ where: { ...activeOwned, readingStatus: "finished" } }),
      this.prisma.book.count({ where: activeOwned }),
      this.prisma.book.count({
        where: { ...activeOwned, readingStatus: { in: [...UNREAD_READING_STATUSES] } },
      }),
    ]);

    return { finishedCount, ownedTotal, tbrCount };
  }
}

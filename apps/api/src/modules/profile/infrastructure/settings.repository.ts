import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<UserProfileSettingsModel>> {
    return client.userProfileSettings.findUnique({ where: { userId } });
  }

  upsert(
    userId: string,
    data: Omit<Prisma.UserProfileSettingsUncheckedCreateInput, "userId">,
  ): Promise<UserProfileSettingsModel> {
    return this.prisma.userProfileSettings.upsert({
      create: { ...data, userId },
      update: data,
      where: { userId },
    });
  }
}

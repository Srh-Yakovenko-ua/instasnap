import type { WeekStartDay } from "@app/shared";

import { defaultUserProfileSettings, WeekStartDaySchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { toZonedIsoDate } from "../../../core/iso-date.js";
import { SettingsRepository } from "../infrastructure/settings.repository.js";

export type UserSettingsContext = {
  timezone: string;
  weekStartDay: WeekStartDay;
};

@Injectable()
export class UserSettingsContextService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async resolve(userId: string, client?: Prisma.TransactionClient): Promise<UserSettingsContext> {
    const settings = await this.settingsRepository.findByUserId(userId, client);
    if (settings === null) {
      return {
        timezone: defaultUserProfileSettings.timezone,
        weekStartDay: defaultUserProfileSettings.weekStartDay,
      };
    }

    return {
      timezone: settings.timezone,
      weekStartDay: WeekStartDaySchema.parse(settings.weekStartDay),
    };
  }

  async today(userId: string, client?: Prisma.TransactionClient): Promise<string> {
    const { timezone } = await this.resolve(userId, client);
    return toZonedIsoDate({ instant: new Date(), timeZone: timezone });
  }
}

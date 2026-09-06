import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";

import { fakeOf } from "../../../test/fake.js";
import { SettingsRepository } from "../infrastructure/settings.repository.js";
import { UserSettingsContextService } from "./user-settings-context.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const LATE_EVENING_IN_KYIV = new Date("2026-09-02T21:30:00.000Z");

function buildService(timezone: null | string): UserSettingsContextService {
  return new UserSettingsContextService(
    fakeOf<SettingsRepository>({
      findByUserId: vi
        .fn()
        .mockResolvedValue(
          timezone === null
            ? null
            : fakeOf<UserProfileSettingsModel>({ timezone, weekStartDay: "sunday" }),
        ),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(LATE_EVENING_IN_KYIV);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UserSettingsContextService.today", () => {
  it("gives a reader ahead of UTC the date their own clock shows", async () => {
    await expect(buildService("Europe/Kyiv").today(USER_ID)).resolves.toBe("2026-09-03");
  });

  it("gives a reader behind UTC the date their own clock shows", async () => {
    await expect(buildService("America/New_York").today(USER_ID)).resolves.toBe("2026-09-02");
  });

  it("falls back to the product default when the reader has no settings row", async () => {
    await expect(buildService(null).today(USER_ID)).resolves.toBe("2026-09-03");
  });
});

describe("UserSettingsContextService.resolve", () => {
  it("returns the reader's own timezone and week start", async () => {
    await expect(buildService("America/New_York").resolve(USER_ID)).resolves.toEqual({
      timezone: "America/New_York",
      weekStartDay: "sunday",
    });
  });

  it("falls back to the product defaults when the reader has no settings row", async () => {
    await expect(buildService(null).resolve(USER_ID)).resolves.toEqual({
      timezone: "Europe/Kyiv",
      weekStartDay: "monday",
    });
  });
});

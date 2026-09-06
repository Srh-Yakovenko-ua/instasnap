import { defaultUserProfileSettings } from "@app/shared";

import { toZonedIsoDate } from "../core/iso-date.js";

export function defaultUserToday(): string {
  return toZonedIsoDate({ instant: new Date(), timeZone: defaultUserProfileSettings.timezone });
}

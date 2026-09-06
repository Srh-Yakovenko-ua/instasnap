# Overview response meta

`GET /api/statistics/overview` MUST return one canonical top-level `meta` object on every successful response, including empty/partial datasets.

## Contract

Conceptual shared schema:

```ts
meta: {
  generatedAt: string;      // ISO-8601 instant produced by backend
  timezone: string;         // resolved canonical IANA UserProfileSettings.timezone
  weekStartDay: 'monday' | 'sunday'; // resolved canonical UserProfileSettings.weekStartDay
  activityHistory: {
    reliableFrom: isoDay;
    selectedPeriodQuality: 'exact' | 'legacy_lower_bound';
    reason?: 'LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED';
  };
}
```

Use the existing shared/profile timezone and `WeekStartDaySchema` primitives where compatible; do not create Statistics-specific preference enums/fields.

## Semantics

### `generatedAt`

- backend-generated ISO-8601 timestamp for this Overview response; prefer a UTC instant (`...Z`) for transport/debugging;
- generated once per response by the application/composition layer (freeze/inject clock in deterministic tests);
- diagnostic/cache/debug metadata only; it is **not** the selected statistics period, not an activity timestamp and not a promise that all underlying rows were read from a single database transaction snapshot;
- frontend does not use it to recompute metrics or infer freshness of individual source records.

### `timezone`

- exact resolved canonical `UserProfileSettings.timezone`;
- same timezone used to resolve user-local `today`, relative period endpoints and `today/yesterday` streak context; persisted reading `@db.Date` membership itself follows canonical date-only semantics from `shared/16-reading-date-semantics.md` and is not timezone-shifted;
- never server/process/database-local timezone and never a Statistics-only setting.

### `weekStartDay`

- exact resolved canonical `UserProfileSettings.weekStartDay`;
- same value used for weekly bucket boundaries and calendar weekday ordering;
- canonical top-level source for frontend Statistics rendering. Do not duplicate a second independently-populated `calendar.weekStartDay`.

## Deliberately not included

Do **not** invent `dataVersion`, `snapshotVersion`, ETag-like counters or cache generation IDs in V1 unless BookNest first introduces a real underlying versioning/cache contract. A meaningless constant/increment is worse than no version field.

`period` and `comparison` stay as their existing top-level domain sections; do not duplicate them inside `meta`.

## Tests

- `meta` exists for rich, empty and partial-data Overview responses and always contains `activityHistory`;
- `meta.timezone` / `meta.weekStartDay` equal resolved user settings and match the semantics used by computed buckets;
- `meta.activityHistory.reliableFrom` equals the stable migration/cutover provenance boundary and `selectedPeriodQuality` matches the normalized requested scope;
- changing either user setting changes the next Overview response and relevant calculations without schema migration;
- `generatedAt` is valid ISO-8601 and deterministic under a frozen/injected test clock;
- response does not expose a fake `dataVersion`.

## Activity-history quality metadata

`meta.activityHistory` is part of the canonical schema above and follows `shared/30-legacy-activity-history-quality.md`. Do not derive its reliability boundary from the earliest surviving event.

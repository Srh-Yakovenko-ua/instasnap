# Canonical reading date semantics

This document defines the V1 source-of-truth rules for reading dates used by Statistics and by the reading write path that produces those dates.

## Why this is required

On current `dev`:

- `BookReadingProgress.startedAt`, `finishedAt`, `pausedAt`, `abandonedAt`, `lastProgressUpdateAt` are PostgreSQL `DATE` (`@db.Date`), not instants;
- `BookReadingProgressEvent.date` is also PostgreSQL `DATE`;
- `BookReadingProgressEvent.createdAt` is a timestamp, but it is **not** the canonical reading day;
- `BookReadingService` currently falls back to `todayIso()` when the client does not provide `date` / `updateDate`;
- the current `toIsoDate(new Date())` helper formats in UTC.

Therefore a stored reading `DATE` and a timestamp have different semantics and MUST NOT be handled by the same timezone-bucketing rule.

## 1. Stored reading dates are logical calendar-date labels

A persisted reading date such as `2026-09-02` means exactly the calendar label `2026-09-02`.

It is **not** an instant such as `2026-09-02T00:00:00Z` that should later be shifted into `Europe/Kyiv`, `America/New_York`, or another timezone.

For canonical `@db.Date` reading fields:

- preserve the stored `YYYY-MM-DD` label;
- compare against inclusive date-only Statistics ranges;
- group directly by the stored date value;
- do not convert the stored date into `UserProfileSettings.timezone` before deciding which day it belongs to;
- do not derive its day from `createdAt` / `updatedAt`.

Prisma/JavaScript may represent a PostgreSQL `DATE` internally as a `Date` at UTC midnight. That is a transport/ORM representation only. UTC-safe conversion may be used to round-trip the same `YYYY-MM-DD` label; do not reinterpret that object as an instant and then format it in the user timezone.

## 2. User timezone resolves `today`, not historical `DATE` labels

Existing `UserProfileSettings.timezone` remains canonical, but its responsibility is precise:

Use it for:

- resolving the user's current calendar date when backend code needs default `today`;
- building relative Statistics periods such as current year through today;
- resolving `today` / `yesterday` for current-streak semantics;
- other genuinely timestamp-to-local-date operations.

Do **not** use it to re-bucket already persisted reading `@db.Date` values.

Changing the user's timezone later MUST NOT rewrite or relabel historical `startedAt`, `finishedAt`, progress-event `date`, or other stored reading dates.

## 3. Mandatory reading write-path prerequisite

Before Statistics is considered reliable, audit every Books/Reading write path that supplies an implicit current date.

At minimum, current `dev` write paths include:

- `BookReadingService.changeReadingStatus`: `input.date ?? todayIso()`;
- `BookReadingService.startReading`: implicit `todayIso()`;
- `BookReadingService.updateReadingProgress`: `input.updateDate ?? todayIso()`.

Also audit existing read-side current-day context for semantic consistency. Current `BookReadingService.getReadingHistory()` passes `today: new Date()` and `toReadingHistoryView()` converts it with the same UTC-oriented `toIsoDate()`. If Reading History continues to expose windows/anchors relative to today, it should resolve the same user-local date semantics rather than disagree with Statistics.

The implicit/default date MUST resolve `YYYY-MM-DD` in the authenticated user's canonical `UserProfileSettings.timezone`, not UTC and not server/process local timezone. Current-day read contexts that depend on `today` must use the same resolver.

Implementation requirements:

- reuse the existing profile/settings timezone source;
- use one small shared/core/application helper for `now instant + IANA timezone -> YYYY-MM-DD` rather than duplicating date math in each method;
- make the clock injectable/freezeable in tests;
- do not add a Statistics-specific timezone field;
- explicit valid client-provided ISO dates remain exact date labels and are not timezone-shifted;
- do not silently rewrite existing historical rows as part of this prerequisite.

This is a cross-feature correctness prerequisite in Books/Reading. It is allowed even though the Statistics module itself should not change unrelated behavior: the current UTC default directly determines future Statistics data quality.

## 4. Statistics period membership

Statistics normalizes the requested period into inclusive date-only boundaries:

```text
from = YYYY-MM-DD
to   = YYYY-MM-DD
```

For date-only reading facts:

```text
period membership = storedDate >= from AND storedDate <= to
```

Examples:

- completed-read membership uses canonical reading-cycle stored `finishedAt` date (after `shared/17-reading-cycle-history.md` is implemented);
- pages/activity membership uses stored `BookReadingProgressEvent.date`;
- day heatmap groups by stored event `date`;
- historical elapsed duration uses cycle `startedAt` -> cycle `finishedAt` calendar-date difference, not timestamp duration.

The user timezone may have been used to resolve the period's relative endpoint (`today`), but it is not applied again to each stored date.

## 5. Event timestamp rule

`BookReadingProgressEvent.createdAt` is technical creation time. It MUST NOT replace `event.date` as reading-day truth.

Do not infer:

```text
readingDay = createdAt converted to user timezone
```

when canonical `event.date` exists.

## 6. API / frontend rule

Reading calendar dates remain ISO date-only strings (`YYYY-MM-DD`) in Statistics contracts.

Frontend:

- treats these values as calendar dates, not UTC instants;
- must not construct a JS `Date` and timezone-shift the value merely to determine the displayed day;
- may localize the human label/weekday using a date-only-safe formatter;
- uses `meta.timezone` for user-local contextual concepts such as `today`, not to relabel historical date keys returned by backend.

## 7. Tests required

Use a frozen instant near UTC day boundaries, for example an instant where UTC date differs from the user's local date.

Required cases include:

1. timezone ahead of UTC: implicit reading date equals the user's local date;
2. timezone behind UTC: implicit reading date equals the user's local date;
3. explicit `YYYY-MM-DD` input is persisted unchanged in both cases;
4. a stored `@db.Date` remains in the same Statistics day after changing profile timezone;
5. current-year/current-streak `today` changes correctly with profile timezone;
6. Statistics does not use `BookReadingProgressEvent.createdAt` to override `event.date`;
7. frontend date-only rendering does not shift a returned date by one day.

## 8. Relationship to rereading/history

This document only defines the meaning and creation of date-only reading facts. Rereading/reset historical-model semantics are defined separately in `shared/17-reading-cycle-history.md`. Cycle `startedAt` / `finishedAt` and cycle-owned progress-event dates use the same date-only rules from this document.

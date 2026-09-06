# Period і comparison

## Shared primitive reuse gate

Before defining new Reading Statistics period/comparison DTOs, audit the existing shared primitives in `packages/shared/src/order-statistics.ts` using `shared/13-statistics-common-primitives.md`.

Current `dev` already exposes reusable-looking `StatisticsPeriodSchema`, `StatisticsComparisonPeriodSchema`, `BookOrderStatisticsCompareModeSchema` and `NumericDeltaSchema`. Do not blindly duplicate them, but do not import an order-specific contract just because the shape is similar.

If the semantics are exactly compatible, extract/reuse the genuinely generic subset through a small shared common module while preserving Delivery behavior/import compatibility. If any business meaning differs, keep a Reading-specific contract and document the mismatch.

## Query contract

All validation/normalization edge cases are canonicalized by `shared/24-period-comparison-edge-contract.md`. Backend is authoritative; frontend must not silently swap/clamp/recalculate explicit bounds.

Підтримати один нормалізований StatisticsPeriod:

- calendar year;
- last 12 months;
- custom `from/to`;
- all time.

Default на FE: current year from Jan 1 through today.

All-time normalized Reading range is `{ from: null, to: userLocalToday }`; metric-specific reliable tracking windows (for example Calendar) may start later and expose that explicitly. Do not include future-dated facts.

## Backend responsibilities

Backend повертає:

- normalized current range;
- optional normalized previous range;
- label/context data;
- bucket granularity.

## Comparison rules

Follow `shared/24-period-comparison-edge-contract.md` exactly. In short:

- Current partial year → same calendar dates previous year (`same_period_last_year`), with explicit leap-day clamp semantics.
- Full past year → full previous calendar year.
- Last 12 months → immediately preceding interval with the same **inclusive calendar-day count**.
- Custom → immediately preceding interval with the same **inclusive calendar-day count**.
- All time → comparison unsupported; contradictory comparison input is rejected rather than silently ignored.
- A valid one-day custom range compares to the immediately previous day.

Delta rules are also backend-owned: zero previous baseline yields `percentDelta = null`, never Infinity/fabricated growth; rates such as active-day percentage compare in **percentage points**, not as raw-count relative percentages.

## Granularity

Для Dynamics, using inclusive calendar-day count from `shared/24-period-comparison-edge-contract.md`:

- 1–31 days → day;
- 32–180 → week;
- > 180 → month;
- all time → year.

Boundary tests MUST cover 31/32 and 180/181 days; do not compute duration with timestamp milliseconds.

## Week boundaries

Для granularity `week` backend MUST використовувати canonical `UserProfileSettings.weekStartDay`, а не hardcoded ISO week. Поточний shared contract підтримує `monday | sunday`.

Rules:

- weekly buckets align to the user-selected week start;
- перший/останній bucket може бути partial і clip-иться до normalized statistics period;
- comparison використовує ту саму week-start semantics для current і previous ranges;
- labels/keys мають бути deterministic і не залежати від server locale;
- зміна `weekStartDay` повинна змінювати weekly bucket boundaries без schema migration.

## Timezone + date-only boundary semantics

Follow `shared/16-reading-date-semantics.md` and `shared/17-reading-cycle-history.md`. Canonical historical cycle `startedAt` / `finishedAt` and `BookReadingProgressEvent.date` are PostgreSQL `DATE` labels, not timestamp instants; completion membership comes from finished cycles, not the mutable current progress snapshot.

Statistics MUST:

- resolve user timezone через існуючий profile/settings source and expose that exact resolved value as Overview `meta.timezone`;
- use that timezone to resolve user-local **today** and relative endpoints such as current year through today;
- normalize the final query into inclusive date-only `from/to` labels;
- compare/group persisted reading `@db.Date` values directly by their stored date labels; **do not timezone-convert/re-bucket them**;
- resolve `today/yesterday` for current-streak context in user timezone;
- не використовувати timezone сервера/процесу/БД як source of user-local `today`;
- не створювати Statistics-specific timezone setting або migration;
- разом із timezone resolve canonical `UserProfileSettings.weekStartDay` для всіх week-aligned buckets and expose it as Overview `meta.weekStartDay` (single response-level source).

UTC timestamps remain appropriate for technical fields such as `generatedAt`/`createdAt`. A Prisma `Date` object representing PostgreSQL `DATE` at UTC midnight may also use UTC-safe helpers to preserve the same lexical `YYYY-MM-DD`; that does **not** make the logical reading date an instant. Never shift such a stored date through the user timezone.

The Books/Reading implicit write default is a prerequisite: when `date/updateDate` is omitted, the backend must resolve `YYYY-MM-DD` from the authenticated user's `UserProfileSettings.timezone`, not from UTC. Explicit client-provided date-only values are preserved unchanged after validation.

## Domain code

Винести нормалізацію period/comparison/granularity/week boundaries в чисті pure domain functions з unit tests. Обов’язково протестувати однакові ranges для `weekStartDay = monday` і `weekStartDay = sunday`.

Shared DTO reuse does **not** mean shared domain calculations: Delivery and Reading можуть мати власні domain functions, якщо їхні business rules відрізняються. Спільним робити лише contract primitives із доведено однаковою семантикою.

# Claude Code backend execution plan

Виконай backend до початку frontend.

## Phase 1 — inspect

Read repo rules and canonical neighboring modules. Produce a short implementation checklist in your session, then code.

Before creating Reading Statistics period/comparison/delta contracts, audit the reusable-looking primitives and current consumers in `packages/shared/src/order-statistics.ts` using `shared/13-statistics-common-primitives.md`. Decide from semantics whether to extract/reuse a common primitive or keep an explicit Reading-specific contract. Do this **before** Phase 2 contract work.

## Phase 2 — shared + domain

- statistics query/response Zod schemas;
- period/comparison pure domain functions;
- identify other independent Statistics rules that warrant focused domain units (calendar/streak, ratings/tastes, library balance, insights, records, etc.) using `backend/16-domain-decomposition.md`;
- keep those units framework-independent and covered by focused unit tests;
- do not create a file per trivial expression and do not build a generic analytics framework.

## Phase 3 — repository

Implement focused aggregate repository/query methods for reading/calendar/tastes/series/current library. Calendar summary/query composition follows `shared/20-calendar-streak-period-semantics.md`: keep `metricRange` distinct from bounded `displayRange`, clip longest streak to metric scope, and make historical current streak unavailable rather than zero. Calendar queries must produce the bounded per-day/per-book data needed for compact `booksPreview` in Overview without executing one query/request per day. Keep Prisma/SQL here; do not collapse the feature into one `getEverything()` data bag or move product semantics into query code merely to avoid domain units.

## Phase 4 — application

Before composing aggregates, enforce `shared/18-soft-deleted-book-eligibility.md`: historical reading facts do not disappear after a later Book soft delete, while current-library/TBR snapshots explicitly use active (`deletedAt IS NULL`) books. Compose Overview response with canonical top-level `meta` (`generatedAt`, resolved `timezone`, resolved `weekStartDay`, `activityHistory`) per `shared/15-overview-response-meta.md`. Do not invent `dataVersion` and do not duplicate a second `calendar.weekStartDay`. Compose Overview response in a thin orchestration-oriented service/composer. It may coordinate many capabilities, but it must not become a god service containing the independent formulas/ranking/eligibility rules that belong in focused domain units. Add InsightEngine and RecordEngine as focused domain/application units, not generic frameworks. InsightEngine emits the shared discriminated `code + typed params` contract (plus semantic metadata/action), never finalized localized sentences. InsightEngine must create **one ranked candidate pool** and derive both `hero.featuredInsight` and `insights.items` from it; do not implement separate hero/card insight engines or run eligibility/significance/diversification twice. For every interactive aggregate, emit the shared semantic exact `drilldown` and keep broader navigation in `contextActions`; backend must expose enough canonical IDs/period/filter values to reproduce the source subset.

For the goal section, add only a Statistics-side adapter/composer over canonical Reading Goals application/domain output. Do **not** create goal progress/pace/projection/risk formulas in Statistics. If a required value is not exposed canonically, extend/refactor `reading-goals` first and consume that result.

## Phase 5 — prerequisites

For TBR history:

- use existing canonical source if present;
- otherwise implement only the minimal required domain change when that metric is part of accepted V1 behavior;
- never silently guess.

For the Overview primary Reading Goal, **do not treat schema/domain migration as a prerequisite**. Consume the complete canonical `status = active` candidate set and select deterministically by `deadline ASC` → `createdAt ASC` → `id ASC`. Do not add `isPrimary` to Prisma/shared create-update contracts or choose from a partially fetched/presentation-sorted page. If needed, add only a minimal internal Reading Goals application integration point that exposes the candidates/selection safely.

Reading-format semantics are different: audit them only to decide whether the **optional** Formats capability is safe. Missing reliable actually-read-format semantics do **not** block V1 Statistics, do not justify a V1 migration, and do not reserve an empty Formats section.

Timezone setting itself is **not** an unresolved prerequisite: reuse existing `UserProfileSettings.timezone`. However, reading **date creation semantics are a correctness prerequisite**. Follow `shared/16-reading-date-semantics.md`: audit/fix Books/Reading implicit `today` writes so omitted `date/updateDate` resolves in the authenticated user's timezone rather than UTC; preserve explicit/stored `@db.Date` labels and never re-bucket them through timezone. Do not add a Statistics-only timezone field or date migration.

Week start is also **not** an unresolved prerequisite: reuse existing `UserProfileSettings.weekStartDay` (`monday | sunday`, current default `monday`) for weekly bucket boundaries and calendar ordering. Do not hardcode Monday/ISO-week behavior and do not add a Statistics-only week-start field or migration.

## Phase 6 — API

Controller + Swagger/Zod DTO wrappers + module registration. Compose compact calendar `booksPreview` into `/statistics/overview`; keep `/statistics/reading-days/:date` as an explicit-interaction full-detail endpoint only, never a fan-out dependency for initial Books-mode rendering.

## Phase 7 — performance gate

Before declaring backend complete, inspect the **implemented** period-scoped `BookReadingProgressEvent` aggregation with a real PostgreSQL query plan in the safe test/dev environment (`EXPLAIN (ANALYZE, BUFFERS)` or the repository-approved equivalent).

Use representative current/last-12-months, comparison and large/all-time scenarios. Verify user/period filtering occurs in the database, there is no per-book/per-day N+1 or obvious avoidable full event-table scan, and inspect whether the existing `@@index([bookId, date])` is actually useful for the chosen query shape.

Do not add a speculative Statistics index. If the plan demonstrates a need, add the smallest purpose-specific migration, rerun the same plan and record the before/after reason/result.

## Phase 8 — verify

Run:

- relevant tests;
- `pnpm typecheck`
- `pnpm lint`
- API OpenAPI generation
- `pnpm gen:api`

Stop and fix backend contract errors before frontend work.

## Mandatory pre-Statistics reading-history milestone

Before implementing completion/rating/duration aggregates, implement and test `shared/17-reading-cycle-history.md` in the existing Books/Reading domain. Do not proceed with mutable-`finishedAt` historical queries as a temporary shortcut. Preserve current BookReadingProgress API behavior where possible, but make reread/reset history-safe and regenerate Prisma/client artifacts when the schema changes.
As part of that prerequisite, implement `shared/19-historical-metadata-snapshots.md`: newly finalized finished cycles persist typed/versioned completion-time analytics metadata atomically. Tastes, behavioral Series membership and `pagesCount`-based records must consume the snapshot; current Book/entity data is presentation enrichment only. Legacy backfilled cycles capture current known metadata once with explicit provenance and then freeze it.

## Deterministic ordering gate

Before finalizing aggregate queries/response mapping, apply `shared/23-deterministic-ordering-policy.md`. Every ordered output must have a total backend comparator ending in a canonical stable key. For paginated exact details, push that total order into the repository/cursor query before limit/take; do not fetch an unstable page and sort it afterwards. Add tie fixtures that reach final keys.

- Apply `shared/25-completed-read-count-semantics.md` before implementing completion KPI/dynamics/rankings.

## Required integration slice before Statistics repositories

Before implementing completion/rating/taste Statistics queries:

1. run `/blast-radius` over reading lifecycle DTOs/services/repositories;
2. implement `shared/35-reading-lifecycle-write-path-integration.md` so create/update/reading/bulk/import paths cannot bypass cycles;
3. implement `shared/36-reading-cycle-concurrency-invariant.md`, including the reviewed partial unique active-cycle index;
4. switch Reading Goals qualification to `shared/37-reading-goals-cycle-qualification.md` and prove reread does not uncount/double-count;
5. implement the minimal explicit event correction path from `shared/38-reading-history-correction-capability.md`;
6. persist reliability provenance from `shared/39-activity-history-reliability-source.md`;
7. verify each contract/migration milestone using `shared/40-repo-specific-verification.md`.

Do not start Statistics aggregation code while these prerequisites are only documented but not integrated with the existing Books/Reading/Reading Goals write paths.

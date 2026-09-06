# Migrations and data availability

Do not add every possible schema field preemptively.

## Category A — no additional Statistics-specific migration expected after mandatory reading prerequisites

Likely implementable without additional Statistics-specific fields after mandatory reading prerequisites:

- pages/activity/calendar from reliable progress events;
- ratings;
- genre frequency/rating;
- author frequency/rating;
- publisher frequency if canonical relation is sufficient;
- series analytics after the mandatory completion-time snapshot / canonical structural-history prerequisite is implemented;
- records based on pages/events/book length;
- user-local period/day/calendar/streak calculations using existing `UserProfileSettings.timezone` (no migration expected);
- week-aligned aggregates and calendar ordering using existing `UserProfileSettings.weekStartDay` (`monday | sunday`; no migration expected).

## Category B — inspect current `dev` before deciding

### Reading format semantics — conditional, not a V1 prerequisite

`Book.formats[]` may mean available/owned formats rather than the format actually used for reading and MUST NOT be treated as proof of the actually-read format.

Guaranteed V1 Statistics ships without Formats when no reliable source exists. Do not add `readingFormat`, edition history or another migration merely to satisfy V1 Overview. Add such domain data only when the product independently adopts exact read-format tracking; after that, Statistics may expose the optional Formats capability.

### Language semantics — resolved for V1

Current `dev` already treats `Book.language` as a required visible edition-language field with canonical `BookLanguageSchema` values and default `ukrainian` across Prisma/shared create/frontend create defaults. V1 Statistics therefore uses it as **declared edition language**, captured into the immutable completion-time cycle snapshot. See `shared/22-language-reliability-semantics.md`.

No Statistics-only `languageConfirmed`/`languageSource`/nullable-language migration is required. The current model cannot retrospectively prove whether legacy `ukrainian` was explicitly selected or accepted/defaulted, so do not fabricate that provenance and do not reinterpret `ukrainian` as unknown. Coverage measures snapshot completeness, not confirmation confidence.

Run the documented pre-release distribution sanity audit. Do not introduce original-language/read-in-original analytics without a separate reliable source.

### Reading goal primary selection — no V1 migration

Current `dev` ReadingGoal model/contract does not expose `isPrimary`, and V1 Statistics MUST NOT add it merely to choose the compact Overview card.

Use canonical Reading Goals `status = active` output and deterministic backend ordering **`deadline ASC` → `createdAt ASC` → `id ASC`**. The selection must consider the complete active candidate set and must not depend on default cursor pagination or incidental DB order.

If the existing Reading Goals application API cannot safely expose the candidate set/selection internally, add the smallest application/domain integration capability needed to select it; this still does not require a schema migration.

Only a separate future product decision that makes “primary goal” user-controlled across Reading Goals may justify an explicit domain field/migration. That change is outside V1 Statistics.

## Category C — migration/event tracking likely required for full metric

### Reading cycles / rereads — mandatory V1 prerequisite

The cycle prerequisite also includes the completion-time historical metadata snapshot from `shared/19-historical-metadata-snapshots.md`. Do not ship cycle history while continuing to derive historical tastes/series/book-length records from mutable current Book metadata.
Current `BookReadingProgress` is a mutable one-row snapshot and cannot serve as immutable completion history. Current reread/reset behavior can clear `finishedAt` and can delete progress events book-wide. Full Statistics therefore requires the minimal canonical reading-cycle history described in `shared/17-reading-cycle-history.md`.

Required direction:

- add an append-oriented read-through/cycle model owned by Books/Reading;
- keep the existing `BookReadingProgress` snapshot for current UI/progress;
- relate all future progress events to the current cycle;
- finished cycles remain historical facts across reread/reset;
- ordinary reset may reset/abandon the current unfinished cycle but must not delete any already persisted reading-activity events; follow `shared/27-reading-activity-event-history.md`;
- backfill at most one known finished cycle from a reliable current snapshot; never invent erased historical rereads.

This is not optional for trustworthy completed-read/rating/duration/reread Statistics.

### Historical TBR / ownership flow

Reliable period inflow/outflow needs lifecycle transition history.
Do not backfill from `updatedAt`.

Preferred approach:

- inspect whether an activity/event table already captures these transitions;
- if not, add minimal canonical transition tracking for future accuracy;
- mark historical flow before tracking with canonical `availability = unavailable`, `data = null`, reason `HISTORY_NOT_TRACKED` unless a trustworthy migration source exists.

## Migration rules

### Reading-cycle correctness prerequisite (schema + Books/Reading behavior)

Implement `shared/17-reading-cycle-history.md` before Statistics completion aggregates. The migration may add a canonical cycle table and a nullable cycle relation on existing progress events. New events must be cycle-scoped; legacy events stay unassigned when safe attribution cannot be proven. Never synthesize missing rereads from timestamps.

As part of the same finished-cycle persistence, add the smallest typed/versioned completion metadata snapshot required by `shared/19-historical-metadata-snapshots.md`. Newly finished cycles capture it atomically. Legacy backfilled cycles capture current known metadata once with `legacy_current_metadata` provenance and then freeze it; do not claim or reconstruct unknown completion-time metadata from unrelated timestamps.

### Reading date correctness prerequisite (code change, not historical date backfill)

Current reading `startedAt/finishedAt/...` and progress-event `date` are `@db.Date`. Statistics must preserve those stored labels. Before relying on future implicit writes, fix the Books/Reading default `today` path to resolve the user's local ISO date from existing `UserProfileSettings.timezone` instead of UTC. This normally requires an application/core integration change, **not** a new column. Do not mass-shift/backfill existing dates because the original user-local intent cannot be reconstructed safely from a date-only value. See `shared/16-reading-date-semantics.md`.

- Small, purpose-specific migration.
- No speculative columns.
- No backfill that assigns invented event dates.
- Add indexes only for demonstrated query patterns.
- For Statistics activity queries, a demonstrated need means inspecting the implemented `BookReadingProgressEvent` query plan first; the existing `@@index([bookId, date])` must not be assumed sufficient or insufficient without evidence.
- Any Statistics-driven index migration must record the observed plan problem and rerun the same representative `EXPLAIN (ANALYZE, BUFFERS)` scenario after the change.
- Update shared schema/API only when backend semantics are stable.

## Contract rule for conditional capabilities

Schema/audit limitations do not create new public availability vocabularies. Historical TBR, duration and other exposed conditional metrics reuse `available | partial | unavailable` plus canonical coverage and typed section reasons. Reading Formats are additionally **not a guaranteed V1 section**: when the reliable source does not exist, the normal Overview may omit that capability entirely rather than reserve/render an unavailable Formats card.

## First-completion reliability during migration

Implement `shared/26-first-book-completion-reliability.md`. A legacy cycle backfilled from the current mutable finished snapshot is the earliest completion **known** after migration, not automatically the first-ever read. Persist/derive enough cutover provenance to distinguish `proven_first` from `first_known_only`; discovery, structural Series lifecycle and TBR first-completion outflow must not promote unknown legacy history to a proven transition.

## Activity-event reset prerequisite

Before Statistics rollout, remove the current destructive reset path for progress events. Surviving events become the historical activity ledger; ordinary reset must preserve them. Do not invent events already erased by legacy behavior.

## ReadingCycle state machine prerequisite

The migration/write-path rollout must implement `shared/28-reading-cycle-state-machine.md`: canonical `active | finished | dnf | abandoned` semantics, at-most-one-active-cycle, terminal immutability and retry-safe start/reread/finish/reset behavior. A duplicate finish must never become a duplicate `completedRead`.

## Mandatory deployment sequence

Follow `shared/29-reading-history-migration-rollout.md`. The ReadingCycle/snapshot prerequisite is not a one-step schema migration: land additive schema, switch canonical new writes, verify mutation behavior, run an idempotent conservative backfill, reconcile, then enable Statistics. Backfill must have a stable unique legacy-source identity and be safe to rerun.

## FK / permanent-purge audit

Before finalizing ReadingCycle/Event foreign keys, apply `shared/32-hard-delete-privacy-purge.md`: soft delete preserves history, while actual Book/account hard deletion must erase owned cycles/events/snapshots according to existing deletion conventions. Do not choose FK behavior that accidentally retains private snapshot content after a true purge.

## Duration legacy data

Do not backfill missing cycle `startedAt` or repair `finishedAt < startedAt` from technical timestamps solely for duration Statistics. Follow `shared/33-reading-duration-semantics.md`; preserve truthful unknown/invalid coverage and reject invalid ordering on new canonical writes.

## ReadingCycle integration migration gates

The additive ReadingCycle migration must include the concurrency/reliability prerequisites, not only the cycle table:

- reconcile duplicate active-cycle candidates before constraint creation;
- add/review the PostgreSQL partial unique one-active-cycle invariant from `shared/36-reading-cycle-concurrency-invariant.md` using established raw-index conventions when Prisma cannot model the predicate;
- add the Reading Goals qualification relation/field needed to identify the selected canonical cycle without replacing the existing goal metrics engine;
- add persisted per-user Reading-history reliability state from `shared/39-activity-history-reliability-source.md`;
- backfill reliability state idempotently from one explicit cutover instant + user timezone;
- preserve migration SQL/raw indexes according to `shared/40-repo-specific-verification.md`.

No constraint may be tightened until reconciliation proves existing rows satisfy it.

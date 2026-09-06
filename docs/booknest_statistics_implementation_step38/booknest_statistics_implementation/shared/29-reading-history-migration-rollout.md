# Reading history migration and rollout

This is the mandatory deployment sequence for the ReadingCycle, activity-event and completion-snapshot prerequisites required by full Statistics. The rollout is additive-first, forward-compatible and backfill-idempotent.

## Goals

- never lose existing reading data during rollout;
- new writes become historically safe before Statistics depends on them;
- legacy backfill is conservative and rerunnable;
- do not require a big-bang destructive migration;
- keep existing Book UI functional while historical tables are introduced.

## Phase 0 — preflight audit

Before schema changes:

1. record counts of Books, `BookReadingProgress`, finished mutable snapshots and progress events per user/environment;
2. inspect invalid/malformed date/rating/language rows that could break typed snapshot backfill;
3. identify the current destructive reset/write paths and all places that create progress events;
4. verify the per-book reading lock/transaction entry points;
5. choose/document the ReadingCycle-history cutover marker used by `shared/26-first-book-completion-reliability.md` and persist the activity-event reliability boundary according to `shared/39-activity-history-reliability-source.md` / `shared/30-legacy-activity-history-quality.md` (they may originate from the same rollout instant only when the write-path guarantees actually become true together).

Do not “clean” ambiguous legacy history by guessing.

## Phase 1 — additive schema

Add the minimum backward-compatible persistence needed by:

- `shared/17-reading-cycle-history.md`;
- `shared/19-historical-metadata-snapshots.md`;
- `shared/26-first-book-completion-reliability.md`;
- `shared/28-reading-cycle-state-machine.md`.

Expected shape includes:

- `BookReadingCycle`;
- nullable `BookReadingProgressEvent.readingCycleId`;
- immutable typed/versioned completion analytics snapshot storage;
- provenance / first-completion reliability fields or equivalent derivable persisted facts;
- indexes required by actual cycle/user/date queries after query-plan verification.

Do **not** make `readingCycleId` globally non-null: legitimate legacy events may remain unassigned permanently.

Do not drop or repurpose existing `BookReadingProgress` fields in this phase.

## Idempotent legacy-source key

The conservative “one cycle from current legacy finished snapshot” backfill must have a stable idempotency identity. Recommended approach:

```text
legacySourceKey = "book-reading-progress-snapshot:<bookId>"
```

(or an equivalent dedicated unique nullable field).

Requirements:

- unique for that migration source;
- null for normal newly tracked cycles;
- rerunning the backfill sees the same key and skips/reuses the existing row;
- do not use generated cycle id, `createdAt` or mutable `updatedAt` as backfill idempotency.

## Phase 2 — switch new writes before backfill

Deploy canonical Books/Reading write behavior first:

1. user-local date-only defaults from `shared/16-reading-date-semantics.md`;
2. state machine/idempotency from `shared/28-reading-cycle-state-machine.md`;
3. every new progress event attaches to the current cycle;
4. ordinary reset preserves activity events per `shared/27-reading-activity-event-history.md`;
5. finish atomically finalizes the cycle, stores cycle rating and captures immutable analytics snapshot;
6. reread creates a new cycle rather than rewriting old completion;
7. first-completion reliability is persisted/derivable correctly for post-cutover vs legacy books.

The existing mutable `BookReadingProgress` continues to serve current UI.

Do not enable full Statistics completion analytics before this phase is stable.

## Phase 3 — mutation verification

In the test environment exercise real mutation flows (test DB mutations are expected; no rollback is required for those test cases):

- first read;
- pause/resume;
- finish retry;
- rating edit;
- reread;
- DNF → start again;
- reset with activity;
- soft delete/restore;
- timezone day-boundary writes.

Verify cycle/event/snapshot invariants after each flow.

## Phase 4 — conservative idempotent backfill

For each legacy `BookReadingProgress` with a reliable current `finishedAt` and no prior row for the stable legacy source key:

- create at most one `finished` legacy cycle;
- preserve known `startedAt` only when actually present;
- copy canonical rating when known;
- capture current known historical analytics metadata **once** with `legacy_current_metadata` provenance;
- classify first-ever reliability as `first_known_only` unless stronger trusted evidence exists;
- never synthesize older rereads;
- never assign old progress events to that cycle unless attribution is demonstrably safe.

Rerunning the job must be a no-op for already backfilled source keys.

Do not update an existing backfilled immutable metadata snapshot on later reruns merely because current Book metadata changed.

## Phase 5 — verification/reconciliation

Before enabling Statistics:

- compare preflight finished-snapshot counts to created legacy cycles with documented exclusions;
- assert no more than one active cycle per user/book;
- assert no duplicate `legacySourceKey`;
- verify new post-cutover events have cycle ids;
- verify allowed legacy unassigned events remain intact;
- verify no ordinary reset deleted historical events;
- verify legacy backfilled firsts remain first-known-only;
- verify completion snapshots pass shared schema validation;
- verify cross-user ownership on all cycle/event relations;
- run the Statistics progress-event query-plan gate.

Any difference must be explained by an explicit exclusion/quality rule, not silently ignored.

## Phase 6 — enable Statistics reads

Only after phases 1–5 pass:

- enable `/statistics/overview` completion/rating/ranking queries from cycles/snapshots;
- enable cycle exact drill-down;
- surface legacy quality states where required;
- run backend/frontend contract and E2E acceptance.

A feature flag is optional if the project already has a suitable mechanism; do not introduce a generic flag framework solely for this page. The sequencing itself is mandatory.

## Phase 7 — tighten safe constraints / remove obsolete destructive paths

After data verification:

- add/tighten only constraints that are valid for both tracked and legacy data;
- keep `readingCycleId` nullable if unassigned legacy events are a supported permanent state;
- remove obsolete code paths that clear historical completion/event data;
- keep `BookReadingProgress` while current UI still depends on it; do not prematurely collapse it into cycle history.

## Rollback / forward-fix rule

Schema additions are backward-compatible, but once canonical write behavior is live, do not roll application code back to a version whose ordinary reset can delete the newly protected historical event ledger. Prefer a forward fix.

Production rollback strategy must preserve new cycle/event rows; destructive down-migrations are not part of the Statistics rollout.

## Backfill observability

The backfill should emit enough structured summary for verification, for example:

```text
scanned
created
skippedAlreadyBackfilled
skippedNoFinishedAt
skippedInvalidData
failed
```

Do not log private book/user content unnecessarily. IDs/counts sufficient for diagnostics are preferred.

## Required tests

- schema migration against representative legacy fixture DB;
- backfill first run creates expected rows;
- second run creates zero duplicates;
- metadata edit after first backfill does not mutate frozen legacy snapshot on rerun;
- new writes during/after backfill remain canonical and are not mistaken for legacy rows;
- cross-user isolation;
- reset/reread behavior remains safe after rollout;
- Statistics remains disabled/not trusted until verification gate passes.

## Legacy activity completeness

Persist the stable `activityHistoryReliableFrom` boundary defined in `shared/30-legacy-activity-history-quality.md`. The migration must not infer it from the earliest surviving event and must not fabricate events deleted by historical reset behavior.

## Additional rollout gates from final dev audit

Before the `canonical new writes` phase is considered complete:

- every lifecycle writer identified by `shared/35-reading-lifecycle-write-path-integration.md` must use the same cycle-aware orchestration;
- every cycle mutation must satisfy `shared/36-reading-cycle-concurrency-invariant.md`;
- Reading Goals must qualify from cycles per `shared/37-reading-goals-cycle-qualification.md`;
- explicit event correction must exist per `shared/38-reading-history-correction-capability.md` so non-destructive reset does not strand mistaken activity;
- per-user reliability state from `shared/39-activity-history-reliability-source.md` must be backfilled/reconciled before legacy quality is exposed.

The one-active-cycle partial unique index is created/tightened only after reconciliation proves there are no duplicate active cycles.

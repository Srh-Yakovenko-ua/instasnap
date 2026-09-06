# Canonical reading-cycle history

This document defines the mandatory historical model required before Statistics may treat completions, rereads and reset flows as reliable.

## Why the current snapshot is insufficient

On current `dev`, `BookReadingProgress` is one mutable row per book. It represents the **current/latest reading state**, not an immutable history of every read-through.

Current behavior also means:

- transition to `reading` / `rereading` clears `finishedAt` on the mutable progress snapshot;
- `rereading` currently reuses `existingStartedAt` when present rather than creating a separate historical read-through;
- `resetProgress = true` with `not_started` / `want_to_read` currently triggers book-wide deletion of `BookReadingProgressEvent` rows;
- rating lives on mutable `BookReadingProgress` and may be cleared/replaced by later reading-state changes.

Therefore Statistics MUST NOT use the current mutable `BookReadingProgress.finishedAt` row as the long-term historical completion ledger. Otherwise a reread/reset can rewrite an earlier year, remove a previous completion, remove historical activity, or make historical rating metrics drift.

## Decision

Before full Statistics aggregates are considered correct, introduce a canonical **reading-cycle history** owned by the Books/Reading domain.

The exact model/file names should follow current repo conventions, but the domain concept is mandatory. A recommended name is `BookReadingCycle`.

`BookReadingProgress` remains the mutable current-state/read-position snapshot used by existing book UI and commands. Reading-cycle history is the append-oriented historical source used for completed-read analytics.

## Minimum cycle semantics

A reading cycle represents one read-through attempt of one book.

The canonical model must be able to represent at least:

- stable cycle id;
- authenticated owner/user scope and book id;
- `startedAt` as canonical date-only value when known;
- terminal `finishedAt` when completed;
- terminal `abandonedAt`/DNF state when applicable;
- canonical lifecycle state `active | finished | dnf | abandoned` (or equivalent enum casing) as defined by `shared/28-reading-cycle-state-machine.md`;
- canonical rating for that completed read when one exists;
- immutable completion-time analytics metadata snapshot required by `shared/19-historical-metadata-snapshots.md`;
- created/updated technical timestamps for ordering/debugging, without using them as reading dates.

Exact enum/column naming may match existing project style. Do not create a generic event-sourcing framework.

A finalized historical cycle (`finished` or another terminal historical state) must not be mutated by ordinary start/reread/reset commands except through an explicit historical-correction capability.

Historical metadata on a finalized **finished** cycle is governed by `shared/19-historical-metadata-snapshots.md`: ordinary later Book/Author/Publisher/Series edits must not silently rewrite the cycle's historical analytics membership or book-length facts.

## Recommended minimal persistence shape

The exact Prisma names must be adapted to current repo conventions, but the implementation should remain close to this conceptual shape rather than inventing a larger framework:

```text
BookReadingCycle
- id
- userId
- bookId
- state              // canonical active | finished | dnf | abandoned
- startedAt?         // @db.Date
- finishedAt?        // @db.Date
- abandonedAt?       // @db.Date
- rating?            // canonical rating for this completed read
- analyticsMetadataSnapshot // typed/versioned completion-time metadata used by historical Statistics
- provenance         // tracked vs conservative legacy-snapshot backfill, or equivalent diagnostic representation
- createdAt          // technical timestamp
- updatedAt          // technical timestamp

BookReadingProgressEvent
- ...existing fields
- readingCycleId?    // nullable only for legacy rows that cannot be safely assigned
```

Required invariants:

- at most one non-finalized/current cycle per book; enforce transactionally using the existing per-book reading lock/pattern and add a DB invariant only if it fits current project conventions;
- `reading`/resume/paused transitions continue the same current cycle; they do not create duplicates;
- `rereading` after a finalized completion creates a new cycle;
- `finished` finalizes the current cycle; if legacy/current data has no current cycle, create the smallest truthful cycle with unknown `startedAt` rather than inventing one;
- `dnf` finalizes the current attempt as non-completed history;
- ordinary reset finalizes the current active cycle as `abandoned` and preserves its activity events; it never rewrites a prior terminal cycle. Follow `shared/28-reading-cycle-state-machine.md`.

Do not use `createdAt` as a fallback reading start/finish date.

## Completion semantics for Statistics

Define a canonical `completedRead` as:

```text
one finalized reading cycle
where cycle.finishedAt belongs to the inclusive normalized Statistics period
```

The Statistics contract MUST distinguish reading-cycle count from distinct-book count; it MUST NOT keep the misleading `completedBooks` name for a cycle count. See `shared/25-completed-read-count-semantics.md`.

Canonical values:

- `completedReads` = finalized completed reading cycles in scope; finishing the same book twice in the same period contributes two completed reads;
- `uniqueBooksCompleted` = `COUNT(DISTINCT bookId)` across those completed reads; the same two reads contribute one unique book;
- the same book may legitimately appear in multiple years/periods;
- exact completion drill-down identifies `readingCycleId` + `bookId` so rereads are not collapsed;
- `firstBookCompletion` remains a separate **proven lifecycle/state-transition** metric and is not interchangeable with `uniqueBooksCompleted` or with the earliest completion merely known from legacy data. Follow `shared/26-first-book-completion-reliability.md`.

The primary Overview value uses the unit `читань` (or locale equivalent), while `uniqueBooksCompleted` is supporting distinct-book context. The frontend must never render a cycle count as `N книг`. Where duplicate rows are visible in exact details, show the completion date and, when useful, a reread/read-number indicator.

## Read-cycle metrics vs first-time state-transition metrics

A completed reread is another `completedRead` for behavioral metrics such as period reading count, reading dynamics, read-cycle ratings and behavioral “most active series”.

Do **not** blindly apply that multiplicity to metrics that represent a one-way/distinct-book state transition. For those, derive/use a **proven** `firstBookCompletion` (not merely the earliest surviving/known finished cycle) or the canonical lifecycle event, per `shared/26-first-book-completion-reliability.md`:

- discovery of a new author/genre/publisher;
- first-time series started/continued/completed/caught-up structural progress;
- TBR outflow and TBR forecast throughput.

This prevents rereads from inventing a second discovery, advancing the same series part twice, or making unread-backlog forecast look faster.

## Rating semantics across rereads

Historical rating analytics must not depend only on the mutable latest `BookReadingProgress.rating`.

When a cycle is finalized as finished, persist the canonical rating associated with that read on the cycle (nullable when unrated). Statistics rating coverage/average/top-rated calculations use the cycle-level rating for completed reads.

If the existing product supports editing the rating of the **latest completed read**, route that change through canonical Books/Reading logic so the intended finished cycle rating and current book view stay consistent. Do not rewrite older completed-cycle ratings merely because a later reread receives a new rating.

## Progress-event ownership by cycle

Add a nullable historical relation from `BookReadingProgressEvent` to the canonical reading cycle (for example `readingCycleId`).

Rules:

- every newly created progress event after the migration must be assigned to the current canonical cycle;
- legacy events may remain `readingCycleId = null` when safe cycle assignment cannot be proven;
- global pages/activity/calendar Statistics may still count reliable legacy events by their canonical `event.date` and `pagesRead`;
- do not fabricate cycle assignment for old events by grouping on `createdAt`, `updatedAt`, current `startedAt`, or other heuristics.

This relation lets future reading-history/detail logic distinguish page-number resets between different read-throughs without destroying previous cycle activity.

## Rereading transition

Starting `rereading` after a completed read must start a **new current reading cycle**. It must never reopen or erase the already-finalized completed cycle.

The new cycle receives its own start date according to `shared/16-reading-date-semantics.md`.

The existing mutable `BookReadingProgress` may be reset/adapted for current progress according to the canonical Books/Reading UX, but historical completed cycles remain unchanged.

Do not reuse the previous cycle's `startedAt` as the new cycle start merely because the mutable snapshot currently contains it.

## Reset semantics

The current book-wide behavior `deleteMany({ bookId })` for reading progress events is not acceptable once historical Statistics relies on those events.

A generic `resetProgress` command must not delete finalized historical cycles or events belonging to finalized historical cycles.

Ordinary reset of the **current unfinished cycle** may reset mutable current progress and finalize that cycle as `abandoned`, but it MUST NOT delete its already recorded reading-activity events. Those events remain historical page/activity facts per `shared/27-reading-activity-event-history.md`. Removing mistaken activity requires a separate explicit history-correction action.

Resetting a previously finished book in preparation for a reread preserves the completed historical cycle. A future product action that truly means “delete this historical read from my history/statistics” must be an explicit separate correction/removal operation with deliberate UX and tests; do not overload ordinary reset with that meaning.

## Backfill / migration rule

Do not invent missing historical rereads.

Recommended conservative migration:

1. for a book whose current mutable snapshot has a reliable `finishedAt`, backfill at most one legacy finished cycle from the facts that currently exist (`startedAt` when known, `finishedAt`, rating when known) and capture the current known analytics metadata once as `legacy_current_metadata` per `shared/19-historical-metadata-snapshots.md`;
2. mark/backfill provenance in a way that lets engineering distinguish legacy snapshot-derived cycles from newly tracked cycles if needed for diagnostics;
3. do not synthesize older completions that were already erased by earlier reread/reset flows;
4. do not assign existing progress events to a cycle unless the assignment is demonstrably safe;
5. existing unscoped legacy events remain valid for pages/activity by `event.date` when their event data itself is reliable.

Historical completeness before cycle tracking is therefore **best effort**. Do not manufacture an exact coverage percentage for lost cycles because the number of missing read-throughs is unknowable.

## Interaction with Reading Goals

Statistics continues to consume canonical Reading Goals metrics and must not reimplement goal math.

Do not silently change goal qualification/counting semantics as part of Statistics. Current Reading Goals already persist their own qualified completion facts; if the new cycle model exposes a concrete inconsistency in that domain, fix it in `reading-goals` with focused tests, then keep Statistics as a consumer.

## Repository/query requirements

Historical completion queries must be scoped to the authenticated user in the database and use cycle `finishedAt` rather than current mutable progress `finishedAt`.

Add only indexes justified by the actual query shape. A direct user + completion-date path is expected to be important for Overview period queries; verify the final schema/query with PostgreSQL query plans rather than relying only on assumptions.

## Tests required

At minimum cover:

1. finish a book once → one completed cycle;
2. start rereading → previous finished cycle remains unchanged and a new current cycle exists;
3. finish reread → same book contributes two completed reads across the appropriate dates/periods;
4. exact drill-down can distinguish the two cycles by cycle id;
5. current-cycle reset does not erase any already recorded reading-activity events, including events from the current unfinished cycle;
6. book-wide historical event deletion is no longer performed by ordinary reset;
7. legacy finished snapshot backfills at most one known cycle and does not invent older reads;
8. legacy unassigned events still contribute to pages/activity without fake cycle assignment;
9. ratings of two finished cycles remain independently stable when a later reread/rating changes;
10. cross-user cycle/event rows never leak into Statistics.

## Non-goals

This prerequisite does not introduce:

- generic event sourcing;
- reading-session-by-clock/time-spent tracking;
- guessed historical rereads;
- mass reconstruction from `createdAt`/`updatedAt`;
- a Statistics-owned mutable reading model.

It only adds the minimum canonical historical read-through model required for trustworthy completion/reread Statistics.

## First-completion reliability

This cycle model does not by itself prove that the earliest surviving cycle is the first-ever read. Implement `shared/26-first-book-completion-reliability.md`. Legacy backfilled finished cycles are `firstKnownBookCompletion` facts only unless stronger canonical evidence proves first-ever completion. Discovery, structural Series lifecycle and TBR first-completion outflow must not use unknown legacy firsts.

## Activity-event preservation on reset

Follow `shared/27-reading-activity-event-history.md`. Reading-cycle lifecycle and current progress reset are distinct from the historical activity-event ledger. An abandoned unfinished cycle is not a completed read, but its valid recorded pages/activity remain in Statistics.

## Canonical state machine and idempotency

Implement `shared/28-reading-cycle-state-machine.md`. Cycle creation/finalization must be retry-safe under the existing per-book transaction/lock: repeated start/reread/finish/DNF/reset must not create duplicate cycles or duplicate completed reads. Terminal `finished | dnf | abandoned` cycles are immutable to ordinary reading commands.

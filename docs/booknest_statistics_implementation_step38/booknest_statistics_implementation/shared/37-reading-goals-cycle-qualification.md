# Reading Goals qualification from canonical ReadingCycles

## Problem

Current Reading Goals synchronization derives qualification from mutable `BookReadingProgress.finishedAt`. After immutable ReadingCycle history is introduced, that source is no longer authoritative: starting a reread may clear/change the current snapshot even though an earlier completed read remains a real goal-qualifying fact.

Statistics must not become historically correct while Reading Goals can "uncount" an already qualifying Book merely because the Book starts another reading cycle.

## Canonical V1 goal semantics

Reading Goals remain **book-count goals**, not read-cycle-count goals.

For a given `ReadingGoalBook`, the Book counts at most once for that goal.

A Book qualifies when there exists at least one canonical `BookReadingCycle` with:

- `state = finished`;
- the same `userId` / `bookId`;
- `finishedAt` inside the goal counting window.

If multiple cycles qualify, select the **earliest qualifying finished cycle** with deterministic tie-break:

`finishedAt ASC → readingCycleId ASC`.

Persist/reference that selected fact as the qualification source, conceptually:

```ts
qualifiedReadingCycleId: string | null;
qualifiedFinishedAt: IsoDay | null;
```

The exact Prisma naming may follow existing conventions, but the selected cycle identity must be recoverable and auditable.

## Rereads

Example:

- read #1 finished `2026-03-15`;
- reread #2 finished `2026-08-20`;
- goal window covers all of 2026.

The Book contributes **1** to the goal, qualified by read #1.

Starting reread #2 does not clear goal qualification. Finishing reread #2 does not increment the same goal a second time.

## Correction behavior

Only an explicit canonical history correction may change an already-selected qualifying fact.

If the selected cycle is corrected/removed/moved outside the goal window:

1. search remaining canonical finished cycles for that Book in the goal window;
2. choose the earliest remaining qualifying cycle;
3. if none remain, mark the Book unqualified;
4. record the existing Reading Goal activity transition consistently.

Ordinary reread/start/reset does not perform this uncount.

## Existing Reading Goal calculations remain owner

`ReadingGoalMetricsSchema`, pace/risk/projection/completion calculations remain owned by Reading Goals.

This change replaces the **qualification input source**, not the goal calculation engine.

Do not copy goal metrics into Statistics or into ReadingCycle domain.

## Sync integration

Adapt `ReadingGoalSyncService` / repositories so snapshot entries obtain canonical qualifying-cycle information rather than current mutable progress `finishedAt`.

Cycle finalize/correction and Book membership changes that can affect goals should call the existing goal sync integration inside the same transaction where appropriate.

Avoid N+1 `cycle` lookup per goal-book: repository queries should fetch qualifying facts in set-based form.

## Legacy / backfill

A conservatively backfilled finished cycle may qualify a goal only when its known `finishedAt` is reliable enough for the existing goal window semantics. Do not fabricate earlier cycles.

The fact that a backfilled cycle is `first_known_only` does **not** prevent it from qualifying a Reading Goal: a goal asks whether this Book was completed inside its window, not whether it was the first-ever read of that title.

## Tests

At minimum:

1. first finish inside goal → counts once;
2. reread starts → still counts;
3. reread finishes inside same goal → still counts once;
4. earliest qualifying cycle outside window + later cycle inside window → later cycle qualifies;
5. two qualifying cycles → earliest wins deterministically;
6. correction removes selected cycle → next qualifying cycle takes over;
7. correction removes last qualifying cycle → uncounted;
8. goal metrics/pace/risk use the updated canonical qualification but keep existing formulas;
9. no reread can generate duplicate `book_counted` semantics for the same goal-book without a genuine uncount/recount correction transition.

## Do not do

- Do not use mutable current `BookReadingProgress.finishedAt` as the qualification authority after cycle rollout.
- Do not count rereads as additional Books toward a count-based goal.
- Do not uncount a Book merely because a new reread clears the current snapshot's `finishedAt`.
- Do not duplicate Reading Goal formulas in ReadingCycle or Statistics.

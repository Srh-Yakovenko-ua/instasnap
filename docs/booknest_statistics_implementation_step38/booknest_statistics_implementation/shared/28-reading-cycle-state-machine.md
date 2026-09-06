# ReadingCycle state machine and idempotency

This contract makes the reading-cycle prerequisite from `shared/17-reading-cycle-history.md` deterministic under retries, rereads, pauses, DNF and resets. The exact enum casing may follow repository conventions; the state semantics are mandatory.

## Canonical cycle states

V1 needs four lifecycle states:

```ts
type ReadingCycleState = "active" | "finished" | "dnf" | "abandoned";
```

- `active`: current read-through attempt; paused UI state does not finalize the cycle.
- `finished`: successfully completed read; contributes one `completedRead`.
- `dnf`: explicit did-not-finish terminal attempt; does not contribute a completed read. Its valid activity events remain historical activity.
- `abandoned`: terminal current attempt ended by ordinary reset/restart semantics without declaring a DNF; does not contribute a completed read. Its valid activity events remain historical activity.

Do not use `discarded` as a synonym for “delete history”. Actual historical correction/removal is a separate capability.

## State transition table

| Current cycle                               | Command / Book reading transition            | Result                                                       |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| none                                        | start `reading`                              | create `active` cycle                                        |
| none                                        | start `rereading`                            | create `active` cycle                                        |
| active                                      | progress update                              | stay `active`                                                |
| active                                      | pause / resume                               | stay `active`                                                |
| active                                      | finish                                       | finalize same cycle as `finished`                            |
| active                                      | DNF                                          | finalize same cycle as `dnf`                                 |
| active                                      | ordinary reset to not-started / want-to-read | finalize same cycle as `abandoned`; preserve activity events |
| finished/dnf/abandoned                      | ordinary mutation                            | terminal cycle remains immutable                             |
| terminal historical cycle + new read/reread | create a new `active` cycle                  |

There may be many terminal cycles for one book, but at most one `active` cycle.

## Date fields

- `active.startedAt` may be null only when creating the smallest truthful legacy/current repair cycle and the start is genuinely unknown.
- `finished` requires canonical date-only `finishedAt`.
- `dnf` requires canonical terminal date (`abandonedAt` or a more explicit `endedAt`/`dnfAt` if project naming prefers).
- `abandoned` requires canonical terminal date.
- terminal dates obey `shared/16-reading-date-semantics.md`.

Do not use technical `createdAt/updatedAt` as reading dates.

## Terminal immutability

Ordinary Books/Reading commands MUST NOT reopen or rewrite a terminal cycle. New reading after a terminal cycle creates another `active` cycle. Historical correction, if implemented, is an explicit separate command with its own audit/invalidation semantics.

Cycle-level completion snapshot/rating on `finished` follows the immutable-history rules; ordinary later Book edits do not mutate it.

## Idempotency: start / reread / resume

Repeated equivalent start/resume requests MUST NOT create multiple active cycles. Under the existing per-book reading lock/transaction:

1. if an active cycle exists, reuse it;
2. otherwise create exactly one active cycle;
3. the operation returns the canonical active cycle/current snapshot.

A duplicate `rereading` request after the new reread cycle already exists returns/reuses that active cycle; it does not create reread #3.

## Idempotency: finish

A retried finish command MUST NOT create duplicate completed reads.

Within the per-book transaction/lock:

1. if an active cycle exists, finalize exactly that cycle;
2. if no active cycle exists but the current canonical Books state already corresponds to a finalized cycle produced by the same logical finish, return that finalized result/no-op;
3. only the legacy repair case may synthesize the smallest truthful finished cycle when no canonical cycle exists at all, and that repair path itself must be idempotent.

Never implement `finish` as unconditional `create(BookReadingCycle)`.

## Idempotency: DNF and reset

- repeated DNF after the current cycle is already `dnf` is a no-op/reuses terminal result;
- repeated ordinary reset after an active cycle is already `abandoned` does not create another abandoned cycle;
- reset never deletes activity events; see `shared/27-reading-activity-event-history.md`.

## Progress-event retry safety

Progress mutations must not double-count pages under a retry of the same logical target progress. Prefer the existing canonical current-page delta behavior under the same per-book lock: a retry whose target page/status is already applied must not emit another positive `pagesRead` event.

If the transport/API later introduces idempotency keys, use them as an additional guarantee, not as a replacement for state-based transactional invariants. V1 does not require a new generic idempotency framework solely for Statistics.

## Rating edits

- rating set as part of finishing is persisted on that `finished` cycle;
- editing the rating of the latest completed read must target that explicit finished cycle through canonical Books/Reading logic;
- rating edit must not create a new cycle;
- a later reread has its own rating and must not overwrite older cycle ratings;
- if UI edits only mutable current rating today, update/refactor the write path so the intended cycle remains canonical before Statistics rollout.

## DNF → reading again

A `dnf` cycle remains terminal history. Starting that book again creates a new `active` cycle. Do not reopen the old DNF cycle, even if the Book-level reading status changes back to `reading`.

## Concurrency / DB invariant

Use the per-book reading lock/transaction pattern as the primary serialization boundary for **every** cycle-mutating path, including `startReading`, Book create/update lifecycle blocks and bulk reading-status operations. Follow `shared/36-reading-cycle-concurrency-invariant.md`.

The database-level at-most-one-active-cycle invariant is **mandatory** in V1. Use the repository's established PostgreSQL raw partial-unique-index pattern when Prisma cannot represent the predicate safely. Service serialization and the DB invariant are complementary, not alternatives.

Do not add a generic distributed lock system for this feature.

## Statistics mapping

- only `finished` cycles contribute `completedReads`;
- `dnf` and `abandoned` cycles do not;
- activity events attached to any state may still contribute page/calendar facts when valid;
- terminal cycle identity remains usable for exact historical details.

## Required tests

1. duplicate start/resume → one active cycle;
2. duplicate reread start → one new active reread cycle;
3. duplicate finish retry → one finished cycle / one completed read;
4. DNF → new reading → old DNF unchanged + new active cycle;
5. reset active → one abandoned cycle + events preserved; repeated reset creates no duplicate;
6. pause/resume does not split a cycle;
7. rating edit targets intended finished cycle without creating another cycle;
8. concurrent finish/start requests respect at-most-one-active invariant;
9. legacy repair finish is idempotent.

## Do not do

- Do not reopen terminal cycles through ordinary state transitions.
- Do not create a cycle on every `reading`/`paused` mutation.
- Do not create a new finished cycle on retry.
- Do not treat DNF or abandoned attempts as completed reads.
- Do not use reset to erase activity history.

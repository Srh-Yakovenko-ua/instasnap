# First-book-completion reliability

This contract separates **the earliest completion we currently know about** from a **proven first-ever completion of the book**. Statistics MUST NOT infer a first-ever read merely because the legacy dataset contains only one finished cycle.

## Canonical terms

### firstKnownBookCompletion

The earliest canonical finished reading cycle currently present for a `bookId`. It is an observed lower-bound fact: “this is the earliest completion BookNest currently knows about”. It does **not** prove that no older read was erased before reading-cycle history existed.

### firstBookCompletion

A finished reading cycle that is **proven** to be the user's first-ever canonical completion of that `bookId`. This is a stronger lifecycle/state-transition fact and may be absent even when `firstKnownBookCompletion` exists.

Recommended derived reliability representation:

```ts
type FirstCompletionReliability =
  | { status: "proven_first"; readingCycleId: string }
  | { status: "first_known_only"; readingCycleId: string; reason: "LEGACY_HISTORY_INCOMPLETE" }
  | { status: "not_first"; readingCycleId: string; priorReadingCycleId: string };
```

Equivalent internal representation is acceptable, but the semantic distinction is mandatory.

## When `proven_first` is allowed

A cycle may be classified as `proven_first` only when the backend has positive evidence that no earlier completed read exists in the canonical history. Valid evidence includes one of these product-owned situations:

1. the book/read lifecycle began after the reading-cycle-history cutover and the canonical history has been complete for that book since then;
2. an explicit trusted import/correction says this is the first completion;
3. another canonical domain event proves the unread → first-read transition.

Absence of an older row is **not** sufficient for pre-cutover/legacy books.

## Legacy migration rule

A conservative cycle backfilled from mutable legacy `BookReadingProgress.finishedAt` is:

```text
firstKnownBookCompletion = yes
firstBookCompletion = unknown / not proven
```

It MUST NOT automatically become `proven_first`. The same applies when a pre-cutover book has no backfilled finished cycle but later gets its first newly tracked completion: if older erased history cannot be ruled out, that new cycle is still only the first known completion.

Do not infer `proven_first` from `Book.createdAt`, `Book.updatedAt`, current reading status, the absence of old progress events, or snapshot provenance alone.

## Metrics that require proven first completion

The following state-transition metrics MUST consume only `proven_first` facts (or a stronger canonical lifecycle event), never merely `firstKnownBookCompletion`:

- new author discovery;
- new genre discovery;
- new publisher discovery;
- new language discovery if surfaced later;
- structural Series `started / continued / completed / caughtUp`;
- TBR outflow caused by first completion;
- any forecast rate derived from unread → first-read transitions.

Rereads never create another first completion.

## Metrics that do NOT require proven first completion

These may use normal finished reading cycles regardless of first-completion certainty:

- `completedReads`;
- `uniqueBooksCompleted`;
- pages/activity/calendar/streaks;
- cycle ratings;
- behavioral author/genre/publisher/language frequency;
- behavioral Series share/activity/marathon;
- top-rated and other cycle-based records.

## Availability / coverage

When a section mixes reliable tracked first completions with legacy books whose first-ever status is unknown, use the shared availability/coverage contract. Do not silently count `firstKnownBookCompletion` as a discovery merely to make totals non-zero.

For a first-completion-based capability, coverage means how much of the candidate lifecycle history is reliable enough to classify first-ever transitions. Example:

```ts
{
  availability: 'partial',
  coverage: { eligibleCount: 20, knownCount: 13, percent: 0.65 },
  reason: 'LEGACY_HISTORY_INCOMPLETE'
}
```

The exact denominator must be documented per section; do not claim an epistemic accuracy percentage for data whose candidate population itself is unknowable. If a defensible denominator cannot be formed, return `unavailable` with `LEGACY_HISTORY_INCOMPLETE`.

## Migration / cutover

The Reading-cycle rollout MUST record a stable cutover boundary or equivalent provenance needed to determine whether lifecycle history has been complete for a book. This may be a migration/cutover marker rather than a user-facing field. Do not use deployment wall-clock time ad hoc in Statistics queries.

## Tests

At minimum cover:

1. post-cutover new book → first finish = `proven_first`;
2. same book reread → later cycle = `not_first`;
3. legacy finished snapshot backfill = `first_known_only`;
4. legacy book with no backfill then newly finished = still `first_known_only` unless stronger evidence exists;
5. discovery/Series/TBR metrics exclude unknown legacy firsts and expose partial/unavailable quality rather than fabricating them;
6. cycle-based behavioral metrics still count those valid completed reads.

## Do not do

- Do not define `firstBookCompletion` as simply `MIN(finishedAt)` across currently surviving cycles.
- Do not promote a legacy backfill to “first-ever” because it is the only known cycle.
- Do not derive discovery/TBR/Series lifecycle facts from `firstKnownBookCompletion` when first-ever status is unknown.
- Do not hide uncertainty by converting unknown legacy firsts into zero.

# Final documentation / contract consistency gate

Run this gate after all Statistics implementation docs are applied and before handing the package to an implementation agent. It exists because the package evolved through many deliberate semantic changes; old examples/aliases must not survive as competing requirements.

## Authority order

1. actual `dev` repository state at implementation start;
2. shared canonical contracts in this package, especially `08`, `09`, `16`–`33`;
3. `shared/31-final-api-contract-manifest.md`;
4. backend/frontend implementation docs;
5. response examples/reference prose.

If lower-authority prose conflicts with a canonical contract, update/remove the stale prose rather than supporting both shapes.

## Required automated checks

- every internal backticked `.md` reference resolves;
- `unzip -t` / archive integrity passes;
- documented response fixtures parse the actual shared Overview Zod schema;
- generated OpenAPI/Orval compiles;
- no new Statistics DTO exposes deprecated aliases;
- no frontend Statistics component defines a handwritten parallel DTO.

## Deprecated live-contract vocabulary

The new Statistics implementation MUST NOT expose/use these as live semantics:

```text
completedBooks          // when value is reading-cycle count
delta / deltaPercent    // KPI comparison aliases
comparisonEnabled       // normalized response duplicate
completed_books_subset  // reread-collapsing drill-down name
RatingsFavoritesSection / Оцінки та фаворити
historyAvailability / insufficient as availability state
calendar.weekStartDay   // duplicate source
discarded               // canonical ReadingCycle terminal reset state is abandoned
```

Negative “do not use” mentions in documentation are fine; generated code/contracts are not.

Canonical replacements include:

```text
completedReads
uniqueBooksCompleted
absoluteDelta / percentDelta
comparison: object | null
reading_cycle / completed_reads_subset
RatingsSection / Оцінки
available | partial | unavailable
meta.weekStartDay
abandoned
```

## Semantic cross-checks

Before implementation starts, verify all of the following remain true simultaneously:

- rereads count as multiple `completedReads`, not multiple distinct books;
- first-known legacy completion is not automatically proven first-ever;
- reset preserves historical activity events;
- only finished cycles are completed reads;
- immutable completion snapshots own historical classification;
- soft delete preserves history, true hard purge erases it;
- pre-cutover activity may be lower-bound and missing old events are not zero; a reliable post-cutover period with no events is a known zero;
- reading dates are date-only labels; implicit new today uses user timezone;
- duration same-day = 1 and is not active reading time;
- Languages are declared edition language; Formats are not guaranteed V1; Favorites are not V1 rating analytics;
- exact drill-down preserves reading-cycle identity where rereads matter;
- comparison zero/rate semantics follow the final contract;
- frontend cache invalidation follows mutation-sync layer rules.

## Manual stale-wording sweep

Search the docs/code for the deprecated terms above plus:

```text
5-star / 4–5★
firstBookCompletion = earliest
MIN(event.date) = reliability boundary
reset deletes current-cycle events
Book.formats = format actually read
isPrimary required for V1
backend localized insight text
```

A hit may be a deliberate prohibition/history note; inspect it. No hit may remain as an affirmative implementation instruction.

## Final implementation-readiness rule

The package is implementation-ready only when:

1. canonical docs do not contradict each other;
2. response fixtures validate against actual schemas;
3. prerequisite Books/Reading migrations/write-path changes are represented in implementation order;
4. backend/frontend acceptance references the same field names and metric semantics;
5. repository audit at implementation start finds no newer `dev` change that invalidates a prerequisite.

## Final cross-feature readiness gate

Before backend implementation is declared ready, verify the package and code satisfy `shared/35-reading-lifecycle-write-path-integration.md` through `shared/40-repo-specific-verification.md`. In particular, no direct lifecycle writer, unlocked start/bulk path, mutable-progress-based Reading Goal qualification, missing correction path or unpersisted activity reliability boundary may remain.

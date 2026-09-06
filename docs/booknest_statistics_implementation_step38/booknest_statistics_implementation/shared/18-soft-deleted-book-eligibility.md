# Soft-deleted book eligibility

## Goal

Statistics must distinguish **historical reading facts** from **current library state** when `Book.deletedAt` is set.

A soft delete is a catalog/visibility lifecycle action. It is **not** an implicit request to rewrite previously recorded reading history. Conversely, current-library snapshot metrics must not count books that are no longer active in the user's library.

This distinction is mandatory across backend queries, domain rules, drill-downs and tests.

## 1. Canonical rule

Use two eligibility classes.

### A. Historical behavioral facts — keep after soft delete

Once reliably recorded, these facts remain eligible even if the related `Book` row is later soft-deleted:

- finalized `BookReadingCycle` completions;
- cycle-scoped reading progress events/pages;
- active reading days, calendar activity and streak history;
- cycle-level ratings;
- dynamics and comparison facts derived from those cycles/events;
- first-completion discoveries;
- historical author/genre/publisher/language aggregates derived from completed reads;
- historical reading/series milestones and records derived from canonical facts.

`Book.deletedAt != null` MUST NOT be applied as a blanket retroactive filter to these historical datasets.

Example:

```text
2025-06-10  book completed
2026-03-01  book soft-deleted
```

The 2025 completion, pages, rating and discovery facts still belong to 2025 Statistics.

### B. Current-state / current-library snapshots — exclude soft-deleted books

Any metric describing **what is currently in the user's active library** MUST use only active books:

```text
Book.deletedAt IS NULL
```

This includes, at minimum:

- current owned-book total;
- current TBR snapshot;
- current owned/read ratio denominator and numerator;
- other future current collection/TBR inventory metrics.

A soft-deleted book must not remain in a current-library denominator merely because it has historical reading facts.

## 2. Soft delete is not historical correction

Do not treat ordinary soft delete as equivalent to:

- deleting a finalized reading cycle;
- deleting historical progress events;
- changing an old rating;
- correcting an erroneous completion;
- purging analytics history.

If BookNest later needs a user-facing action such as `Remove this reading from history` or a privacy/data-purge operation, that must be an explicit domain action with deliberate effects on cycle/event history. Do not overload `Book.deletedAt` with that meaning.

Restoring a soft-deleted book must not recreate or duplicate its historical facts; the same cycles/events become linked to an active book row again.

## 3. Metadata for historical aggregates

Historical semantic metadata comes from the finalized cycle's completion-time snapshot defined in `shared/19-historical-metadata-snapshots.md`, not from the mutable current Book row. This keeps old author/genre/publisher/language/series membership and `pagesCount`-based records stable across later edits and soft deletes.

The still-present soft-deleted Book/entity rows may be used for current presentation enrichment (`bookState`, current display name, cover, context-action availability), but they must not redefine historical aggregate membership. Snapshot fallback labels are used when current presentation data is unavailable.

Soft deletion alone does not make the historical fact `unknown` and does not remove it from a ranking. If required snapshot metadata is genuinely missing, use the canonical availability/coverage contract. Do not drop the historical read solely because one optional metadata field is absent.

## 4. Series semantics

- Historical first-completion milestones remain historical facts even if the related book is later soft-deleted.
- Rereads still follow `shared/17-reading-cycle-history.md` and do not advance structural progress twice.
- Any **current catalog denominator** for series completeness/caught-up must reuse the canonical Series domain's current eligibility rules. Statistics must not invent a second deleted-book rule for Series.

Do not solve a current Series-domain ambiguity by retroactively removing historical reading milestones.

## 5. Goals semantics

Statistics consumes canonical Reading Goals results. Do not independently filter goal metrics by `Book.deletedAt` inside Statistics.

If Reading Goals must change how deleted goal books affect goal progress, that decision belongs to the Reading Goals domain and Statistics consumes the resulting canonical metrics.

## 6. Exact drill-down

An exact historical Statistics subset may contain a reading cycle whose current `Book` row is soft-deleted.

Required behavior:

- keep the row in the exact subset;
- preserve `readingCycleId` + `bookId` identity;
- allow Statistics-local details to render a deleted/unavailable-book state when needed;
- omit/disable a broader `Open book` context action if the normal Book route cannot open soft-deleted books;
- do not silently drop the row or navigate to an approximate active-books-only list.

Historical book references that can point to a deleted row MUST expose a small semantic `bookState: active | soft_deleted`. This is **not** the Statistics data-quality `availability` contract; it describes the current Book record state and prevents frontend from inferring deletion from a failed route.

## 7. Query rules

Historical fact queries:

- scope by authenticated `userId` and canonical period;
- use the historical cycle snapshot for semantic metadata; join the current Book only when needed for current `bookState`, presentation enrichment or explicit current-domain checks;
- **do not add `Book.deletedAt = null` as a blanket condition** for completion/event membership.

Current snapshot queries:

- explicitly require `Book.deletedAt = null`;
- then apply canonical ownership/reading-state eligibility.

Do not hide this distinction inside one repository method called `getEligibleBooks()` and reuse it for both historical facts and current snapshots.

## 8. Tests

At minimum cover:

1. completed read in 2025, book soft-deleted in 2026 → 2025 `completedReads` and `uniqueBooksCompleted` unchanged;
2. historical pages/calendar activity from that book remain in the original dates;
3. cycle-level rating still contributes to historical rating aggregates;
4. historical author/genre/publisher/language/discovery facts do not disappear solely because of soft delete;
5. current TBR/owned total/read ratio exclude the soft-deleted book;
6. restoring the book does not duplicate cycles/events or change historical counts;
7. exact completion drill-down still returns the deleted book's historical cycle and does not silently filter it out;
8. current-library query tests explicitly assert `deletedAt IS NULL` semantics;
9. historical-query tests explicitly assert that soft deletion is not a retroactive exclusion predicate.

## 9. Do not do

- Do not globally add `Book.deletedAt = null` to every Statistics query.
- Do not globally include soft-deleted books in current library/TBR snapshots.
- Do not delete finalized cycles/events just because `Book.deletedAt` is set.
- Do not use soft delete as a substitute for an explicit reading-history correction/purge action.
- Do not make frontend decide whether a deleted historical fact counts; backend owns the eligibility semantics.

## Hard delete is different

This preservation rule applies to **soft delete only**. True permanent Book/account erasure follows `shared/32-hard-delete-privacy-purge.md` and removes the owned cycles/events/snapshots; Statistics is allowed to change because the source data has been intentionally purged.

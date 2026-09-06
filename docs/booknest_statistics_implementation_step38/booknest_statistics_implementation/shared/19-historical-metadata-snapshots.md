# Historical metadata snapshots

## Goal

Historical Statistics must remain stable when the user later edits a Book's metadata. A period such as `2025` must not change merely because, in 2027, the user edits genres, authors, publisher, language, page count or series membership on the current `Book` row.

The canonical solution is **metadata snapshot-at-completion** for completed reading cycles. Current Book metadata may enrich presentation, but it must not redefine historical membership or historical numeric facts.

## Why current Book metadata is not a historical source

On current `dev`, historical analytics-relevant fields live on mutable current records/relations, including:

- `Book.pagesCount`;
- `Book.language` as canonical declared edition language; reliability/default semantics follow `shared/22-language-reliability-semantics.md`;
- `Book.genres[]`;
- `Book.publisherId`;
- `Book.authors` / `BookAuthor` relations;
- `Book.seriesId` / `partNumber`;
- Series status/order/known-book context used by structural series rules.

These fields can legitimately change because of corrections, enrichment, merges or later catalog maintenance. Joining a 2025 completed cycle to those values at query time would project today's metadata backwards and rewrite old rankings/records/discoveries.

## Canonical decision

When a canonical reading cycle is finalized as `finished`, persist a **typed analytics metadata snapshot** representing the metadata known for that read at completion time.

The exact persistence name may follow repo conventions (for example `analyticsMetadataSnapshot` / `completionMetadataSnapshot`), but the semantics are mandatory.

A finalized cycle's snapshot is immutable under ordinary Book edits. Changing current Book metadata does not mutate finalized cycle snapshots.

Do not build a generic audit/event-sourcing framework. This is a focused completion-time snapshot required for trustworthy reading analytics.

## Minimum snapshot contents

Persist only fields that are actually required to reproduce historical Statistics. A practical V1 typed shape is conceptually:

```ts
{
  version: 1,
  provenance: 'tracked_at_completion' | 'legacy_current_metadata',

  book: {
    title: string,
    pagesCount: number | null,
    language: BookLanguage | null,
    genres: string[],
  },

  authors: Array<{
    authorId: string,
    name: string,
  }>,

  publisher: null | {
    publisherId: string,
    name: string,
  },

  series: null | {
    seriesId: string,
    name: string,
    partNumber: number | null,
    // Structural context is resolved by the canonical Series domain when needed.
    // Exact persisted fields may follow that domain's existing semantics.
    structuralContext?: CanonicalSeriesCompletionContext,
  },
}
```

`structuralContext` above is conceptual, **not permission for an untyped public JSON blob**. If Series structural lifecycle requires completion-time denominator/status/eligibility facts, persist the smallest typed canonical Series-domain result needed to reproduce those historical milestones, or persist a focused canonical series-lifecycle milestone fact. Do not let Statistics invent its own Series ordering/completeness rules.

The implementation may use a typed/versioned JSON column or focused normalized snapshot rows/columns, whichever best matches current project conventions and query needs. If JSON is used, validate it with a shared/internal Zod schema and keep a snapshot schema version. Do not expose arbitrary unvalidated JSON in the public API.

## Semantic fields vs presentation enrichment

Historical **membership/numeric semantics** MUST come from the finalized cycle snapshot:

- author membership/counting;
- genre membership/counting;
- publisher membership/counting;
- language membership/counting;
- behavioral series membership;
- historical book-length/`pagesCount` records;
- discovery identity at first completion;
- any completion-time Series structural context needed for stable lifecycle milestones.

Current records MAY be used only as presentation enrichment when available:

- current entity display name;
- current cover/media;
- current route availability;
- current `bookState` (`active | soft_deleted`).

Presentation enrichment MUST NOT alter whether a historical cycle belongs to an author/genre/publisher/language/series aggregate.

If a current entity no longer exists or is unavailable, use the snapshot fallback label where the UI needs one. Missing current navigation must not remove the historical fact.

## Names and identity

For relational entities, historical grouping identity is the snapshot identity (`authorId`, `publisherId`, `seriesId`) captured at completion time.

A later rename of the same entity may be shown as the current display label when the entity still exists, because a rename changes presentation rather than identity. The historical membership remains attached to the snapshot id.

If BookNest later supports explicit entity merges or historical metadata corrections that intentionally change identity, that must be a deliberate domain migration/correction with tests. Do not silently remap finalized snapshots merely because the current Book relation changes.

For `Book.genres[]`, snapshot the canonical persisted values/keys used by the Book at completion. Later edits to the current genre list do not rewrite old cycles.

## `pagesCount`

Actual pages-read totals continue to use `BookReadingProgressEvent.pagesRead`; never reconstruct activity from book length.

Metrics that explicitly need **book length**, such as `Найдовша завершена книга`, use the cycle's `pagesCount` snapshot. They must not use today's mutable `Book.pagesCount` for a historical completion.

If the completion-time snapshot has no reliable `pagesCount`, apply canonical availability/coverage/record eligibility. Do not fill it later from a changed current value at query time.

## Ratings

Rating is already cycle-level per `shared/17-reading-cycle-history.md`; it is not duplicated inside this metadata snapshot unless implementation conventions strongly justify it. Historical rating analytics continue to use canonical cycle rating.

## Series: behavioral vs structural history

Two cases must remain distinct.

### Behavioral series analytics

`series share`, `most active series` and marathon membership use the completion-time `seriesId` / part context from the cycle snapshot. Moving the current Book into or out of a series later does not rewrite the old behavioral read.

### Structural lifecycle analytics

`started / continued / completed / caughtUp` are historical structural milestones. They MUST NOT be recomputed for an old period solely from today's mutable `Series.status`, `totalBooks`, book membership/order or ignored/disabled configuration.

At each relevant first completion, obtain the structural resolution from the canonical Series domain and persist enough immutable context/fact to reproduce the historical milestone. Acceptable implementation directions are:

1. completion-time typed Series structural context stored with the cycle/first-completion fact; or
2. a small canonical persisted Series lifecycle milestone/fact owned by the appropriate domain integration.

Statistics consumes that canonical historical fact/context. It does not duplicate Series heuristics.

Current series pages may still use current Series metadata; that is separate from historical Statistics.

## Snapshot creation transaction

For every newly tracked finished cycle:

1. resolve canonical current Book metadata and relations inside the Books/Reading completion flow;
2. resolve any required canonical Series-domain structural context;
3. persist the cycle's final rating/date and metadata snapshot atomically with cycle finalization, using project transaction conventions;
4. after finalization, ordinary Book edits do not mutate the snapshot.

A partially written finished cycle without the required snapshot should not be produced by normal post-migration flows.

## Legacy/backfill rule

Past completion-time metadata usually cannot be reconstructed exactly.

For a legacy finished cycle created during the conservative migration from `shared/17-reading-cycle-history.md`:

- capture the **current known Book metadata once at migration/backfill time**;
- mark snapshot provenance `legacy_current_metadata` (or equivalent);
- do not claim that this necessarily equals metadata at the original finish date;
- freeze that snapshot afterwards so later edits no longer continue to drift history;
- do not reconstruct old author/genre/publisher/series membership from `createdAt`, `updatedAt` or other unrelated timestamps.

`coverage` still describes known-vs-eligible metadata, not epistemic certainty about what the metadata was years ago. Do not invent a fake historical-accuracy percentage for legacy snapshots.

If a legacy field is genuinely absent, use the canonical availability/coverage rules rather than filling it from a future current Book value on every Statistics request.

## Soft delete / purge interaction

This rule complements `shared/18-soft-deleted-book-eligibility.md`.

A later soft delete never removes the historical cycle or its snapshot. Historical labels/membership can therefore survive even when the normal active Book route is unavailable.

Do not require the current Book row as the semantic source for a historical aggregate. Current Book may be joined for `bookState`, current cover/name enrichment or context actions only.

Hard-delete/privacy purge behavior is a separate explicit data-lifecycle decision and must deliberately define whether historical cycles/snapshots are purged; do not infer it from soft-delete semantics.

## Exact drill-down

Exact historical detail items remain identified by `readingCycleId + bookId` and use the same completion-time snapshot semantics as their source aggregate.

Example: if a 2025 cycle was counted under Author A and the current Book is later reassigned to Author B, clicking the 2025 Author A ranking still returns that exact cycle. `Open book` may show the current Book record with Author B as a separate context/entity action; that current page must not redefine the 2025 aggregate.

## Query/performance rule

Do not reintroduce historical drift just to simplify SQL by joining every period cycle to current `Book` metadata.

Fetch/aggregate against persisted historical snapshot fields/context. Choose normalized columns/rows vs typed JSON according to actual query-plan evidence and existing project conventions. Add indexes only when the implemented query demonstrates a need.

## Tests required

At minimum cover:

1. finish a book with Genre A → edit current Book to Genre B → old period remains Genre A;
2. finish with Author A → change current Book author relation → old author ranking/discovery remains attached to snapshot Author A;
3. finish with Publisher P1 → change to P2 → old publisher aggregate remains P1;
4. finish with language X → change current language → old language aggregate remains X;
5. finish with `pagesCount = 500` → later edit to `450` → historical longest-book eligibility/value remains 500;
6. finish as standalone → later assign current Book to a series → old behavioral series metrics remain standalone;
7. finish in Series S → later remove/change series membership → old behavioral series membership remains S;
8. structural `completed/caughtUp` milestone does not change merely because current Series status/known-book denominator changes later;
9. current entity rename may update display label without changing snapshot identity/membership;
10. exact drill-down membership remains equal to the aggregate after current metadata edits;
11. legacy backfill is marked `legacy_current_metadata` and freezes the captured values from that point onward;
12. soft-deleted historical rows can render snapshot fallback labels without being removed from the aggregate;
13. cross-user snapshot data never leaks.

## Do not do

- Do not compute historical tastes/records/series membership from mutable current Book relations on every request.
- Do not mutate finalized cycle snapshots on ordinary Book edit.
- Do not use current `Book.pagesCount` to rewrite a historical longest-book record.
- Do not project a newly added current genre/author/publisher/series relation backwards into old periods.
- Do not create a generic full-Book snapshot or generic event-sourcing system; snapshot only analytics-relevant completion metadata.
- Do not expose untyped arbitrary snapshot JSON through OpenAPI/frontend contracts.

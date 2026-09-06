# Exact drill-down contract

Statistics follows the same core interaction rule already established by Delivery Statistics:

> A click/chevron on an analytics value means **exact drill-down into the same subset from which that value was calculated**. Related-but-not-exact navigation is a separate explicit context action.

This is a product contract, not only a frontend convention. Backend/shared contracts must expose enough semantic scope for frontend navigation/details to reproduce the aggregate exactly.

## 1. Canonical distinction

Each interactive analytics item may expose:

```ts
type StatisticsInteractiveTarget = {
  drilldown?: StatisticsExactDrilldown;
  contextActions?: StatisticsContextAction[];
};
```

- `drilldown` — at most one canonical exact destination for the metric/subset; clicking the row/card/bar/chevron uses this target.
- `contextActions` — optional related navigation such as `Open author`, `Open publisher`, `Open series`, or a broader library view. These actions MUST be visually explicit and MUST NOT masquerade as the metric click.
- no `drilldown` — the analytics item is non-clickable even if a related context action exists.

Do not encode arbitrary frontend URLs in backend DTOs. Use a shared discriminated semantic target and a centralized frontend builder that translates the target to existing route/query conventions.

## 2. Exactness invariant

For an aggregate `A = aggregate(S)`, its drill-down destination MUST reproduce the same source subset `S` (subject only to deterministic presentation ordering/pagination).

Examples:

- `Genre: Fantasy · 14 читань` for period `2026-01-01..2026-08-19` → exact drill-down contains the 14 completed reading cycles in that period that contributed to the Fantasy count. It MUST NOT silently open every Fantasy book in the library.
- `Author: X · 5 читань` → exact drill-down contains the 5 completed reading cycles that contributed to the behavioral ranking (including rereads if the ranking counts them). `Open author` is a separate context action. Discovery/first-time metrics instead use first-completion semantics.
- rating bucket `9.0–10.0 · 8 читань` → exact drill-down contains those same eligible completed+rated reading cycles in that bucket.
- dynamics month `March · 6 читань` → exact drill-down contains the six canonical completed reading cycles whose cycle `finishedAt` placed them in that bucket; repeated `bookId` values are allowed and remain distinct by `readingCycleId`.
- calendar day `2026-05-14 · 124 pages` → exact drill-down is the shared reading-day details built from that date's canonical progress events.
- top-rated item represents one concrete completed reading cycle → primary exact drill-down targets that `readingCycleId`; broader `Open book` navigation is a separate context action because a Book page does not reproduce one historical read-through.

## 3. Semantic target shape

Implement the shared target as small discriminated unions, not a generic query-language/BI DSL. Exact names may follow project conventions, but the semantics are mandatory. A practical shape is:

```ts
type StatisticsExactDrilldown =
  | { kind: "reading_cycle"; readingCycleId: string; bookId: string }
  | { kind: "reading_day"; date: string }
  | {
      kind: "completed_reads_subset";
      period: { from: string | null; to: string };
      filters: {
        authorId?: string;
        genre?: string;
        publisherId?: string;
        seriesId?: string;
        ratingMin?: number;
        ratingMax?: number;
        language?: string;
        finishedFrom?: string;
        finishedTo?: string;
      };
    };

type StatisticsContextAction =
  | { kind: "open_author"; authorId: string }
  | { kind: "open_publisher"; publisherId: string }
  | { kind: "open_series"; seriesId: string }
  | { kind: "open_goal"; goalId: string }
  | { kind: "open_book"; bookId: string }
  | { kind: "open_books" /* broader/non-exact semantic target */ };
```

Do not add filters merely because they might be useful someday. Add only variants/fields required by implemented Statistics interactions.

`completed_reads_subset.period` is the canonical Statistics source period. Bucket-specific bounds such as a selected month/week/day further narrow that source; they never replace unrelated semantics with a fuzzy text search.

## 4. Frontend builder

Create one typed Statistics drill-down builder/router helper, for example:

```text
features/statistics/model/build-statistics-drilldown-target.ts
```

Responsibilities:

- accept only generated/shared `StatisticsExactDrilldown`;
- map semantic targets to destination-specific route/query params;
- preserve exact period/filter semantics;
- use IDs for exact entities (`authorId`, `publisherId`, `seriesId`, `bookId`) rather than fuzzy `q` searches;
- fail closed: if the current destination cannot represent the subset exactly, do **not** generate approximate navigation. Use the Statistics-local detail UI/endpoint or leave the metric non-clickable until exact routing exists.

Do not let every card assemble URLs independently.

## 5. Existing-page capability rule

Prefer an existing BookNest destination only when its current filter contract can reproduce the exact Statistics subset.

If it cannot:

1. keep the primary click inside Statistics using an exact detail popover/bottom sheet/lazy detail endpoint; or
2. extend the destination with explicit exact filters as a deliberate cross-feature change;
3. keep broader navigation as a separately labelled context action.

Never degrade exactness to avoid a small routing/backend change.

## 6. Interaction rules

- KPI cards remain non-clickable as already decided.
- A chevron is rendered only when `drilldown` exists.
- The entire analytics row/bar may be clickable when it has exactly one canonical `drilldown`.
- Context actions use explicit labels/icons and do not hijack the primary row click.
- Popovers/bottom sheets must preserve the same subset; any `View all` CTA inside them is exact or is renamed/reframed as an explicit broader context action.
- Pagination/sorting in a destination may change presentation order but not membership semantics.

## 7. Backend/shared responsibilities

Backend owns:

- source eligibility;
- period/bucket normalization;
- aggregate membership semantics;
- IDs/filter values required to reproduce the exact subset.

Shared contract owns the typed drill-down/context-action discriminators.

Frontend owns:

- route construction;
- popover/bottom-sheet presentation;
- explicit context-action labels;
- no reconstruction of business eligibility from display values.

## 8. Tests

For every interactive aggregate added to V1, test at least one exactness case:

```text
aggregate count == count of records returned/resolved by its exact drill-down scope
```

Also test:

- period filters survive navigation;
- entity IDs are used instead of fuzzy search;
- no chevron when `drilldown` is absent;
- broader entity/library links are rendered as context actions;
- unsupported destination capability fails closed instead of producing approximate navigation.

## Reading-cycle identity

Completion-based Statistics scopes are sets of completed reading cycles, not necessarily distinct books. A reread can therefore produce multiple exact rows for the same `bookId`. Canonical completion drill-down scope/result must carry `readingCycleId` (plus `bookId`); do not collapse duplicate book ids or route the primary click to a distinct-book library list that cannot reproduce the aggregate.

## Soft-deleted historical books

Exact historical subsets do not drop a reading cycle merely because its current `Book` row is soft-deleted. Preserve `readingCycleId + bookId`, expose `bookState: active | soft_deleted` on the historical book reference, and render a Statistics-local deleted-book state if the normal Book surface cannot open it. In that case omit/disable the broader `Open book` context action rather than changing subset membership. See `shared/18-soft-deleted-book-eligibility.md`.
Exact membership also follows the cycle's completion-time metadata snapshot (`shared/19-historical-metadata-snapshots.md`). A later current Book author/genre/publisher/language/series edit must not move an old cycle into a different historical exact subset; broader current-entity navigation remains a separate context action.

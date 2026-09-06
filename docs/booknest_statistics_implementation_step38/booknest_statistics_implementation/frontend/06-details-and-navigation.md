# Details, popovers, bottom sheets and exact navigation

Unify analytics drill-down UX around the canonical contract in `shared/10-exact-drilldown-contract.md`.

## Central rule

A click/chevron on an analytics metric means **exact drill-down**: the destination must represent the same subset from which the displayed statistic was calculated. Related-but-not-exact navigation is a separate explicit context action.

Examples:

- `Fantasy · 14 читань` must not silently navigate to all Fantasy books ever; the primary drill-down represents the 14 eligible completed reading cycles in the active period.
- an author ranking row opens the exact Statistics subset/details for that row; `Open author` is a separate context action.
- a concrete book cover may navigate directly to book details because the clicked object is exactly that book.

## Desktop

- lightweight popover when staying in Statistics context is the safest exact representation;
- direct navigation when an existing destination can reproduce the exact subset;
- direct navigation for a concrete entity only when the interaction itself represents that exact entity (for example a book cover);
- chevron only when a canonical exact `drilldown` exists.

## Mobile

- bottom sheet for exact day/genre/author/publisher/language details;
- broader entity/list actions inside the sheet remain explicit context actions unless they reproduce the exact subset.

## Centralized builder

Create one typed helper (name may follow project conventions), e.g.:

```text
features/statistics/model/build-statistics-drilldown-target.ts
```

It consumes the generated/shared `StatisticsExactDrilldown` union and maps it to existing route/query conventions. Individual cards/rows MUST NOT assemble ad-hoc URLs. Use IDs and exact filters, never fuzzy `q` matching for an exact target.

Fail closed: if an existing BookNest page cannot express the exact period + filters, do not navigate approximately. Keep primary interaction in a Statistics popover/bottom sheet/lazy details endpoint, or deliberately extend the destination filter contract first.

## Reuse

- shared day-details UI for heatmap and books calendar after interaction; initial calendar/diary Books mode uses Overview `booksPreview` and does not preload day details;
- existing book cover/card primitives;
- existing author/publisher/series navigation only as exact destinations or explicit context actions;
- existing filtered list query conventions only when they can represent exact Statistics semantics.

Avoid inventing a new modal system specifically for Statistics.

## Reread-aware exact completion details

Completion-based Statistics details represent reading cycles, not distinct book rows. If the same book was completed more than once in the exact subset, do not collapse it by `bookId`. Render each exact item with its completion date and preserve `readingCycleId`; a compact `Перечитано` / read-number marker may be shown when needed to explain repeated covers. `Open book` remains a context/entity action to the single book record.

## Soft-deleted historical book rows

Historical exact details may contain a reading cycle whose current Book record has `bookState = soft_deleted`.

Frontend rules:

- keep the row because it belongs to the exact historical subset;
- show a compact neutral state such as `Книгу видалено з бібліотеки` / localized equivalent;
- do not infer deletion from a failed fetch or missing route; consume generated `bookState`;
- keep cycle facts that remain reliable (finished date, cycle rating, pages/activity where present);
- omit/disable `Open book` when the normal Book route does not support soft-deleted records;
- do not replace the primary exact result with a broader active-books-only navigation.

`bookState` is not the section `availability` state and must not trigger a generic unavailable Statistics section.

## Historical metadata vs current Book presentation

Exact Statistics rows are historical reading-cycle results. Their aggregate membership/semantic labels come from the completion-time snapshot in `shared/19-historical-metadata-snapshots.md`. Current Book/entity data may enrich the row with the latest cover/name/navigation when available, but a current metadata edit must not move/remove the row from the historical exact subset.

Example: a 2025 cycle counted under Author A stays in the 2025 Author A exact subset even if the current Book is later reassigned to Author B. `Open book` is a separate current-entity action and may show today's metadata. When current entities are unavailable, render snapshot fallback labels rather than dropping the cycle.

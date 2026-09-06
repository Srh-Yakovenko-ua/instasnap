# Completed reads vs unique completed books

## Why this contract exists

Canonical rereading means one `bookId` can have multiple finalized reading cycles. A reading-cycle count and a distinct-book count are therefore different metrics and must never share the same API/UI name.

## Canonical metrics

### `completedReads`

Number of canonical finalized reading cycles whose cycle `finishedAt` belongs to the normalized Statistics period.

- first finish of Book A in scope → +1;
- reread of Book A finished again in the same scope → +1 again;
- exact rows preserve `readingCycleId` + `bookId`;
- later soft delete does not remove historical reads.

This is the primary behavioral completion metric used by the Overview KPI, completed-read Dynamics and behavioral taste/series counts.

### `uniqueBooksCompleted`

`COUNT(DISTINCT bookId)` across canonical `completedReads` in the same selected period.

- Book A finished twice in scope → `completedReads = 2`, `uniqueBooksCompleted = 1`;
- Book A first finished before scope and reread once in scope → `completedReads = 1`, `uniqueBooksCompleted = 1`;
- therefore `uniqueBooksCompleted` is not equivalent to `firstBookCompletion`.

This is supporting distinct-title context, not a fifth KPI card in V1.

## Naming invariant

The new global Statistics API MUST use:

- `completedReads` / `completedReadCount` for reading-cycle counts;
- `uniqueBooksCompleted` (or another explicitly distinct-book name) for distinct-book counts.

Do **not** expose a reading-cycle count as `completedBooks`, `booksCompleted` or another field whose name implies distinct books. Existing unrelated BookNest APIs may retain their established naming; this rule applies to the new Reading Statistics contract.

## Overview KPI

Keep the existing four-card layout.

Completed card:

- title: `Прочитано`;
- primary value: `37 читань`;
- supporting context: `35 унікальних книг`;
- comparison refers to `completedReads`, e.g. `↑ 8 читань · +28% проти 2025`.

Frontend must never render `completedReads = 37` as `37 книг`. `uniqueBooksCompleted` is supplied by backend and must not be inferred from preview arrays.

## Dynamics

The count series is `completedReads`. User-facing toggle: `Читання | Сторінки`, not `Книги | Сторінки`. Bucket labels/tooltips that show the cycle count use the equivalent of `читань`.

A future distinct-title series must be explicit and must use `uniqueBooksCompleted`; do not silently change the behavioral series semantics.

## Behavioral rankings

When finalized cycles are the population, use `completedReadCount` and copy equivalent to `читань` for:

- genre frequency;
- author frequency;
- publisher frequency;
- language frequency;
- behavioral series share.

If a surface wants distinct books, its backend field and user-facing unit must explicitly say so and use `COUNT(DISTINCT bookId)`.

Discovery, structural Series lifecycle and TBR reduction continue to use first-completion/state-transition semantics.

## Ratings coverage

Cycle-level rating coverage uses `ratedReadsCount / completedReadsCount`. Do not call these `ratedBooksCount / completedBooksCount` when rereads are eligible.

## Insights

Insights comparing this behavioral metric use typed params such as `currentReads`, `comparisonReads`, `absoluteDeltaReads`, `percentDelta`. Do not use `currentBooks/comparisonBooks` for a cycle count.

## Comparison

Normalize `completedReads` and `uniqueBooksCompleted` independently for current/comparison periods. A reread can change the read delta while the distinct-book delta remains unchanged. Frontend does not derive one from the other.

## Acceptance examples

### No reread

A, B, C each finish once:

- `completedReads = 3`;
- `uniqueBooksCompleted = 3`.

### Same-book reread inside the period

A#1, A#2, B finish:

- `completedReads = 3`;
- `uniqueBooksCompleted = 2`;
- exact details contain three cycle rows and two distinct `bookId` values.

### Reread of an older title

A was first completed in 2025 and reread once in 2026. For 2026:

- `completedReads = 1`;
- `uniqueBooksCompleted = 1`;
- `firstBookCompletion` for A is not in 2026;
- reread does not create a new-author/new-genre/TBR-first-completion transition.

## Do not

- do not retain `completedBooks` as an alias for a reading-cycle count in the new Statistics API;
- do not display a cycle count with unit `books/книг`;
- do not deduplicate `completedReads` by `bookId`;
- do not count rereads multiple times in `uniqueBooksCompleted`;
- do not confuse `uniqueBooksCompleted` with `firstBookCompletion`;
- do not let frontend infer the distinct count.

# Statistics test fixtures

Create small deterministic fixtures. Do not depend on a huge opaque dev database.

## Fixture user A

Target ~10–12 books.

### Reading timeline

- 2 completed reads in January.
- 1 book starts in January and finishes in February.
- 3 completed reads in March.
- 1 currently reading.
- 1 paused.
- 1 DNF with rating if domain allows it.
- 1 completed read with no rating.
- 1 old historical finished book before the current statistics period.

### Progress events

Include:

- date-only/timezone boundary fixtures with a frozen instant where UTC and user-local calendar dates differ (at least one timezone ahead of UTC and one behind UTC);
- an explicit client-provided `YYYY-MM-DD` case proving the date persists unchanged;
- a profile timezone change after historical events proving stored event/finish dates stay on the same calendar labels;
- multiple events on same day across 2 books;
- one day with **4+ books with `pagesRead > 0`** to assert preview cap = 3, deterministic `pagesRead DESC` → `bookId ASC` ordering and non-zero `remainingBooksCount`;
- one tie on per-book daily pages to exercise the `bookId ASC` tie-break;
- one zero-page event alongside real activity to prove it does not enter `booksCount`/preview/day-details membership;
- consecutive active days for a known streak;
- a streak crossing the start of a short/current custom `metricRange` to assert clipped value + `continuesBeforeRange = true`;
- a closed past-year period to assert `currentStreak = unavailable/PERIOD_NOT_CURRENT`;
- > 12 months of progress-event history so All-time asserts lifetime/tracked KPI scope but last-12-month `displayRange`/day payload;
- a gap day;
- one high-page day for a record;
- page events crossing month boundaries.

### Ratings

Use only canonical BookNest values on the `0.5–10.0` scale with `0.5` step (for example `10`, `9.5`, `8`, `6.5`). Do not create 1–5-star fixtures.

Have enough rated books to test:

- rating distribution across canonical values;
- high-rating share using `rating >= 8.0`;
- one genre with ≥3 rated books;
- one author with ≥3 rated books;
- one genre with only 1 rated book so it is excluded from `highest rated`.

### Genres

Use multi-genre books.
Include:

- one genre seen before period;
- one genre first read in period.

### Authors

Include:

- one returning author with books in multiple years;
- one brand-new author in period;
- one co-authored book.

### Series

Create:

- one completed series;
- one ongoing series that becomes caught up;
- one continued series;
- one new series;
- one series with unknown metadata that forces an `unavailable` result for certainty-dependent metrics;
- a sequence of ≥2 consecutive books from same series for marathon.

### Publishers / language + optional format-capability guard

Include:

- known publisher;
- missing publisher;
- canonical language `ukrainian` and at least one other `BookLanguageSchema` value such as `english`;
- a `ukrainian` case that remains a valid observation even though it equals the current product default;
- one synthetic legacy/backfill completion snapshot with genuinely missing/invalid language to prove `partial` coverage semantics without inventing a fake `Не вказано` category;
- API expectation uses canonical values (`ukrainian`, `english`), not `uk`/`en`;
- multiple values in `Book.formats[]` on at least one book to prove that this field alone does **not** enable actually-read-format analytics. Guaranteed V1 must still be valid with Formats omitted.

### Goal

Create:

- one active target-count goal;
- multiple active goals to test deterministic primary selection, including:
  - different deadlines → nearest deadline wins;
  - same deadline + different `createdAt` → earlier-created goal wins;
  - same deadline + same `createdAt` → `id ASC` is the stable final tie-break;
  - non-active (`completed`/`expired`/`archived`) goals are never candidates;
  - candidate count/order does not depend on a frontend/default paginated list.

## Fixture user B

Small separate dataset used specifically to assert no cross-user leakage.

## Empty user

No books/progress.

## Historical data fixture

### Historical metadata drift fixture

Create at least one completed tracked cycle, then mutate the current Book metadata after completion:

- Genre A → Genre B;
- Author A → Author B relation;
- Publisher P1 → P2;
- language X → Y;
- `pagesCount 500 → 450`;
- standalone → Series S, and a separate Series S → standalone/change case.

Assert that the old period continues to use the completion-time snapshot for historical rankings/discoveries/records/behavioral series membership. Add a structural Series case where current series status/known denominator changes after a persisted historical milestone and the old lifecycle result remains stable.

Also include one legacy backfilled cycle with `legacy_current_metadata` provenance and prove later Book edits no longer drift its captured snapshot.

Include data in previous year for comparison:

- fewer completed reads;
- different genre rank;
- if and only if a reliable optional reading-format capability exists, different format mix for its comparison tests; otherwise no format-comparison fixture is required;
- different active-day rate.

## TBR history

If lifecycle history is not implemented, tests must assert canonical period-flow `availability = unavailable`, `data = null`, reason `HISTORY_NOT_TRACKED`, not fabricate inflow/outflow.

## Availability / coverage fixture assertions

Include explicit cases for:

- `available` known zero;
- `partial` rating/language metadata with exact `{ eligibleCount, knownCount, percent }`;
- `unavailable` with typed reason;
- `eligibleCount = 0` → coverage percent `null`;
- minimum-sample failure represented as `unavailable + INSUFFICIENT_SAMPLE`, never a fourth `insufficient` enum value.

## Soft-deleted book eligibility fixtures

Add fixtures for:

- completed reading cycle in an old period, then `Book.deletedAt` set later — historical completion remains;
- historical progress events/pages remain in calendar/dynamics after soft delete;
- cycle rating and discovery/ranking metadata remain eligible after soft delete;
- same Book excluded from current owned/TBR/read-ratio snapshot;
- restored Book does not duplicate historical cycles/events;
- exact drill-down can return a historical cycle whose Book is currently soft-deleted.

## Rereading / cycle-history fixtures

Add at least:

- one book finished once in 2025, reread started in 2026 and finished in 2026; expect one completed read in each period and two lifetime cycles;
- one book finished twice inside the same period; expect `completedReads` +2, `uniqueBooksCompleted` +1, while exact results retain two distinct `readingCycleId` values;
- two cycle-level ratings for the same book to prove historical rating stability;
- a current unfinished cycle reset after an earlier finished cycle; earlier cycle/events remain;
- legacy finished snapshot eligible for one conservative backfill cycle;
- legacy progress events with no provable cycle assignment; they still count pages/activity but are not fabricated into a read cycle.

## Deterministic ordering fixtures

Add ties that force each comparator to its final key:

- two top-rated cycles with equal rating and `finishedAt` → `readingCycleId ASC`;
- equal-frequency genres → `genreKey ASC`;
- equal-frequency authors → `authorId ASC`;
- equal average-rating + rated-count genre/author rows → stable key ASC;
- publishers tied on count and average rating, plus a tied-count publisher with unavailable/null rating → valid rating before null, then `publisherId ASC`;
- equal language counts → canonical language value ASC and unchanged order under both `uk`/`en` UI locales;
- equal most-active/progress series → `seriesId ASC`;
- equal discovery candidates within each type → stable entity key ASC;
- equal record extrema for each applicable record type → documented final key;
- Insight candidates tied on semantic rank/significance → internal `stableKey ASC`;
- exact-detail rows tied across a pagination boundary → no duplicate/missing IDs between pages.

## Period/comparison edge fixtures

Add focused fixtures/frozen clocks for `shared/24-period-comparison-edge-contract.md`:

- current-year today in at least two timezones around UTC midnight;
- custom one-day range;
- 31/32-day and 180/181-day ranges;
- leap-day current period (`2024-02-29`) and prior-year clamp;
- last-12-month window crossing a leap year;
- comparison period with genuinely zero reading activity;
- deltas `10→8`, `0→5`, `0→0`, `8→0`;
- active-day rates `0.352→0.416` producing `+6.4 pp`;
- invalid reversed/future custom ranges and future year.

### Duration edge fixtures

- same-day finished cycle (`startedAt == finishedAt`) → elapsedDays 1;
- adjacent-day cycle → 2;
- leap-day crossing;
- finished cycle with missing startedAt;
- legacy invalid finishedAt before startedAt;
- two equal fastest durations to exercise deterministic tie-break.

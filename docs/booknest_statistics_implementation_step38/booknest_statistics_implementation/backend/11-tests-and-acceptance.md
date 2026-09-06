# Backend tests і acceptance

## Unit tests

Pure/focused domain units (split by real capability; see `backend/16-domain-decomposition.md`):

- period normalization;
- previous period;
- bucket granularity;
- week boundary alignment for both `weekStartDay = monday` and `weekStartDay = sunday`;
- partial first/last weekly buckets clipped to selected period;
- streaks, including period-boundary clipping, historical `PERIOD_NOT_CURRENT`, and current-range continuation before `metricRange.from`;
- intensity;
- discovery eligibility;
- soft-deleted-book split semantics: historical cycles/events remain eligible after later soft delete, while current-library/TBR snapshot queries exclude `deletedAt != null`;
- comparison thresholds;
- series marathon;
- insight diversification;
- single insight candidate-pool ranking shared by Hero + regular Insights;
- featured-candidate exclusion from regular Insight cards;
- insight code/params candidate mapping;
- record diversification.

## Service tests

- user isolation;
- no-data states;
- partial metadata coverage;
- language reliability/default semantics per `shared/22-language-reliability-semantics.md`: canonical enum values, default `ukrainian` remains valid, coverage means snapshot completeness only, and genuinely missing legacy snapshot language yields `partial` without a fake category;
- unknown vs zero;
- comparison on/off;
- all-time behavior;
- canonical `timezone` and `weekStartDay` are read from user settings, exposed in top-level Overview `meta`, and reflected in period/calendar/weekly aggregates;
- stored reading `@db.Date` values preserve their exact `YYYY-MM-DD` membership and are not timezone-shifted when Statistics groups/filters them;
- implicit Books/Reading `today` writes resolve the date in the authenticated user's `UserProfileSettings.timezone`, including UTC-boundary cases ahead of and behind UTC; explicit date-only inputs remain unchanged;
- changing profile timezone changes future implicit `today`/relative current-day context but does not relabel existing historical reading dates;
- Overview `meta.generatedAt` is valid ISO-8601 and deterministic under a frozen/injected test clock;
- rich, empty and partial-data Overview responses all include `meta`;
- no fake `dataVersion`/snapshot-version field is introduced;
- calendar `booksCount`, `booksPreview` and full day details are derived from the same canonical daily per-book subset;
- preview is capped at 3 and ordered `pagesRead DESC` → `bookId ASC`, with exact `remainingBooksCount`;
- rendering a month/diary does not require per-day day-details requests;
- Calendar `metricRange` and `displayRange` follow `shared/20-calendar-streak-period-semantics.md`;
- All-time Calendar KPI values use the full reliably tracked activity range while `days[]` is bounded to the last-12-month `displayRange`;
- historical periods return `currentStreak = unavailable/PERIOD_NOT_CURRENT`, while a current period with no live streak returns available zero;
- `longestStreak` is clipped at metric-period boundaries and current-streak continuation before the range is exposed rather than silently counted.

## Integration/API tests

At minimum:

- overview for seeded user;
- no cross-user data leakage;
- date/custom period;
- day details;
- invalid query;
- empty user.

## Hard acceptance rules

- no pages reconstructed from book page count;
- no lifecycle history reconstructed from `updatedAt`;
- no Prisma outside infrastructure;
- no business calculations in controller;
- independent Statistics algorithms are not concentrated in one god service/repository; application service stays orchestration-oriented;
- framework-independent rules with meaningful invariants/edge cases are covered by focused domain unit tests;
- all response schemas shared;
- Languages returns canonical `BookLanguageSchema` values and does not invent explicit/default confirmation provenance or original-language semantics;
- Overview top-level `meta` follows `shared/15-overview-response-meta.md`; `calendar.weekStartDay` is not duplicated as a second source of truth;
- Insight response uses a shared discriminated `code + typed params` union and contains no localized text field;
- generated OpenAPI/Orval types preserve narrowing of Insight params by code;
- Hero and regular Insights are selected from one ranked candidate pool with one eligibility/significance/sample/diversification/ranking pass;
- the featured semantic candidate is not repeated in `insights.items`; frontend performs no reranking/deduping/promotion;
- OpenAPI generation passes.

## Performance acceptance

This is a manual/integration acceptance gate in addition to automated tests:

- inspect the actual `BookReadingProgressEvent` period aggregation with `EXPLAIN (ANALYZE, BUFFERS)` or the repository-approved equivalent in the safe test/dev database;
- include representative current/last-12-months, comparison and large/all-time periods;
- verify user + period predicates are applied in the database;
- verify no per-book/per-day N+1 or obvious avoidable full event-table scan; specifically verify Books-mode preview data is aggregated/batched as part of Overview rather than fetched through a day loop;
- inspect whether the existing `@@index([bookId, date])` supports the implemented query shape;
- add/change an index only from observed evidence, then rerun the same plan;
- keep a short note of the inspected query shape and the index decision.

## Canonical availability / coverage

- test `available` known zero separately from `unavailable`;
- test `partial` requires exact coverage counts/percent;
- test `unavailable` returns null/omitted data + typed reason;
- test no endpoint emits `insufficient` as an availability enum value or parallel `historyAvailability`;
- test minimum sample and missing history map to section-specific reasons on `unavailable`.

## Exact drill-down contract tests

- interactive aggregate output exposes a typed exact target, not a frontend URL;
- drill-down scope uses canonical entity IDs/filter values;
- aggregate membership/count equals the records resolved by the drill-down scope for representative Dynamics/rating/genre/author/publisher/day cases;
- period/bucket bounds are preserved;
- broader entity navigation is emitted separately as context metadata where needed.

## Reading-cycle history acceptance

- completion queries use canonical finished cycles, never mutable current `BookReadingProgress.finishedAt` as the historical ledger;
- rereading creates a new cycle and preserves the earlier finished one;
- finishing a reread can count the same `bookId` again and exact details distinguish cycle ids;
- ordinary reset cannot book-wide erase finalized cycle events/history;
- cycle rating remains stable across later rereads;
- legacy backfill is conservative and never guesses erased reads.

## Period/comparison hard acceptance

- [ ] Canonical edge behavior matches `shared/24-period-comparison-edge-contract.md`.
- [ ] One-day periods are valid and use a one-day immediately preceding comparison interval.
- [ ] Explicit invalid/future/reversed custom ranges are rejected rather than silently swapped/clamped.
- [ ] Comparison for All time is rejected/disabled, not silently ignored.
- [ ] Inclusive-day duration is calendar-date arithmetic, not milliseconds.
- [ ] `percentDelta = null` whenever the known previous baseline is zero; API never emits Infinity/NaN.
- [ ] Rate deltas such as active-day rate use explicit percentage-point semantics.
- [ ] Frontend comparison captions/drill-downs use normalized backend-returned ranges.

## First-completion reliability acceptance

- post-cutover new book first finish is a proven first completion;
- reread is never another first completion;
- conservative legacy finished-cycle backfill is first-known-only unless stronger canonical evidence exists;
- legacy book first observed after cutover is not automatically proven-first;
- discovery, structural Series lifecycle and TBR first-completion outflow do not use first-known-only facts;
- affected capabilities expose `partial` / `unavailable` rather than fabricated historical transitions.

## Reset/activity-history acceptance

- ordinary current-progress reset preserves already persisted reading events;
- reset may abandon/discard the current unfinished cycle without creating a completed read;
- preserved events still contribute to pages/calendar/streak/day details;
- only an explicit correction action may remove mistaken historical activity.

## ReadingCycle state-machine acceptance

- only `finished` contributes completed reads; `dnf` / `abandoned` do not;
- pause/resume keeps the same active cycle;
- reread creates exactly one new active cycle;
- repeated finish/DNF/reset requests are idempotent;
- terminal cycles are immutable to ordinary commands;
- DNF → reading starts a new cycle;
- rating edits target the intended finished cycle without creating another cycle;
- at-most-one-active-cycle holds under concurrent mutations.

## Reading-history migration acceptance

- additive schema lands without dropping current Books/Reading fields;
- new canonical writes are active before legacy backfill;
- legacy backfill uses a stable unique source key and is idempotent;
- rerunning backfill does not refresh immutable legacy snapshots from changed current metadata;
- reconciliation gates Statistics enablement;
- legitimate legacy unassigned events remain supported.

## Legacy activity-history quality acceptance

- a stable activity-history reliability cutover exists and is not derived from earliest surviving event;
- post-cutover periods are exact; overlapping/pre-cutover periods expose legacy lower-bound quality;
- surviving old events remain counted while missing old events are not treated as zero;
- non-monotonic activity rankings become unavailable when incomplete history could change the winner.

## Final API/Zod contract acceptance

- full contract test fixtures parse the actual Overview Zod schema; documented partial snippets match their referenced sub-schemas;
- normalized response has `comparison: null | object`, not `period.comparisonEnabled`;
- KPI comparisons use canonical `previous / absoluteDelta / percentDelta`;
- rating deltas use absolute score delta and rate deltas use percentage points;
- deprecated `delta`, `deltaPercent`, cycle `completedBooks` aliases are absent from the new DTO;
- generated OpenAPI/Orval nullability matches Zod.

## Permanent deletion acceptance

- soft delete preserves historical cycles/events/snapshots;
- true Book hard delete removes its owned historical source data;
- user/account purge removes all user-owned ReadingCycle/event/snapshot rows;
- permanent purge is retry-safe and cross-user isolated;
- no persistent Statistics cache/materialized data can resurrect purged history.

## Reading-duration acceptance

- elapsed duration uses inclusive date-only calendar arithmetic; same-day = 1;
- missing start/invalid date order is excluded from known duration sample and reflected in coverage;
- new canonical write rejects finish-before-start;
- pauses are not subtracted;
- fastest record uses the shared duration definition and deterministic tie-break.

## Cross-feature ReadingCycle integration acceptance

- every public backend path capable of changing reading lifecycle (Book create/update, reading status/progress/start, bulk status, trusted import/correction) leaves mutable Book snapshot and cycle ledger consistent;
- no post-rollout path can persist `readingStatus = finished` / `finishedAt` without exactly one corresponding canonical finished cycle;
- `startReading`, single-book transitions and bulk transitions use the same per-book serialization semantics;
- DB rejects duplicate active cycles; legitimate races resolve to canonical idempotent behavior rather than leaking raw unique errors;
- bulk locks/books are processed in deterministic order where a shared transaction is used.

## Reading Goals cycle-qualification acceptance

- a Book with one qualifying finished cycle counts once;
- starting a reread does not uncount it;
- another qualifying reread does not increment the same count-based goal twice;
- earliest qualifying cycle is selected deterministically;
- explicit correction of the selected cycle falls back to the next qualifying cycle or uncounts when none remain;
- pace/risk/projection still come from the existing Reading Goals calculation engine.

## Explicit correction acceptance

- exact-id event correction removes only the intended owned activity fact;
- other-user and wrong-book corrections are rejected;
- ordinary reset never substitutes for correction;
- successful correction refreshes Reading History/Statistics and affected Reading Goals when relevant.

## Reliability-state acceptance

- every Statistics-capable user has persisted Reading-history provenance;
- `activityHistoryReliableFrom` is stable across reruns/deploys/timezone changes;
- missing state fails safely rather than being interpreted as exact history.

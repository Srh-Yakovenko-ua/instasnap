# Product decisions log

This file records deliberate decisions so an implementation agent does not re-introduce rejected ideas.

## Overview focus

- Overview is primarily about reading behavior and progress, not an operational dashboard of every BookNest module.
- Wishlist / In Transit / Loans counts are not separate Overview sections.
- No ownership donut on Overview.

## Hero

- Hero does not duplicate KPI totals.
- Hero covers are recent completed books, not top-rated books.
- Top-rated books belong in `Оцінки`.

## KPI

- Four fixed non-clickable KPI cards: completed reads, pages read, average rating, active days. The completed-reads card may show `uniqueBooksCompleted` as supporting context without creating a fifth KPI card.
- Reading pace is not a fifth KPI.

## Reading dynamics

- Use bars for current data.
- Comparison is contextual, not a separate `2026 vs 2025` section.

## Calendar

- Two modes: `Активність | Книги`.
- Books mode is renderable from the single Overview payload via compact per-day `booksPreview` (max 3) + `remainingBooksCount`; no per-visible-day details fan-out.
- `/statistics/reading-days/:date` is full detail only after explicit interaction.
- Mobile Books mode is a reading diary/timeline.
- Time-of-day insights are not supported because progress-entry time is not reliable reading time.
- Week ordering/boundaries follow existing `UserProfileSettings.weekStartDay` (`monday | sunday`); Statistics does not hardcode Monday-first/ISO weeks or introduce a duplicate setting.

## Insights

- Deterministic, backend-driven, no LLM in V1.
- Hero featured insight and regular Insight cards come from **one Insight Engine ranked candidate pool**; no separate Hero insight engine.
- The featured semantic candidate is not repeated in regular Insight cards.
- Backend returns stable typed `code + params`, not a localized insight sentence.
- `params` are code-specific through a discriminated shared contract; frontend localizes wording via `next-intl` (`uk` + `en`).
- No judgement wording or red/green moralization.

## Drill-down

- Click/chevron means exact source-subset drill-down.
- Related-but-not-exact navigation is an explicit context action.
- If an existing destination cannot reproduce period + filters exactly, primary interaction stays in Statistics details or the destination contract is deliberately extended first.
- Do not use fuzzy `q` navigation as an exact target.

## Ratings

- Ratings and top-rated books are one section named `Оцінки`.
- Do not call the section `Оцінки та фаворити`: V1 does not consume `Book.isFavorite` / `favoriteAddedAt` as a Statistics metric.
- A future Favorites analytics feature requires an explicit product definition first (`current favorite among period reads` vs `favorited during period` vs `favorite state at completion`); do not infer one silently.
- Canonical scale is `0.5–10.0` with `0.5` step; Statistics does not convert it to 5 stars.
- High-rating share means `rating >= 8.0`.
- DNF does not enter Overview rating aggregate.

## Genres / authors

- `Найчастіше читаю | Найвище оцінюю`.
- Minimum sample protects `best rated` claims.

## Series

- `Наздогнано` for ongoing series is distinct from `Завершено`.
- Series marathon is separate from most-active series.

## Library balance

- Do not use `createdAt`/`updatedAt` to fabricate historical TBR flow.
- Current snapshot may ship even when historical flow is unavailable.

## Tempo/duration

- No standalone Tempo section on Overview.
- Duration records may appear through Insights/Records.
- Elapsed duration is not actual reading time.

## Records

- Keep a separate emotional `Ваші рекорди` section.
- Do not use trivial `highest rating = 10/10` as a record.

## Annual recap

- `Ваш рік у книгах` is a future standalone storytelling/shareable feature.
- It is not an extra recap section at the bottom of Overview V1.

## Layout

- No sticky statistics sidebar.
- No masonry.
- No drag-and-drop/custom dashboard in V1.
- Desktop ends with Records.
- Mobile adapts presentation but does not remove core analytics.

## Reading Goal primary selection (V1)

- Statistics does not add `isPrimary` or a ReadingGoal schema migration merely to choose the Overview goal card.
- Candidates are canonical Reading Goals with `status = active`.
- Deterministic order is `deadline ASC` → `createdAt ASC` → `id ASC`; selection must not depend on pagination/frontend/DB incidental order.
- A user-controlled primary-goal concept, if ever needed, is a separate future Reading Goals product/domain change outside V1 Statistics.

## Shared Statistics period/comparison primitives

- Existing Order Statistics period/comparison/delta primitives are audited before Reading equivalents are created.
- If semantics match exactly, extract/reuse only the genuinely generic primitives through a small shared module and preserve Delivery behavior/import compatibility.
- If semantics differ, keep explicit feature-specific contracts and document the mismatch; deduplication is not more important than domain correctness.
- This does not authorize a generic analytics/BI framework or moving order-specific schemas into a common module.

- Overview response metadata is self-describing: top-level `meta.generatedAt`, resolved `meta.timezone`, resolved `meta.weekStartDay`, and `meta.activityHistory`; no fake `dataVersion`, and no duplicate independently-populated `calendar.weekStartDay`.

## Reading date semantics

- Reading `startedAt/finishedAt/...` and progress-event `date` are canonical date-only values (`@db.Date`), not instants; Statistics never timezone-rebuckets stored dates.
- Existing `UserProfileSettings.timezone` resolves user-local `today`, relative period endpoints and current-streak today/yesterday context.
- Books/Reading implicit/default `today` writes must be corrected to use authenticated-user timezone instead of the current UTC-based helper; explicit date inputs stay unchanged.
- `BookReadingProgressEvent.createdAt` is not reading-day truth when `event.date` exists.
- Changing profile timezone does not rewrite/relabel historical reading dates. No speculative backfill of existing date-only rows.
- Rereading/reset/history semantics are defined separately by `shared/17-reading-cycle-history.md`; the date rule only defines the calendar-date meaning used by those cycles/events.

## Reading-cycle / rereading history decision

- `BookReadingProgress` remains the mutable current/latest reading snapshot and is **not** the Statistics historical completion ledger.
- Full Statistics requires canonical Books/Reading read-through history (recommended concept: `BookReadingCycle`) before completion/reread metrics are accepted.
- Statistics uses `completedReads` for finalized reading-cycle count and `uniqueBooksCompleted` for distinct `bookId` count in the selected period. A finished reread increments `completedReads`; the cycle count is never named `completedBooks`.
- New progress events are associated with the current cycle; legacy events remain unassigned when attribution is not provable.
- Ordinary reread/reset cannot erase previously finalized cycles or their historical events. Ordinary reset may reset/abandon the current unfinished cycle but does not delete its persisted activity events; deleting historical activity or a historical read requires a separate explicit correction action.
- Finished-cycle rating is persisted at cycle level so a later reread/reset cannot rewrite historical rating analytics.
- Backfill is conservative: at most one known finished legacy cycle from current reliable snapshot facts; erased older reads are never reconstructed from timestamps.
- Historical completeness before cycle tracking is best effort; do not invent an exact coverage percentage for unknowable missing cycles.

## Soft-deleted Book semantics

- Ordinary `Book.deletedAt` is a current catalog/visibility state, not an analytics-history correction.
- Historical finalized reading cycles/events/ratings/discoveries remain in their original periods after a later soft delete.
- Current library/TBR/owned/read-ratio snapshot populations exclude soft-deleted Books.
- Exact historical drill-down keeps those cycles and may render a Statistics-local deleted-book state when normal Book navigation is unavailable.
- Explicit reading-history correction/purge, if added later, is a separate domain action.

## Historical metadata stability

- Historical completed-read analytics use immutable completion-time metadata snapshots, not current Book metadata projected backwards.
- Snapshot scope is limited to analytics-relevant fields: book-length/language/genres, author identities, publisher identity and series context required by historical metrics.
- Current names/covers/routes are presentation enrichment only and do not redefine historical membership.
- Behavioral series membership is snapshot-at-completion; structural series lifecycle uses immutable canonical Series-domain context/milestone facts.
- Legacy backfilled cycles capture current known metadata once with explicit legacy provenance and freeze it; unknown true past metadata is not reconstructed.

## Calendar / streak period scope

- Calendar exposes explicit `metricRange` for summary KPIs and `displayRange` for rendered day cells.
- Non-All-time uses the same effective range for both; future days are excluded.
- All time uses a finite observed Calendar window plus explicit `meta.activityHistory` quality; earliest surviving event is not the reliability boundary. Heatmap/Books payload remains bounded to backend-resolved last 12 months.
- `longestStreak` is clipped to `metricRange`.
- `currentStreak` exists only for a current period ending today; closed historical periods return `unavailable + PERIOD_NOT_CURRENT` rather than zero.
- A current streak that continues before selected `metricRange.from` is clipped and marks `continuesBeforeRange = true`.

## Statistics query invalidation

- Statistics is a cross-feature derived read model; successful mutations of canonical inputs must invalidate its TanStack Query cache.
- Use one centralized matcher/helper covering the full `/api/statistics...` query family, following current query-key conventions/generated utilities.
- Integrate invalidation into existing feature mutation-sync/API hooks (Books/Reading, Reading Goals, Series, profile settings), not Statistics presentation components.
- V1 prefers conservative full Statistics-family invalidation over fragile section-level/manual aggregate cache patching.
- Active views refetch through TanStack Query invalidation behavior; inactive variants are stale for their next mount. No polling workaround.
- Failed or unrelated mutations do not invalidate Statistics.

## Language reliability / default semantics

- Guaranteed V1 `Мови` reports the declared edition language stored in canonical `Book.language` and frozen at cycle completion.
- Current `dev` makes language non-null and defaults it to `ukrainian` in Prisma/shared create/frontend create defaults; the visible form Select also falls back/clears to `ukrainian`.
- Statistics does not pretend it can retrospectively distinguish explicit Ukrainian from accepted/defaulted Ukrainian, and it does not reclassify all default-valued rows as unknown.
- Language coverage means completion-snapshot completeness only, not confirmation confidence. Missing legacy snapshot language affects coverage but is not a fake `Не вказано` category.
- API returns canonical `BookLanguageSchema` values; frontend localizes labels.
- No Statistics-only language provenance/confirmation migration and no original-language/read-in-original analytics in V1. See `shared/22-language-reliability-semantics.md`.

## Deterministic ordering

- Every ordered Statistics collection has a backend-owned total order; semantic sort keys always end in a canonical non-localized stable key.
- Frontend preserves backend analytics order; localized labels do not break ties.
- V1 comparator matrix for Hero/ratings/tastes/discoveries/series/records/calendar/Insight candidates lives in `shared/23-deterministic-ordering-policy.md`.
- Paginated exact details must include the final stable key in DB/cursor order to prevent duplicate/missing rows under ties.

## Period / comparison edge semantics

- Backend owns validation and normalized period/comparison ranges; frontend does not silently repair explicit invalid input or recompute comparison dates.
- Current year ends at user-local today; future year and explicit future custom bounds are invalid; one-day custom range is valid.
- Last-12-month/custom previous comparison uses equal inclusive calendar-day count; current/full-year uses previous-year calendar semantics with leap-day clamp.
- All time has no comparison.
- Numeric `percentDelta` is undefined/null when previous = 0; never Infinity/NaN or fabricated growth.
- Rate/proportion comparison uses explicit percentage-point deltas from canonical ratio values.
- Canonical full rules live in `shared/24-period-comparison-edge-contract.md`.

## First-completion reliability

- The earliest completion currently known is not automatically the user's first-ever completion.
- Legacy backfilled cycles are `firstKnownBookCompletion` unless stronger evidence proves first-ever status.
- Discovery, structural Series lifecycle and TBR first-read outflow use only proven first-completion facts.

## Reset versus historical activity

- Ordinary reset changes mutable current progress/cycle state but preserves already recorded reading-activity events.
- Abandoned-cycle pages remain real historical activity; deleting mistaken events requires a separate explicit correction action.

## ReadingCycle state machine

- Canonical cycle lifecycle is `active | finished | dnf | abandoned`; only `finished` is a completed read.
- Terminal cycles are immutable to ordinary reading commands.
- Existing per-book transaction/lock owns retry-safe start/reread/finish/DNF/reset semantics and at-most-one-active-cycle.

## Reading-history rollout

- Rollout is additive schema → canonical new writes → mutation verification → conservative idempotent backfill → reconciliation → Statistics enablement.
- Legacy backfill uses a stable source identity and never refreshes frozen metadata on rerun.

## Legacy activity-history quality

- Surviving pre-cutover progress events are real observed facts but the old ledger may be incomplete.
- Activity history has a stable reliability cutover; selected pre-cutover scopes are lower-bound, not exact.
- Unknown deleted-event count is not represented by fake coverage percent.

## Final Statistics API field contract

- `shared/31-final-api-contract-manifest.md` is the naming/composition authority alongside actual shared Zod schemas.
- Comparison OFF is `comparison = null`; KPI delta fields are `previous / absoluteDelta / percentDelta`; score/rate deltas use score points/percentage points as appropriate.

## Soft delete versus permanent purge

- Soft delete preserves historical reading facts.
- True Book/account hard delete/privacy purge erases owned cycles/events/snapshots and is allowed to change historical Statistics.

## Reading elapsed duration

- Duration is inclusive calendar-day span; same-day finish = 1 day.
- Paused/gap days remain included; this is not active reading time/speed.
- Missing/invalid legacy start dates reduce coverage and are not guessed.

## Final ReadingCycle integration hardening

- All Books/Reading lifecycle writers, including create/update/bulk paths, use one cycle-aware orchestration invariant; Statistics cannot rely on only `BookReadingService` being correct.
- Every cycle mutation is transactionally serialized per Book and protected by a DB partial unique one-active-cycle invariant.
- Count-based Reading Goals qualify a Book from the earliest canonical finished cycle in the goal window and count that Book at most once; rereads do not uncount or double-count it.
- Ordinary reset remains non-destructive; mistaken activity is changed only through an explicit exact-id correction capability.
- `activityHistoryReliableFrom` is persisted per user as Reading-history provenance, computed conservatively at rollout and never derived from event minima/runtime clocks.
- Implementation verification follows current repo `CLAUDE.md`: focused tests, `/blast-radius`, migration review/raw-index safety; full local `pnpm test`/`pnpm knip` are not routine gates.

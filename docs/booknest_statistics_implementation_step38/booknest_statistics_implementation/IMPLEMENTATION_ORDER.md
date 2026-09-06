# Implementation order

Use this as a session-to-session progress tracker.

- [ ] Read repo `CLAUDE.md`, backend/frontend agent docs and code principles.
- [ ] Audit current `dev` data model and nearest canonical features.
- [ ] Reuse the existing canonical `UserProfileSettings.timezone` source; do not introduce a Statistics-specific timezone setting or server-local fallback.
- [ ] Audit/fix Books/Reading user-local `today` semantics per `shared/16-reading-date-semantics.md`: omitted write `date/updateDate` and existing Reading History today-relative anchors must resolve in authenticated-user timezone, while explicit/stored `@db.Date` labels remain unchanged. Add UTC-boundary tests; do not backfill-shift historical dates.
- [ ] Implement the canonical reading-cycle prerequisite from `shared/17-reading-cycle-history.md`: preserve `BookReadingProgress` as current snapshot, add read-through history, relate all new progress events to the current cycle, preserve finalized history across reread/reset, and perform only conservative known-fact backfill.
- [ ] Add completion-time historical metadata snapshots per `shared/19-historical-metadata-snapshots.md`: newly finished cycles capture typed analytics metadata atomically; legacy backfilled cycles capture current known metadata once with provenance; ordinary later metadata edits must not drift historical aggregates.
- [ ] Enforce `shared/18-soft-deleted-book-eligibility.md`: historical reading facts survive later soft delete; current library/TBR snapshots explicitly exclude soft-deleted Books.
- [ ] Apply `shared/22-language-reliability-semantics.md`: treat current canonical `Book.language` as declared edition language, do not invent explicit/default provenance or reinterpret default `ukrainian` as unknown, run the pre-release distribution sanity audit, and keep original-language analytics deferred. Audit reading-format semantics separately only to determine whether optional Formats capability is safely supportable; it is not a V1 blocker and `Book.formats[]` alone is not sufficient.
- [ ] Confirm the canonical Reading Goals application/domain integration point and consume its already-computed metrics; do not create Statistics-local goal formulas.
- [ ] Confirm whether ownership/TBR transition history exists.
- [ ] Audit the existing `order-statistics` period/comparison/delta primitives and consumers (`shared/13-statistics-common-primitives.md`). Decide from semantics whether to extract/reuse a common primitive or keep an explicit Reading-specific contract.

- [ ] Audit **all** reading lifecycle write paths and route them through one cycle-aware orchestration boundary (`shared/35-reading-lifecycle-write-path-integration.md`), including Book create/update, ReadingService, bulk status and trusted import/correction paths.
- [ ] Enforce transaction + per-book locking for every cycle mutation and add/review the DB partial unique one-active-cycle invariant (`shared/36-reading-cycle-concurrency-invariant.md`).
- [ ] Refactor Reading Goals qualification to canonical finished cycles (`shared/37-reading-goals-cycle-qualification.md`): one Book counts at most once per count-based goal; reread cannot uncount/double-count it.
- [ ] Add the narrow explicit reading-history correction capability from `shared/38-reading-history-correction-capability.md`; ordinary reset remains non-destructive.
- [ ] Persist per-user `activityHistoryReliableFrom` according to `shared/39-activity-history-reliability-source.md` before exposing legacy activity quality.
- [ ] Use `shared/40-repo-specific-verification.md` for contract/migration verification, including `/blast-radius`, focused Vitest files and migration SQL/raw-index review.

## Backend

- [ ] Reuse/extract semantically compatible Statistics period/comparison/delta primitives; add Reading-specific schemas only for semantics that genuinely differ. Preserve Delivery Statistics behavior/import compatibility.
- [ ] Add canonical shared availability/coverage primitives (`available | partial | unavailable`, coverage counts/percent) and compose them into Overview section schemas.
- [ ] Define the smallest focused Statistics domain decomposition from actual `dev` patterns (`backend/16-domain-decomposition.md`); keep application orchestration thin and avoid god service/repository.
- [ ] Apply the total-order comparator matrix from `shared/23-deterministic-ordering-policy.md` to every ranking/preview/record/detail; final stable keys must be part of backend DB/cursor ordering, not repaired on frontend.
- [ ] Apply `shared/24-period-comparison-edge-contract.md`: reject invalid/future/reversed ranges, support one-day periods, normalize comparison/leap-year bounds, use null zero-baseline percent deltas and percentage-point rate deltas; add boundary tests.
- [ ] Implement period/comparison domain logic + tests.
- [ ] Apply `shared/25-completed-read-count-semantics.md`: expose cycle-based `completedReads` and distinct `uniqueBooksCompleted` separately; never keep the misleading `completedBooks` name for a read-cycle count.
- [ ] Implement reading KPI/dynamics repository queries from canonical finished reading cycles + progress events; never use mutable current `BookReadingProgress.finishedAt` as the historical completion ledger.
- [ ] Implement Calendar `metricRange` vs `displayRange` + period-aware streak semantics from `shared/20-calendar-streak-period-semantics.md`, then compact exact per-day `booksPreview` in Overview + lazy full day-details endpoint. Ensure historical current streak is unavailable (not zero), All-time KPIs remain tracked-lifetime scoped, and Books mode needs no per-day fan-out.
- [ ] Implement ratings/genres/authors/publishers/languages aggregates from completion-time snapshot membership, not current Book joins; language values/coverage follow `shared/22-language-reliability-semantics.md`.
- [ ] Implement series analytics using snapshot behavioral membership and immutable canonical Series structural context/milestone facts for historical lifecycle.
- [ ] Implement current library snapshot.
- [ ] Implement TBR flow only if reliable history exists; otherwise canonical `unavailable + HISTORY_NOT_TRACKED` state.
- [ ] Integrate the goal snapshot as an adapter over canonical Reading Goals metrics; keep all goal calculations owned by `reading-goals`.
- [ ] Implement deterministic Insight Engine as one `candidates → eligibility → significance → sample → dedupe/diversify → ranking` pipeline; derive both Hero featured insight and regular Insight cards from the same ranked pool and exclude the featured candidate from regular items.
- [ ] Implement deterministic Record Engine.
- [ ] Compose `/api/statistics/overview` with canonical top-level `meta` (`generatedAt`, resolved `timezone`, resolved `weekStartDay`, `activityHistory`); keep period/comparison separate and do not invent `dataVersion` or duplicate `calendar.weekStartDay`.
- [ ] Add API/integration/user-isolation tests.
- [ ] Run the mandatory `BookReadingProgressEvent` query-plan checkpoint on the implemented period activity aggregation (`EXPLAIN (ANALYZE, BUFFERS)` or repository-approved equivalent) with representative current/comparison/large-period data.
- [ ] Add/change an index only if that actual plan demonstrates a need; rerun and record before/after evidence.
- [ ] Run backend typecheck/lint/tests.
- [ ] Generate OpenAPI and run `pnpm gen:api`.

## Frontend

- [ ] Add Statistics route and translations.
- [ ] Implement `frontend/12-query-invalidation.md`: one centralized matcher/helper for the complete Statistics query family, then wire it into successful Book/Reading, Reading Goal, Series/relevant-entity and profile `timezone/weekStartDay` mutation-sync paths. Invalidate aggregate/detail variants rather than manually patching Statistics cache.
- [ ] Implement URL period/comparison controls.
- [ ] Implement page shell and skeleton/error/empty state.
- [ ] Hero + KPI + Insights.
- [ ] Dynamics + Goal.
- [ ] Calendar renders from Overview `booksPreview`/`remainingBooksCount`; full day details lazy only after interaction + mobile reading diary; verify no per-visible-day request fan-out.
- [ ] Centralized typed Statistics drill-down builder; exact subset navigation only, broader links as context actions.
- [ ] Ratings / `Оцінки` only; do not add Favorites analytics in V1. See `shared/21-ratings-vs-favorites-semantics.md`.
- [ ] Genres + Authors.
- [ ] Publishers + Languages.
- [ ] Optional Formats only if backend audit proves a reliable actually-read-format source; otherwise omit it from V1 UI/API implementation scope.
- [ ] Discoveries.
- [ ] Series.
- [ ] Library Balance.
- [ ] Records.
- [ ] Mobile progressive disclosure/bottom sheets/swipes.
- [ ] Accessibility/i18n/tests.
- [ ] Final typecheck/lint/tests/build verification.

- [ ] Implement `shared/26-first-book-completion-reliability.md`: distinguish first-known legacy completion from proven first-ever completion before enabling discovery, structural Series lifecycle or TBR first-completion analytics.

- [ ] Implement `shared/27-reading-activity-event-history.md`: remove destructive progress-event deletion from ordinary reset before enabling pages/calendar/streak Statistics.

- [ ] Implement `shared/28-reading-cycle-state-machine.md` and its concurrency/idempotency tests before wiring completion Statistics.

- [ ] Execute `shared/29-reading-history-migration-rollout.md` in order; do not enable completion/rating/ranking Statistics before the backfill/reconciliation gate.

- [ ] Add `shared/30-legacy-activity-history-quality.md` + `shared/39-activity-history-reliability-source.md`: persist the per-user activity-history reliability boundary and wire lower-bound/unavailable semantics before exposing legacy page/calendar/streak claims.

- [ ] Finalize shared Zod schemas against `shared/31-final-api-contract-manifest.md`, make response fixtures parse them, then regenerate OpenAPI/Orval before frontend implementation.

- [ ] Audit and implement `shared/32-hard-delete-privacy-purge.md` when finalizing ReadingCycle/Event foreign keys and deletion behavior.

- [ ] Apply `shared/33-reading-duration-semantics.md` to cycle validation, duration coverage and fastest-record logic.

- [ ] Final pre-handoff step: run `shared/34-final-consistency-gate.md`, validate all response fixtures against real Zod schemas, regenerate OpenAPI/Orval and resolve every stale/duplicate contract term.

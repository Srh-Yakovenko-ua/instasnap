# Claude Code task — BookNest Statistics

Працюй на актуальній `dev` гілці BookNest.

## Goal

Реалізувати Statistics → Overview згідно документації в цьому пакеті, **спочатку backend повністю, потім frontend**.

## Mandatory workflow

1. Прочитай repo `CLAUDE.md`, relevant agent files і `docs/code-principles.md`.
2. Перевір кожне припущення документації проти актуального коду.
3. До створення Reading Statistics period/comparison/delta schemas зроби semantic audit існуючих primitives у `packages/shared/src/order-statistics.ts`; reuse/extract тільки справді сумісне, не дублюй і не тягни order-specific semantics сліпо (`shared/13-statistics-common-primitives.md`).
   3a. Before implementing Statistics aggregates, apply `shared/16-reading-date-semantics.md`: verify/fix Books/Reading implicit date defaults so omitted `date/updateDate` uses authenticated-user `UserProfileSettings.timezone`, while stored/explicit `@db.Date` values remain exact date labels and are never timezone-rebucketed. This is a required cross-feature data-quality prerequisite, not a new Statistics timezone field or historical backfill.
   3b. Before treating completion/reread history as reliable, implement `shared/17-reading-cycle-history.md`: keep `BookReadingProgress` as the mutable current snapshot, add canonical read-through/cycle history, scope new progress events to the current cycle, stop ordinary reset from deleting finalized historical cycles/events, and make Statistics completion metrics read from finished cycles rather than mutable `finishedAt`. Do not invent erased legacy rereads.
   3c. Enforce `shared/18-soft-deleted-book-eligibility.md`: ordinary Book soft delete must not retroactively remove finalized reading cycles/events/ratings/discoveries from historical Statistics; current library/TBR/owned/read-ratio snapshots must explicitly exclude soft-deleted Books. Do not treat soft delete as a history-correction or purge action.
   3d. Treat the V1 taste section as `Оцінки` only: rating aggregates/distribution/top-rated reads are approved, but `Book.isFavorite` / `favoriteAddedAt` are not Statistics metrics until a separate Favorites semantic is explicitly designed. See `shared/21-ratings-vs-favorites-semantics.md`.
   3e. Enforce `shared/19-historical-metadata-snapshots.md`: finalized finished cycles capture immutable typed completion-time analytics metadata. Historical author/genre/publisher/language/series membership and `pagesCount`-based records must not be recomputed from mutable current Book metadata. Legacy backfilled cycles capture current known metadata once with explicit legacy provenance and then freeze it.
   3f. Apply `shared/22-language-reliability-semantics.md`: V1 `Мови` means declared edition language captured from canonical `Book.language` into the completion snapshot. Do not reinterpret `ukrainian` as unknown merely because it is the default, do not invent explicit/default confirmation provenance, return canonical enum values, and do not add original-language analytics without a separate reliable source.
   3g. Period/comparison edge semantics реалізуй строго за `shared/24-period-comparison-edge-contract.md`: backend validation authoritative, one-day valid, reversed/future explicit ranges invalid, All-time comparison unsupported, zero previous baseline → `percentDelta = null`, rate delta → percentage points.
4. Backend: shared contract → statistics domain/repository/service/controller → tests → OpenAPI.
5. Виконай `pnpm gen:api`.
6. Лише тоді frontend.
7. Перевикористовуй існуючі patterns/components. Не створюй паралельну архітектуру.
8. Якщо для метрики немає надійних historical data, не вигадуй їх; використай єдиний shared `available | partial | unavailable` + coverage contract або мінімальний canonical tracking prerequisite; не створюй секційні аналоги станів.
9. `/statistics/overview` завжди повертає canonical top-level `meta` (`generatedAt`, resolved `UserProfileSettings.timezone`, resolved `weekStartDay`, `activityHistory`) згідно `shared/15-overview-response-meta.md`; не вигадуй `dataVersion` і не дублюй `calendar.weekStartDay`.
10. Усі calculations/aggregates/insights/records/forecast/comparison — backend. Hero featured insight і regular Insight cards мають походити з одного ranked Insight Engine pool; frontend їх не rerank/dedupe/promote.
11. Не змінюй unrelated behavior.
12. Після кожного milestone запускай relevant typecheck/lint/tests.

Почни з `backend/00-start-here.md`.

- Calendar/streak scope MUST follow `shared/20-calendar-streak-period-semantics.md`.

## Cross-feature Statistics cache freshness

Implement `frontend/12-query-invalidation.md`. Reuse current TanStack Query key/mutation-sync conventions, centralize the matcher/helper for `/api/statistics...`, invalidate after successful mutations of Statistics inputs, and do not hand-patch Overview aggregates in UI code.

## Deterministic ordering

Deterministic ordering is a V1 correctness requirement, not cosmetic polish. Follow `shared/23-deterministic-ordering-policy.md`: all rankings/previews/records/Insight candidates/exact details use backend-owned total comparators with canonical stable final keys; pagination applies the full order before limit/take; frontend must not invent locale/name tie-breaks.

- Completion count naming follows `shared/25-completed-read-count-semantics.md`: cycle count = `completedReads`; distinct-title count = `uniqueBooksCompleted`; never call a cycle count `completedBooks`.

3f. Implement `shared/26-first-book-completion-reliability.md`: never define `firstBookCompletion` as merely the earliest surviving cycle. Legacy/backfilled cycles are first-known-only unless stronger canonical evidence proves first-ever status; discovery, structural Series lifecycle and TBR first-read outflow must downgrade quality instead of fabricating transitions.

3g. Implement `shared/27-reading-activity-event-history.md`: ordinary reset may clear current progress/abandon the current cycle but must preserve already recorded reading events; history deletion is an explicit correction concern.

3h. Implement `shared/28-reading-cycle-state-machine.md`: canonical active/finished/dnf/abandoned cycle states, terminal immutability, at-most-one active cycle, and retry-safe start/reread/finish/DNF/reset/progress behavior.

3i. Follow `shared/29-reading-history-migration-rollout.md`: additive schema first, canonical new writes before backfill, idempotent legacy-source-key backfill, reconciliation, then Statistics enablement. Do not big-bang or destructively rewrite legacy history.

3j. Implement `shared/30-legacy-activity-history-quality.md`: surviving pre-cutover events are observed facts but may be incomplete; persist a stable reliable-from boundary, expose lower-bound quality, never derive completeness from MIN(event.date) or fake a coverage percentage.

3k. Treat `shared/31-final-api-contract-manifest.md` + actual shared Zod schemas as the one V1 DTO authority. Remove old example aliases, validate fixtures through Zod, regenerate OpenAPI/Orval, and do not hand-write frontend DTO compatibility layers.

3l. Apply `shared/32-hard-delete-privacy-purge.md`: soft delete preserves history, but true Book/account permanent purge must erase owned cycles/events/completion snapshots; choose FK/service deletion behavior accordingly.

3m. Use `shared/33-reading-duration-semantics.md` for every duration-based metric: inclusive date-only span, same-day=1, no pause subtraction, invalid/missing start handled via validation/coverage rather than guessing.

Final gate: before coding against this package, run the repository contradiction audit and `shared/34-final-consistency-gate.md`; canonical shared contracts + actual dev state override stale prose/examples, never support two DTO shapes to satisfy conflicting docs.

## Mandatory ReadingCycle integration hardening before Statistics backend

Before completion-based Statistics endpoints are enabled, implement all of the following as one prerequisite slice:

1. `shared/35-reading-lifecycle-write-path-integration.md` — audit and route **every** lifecycle-mutating backend path (`BooksService.create/update`, `BookReadingService`, bulk status, imports/corrections) through one cycle-aware orchestration invariant. No direct `readingStatus/readingProgress` writer may bypass canonical cycles.
2. `shared/36-reading-cycle-concurrency-invariant.md` — every current-cycle mutation uses transaction + per-book serialization, including `startReading` and bulk paths, and the DB has a reviewed partial unique one-active-cycle invariant.
3. `shared/37-reading-goals-cycle-qualification.md` — Reading Goals stop qualifying from mutable current `BookReadingProgress.finishedAt`; a count-based goal qualifies a Book from the earliest canonical finished cycle inside its counting window and counts the Book at most once. Reread must not uncount or double-count it.
4. `shared/38-reading-history-correction-capability.md` — ordinary reset remains non-destructive; add the narrow explicit history-correction capability required to remove a genuinely mistaken event/fact and recompute dependents.
5. `shared/39-activity-history-reliability-source.md` — persist `activityHistoryReliableFrom` in canonical per-user Reading-history provenance; do not derive it from events or a runtime deploy constant.
6. `shared/40-repo-specific-verification.md` — follow current root `CLAUDE.md`: focused Vitest files locally, `/blast-radius` for contract-shaped changes, `db-migrate`/migration review for Prisma, inspect raw-index SQL, and do not routinely run full `pnpm test`/`pnpm knip`.

These are backend integration prerequisites, not optional Statistics refinements. Complete and verify them before declaring the backend implementation-ready.

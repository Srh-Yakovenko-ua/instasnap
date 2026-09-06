# Statistics Overview — acceptance checklist

Use this as Definition of Done before considering the feature complete.

## Shared period/comparison contracts

- [ ] Existing `order-statistics.ts` period/comparison/delta primitives and their consumers were audited before adding Reading equivalents.
- [ ] Semantically identical primitives are reused/extracted through the smallest common shared layer rather than duplicated.
- [ ] Any Reading-specific period/comparison contract has a documented semantic reason for remaining separate.
- [ ] Extracting common primitives causes no Delivery Statistics contract/behavior regression and preserves required public/shared import compatibility.
- [ ] Common DTO reuse does not move Delivery-specific lifecycle/currency/source-quality/drill-down schemas into a generic module.

## Global period

- [ ] Current year defaults to Jan 1 → today.
- [ ] Past years use the full calendar year.
- [ ] Last 12 months works.
- [ ] Custom `from/to` works.
- [ ] All time works.
- [ ] Period state survives refresh through URL params.
- [ ] All time disables comparison.

## Comparison

- [ ] Current partial year compares to the same dates of previous year.
- [ ] Custom range compares to immediately preceding range of equal duration.
- [ ] Comparison caption shows exact dates.
- [ ] OFF removes deltas, previous series and comparison insights.
- [ ] Insignificant changes do not generate noisy insights.

## Soft-deleted book eligibility

- [ ] Historical completed reading cycles remain in their original periods after a later `Book.deletedAt`.
- [ ] Historical progress-event pages, active days/calendar/streak history and cycle ratings are not removed by a blanket active-book filter.
- [ ] Historical taste/discovery/ranking facts are not dropped solely because the related Book is currently soft-deleted.
- [ ] Current owned/TBR/read-ratio snapshot populations explicitly require active/non-deleted Books.
- [ ] Soft delete does not delete finalized cycles/events; explicit history correction/purge remains a separate domain action.
- [ ] Exact historical drill-down keeps soft-deleted-book cycles in the subset and fails closed on broader Book navigation when the normal route cannot represent them.
- [ ] Historical book references that may be soft-deleted expose generated `bookState: active | soft_deleted`; frontend does not infer deletion from failed navigation.
- [ ] Restore of a Book does not recreate/duplicate historical cycles/events.

## Data quality contract

- [ ] Every Statistics section/metric uses only `available | partial | unavailable`; `insufficient` is not a public availability value.
- [ ] Partial results expose canonical `{ eligibleCount, knownCount, percent }` coverage.
- [ ] `knownCount <= eligibleCount`; coverage percent uses the canonical formula and is `null` only for zero eligible population.
- [ ] Known zero is `available` and is never confused with unavailable data.
- [ ] `unavailable` metrics return `null`/omitted data plus a typed section reason, never numeric zero.
- [ ] Minimum-sample/history/semantic limitations are typed reasons on `unavailable`, not parallel booleans or section-local availability enums.
- [ ] Frontend consumes backend availability directly and does not infer it from nullable values or array length.

## Overview response meta

- [ ] Every successful Overview response (rich, empty, partial) includes top-level `meta.generatedAt`, `meta.timezone`, `meta.weekStartDay`, `meta.activityHistory`.
- [ ] `meta.timezone` equals resolved canonical `UserProfileSettings.timezone` and is the timezone used for user-local `today`, relative period endpoints and current-streak context; persisted reading `@db.Date` values themselves are not timezone-rebucketed.
- [ ] `meta.weekStartDay` equals resolved canonical `UserProfileSettings.weekStartDay` and is the value actually used for weekly buckets/calendar ordering.
- [ ] Calendar does not expose a second independently-populated `calendar.weekStartDay` source of truth.
- [ ] `generatedAt` is valid ISO-8601 response-generation metadata and is testable with a frozen/injected clock.
- [ ] V1 does not invent `dataVersion`/`snapshotVersion` without a real versioning/cache contract.
- [ ] `period` and `comparison` remain separate top-level domain sections rather than being duplicated inside `meta`.

## Reading metrics

- [ ] `BookReadingProgress.startedAt/finishedAt/...` and `BookReadingProgressEvent.date` are treated as logical date-only values, not instants.
- [ ] Stored reading dates retain exact `YYYY-MM-DD` period/day membership regardless of later profile-timezone changes.
- [ ] Event `createdAt` is not substituted for canonical `event.date`.
- [ ] Books/Reading implicit default dates (`date/updateDate` omitted) resolve from the authenticated user's canonical timezone, including UTC-boundary tests; explicit ISO date inputs are preserved unchanged.
- [ ] Existing Reading History `today`-relative anchors/windows use the same user-local date resolver, so Reading History and Statistics do not disagree at UTC boundaries.
- [ ] Completed books/reads are based on canonical finished reading-cycle `finishedAt`, not mutable current `BookReadingProgress.finishedAt`; reread completions may count again.
- [ ] Pages by period come only from `BookReadingProgressEvent.pagesRead`.
- [ ] Missing page history is not reconstructed from `pagesCount`.
- [ ] Active day means summed `pagesRead > 0`.
- [ ] Average rating uses canonical coverage and returns `partial` when calculated from a rated subset.
- [ ] No ratings returns `unavailable + NO_RATINGS` with `value = null` and renders `—`, not `0`.

## Calendar

- [ ] Heatmap membership groups canonical stored `event.date` values directly; timezone is used for user-local current-day context, not for shifting historical date keys.
- [ ] Relative current-day/streak boundaries and implicit new reading dates do not depend on server/process/database timezone.
- [ ] Statistics introduces no duplicate timezone field or migration.
- [ ] Existing `UserProfileSettings.weekStartDay` is used; no duplicate Statistics week-start setting/migration exists.
- [ ] `monday` and `sunday` produce the expected calendar weekday order.
- [ ] Weekly Dynamics buckets align to the same canonical `weekStartDay` and are clipped at period edges.
- [ ] Calendar returns explicit inclusive `metricRange` (summary KPI scope) and `displayRange` (day-cell payload scope).
- [ ] Current streak is not broken before the current day has ended for a current period.
- [ ] Closed historical periods return `currentStreak = unavailable + PERIOD_NOT_CURRENT`, not a fake `0`.
- [ ] A current streak that began before `metricRange.from` is clipped for selected-period semantics and exposes `continuesBeforeRange = true`.
- [ ] `longestStreak` is clipped at `metricRange` boundaries.
- [ ] All-time Calendar follows the finite observed-window + `meta.activityHistory` quality rules; earliest surviving event is not called reliable history, and bounded `displayRange` does not redefine summary semantics.
- [ ] `Активність | Книги` both work.
- [ ] Overview `calendar.days[]` includes compact `booksPreview` (max 3) and exact `remainingBooksCount` for Books mode.
- [ ] Preview ordering is deterministic: per-book daily `pagesRead DESC` → `bookId ASC`.
- [ ] `booksCount`, preview membership and full day details use the same canonical daily subset; zero-page-only book events do not enter it.
- [ ] Desktop month grid and initial mobile diary render without one day-details request per visible day.
- [ ] Mobile Books mode uses reading diary/timeline.
- [ ] Full day details are lazy loaded only after explicit day interaction.
- [ ] All-time calendar clearly states its actual displayed range.

## Ratings / tastes

- [ ] Statistics uses the canonical `0.5–10.0` rating scale with `0.5` step.
- [ ] No backend or frontend Statistics code converts ratings to `1–5★`.
- [ ] High-rating share uses `rating >= 8.0`.
- [ ] DNF is excluded from Overview rating aggregate.
- [ ] Genre rating uses minimum sample.
- [ ] Author rating uses minimum sample.
- [ ] Publisher rating exposes coverage.
- [ ] New author/genre/publisher is based on first completed reading, not entity creation date.
- [ ] Multi-genre/co-author books follow documented counting rules.

## Series

- [ ] Started / continued / completed / caught-up are distinct.
- [ ] `caughtUp` is only for ongoing series.
- [ ] Unknown series metadata never creates fake progress percentages.
- [ ] Series marathon logic is tested.

## Library balance

- [ ] No TBR history is reconstructed from `createdAt` or `updatedAt`.
- [ ] If transition history is unavailable, period balance is explicitly unavailable.
- [ ] Current owned/TBR snapshot still works.
- [ ] Forecast requires minimum history/sample.

## Goals

- [ ] `reading-goals` remains the single owner of goal progress/pace/projection/risk/completion calculations.
- [ ] Statistics consumes already-computed canonical Reading Goal metrics through the existing/refactored Reading Goals application/domain capability.
- [ ] No Statistics-local calculator reproduces goal formulas from raw goal/book/activity data.
- [ ] If Statistics needs a missing goal metric, the canonical Reading Goals capability is extended first.
- [ ] Statistics tests verify mapping/integration and pass-through semantics instead of copying Reading Goals formulas.
- [ ] Frontend does not recalculate progress/pace/required pace/forecast/risk.
- [ ] No-goal state offers `Створити ціль`.
- [ ] V1 does not add `ReadingGoal.isPrimary`, related create/update contract fields, migration, or primary-goal UI control solely for Statistics.
- [ ] Primary candidates come only from canonical Reading Goals items with `status = active`; Statistics does not rederive active/completed/expired semantics.
- [ ] Multiple active goals select deterministically by `deadline ASC` → `createdAt ASC` → `id ASC`.
- [ ] Primary selection considers the complete active candidate set and is independent of frontend ordering, default cursor pagination and incidental DB order.
- [ ] No active goal returns the create-goal empty state; one active goal selects directly; multiple goals expose the correct remaining-active count.

## Insights / records

- [ ] Insight selection is deterministic.
- [ ] Insight HTTP payload uses stable typed `code` + code-specific typed `params`.
- [ ] Insight contract is a discriminated union; public `params` are not `Record<string, unknown>`.
- [ ] Backend does not return localized insight `text`/`title`/`description`.
- [ ] Hero featured insight and regular Insight cards use the same typed Insight contract.
- [ ] Hero + regular Insights come from one backend-ranked candidate pool and one eligibility/significance/sample/diversification/ranking pass.
- [ ] Featured semantic candidate is excluded from `insights.items`; no cross-surface duplicate.
- [ ] Frontend renders backend selection as-is and does not rerank/dedupe/promote insights.
- [ ] Frontend maps every supported insight `code` to `uk` + `en` `next-intl` messages and formats values/plurals/dates in the active locale.
- [ ] Optional insight actions are semantic/typed and do not unnecessarily encode frontend URLs.
- [ ] Record selection is deterministic.
- [ ] Both use eligibility and diversification.
- [ ] No judgement colors/writing.
- [ ] Unknown data never becomes a confident claim.

## Exact drill-down

- [ ] Every clickable analytics aggregate has a typed canonical `drilldown`; items without one render no chevron/primary click.
- [ ] Primary click/chevron reproduces the exact source subset that produced the displayed metric.
- [ ] Broader author/publisher/series/library navigation is an explicit `contextAction`, not an implicit row click.
- [ ] Existing pages are used as destinations only when their filter contract can represent the Statistics subset exactly.
- [ ] Unsupported exact routing fails closed to Statistics-local details/non-clickable behavior instead of approximate navigation.
- [ ] IDs/exact filters are used instead of fuzzy `q` matching.
- [ ] One centralized typed Statistics drill-down builder maps shared targets to frontend routes/query params.
- [ ] Drill-down tests assert aggregate membership/count equivalence for Dynamics, rating buckets, genre/author/publisher rankings and day details where interactive.

## Languages / conditional Formats

- [ ] Languages remain part of guaranteed V1 and follow `shared/22-language-reliability-semantics.md`.
- [ ] Language items use canonical `BookLanguageSchema` values (`ukrainian`, `english`, ...), with frontend-localized labels; no invented `uk`/`en` API vocabulary.
- [ ] `ukrainian` remains a valid observation even though it is the current Prisma/shared/frontend create default; Statistics does not guess explicit-vs-default provenance.
- [ ] Language coverage means immutable snapshot completeness, not user-confirmation confidence; genuinely missing legacy snapshot language may yield `partial`.
- [ ] Missing legacy language is not rendered as a fake `Не вказано` ranking category, and current Book edit is not offered as a historical correction unless such a correction capability exists.
- [ ] Original-language/read-in-original analytics remain absent without a separate canonical source.
- [ ] Reading Formats are **not** required for V1 completion.
- [ ] `Book.formats[]` alone never enables actually-read-format analytics or chooses a presumed read format.
- [ ] Missing reliable read-format semantics do not trigger a V1 schema migration and do not block Overview delivery.
- [ ] Desktop/mobile layouts reserve no permanent Formats card/slot when the capability is unsupported.
- [ ] If a reliable actually-read-format source exists, optional Formats analytics reuse the same period, eligibility, availability/coverage and exact-drill-down contracts.
- [ ] Format comparison/insights are generated only when that optional capability is genuinely supported.

## Backend domain decomposition

- [ ] Statistics application service/composer is orchestration-oriented and does not contain the majority of independent analytics formulas/ranking/eligibility rules.
- [ ] Meaningful framework-independent capabilities with their own invariants/edge cases are extracted into focused domain units and covered by unit tests.
- [ ] Prisma/SQL remains in infrastructure/repository; domain units do not depend on Prisma/NestJS/HTTP/frontend code.
- [ ] Repository methods are focused by aggregate/source/capability and there is no loosely typed `getEverything()` data bag that pushes all business semantics into the application service.
- [ ] Decomposition follows actual `dev` canonical patterns and does not create a generic analytics framework or one-file-per-expression structure.

## Reading-cycle / reread history

- [ ] `BookReadingProgress` remains a mutable current snapshot and is not used as the canonical historical completion ledger.
- [ ] A canonical Books/Reading read-through/cycle history exists before completion/reread Statistics are accepted.
- [ ] `completedReads` counts finished reading cycles; `uniqueBooksCompleted` counts distinct `bookId` values within those reads; the new Statistics API never exposes the cycle count under `completedBooks`. A completed reread increments `completedReads`, may leave `uniqueBooksCompleted` unchanged, and exact details preserve `readingCycleId`.
- [ ] Overview primary completion KPI uses `completedReads` and a read/read-through unit; `uniqueBooksCompleted` is returned separately as distinct-book context and is not presented as a fifth KPI card.
- [ ] Dynamics count mode is labeled `Читання` (or locale equivalent), not `Книги`, when its source is completed cycles.
- [ ] Starting `rereading` creates a new current cycle and leaves earlier finalized cycles unchanged.
- [ ] All newly created progress events are associated with the current cycle; legacy events remain unassigned when attribution is not provably safe.
- [ ] Ordinary reset never deletes already persisted reading-activity events or finalized cycles; current progress may be reset/abandoned without erasing the activity ledger.
- [ ] Completed-cycle rating is historical/cycle-level and does not silently change because a later reread/reset changes the mutable progress rating.
- [ ] Legacy backfill creates at most one known finished cycle from reliable current snapshot facts and never fabricates missing older rereads.
- [ ] Tests cover first read → reread → second finish, reset behavior, duplicate-book exact drill-down, legacy events and cross-user isolation.
- [ ] Rereads affect behavioral completed-read metrics but do not create duplicate discovery/structural series progress/TBR-reduction transitions.

## Historical metadata stability

- [ ] Every newly finalized finished reading cycle stores a typed/versioned analytics metadata snapshot atomically with completion.
- [ ] Historical author/genre/publisher/language membership is derived from the completion-time snapshot, not current Book relations.
- [ ] Behavioral series membership uses completion-time snapshot series identity; later current series edits do not rewrite old reads.
- [ ] Structural series `started/continued/completed/caughtUp` history uses immutable canonical Series-domain completion-time context/milestone facts rather than today's mutable denominator/status/order state.
- [ ] Historical book-length records use cycle `pagesCount` snapshot; changing current `Book.pagesCount` does not change old records.
- [ ] Ordinary Book/Author/Publisher/Series edits do not mutate finalized cycle snapshots.
- [ ] Current entity names/covers may enrich presentation but never alter historical aggregate membership.
- [ ] Legacy cycle migration captures current known metadata once with `legacy_current_metadata` provenance and freezes it; no fake historical-accuracy percentage is invented.
- [ ] Exact drill-down membership remains equal to the source aggregate after current metadata edits.
- [ ] Missing snapshot metadata uses canonical availability/coverage rather than current-value fallback on every request.

## Performance / query-plan gate

- [ ] The implemented period-scoped `BookReadingProgressEvent` aggregation has been inspected with a real PostgreSQL query plan (`EXPLAIN (ANALYZE, BUFFERS)` in the safe test/dev environment, or the repository-approved equivalent).
- [ ] The inspected query is scoped to the authenticated user and selected period in the database, not filtered in application memory.
- [ ] Pages/dynamics/calendar/streak activity has no per-book/per-day N+1 pattern or obvious avoidable full-table event scan. Calendar Books previews are produced in the Overview aggregation/batch, not by fan-out day-detail calls.
- [ ] Current/last-12-months, comparison-enabled and large/all-time scenarios have been considered with representative data.
- [ ] Existing `@@index([bookId, date])` is treated as a starting point; any additional/change index is added only when the actual plan demonstrates the need.
- [ ] If an index migration is added, the same representative plan is rerun and the before/after reason is documented.
- [ ] No Redis/materialized statistics/precomputation layer is introduced in V1 without measured evidence that efficient DB aggregation remains insufficient.

## Statistics cache invalidation

- [ ] One centralized Statistics query matcher/helper covers Overview parameter variants, reading-day details and future `/api/statistics...` exact-detail queries.
- [ ] Successful Reading status/progress/reread/reset/correction mutations invalidate Statistics.
- [ ] Successful Book metadata, ownership, soft-delete/restore and Statistics-consumed rating mutations invalidate Statistics when relevant; favorite-only mutations do not invalidate V1 Statistics.
- [ ] Successful Reading Goal mutations invalidate Statistics goal-dependent Overview data.
- [ ] Successful Statistics-relevant Series mutations invalidate Statistics without changing immutable historical snapshot semantics.
- [ ] Successful profile `timezone` and `weekStartDay` mutations invalidate the full Statistics family.
- [ ] Failed mutations do not invalidate Statistics as if canonical data changed.
- [ ] Aggregate Overview cache is not manually reconstructed/patched on frontend after cross-feature mutations.
- [ ] Invalidation is wired at mutation/API synchronization boundaries, not scattered through page components.
- [ ] Tests prove the Statistics matcher does not match unrelated API query families.

## Ratings vs Favorites semantics

- [ ] The V1 section is named `Оцінки`, not `Оцінки та фаворити`.
- [ ] Its contract contains rating aggregates/distribution/top-rated reads only and does not silently consume `Book.isFavorite` / `favoriteAddedAt`.
- [ ] Top-rated books are not described as favorites; they remain `Найвище оцінені`.
- [ ] Favorite-only mutations do not invalidate Statistics V1.
- [ ] If Favorites analytics is added later, its product meaning is explicitly chosen before implementation (`current favorite among period reads`, `favorited during period`, or `favorite state at completion`) and historical-period behavior is specified rather than inferred.

## Frontend

- [ ] Generated Orval/TanStack Query client is used.
- [ ] No manual HTTP DTO duplication.
- [ ] Desktop order matches final IA.
- [ ] Mobile uses 2×2 KPI, swipes, Top-N expansion and bottom sheets.
- [ ] `available/partial/unavailable` states, coverage and typed reasons are preserved.
- [ ] uk/en localization is complete.
- [ ] Charts have accessible textual equivalents.

## Project verification

- [ ] Relevant tests pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] OpenAPI generation passes.
- [ ] `pnpm gen:api` passes.
- [ ] No cross-user statistics leakage.

## Deterministic ordering

- [ ] Every V1 ordered array/ranking/preview/record/detail has a documented total comparator.
- [ ] Every comparator ends with a canonical non-localized stable key (`readingCycleId`, entity id, `genreKey`, canonical language value or ISO date as appropriate).
- [ ] Frontend preserves backend analytics order and does not repair ties using localized labels.
- [ ] Optional/null ranking values have explicit null placement; DB default null ordering is not relied on.
- [ ] Hero, ratings, genres, authors, publishers, languages, discoveries, series, calendar preview, Insight pool and Record Engine have tie fixtures that reach the final key.
- [ ] Paginated exact-details use a total DB/cursor order including the stable final key before `take/limit`; a tie crossing a page boundary produces no duplicate/missing row.
- [ ] Same canonical fixture/input produces byte-equivalent ordered ID/key sequences across repeated backend calls.

## Period / comparison edge contract

- [ ] All period validation/normalization follows `shared/24-period-comparison-edge-contract.md`.
- [ ] Current year ends at user-local today; future year and explicit future custom bounds are rejected.
- [ ] Custom `from > to` is rejected and one-day custom range is valid.
- [ ] Last-12-month and previous-period calculations use date-only calendar arithmetic.
- [ ] Current/full-year, last-12-month and custom comparison bounds follow the documented modes and leap-year rules.
- [ ] All time does not support comparison.
- [ ] Granularity boundaries are tested at 31/32 and 180/181 inclusive days.
- [ ] `percentDelta` is null for zero previous baseline and API never emits Infinity/NaN.
- [ ] Rate metrics use a dedicated ratio/percentage-point comparison contract rather than ambiguous percent math.
- [ ] Frontend renders backend-normalized period/comparison bounds and does not recalculate them.

## First-completion reliability

- [ ] `firstKnownBookCompletion` is not treated as synonymous with proven `firstBookCompletion`.
- [ ] Legacy backfilled cycles are not automatically classified as first-ever reads.
- [ ] Discovery, structural Series lifecycle and TBR first-completion outflow consume only proven first-completion/lifecycle facts.
- [ ] Legacy uncertainty becomes explicit `partial` / `unavailable` quality rather than fake discoveries or fake zeroes.
- [ ] Post-cutover first-read and reread cases have focused tests.

## Reading activity reset semantics

- [ ] Ordinary reset never deletes already persisted reading-activity events, including current unfinished-cycle events.
- [ ] Reset can clear mutable current progress without fabricating a completed read.
- [ ] Preserved activity still contributes to pages/calendar/streak metrics.
- [ ] Historical reading-event deletion is available only through the explicit exact correction capability, never as a reset side effect.

## ReadingCycle state machine / idempotency

- [ ] Canonical states are `active | finished | dnf | abandoned` (equivalent casing allowed).
- [ ] At most one active cycle exists per user/book.
- [ ] Start/resume/reread/finish/DNF/reset retries do not create duplicate cycles.
- [ ] Only `finished` contributes completed reads.
- [ ] Terminal cycles are not reopened by ordinary mutations.
- [ ] Progress retry does not double-count pages for the same already-applied target page.

## Reading-history rollout

- [ ] ReadingCycle/snapshot schema is additive-first.
- [ ] Canonical new write paths are deployed before backfill.
- [ ] Legacy backfill has a stable idempotency key and is safely rerunnable.
- [ ] Re-running backfill cannot mutate frozen legacy snapshots.
- [ ] Verification/reconciliation passes before Statistics completion analytics are enabled.
- [ ] `readingCycleId` is not incorrectly made non-null for legitimate legacy events.

## Legacy activity-event completeness

- [ ] A stable `activityHistoryReliableFrom` boundary exists.
- [ ] Pre-cutover surviving events are preserved but their absence is not treated as known zero.
- [ ] Pages/active-days/streak lower-bound semantics are communicated when selected scope crosses unreliable history.
- [ ] Most-active-weekday/other non-monotonic activity rankings are not presented as exact when old missing events could change them.
- [ ] No fake event-history coverage percentage is created.

## Final API contract manifest

- [ ] `shared/31-final-api-contract-manifest.md` matches actual shared Zod schemas.
- [ ] Full rich/empty/partial/historical test fixtures parse the real schema; partial documentation snippets use canonical field names/shapes.
- [ ] New Statistics DTO contains no deprecated field aliases (`delta`, `deltaPercent`, `comparisonEnabled`, cycle `completedBooks`).
- [ ] Orval-generated types compile without handwritten Statistics DTO casts.

## Hard delete / privacy purge

- [ ] Soft delete and permanent purge have explicitly different semantics.
- [ ] ReadingCycle/Event FK/service deletion behavior preserves soft-delete history but erases data on true hard purge.
- [ ] Account purge removes completion metadata snapshots as well as cycles/events.
- [ ] Purge is idempotent and cross-user isolated.

## Reading duration

- [ ] Same-day completed cycle has `elapsedDays = 1`.
- [ ] Duration uses date-only inclusive calendar arithmetic, not milliseconds.
- [ ] Missing start / invalid date order reduce duration coverage rather than being guessed or clamped.
- [ ] New writes reject `finishedAt < startedAt`.
- [ ] Duration wording does not claim active reading time/speed.

## Final consistency gate

- [ ] `shared/34-final-consistency-gate.md` passes: no unresolved internal references, stale live DTO aliases or contradictory affirmative requirements.
- [ ] Response fixtures parse actual Zod and generated OpenAPI/Orval compiles before frontend handoff.

## ReadingCycle cross-feature integration — final P0/P1 gate

- [ ] `BooksService.create` cannot create a finished/current reading state without the corresponding canonical cycle semantics.
- [ ] `BooksService.update` delegates lifecycle-owned status/progress changes through the canonical cycle-aware orchestration.
- [ ] `BookReadingService.startReading` uses the same transaction + per-book lock semantics as other cycle mutations.
- [ ] `BulkBooksService.setReadingStatus` no longer blind-updates lifecycle state outside cycle orchestration.
- [ ] `/blast-radius` confirms no unsupported direct lifecycle writer remains.
- [ ] DB has a reviewed partial unique invariant preventing more than one active cycle per Book/user scope.
- [ ] Count-based Reading Goals qualify from canonical finished cycles and count one Book at most once per goal.
- [ ] Starting/finishing a reread neither uncounts nor double-counts an already qualifying Book.
- [ ] Explicit correction of a qualifying cycle deterministically falls back to another eligible cycle or uncounts it.
- [ ] Explicit reading-event correction exists and ordinary reset remains non-destructive.
- [ ] `activityHistoryReliableFrom` is persisted in per-user Reading-history provenance and is stable across reruns/timezone changes.
- [ ] Contract/migration work followed `shared/40-repo-specific-verification.md`, including focused Vitest, `/blast-radius` and migration SQL/raw-index review.

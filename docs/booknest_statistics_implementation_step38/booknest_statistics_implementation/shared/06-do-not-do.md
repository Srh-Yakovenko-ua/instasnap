# Do not do

- Do not create a generic BI/dashboard framework.
- Do not put Prisma in services/controllers.
- Do not concentrate independent calendar/streak/rating/taste/library/insight/record algorithms in one god `statistics.service` or `statistics.repository`; keep application orchestration thin and extract only meaningful focused domain units.
- Do not over-correct decomposition by creating a file for every trivial formula or a generic analytics framework without real reuse.
- Do not handwrite frontend API types/fetch.
- Do not calculate statistics in React.
- Do not infer Calendar KPI scope from the visible heatmap/day payload; use backend `metricRange` vs `displayRange`, especially for All time.
- Do not render a closed historical period's `currentStreak` as `0`; return/consume `unavailable + PERIOD_NOT_CURRENT`.
- Do not let `longestStreak` absorb days outside the selected Calendar `metricRange`; clip it at period boundaries.
- Do not render Calendar Books mode by calling `/statistics/reading-days/:date` once per visible day; use compact `calendar.days[].booksPreview` from the single Overview response and lazy-load full day details only after interaction.
- Do not treat persisted reading `@db.Date` as a timestamp and convert it through the user timezone; preserve its `YYYY-MM-DD` label.
- Do not derive a progress event's reading day from `createdAt` when canonical `BookReadingProgressEvent.date` exists.
- Do not keep the current UTC-based implicit `today` write behavior once Statistics depends on user-local day correctness; resolve new default reading dates from existing `UserProfileSettings.timezone`.
- Do not backfill/shift existing historical date-only rows merely because the default write path is corrected.
- Do not use mutable current `BookReadingProgress.finishedAt` as the immutable Statistics completion ledger once rereads are supported.
- Do not let ordinary `rereading` or `resetProgress` erase previously finalized read-through cycles/events; never keep the current book-wide `deleteMany({ bookId })` behavior for historical events after cycle tracking is introduced.
- Do not invent erased legacy rereads or assign old progress events to cycles from `createdAt`/`updatedAt` heuristics.
- Do not apply `Book.deletedAt = null` as a blanket filter to historical completion/activity/rating/discovery datasets; a later soft delete is not a retroactive history rewrite.
- Do not derive historical author/genre/publisher/language/series membership or `pagesCount`-based records from mutable current Book metadata after completion; use the immutable cycle snapshot from `shared/19-historical-metadata-snapshots.md`.
- Do not reclassify `Book.language = ukrainian` as unknown merely because Ukrainian is the current default, and do not invent language-confirmation provenance or original language from heuristics; follow `shared/22-language-reliability-semantics.md`.
- Do not mutate finalized completion metadata snapshots on ordinary Book/Author/Publisher/Series edits or silently project new current relations backwards into old periods.
- Do not include soft-deleted Books in current owned/TBR/read-ratio snapshot populations.
- Do not use ordinary Book soft delete as a substitute for an explicit reading-history correction or data-purge action.
- Do not return backend-localized Insight sentences; use the shared typed `code + params` contract and localize on frontend.
- Do not implement separate Hero and regular-Insights selection pipelines; both surfaces must derive from one ranked Insight Engine candidate pool, with the featured candidate excluded from regular cards.
- Do not rerank/dedupe/promote insights on frontend.
- Do not make public Insight `params` an untyped `Record<string, unknown>`; keep them code-specific and generated through the shared/OpenAPI contract.
- Do not reimplement Reading Goal progress/pace/projection/risk/completion formulas inside the Statistics module; consume canonical Reading Goals results.
- Do not reconstruct missing history from timestamps that do not mean that event.
- Do not convert unknown/unavailable to zero.
- Do not create section-local availability enums/flags (`insufficient`, `historyAvailability`, `hasData`); reuse the canonical `available | partial | unavailable` + coverage contract.
- Do not make every analytics card clickable.
- Do not make a click/chevron navigate to a related-but-not-exact subset; primary analytics interaction must satisfy the exact drill-down contract.
- Do not use fuzzy `q` search or broad entity/list navigation as a substitute for canonical IDs + exact period/filter semantics.
- Do not let individual Statistics components hand-build drill-down URLs; use the centralized typed Statistics drill-down builder.
- Do not duplicate operational Wishlist/Delivery/Loan dashboards on Overview.
- Do not label the V1 rating section `Оцінки та фаворити` or silently treat `Book.isFavorite` / `favoriteAddedAt` as period analytics; the approved V1 section is `Оцінки` only.
- Do not add Favorites analytics until the product semantics explicitly choose current-state vs event-in-period vs completion-time meaning and the corresponding historical stability rules.
- Do not add a second `2026 vs 2025` section; comparison is contextual.
- Do not add annual recap into Overview V1.
- Do not add parallel Reading `StatisticsPeriod` / comparison / numeric-delta primitives before auditing the reusable-looking contracts already in `order-statistics.ts`.
- Do not force order-specific period/comparison semantics into Reading Statistics merely to deduplicate types; extract a common primitive only when semantics are proven identical.
- Do not over-abstract helpers before real reuse.
- Do not edit generated Orval/shadcn files manually.

- Do not scatter Statistics invalidation across page components or manually patch derived Overview aggregates after cross-feature mutations; use the centralized Statistics query matcher/invalidation helper.
- Do not rely only on `staleTime`, window focus, remount or polling to make successful Statistics-affecting mutations visible.
- Do not invalidate Statistics on failed mutations or every unrelated mutation in BookNest; invalidate on successful changes to canonical data actually consumed/presented by Statistics.

- Do not rely on natural database/Prisma relation/Map insertion order or frontend sort stability for Statistics rankings/previews/records.
- Do not use localized/current display names as final analytics tie-breaks when canonical IDs/keys exist.
- Do not paginate an exact-detail ranking under a partial order; include a stable final identity key in database/cursor ordering before limit/take.

## Period/comparison edge anti-patterns

- Do not silently swap reversed custom `from/to`.
- Do not silently clamp an explicitly requested future custom range to today or show a zero-filled future year.
- Do not enable/ignore comparison for All time; treat it as unsupported and prevent/reject the contradictory state.
- Do not compute inclusive date duration with epoch-millisecond division.
- Do not emit/render Infinity/NaN or fabricate `100%` growth when previous = 0.
- Do not compare rate/proportion values as raw counts; use explicit percentage-point semantics when that is the intended comparison.
- Do not let frontend recalculate comparison bounds or exact-drill-down dates from raw URL state after backend normalization.

- Do not expose a completed reading-cycle count under `completedBooks`/`books` naming or render it with the unit `книг`; use `completedReads` and keep `uniqueBooksCompleted` explicit. See `shared/25-completed-read-count-semantics.md`.

- Do not treat `MIN(finishedAt)` / the only surviving legacy cycle as proof of first-ever completion.
- Do not fabricate discovery, structural Series lifecycle or TBR first-read outflow from first-known-only legacy cycles.

- Do not delete current unfinished-cycle reading events as a side effect of ordinary progress reset; reset current state and historical activity correction are separate operations.

- Do not implement ReadingCycle creation/finalization as non-idempotent unconditional inserts; duplicate network retries must not duplicate reads.
- Do not reopen terminal `finished`/`dnf`/`abandoned` cycles through ordinary reading transitions.

- Do not ship ReadingCycle history as a destructive big-bang migration or run a non-idempotent legacy backfill.
- Do not enable completion-based Statistics before canonical new writes and migration reconciliation are complete.

- Do not claim surviving legacy progress events are a complete ledger when earlier reset behavior could have deleted rows; do not turn missing pre-cutover events into known zeroes.

- Do not keep multiple accepted HTTP field aliases for documentation continuity; the finalized Statistics DTO has one canonical shape from `shared/31-final-api-contract-manifest.md`.

- Do not retain immutable reading-cycle snapshots after an explicit permanent user/book privacy purge merely to preserve historical Statistics.

- Do not define same-day reading duration as zero, subtract paused days, or repair invalid legacy start/finish order by guessing.

## Final integration prohibitions

- Do not leave Book create/update or bulk reading-status as parallel lifecycle writers after ReadingCycle rollout.
- Do not rely on an application lock **or** a DB constraint alone; V1 requires both per-book serialization and the one-active-cycle DB invariant.
- Do not qualify count-based Reading Goals from mutable current `BookReadingProgress.finishedAt` after cycles exist.
- Do not count rereads twice toward the same count-based Reading Goal.
- Do not re-enable destructive ordinary reset because an explicit correction UI is inconvenient; use the exact correction capability.
- Do not derive `activityHistoryReliableFrom` from `MIN(event.date)`, an env constant or a moving deployment timestamp.
- Do not routinely run full `pnpm test`/`pnpm knip` contrary to current repo quality-gate rules; use focused tests + `/blast-radius` and CI.

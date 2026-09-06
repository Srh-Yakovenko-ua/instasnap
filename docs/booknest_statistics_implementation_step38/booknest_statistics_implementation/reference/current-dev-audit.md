# Current dev audit used for this package

Verified against public `dev` during preparation:

- monorepo uses pnpm/Turborepo;
- web: Next.js 16, React 19, next-intl, TanStack Query, shadcn/Tailwind;
- api: NestJS 11, Prisma 7, PostgreSQL;
- backend feature modules use `api/application/domain/infrastructure`;
- shared Zod DTOs → Swagger/OpenAPI → Orval-generated frontend;
- `BookReadingProgress` has start/finish/rating fields;
- `BookReadingProgressEvent` has `bookId`, `date`, `pagesRead`; at package preparation time it has `@@index([bookId, date])`, while authenticated user scoping is reached through the related `Book.userId`;
- `BookReadingProgress.startedAt/finishedAt/pausedAt/abandonedAt/lastProgressUpdateAt` and `BookReadingProgressEvent.date` are PostgreSQL `DATE` (`@db.Date`), while event `createdAt` is `Timestamptz`; stored reading dates therefore represent date labels rather than instants;
- `BookReadingProgress` is one mutable row per book, not an immutable history of read-throughs: current `rereading` transition clears mutable `finishedAt` and reuses `existingStartedAt` when present; `resetProgress=true` to `not_started/want_to_read` can trigger book-wide deletion of `BookReadingProgressEvent`; therefore full historical Statistics requires the separate canonical reading-cycle prerequisite in `shared/17-reading-cycle-history.md`;
- current `BookReadingService` uses `todayIso()` for omitted `date/updateDate` in status/progress/start flows, and current core `toIsoDate(new Date())` formats in UTC. This is a Statistics data-quality prerequisite: future implicit reading dates must resolve from authenticated-user `UserProfileSettings.timezone`, without reinterpreting explicit/stored date-only values;
- current `getReadingHistory()` also passes `today: new Date()` to a mapper that uses `toIsoDate(today)`, so its today-relative activity window currently inherits UTC day semantics; audit/fix it with the same user-local date resolver to keep canonical Reading behavior consistent;
- `Book` has genres[], formats[], language, statuses, pagesCount, publisher relation and soft-delete state via `deletedAt`; Statistics must not use one blanket deleted-book predicate for both immutable historical reading facts and current-library snapshots.
- `Book.language` is currently non-null with Prisma default `ukrainian`; `CreateBookInputSchema` also defaults it to `ukrainian`, frontend `createBookFormDefaults` sets `ukrainian`, and the visible Classification language Select clears/falls back to `ukrainian`. The current model therefore cannot distinguish explicit-vs-defaulted Ukrainian in legacy rows. V1 Statistics treats this as the **declared edition language stored in BookNest**, not as separately verified provenance; follow `shared/22-language-reliability-semantics.md`.
- `Series` has status/totalBooks;
- `ReadingGoal` is currently count-based (`targetCount` + `deadline`) and already has canonical backend analytics through `ReadingGoalMetricsSchema`: `completedCount`, `remainingCount`, `progressPercent`, `elapsedPercent`, `expectedCompletedCount`, `actualBooksPerDay`, `averageDaysPerBook`, `requiredBooksPerDay`, `requiredDaysPerBook`, `pace`, `paceDeltaBooks`, `paceDeltaPercent`, `projectedCompletionDate`, `projectedDaysDelta`, `projectionConfidence`, `riskLevel`, `riskReasons`, `daysLeft`, `daysSinceLastCounted`, `lastCountedAt`, `elapsedDays`, `totalDays`;
- Reading Goals also already exposes canonical overview-level data (`ReadingGoalsOverviewSchema`) for active/on-track/attention counts, completed/success summary and best result; goal books/activity/checkpoints are separate existing models;
- therefore `reading-goals` must remain the calculation owner; the new Statistics feature should consume/adapt these canonical outputs rather than duplicating goal formulas;
- canonical user timezone already exists in `UserProfileSettings.timezone` and is validated through the shared profile/settings contract (IANA timezone; current default `Europe/Kyiv`);
- canonical week start already exists in `UserProfileSettings.weekStartDay`; shared `WeekStartDaySchema` supports `monday | sunday`, current default is `monday`;
- `BookOrder` has order date/currency/total and items/shipments.
- `packages/shared/src/order-statistics.ts` already defines reusable-looking `StatisticsPeriodSchema` (`from/to` nullable `isoDay`), `StatisticsComparisonPeriodSchema`, `BookOrderStatisticsCompareModeSchema` (`previous_period | same_period_last_year`) and `NumericDeltaSchema`; Reading Statistics must audit semantic compatibility and current consumers before creating equivalents or extracting a common module. The shared `NumericDeltaSchema` shape allows nullable `percentDelta`, but the Reading implementation must still verify the actual Delivery zero-baseline behavior before reusing semantics; Reading requires the explicit rules in `shared/24-period-comparison-edge-contract.md`.

Before coding, Claude must re-open the repo because `dev` may move after this package was generated.

## Reusable Statistics interaction precedent

Delivery Statistics already establishes the product direction that drill-down must preserve aggregate subset semantics rather than use fuzzy/related navigation. Global Reading Statistics should reuse that principle with its own typed semantic target/builder instead of inventing ad-hoc URLs per component.

## Frontend query-key / mutation-sync precedent

Current `dev` already has centralized TanStack Query synchronization patterns that Statistics should extend rather than replace:

- `features/books/api/book-keys.ts` owns `bookKeys` and Books-key matching helpers;
- `features/books/api/use-book-mutation-sync.ts` is a cross-feature success-sync point: it updates the changed Book detail and invalidates related Books, Reading Queue/History, Series and Delivery queries;
- `features/reading-goals/api/goal-keys.ts` owns a centralized Reading Goals query-key root/factories;
- current mutation hooks such as reading progress/status call the shared Book mutation sync from `onSuccess`.

Statistics should follow the same API-layer pattern. Add/reuse one centralized matcher/helper for the full `/api/statistics...` query family and invoke it from successful mutation-sync paths in the source features. Do not introduce a global event bus or component-level invalidation solely for Statistics. See `frontend/12-query-invalidation.md`.

## Favorite state

- Current Book model exposes `isFavorite` and `favoriteAddedAt`, but the approved Statistics V1 does not consume them.
- These fields do not by themselves answer a single unambiguous period-statistics question, so the V1 section is `Оцінки`; future Favorites analytics requires an explicit semantic decision first. See `shared/21-ratings-vs-favorites-semantics.md`.

## Final implementation-readiness findings — cross-feature blockers discovered after step37

Current `dev` has lifecycle writes outside `BookReadingService`: `BooksService.create()` can persist initial `readingStatus/readingProgress`, `BooksService.update()` can resolve/update reading progress directly, and `BulkBooksService.setReadingStatus()` performs a repository-level bulk status update before goal sync. Therefore ReadingCycle integration must follow `shared/35-reading-lifecycle-write-path-integration.md`; patching only `BookReadingService` is insufficient.

`BookReadingService.changeReadingStatus()` and `updateReadingProgress()` currently acquire the per-book lock, while current `startReading()` does not use the same transaction/lock path. ReadingCycle rollout therefore requires `shared/36-reading-cycle-concurrency-invariant.md`, including a DB partial unique one-active-cycle invariant.

Current `ReadingGoalSyncService` qualifies goal books from mutable progress `finishedAt`/`qualifiedFinishedAt`. This conflicts with immutable reread history because a reread may change the mutable finish field. After cycle rollout, qualification must follow `shared/37-reading-goals-cycle-qualification.md` while existing Reading Goal metrics remain canonical.

Current repo quality gates also require focused local Vitest files, `/blast-radius` for contract-shaped changes and explicit migration/raw-index review rather than routine local full-suite/knip runs; see `shared/40-repo-specific-verification.md`.

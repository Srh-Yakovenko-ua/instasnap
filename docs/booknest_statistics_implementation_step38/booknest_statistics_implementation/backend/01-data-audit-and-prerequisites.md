# Data audit і prerequisites

## Уже доступні на `dev`

### Reading

`BookReadingProgress`

- `startedAt`
- `finishedAt`
- `pausedAt`
- `abandonedAt`
- `rating`
- `lastProgressUpdateAt`

`BookReadingProgressEvent`

- `date`
- `page`
- `pagesRead`

`BookReadingProgressEvent` є canonical source для reliable daily pages/activity facts, але поточний `BookReadingProgress` — лише mutable current/latest snapshot, а не canonical immutable completion history. На актуальному `dev` переходи в `rereading` очищають mutable `finishedAt`, а `resetProgress` для `not_started/want_to_read` може book-wide видалити reading events. Тому перед Statistics completion/reread aggregates обов'язково реалізувати `shared/17-reading-cycle-history.md`.

Також `BookReadingProgress.startedAt/finishedAt/...` і `BookReadingProgressEvent.date` на актуальному `dev` є PostgreSQL `DATE` (`@db.Date`), тобто logical calendar-date values, а не timestamp instants. Дотримуватись `shared/16-reading-date-semantics.md`: stored date не re-bucket-ити через timezone.

### Book

- `genres: String[]`
- `formats: String[]`
- `language: String` — non-null canonical BookLanguage value; current Prisma/shared/frontend create defaults are `ukrainian`, so stored value completeness is not the same thing as explicit user-confirmation provenance. See `shared/22-language-reliability-semantics.md`.
- `readingStatus`
- `ownershipStatus`
- `wishlistAddedAt`
- `pagesCount`
- `publicationYear`
- `publisherId`
- author relations
- series relation/order fields — перевірити актуальний schema section повністю.

### Series

- `status`
- `totalBooks`
- books/authors.

### ReadingGoal

На актуальному `dev` goal domain уже значно ширший за `targetCount/deadline`.

Canonical goal shape залишається **count-based**:

- `targetCount`;
- `deadline`;
- optional `listId`;
- `archivedAt`;
- status/result;
- goal books/activity/checkpoints.

Canonical backend metrics уже оголошені в `ReadingGoalMetricsSchema` і доступні через goal list/detail contracts:

- progress: `completedCount`, `remainingCount`, `progressPercent`;
- elapsed/expected: `elapsedDays`, `totalDays`, `elapsedPercent`, `expectedCompletedCount`;
- actual pace: `actualBooksPerDay`, `averageDaysPerBook`;
- required pace: `requiredBooksPerDay`, `requiredDaysPerBook`;
- pace status/delta: `pace`, `paceDeltaBooks`, `paceDeltaPercent`;
- projection: `projectedCompletionDate`, `projectedDaysDelta`, `projectionConfidence`;
- risk: `riskLevel`, `riskReasons`;
- recency/deadline context: `daysLeft`, `daysSinceLastCounted`, `lastCountedAt`.

Окремо вже існує `ReadingGoalsOverviewSchema` з aggregate goal data: active total/on-track/needs-attention, attention items, completed/success summary, current-year counted books і best result.

**Domain ownership:** усі ці goal metrics та їх формули належать `reading-goals`. Новий `statistics` module не стає другим owner-ом goal progress/pace/projection/risk semantics. Він повинен отримувати canonical already-computed metrics через existing/refactored Reading Goals application capability і лише адаптувати їх у Statistics response. Якщо потрібного canonical value немає — спочатку розширити Reading Goals capability, а не рахувати його локально в Statistics.

Не припускати multi-type goals або `isPrimary`: на актуальному `dev` create/update contract залишається count-based і не містить цих полів. Для V1 Statistics це остаточне рішення: `isPrimary` не додаємо; primary active goal вибирається backend-ом із canonical `status = active` goals за `deadline ASC` → `createdAt ASC` → `id ASC`, без залежності від list pagination/frontend order.

## Обов'язковий audit перед міграціями

Перевірити:

1. Чи існує надійна історія ownership transitions / дата входу книги в OWNED/TBR.
2. Чи існує окреме canonical reliable джерело **фактично прочитаного формату**. `Book.formats[]` саме по собі не вважати таким джерелом. Результат цього audit визначає лише optional Formats capability; він не блокує guaranteed V1 Statistics.
3. Перевірити інтеграцію Statistics з уже наявним canonical `UserProfileSettings.timezone` (IANA timezone; поточний default — `Europe/Kyiv`). Нове поле/налаштування timezone для Statistics не потрібне.
4. Перевірити інтеграцію Statistics з уже наявним canonical `UserProfileSettings.weekStartDay`. Shared contract підтримує `monday | sunday`, поточний default — `monday`; Statistics-specific week-start setting не потрібне.
5. Чи series order/disabled/ignored logic уже має canonical service.
6. Перевірити актуальний canonical integration point Reading Goals application/domain для отримання already-computed metrics. Statistics не повинен повторювати формули. Якщо contract/integration point змінився — синхронізувати Statistics з новим canonical API або мінімально розширити Reading Goals capability.
7. Language semantics are resolved for V1 via `shared/22-language-reliability-semantics.md`: current `Book.language` is the visible required **declared edition language** and is snapshotted at completion. Do not invent explicit/default provenance, do not reclassify `ukrainian` as unknown, and do not derive original language. Run the documented pre-release distribution sanity audit instead of heuristic rewriting.
8. Audit existing `packages/shared/src/order-statistics.ts` period/comparison/delta primitives and their current consumers before adding Reading Statistics equivalents. Follow `shared/13-statistics-common-primitives.md`: reuse/extract only when date/range/all-time/comparison/delta semantics are truly identical; otherwise keep the contracts separate and document the mismatch.
9. Audit the Books/Reading implicit-date write path. Current `BookReadingService` uses `input.date ?? todayIso()`, implicit `todayIso()` in `startReading`, and `input.updateDate ?? todayIso()`; current core `toIsoDate(new Date())` formats in UTC. Replace the implicit/default-day resolution with authenticated-user-local `YYYY-MM-DD` from existing `UserProfileSettings.timezone` before relying on newly written activity data. Do not timezone-shift explicit date-only inputs or existing stored `@db.Date` values.
10. Audit existing Reading History current-day anchoring as part of the same semantic fix: `getReadingHistory()` currently supplies `new Date()` and the mapper derives `todayIso` through the UTC-oriented helper. Reading History and Statistics must not disagree about user-local `today`; reuse the same resolved-user-date helper where current-day context is required.
11. Audit rereading/reset history before using `BookReadingProgress.finishedAt` as a Statistics source. Current `dev` has one mutable progress row per book; `rereading` clears `finishedAt`, while `resetProgress=true` to `not_started/want_to_read` triggers book-wide progress-event deletion. Implement the canonical reading-cycle prerequisite in `shared/17-reading-cycle-history.md`; do not accept “current-cycle only” history for full Statistics.
12. Audit every Statistics query that touches `Book.deletedAt`. Apply `shared/18-soft-deleted-book-eligibility.md`: historical reading cycles/events remain historical facts after a later soft delete, while current-library/TBR/owned snapshot populations explicitly require `Book.deletedAt IS NULL`. Do not reuse one blanket deleted-book predicate for both classes.
13. Audit historical metadata drift. Current `Book.pagesCount`, `Book.language`, `Book.genres[]`, `Book.publisherId`, `BookAuthor` relations and `Book.seriesId/partNumber` are mutable current-state data, not immutable historical facts. Implement `shared/19-historical-metadata-snapshots.md`: newly finished cycles capture typed completion-time analytics metadata atomically; legacy backfilled cycles capture current known metadata once with explicit provenance; old aggregates must not keep rejoining mutable current metadata as their semantic source.

## Правило

Якщо історичного факту немає — не реконструювати його з `createdAt`/`updatedAt`. Позначити metric як unavailable/partial або спершу додати канонічне event tracking.

## Canonical timezone вже існує

Overview exposes the resolved value as top-level `meta.timezone`. Для Statistics не створювати окреме timezone-поле і не робити prerequisite-міграцію. Canonical timezone визначає user-local `today`, relative period endpoints і `today/yesterday` streak context. Але persisted reading `@db.Date` values already are calendar-date labels: їх не можна повторно переводити в timezone для membership/grouping. Окремо обов'язково виправити implicit reading-date write path, щоб новий default `today` створювався в `UserProfileSettings.timezone`, а не UTC. Повні правила — `shared/16-reading-date-semantics.md`.

## Canonical week start уже існує

Overview exposes the resolved value as top-level `meta.weekStartDay`. Для weekly aggregation і calendar presentation використовувати існуючий `UserProfileSettings.weekStartDay`, а не hardcoded ISO/Monday semantics. Supported values беруться з canonical `WeekStartDaySchema`: `monday | sunday` (поточний default — `monday`). Не створювати окреме Statistics-specific налаштування або migration. Якщо користувач змінює week start, наступний Statistics response має відображати нову семантику.

14. Replace ordinary reset semantics that delete progress events. Implement `shared/27-reading-activity-event-history.md`: current progress/cycle state may reset, but already persisted real reading events remain canonical historical activity. A separate explicit correction action is required to erase mistaken activity.

15. Implement and test the canonical ReadingCycle state machine/idempotency from `shared/28-reading-cycle-state-machine.md` before Statistics completion counts are trusted. In particular, duplicate finish/reread retries must not create duplicate cycles and DNF/reset must remain terminal non-completed history.

16. Audit existing hard-delete/account-purge conventions before choosing ReadingCycle/Event FK `onDelete` behavior. Apply `shared/32-hard-delete-privacy-purge.md`: soft delete preserves historical Statistics, actual permanent purge erases owned historical source rows.

17. Audit duration data quality and enforce `shared/33-reading-duration-semantics.md`: inclusive calendar-day span, same-day = 1, new invalid finish-before-start rejected, legacy missing/invalid start reduces duration coverage without guessed repairs.

## Cross-feature lifecycle integration prerequisite — mandatory

The ReadingCycle prerequisite is incomplete unless **all** backend lifecycle writers use it. Current `dev` includes reading-state/progress writes outside the main `BookReadingService`, notably Book create/update and bulk reading-status paths. Follow `shared/35-reading-lifecycle-write-path-integration.md`; use `/blast-radius` to find every writer and eliminate parallel lifecycle semantics before enabling completion Statistics.

Every cycle-mutating path must also satisfy `shared/36-reading-cycle-concurrency-invariant.md`: transaction + per-book serialization and a reviewed DB partial unique one-active-cycle invariant. Do not assume current `startReading`/bulk behavior already provides the same locking as `changeReadingStatus`/`updateReadingProgress`.

## Reading Goals qualification prerequisite — mandatory

Current Reading Goals synchronization is based on mutable current progress `finishedAt`. After immutable cycles exist, this is no longer the qualification authority. Implement `shared/37-reading-goals-cycle-qualification.md`: a count-based goal counts each Book at most once, based on the earliest canonical finished cycle inside the goal counting window. Starting/finishing a reread must not clear or duplicate an already qualifying Book.

This changes the qualification source only. Existing Reading Goal pace/risk/projection calculations remain canonical and are still reused by Statistics.

## Explicit correction prerequisite

Because ordinary reset must preserve historical reading events, provide the narrow explicit event/history correction capability in `shared/38-reading-history-correction-capability.md`. Do not reintroduce destructive reset as a workaround for mistaken activity.

## Persisted activity-history provenance

`activityHistoryReliableFrom` must have the concrete persistence/source semantics in `shared/39-activity-history-reliability-source.md`: per-user Reading-history state, derived once from the canonical cutover + user timezone and frozen. It is not `MIN(event.date)`, not a runtime constant and not a user-editable profile preference.

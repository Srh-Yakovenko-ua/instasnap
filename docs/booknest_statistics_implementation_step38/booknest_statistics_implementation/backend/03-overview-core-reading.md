# Core reading aggregates

## KPI

Повернути:

1. `completedReads`
2. `uniqueBooksCompleted` (supporting companion metric; not a fifth KPI card)
3. `pagesRead`
4. `averageRating`
5. `activeDays`

### Completed reads + unique books

Рахувати за canonical **finished reading cycles** (`shared/17-reading-cycle-history.md`) whose stored date-only cycle `finishedAt` falls inside inclusive `from/to`. Не використовувати mutable current `BookReadingProgress.finishedAt` як historical ledger. `finishedAt` не timezone-shift-ити: це `@db.Date`, не instant.

`completedReads` у Statistics означає count completed read-throughs/cycles: завершене перечитування рахується ще одним completed read. `uniqueBooksCompleted = COUNT(DISTINCT bookId)` over those reads and is returned separately. The new Statistics contract MUST NOT expose the cycle count under `completedBooks`. Exact detail rows preserve `readingCycleId` + `bookId`, so two completions of one book do not merge. A later `Book.deletedAt` does **not** retroactively remove a finalized cycle from historical Statistics; follow `shared/18-soft-deleted-book-eligibility.md`.
Historical author/genre/publisher/language/series membership and book-length facts for that cycle come from `shared/19-historical-metadata-snapshots.md`, not from today's mutable Book relations.

### Pages read

Тільки `sum(BookReadingProgressEvent.pagesRead)` для stored date-only `event.date` усередині inclusive `from/to`. Не re-bucket-ити `event.date` через timezone і не підміняти його `event.createdAt`.
Не підміняти `pagesCount`. Historical progress events remain eligible after a later soft delete of the related Book; do not add a blanket `Book.deletedAt = null` filter to historical activity queries.

### Average rating

Тільки completed reading cycles у period із canonical cycle-level rating. Не брати historical rating тільки з mutable latest `BookReadingProgress.rating`, бо reread/reset може його змінити.
Canonical scale: `0.5–10.0`, step `0.5`; не конвертувати в 5-star scale.
Повернути `ratedReadsCount` і `completedReadsCount`, де denominator — completed read cycles у scope. Do not call cycle-based coverage counts “books”.

### Active day

Day, де `sum(pagesRead) > 0`.

## Dynamics

Для кожного bucket:

- `start`
- `end`
- `completedReads`
- `uniqueBooksCompleted` (supporting distinct-title context; primary behavioral series remains `completedReads`)
- `pagesRead`

Окремо current + optional comparison series.

## Peak period

Повернути peak bucket для completed reads і pages.

## Hero

`hero.featuredInsight` comes from the **same single Insight Engine ranked candidate pool** used for `insights.items`; Hero does not have a separate insight selector/threshold/ranking pipeline. The featured candidate is removed from regular Insight cards so the same semantic insight is not duplicated across both surfaces. See `backend/08-goals-insights-records.md` and `shared/14-single-insight-pool.md`.

Повернути до 4 останніх завершених книг period. Backend selection/order MUST follow `shared/23-deterministic-ordering-policy.md`: `cycle.finishedAt DESC → readingCycleId ASC`; never rely on relation/DB order. Якщо Hero візуально дедуплікує reread covers за `bookId`, він проходить already-sorted sequence і зберігає першу occurrence; aggregate/exact semantics не змінюються.

- id
- title
- cover
- author display
- rating
- finishedAt
- readingCycleId (exact historical identity; one book may appear more than once after rereads)

Не повертати top-rated як Hero list — top-rated використовується в Ratings section.

Hero labels/covers may use current presentation enrichment when available, but historical cycle membership/author identity must remain based on the completion-time snapshot; fallback snapshot labels must be available when the current entity/book cannot be rendered.

## Data-quality integration

KPI values that depend on optional/history-backed data use the canonical shared availability/coverage contract. A known zero in a reliable period remains `available`; pre-cutover activity incompleteness follows `shared/30-legacy-activity-history-quality.md` and is not inferred from an empty events query. Nested metrics that cannot be interpreted safely may be `unavailable + LEGACY_HISTORY_INCOMPLETE`; subset-derived metrics such as rating are `partial` with canonical coverage.

# Deterministic ordering policy

Statistics must produce a **total deterministic order** for every ordered collection: rankings, previews, records, insight candidates, exact-detail rows and paginated results. The same canonical input must produce the same output order regardless of incidental database row order, Prisma relation order, JavaScript object/Map insertion order, frontend locale or sort stability.

## Core rule

Every backend comparator/order-by must end in a stable canonical identity/date key after the product-semantic ranking keys.

Do not rely on:

- natural/implicit database order;
- localized/display labels as the final tie-break;
- current mutable names when an immutable entity/key identity exists;
- frontend re-sorting to make backend output stable;
- array insertion order from joins/grouping;
- pagination without a total order.

Frontend preserves backend ranking/order unless a detail surface exposes an explicit user-selected sort mode. Presentation-only locale sorting is allowed only for non-ranked alphabetical lists whose contract explicitly says alphabetical; it must not redefine an analytics ranking.

## Stable identity keys

Use canonical non-localized identities as the final tie-break:

- completed read / historical book row: `readingCycleId ASC` (retain `bookId` as entity identity, but cycle is the exact read identity);
- distinct current book row: `bookId ASC`;
- author: `authorId ASC`;
- publisher: `publisherId ASC`;
- series: `seriesId ASC`;
- genre: canonical `genreKey ASC`;
- language: canonical `BookLanguageSchema` value ASC, never translated label;
- day/month bucket: canonical ISO date/month key;
- Reading Goal: existing `deadline ASC → createdAt ASC → id ASC` rule remains canonical;
- any internal Insight candidate without an entity id must expose an internal deterministic `stableKey` derived from canonical code + IDs/date/bucket keys.

Do not use title/name as the final key merely because it looks user-friendly. Names may change and localization/collation differs by locale.

## V1 comparator matrix

### Chronological series / buckets

- Dynamics buckets: `start ASC`.
- Calendar `days[]`: `date ASC`.
- Comparison series: same chronological ordering as current series.
- Day-details book rows: `pagesRead DESC → bookId ASC` unless the endpoint exposes an explicit alternative sort.

### Hero recent completed covers

Canonical source order:
`cycle.finishedAt DESC → readingCycleId ASC`.

If Hero applies visual de-duplication by `bookId`, process that already-sorted sequence and keep the first occurrence per `bookId` until the display cap is reached. De-duplication is presentation selection only and must not alter KPI/exact-detail membership.

### Ratings

- Top-rated completed reads: `rating DESC → finishedAt DESC → readingCycleId ASC`.
- Exact rating-bucket/detail default order: same comparator unless the detail contract explicitly selects another sort.

### Genres

- Frequency ranking: `completedReadCount DESC → genreKey ASC`.
- Highest-rated ranking: `averageRating DESC → ratedReadCount DESC → genreKey ASC`.
- New/discovery chips/cards when an ordered subset is needed: `firstEncounterAt DESC → genreKey ASC` unless the discovery-card selector below applies.

### Authors

- Frequency ranking: `completedReadCount DESC → authorId ASC`.
- Highest-rated ranking: `averageRating DESC → ratedReadCount DESC → authorId ASC`.
- Returning-author ranking: `distinctReadingYears DESC → completedReadCount DESC → latestFinishedAt DESC → authorId ASC`.

### Publishers

Keep the approved ranking semantics, but make them total:
`completedReadCount DESC → averageRating DESC NULLS LAST → publisherId ASC`.

`averageRating` participates only when it is a valid computed value under the canonical rating/coverage rules; unavailable/insufficient values sort after valid values. Never use current/display publisher name as the final tie-break.

### Languages

- Frequency ranking: `completedReadCount DESC → canonical language value ASC`.
- Any equal-share/count result therefore remains stable across `uk`/`en` UI locales.

### Discoveries

Do **not** create one cross-type numeric competition between authors, genres and publishers.

Select the strongest candidate _inside each type_ with a deterministic comparator:

- Author: `completedReadsAfterDiscovery DESC → averageRating DESC NULLS LAST → latestFinishedAt DESC → authorId ASC`.
- Genre: `completedReadsAfterDiscovery DESC → averageRating DESC NULLS LAST → latestFinishedAt DESC → genreKey ASC`.
- Publisher: `completedReadsAfterDiscovery DESC → averageRating DESC NULLS LAST → latestFinishedAt DESC → publisherId ASC`.

When multiple discovery-type cards render, V1 surface order is fixed: `author → genre → publisher`, omitting unavailable types. This is presentation order, not a claim that one type is mathematically more important than another.

### Series

- Most active: `completedReadCycles DESC → attributablePagesRead DESC → latestFinishedAt DESC → seriesId ASC`.
- Most progress / Top-3 structural progress: `distinctProvenFirstCompletionsInPeriod DESC → seriesId ASC`.
- Longest marathon candidate: `marathonLength DESC → marathonEndFinishedAt DESC → seriesId ASC → startReadingCycleId ASC`.

### Calendar Books preview

Existing rule remains canonical:
`pagesRead DESC → bookId ASC`, max 3.

### Insight Engine

The existing single-pool product ranking (`eligibility → significance → sample → dedupe/diversify → priority/ranking`) remains authoritative. The comparator must still be total. After all semantic priority/significance keys, append an internal deterministic `stableKey ASC` generated from canonical insight code + subject entity/date/bucket identifiers.

Do not expose localized text as this key. Frontend never reranks the pool.

### Record Engine

Record **type selection/output order** is deterministic and follows the approved priority list:

1. longest completed book/read;
2. most pages in a day;
3. fastest completed reading cycle;
4. longest series marathon;
5. longest reading streak;
6. peak month;
7. shortest completed book.

After eligibility/diversification, take the first up to 4 available record types in that priority order. Within a record type, select the winner deterministically:

- longest completed book: `pagesCount DESC → finishedAt DESC → readingCycleId ASC`;
- most pages in a day: `pagesRead DESC → date DESC`;
- fastest completed cycle: `elapsedDays ASC → finishedAt DESC → readingCycleId ASC`;
- longest series marathon: `marathonLength DESC → marathonEndFinishedAt DESC → seriesId ASC → startReadingCycleId ASC`;
- longest streak: `streakLength DESC → endDate DESC → startDate ASC`;
- peak month: primary approved peak metric DESC → `month DESC`;
- shortest completed book: `pagesCount ASC → finishedAt DESC → readingCycleId ASC`.

If rereads create identical book-length record candidates, the comparator chooses one representative cycle; do not let relation/input order decide it.

## Exact details and pagination

Any exact-detail endpoint/list must have a deterministic default order. If it is paginated/cursor-based, **all semantic sort keys plus the final stable identity key must be part of the database ordering/cursor semantics before `take/limit` is applied**.

A stable post-fetch frontend sort is not a substitute: pagination under a partial order can duplicate or skip rows between pages.

Changing presentation order is allowed only when the endpoint exposes an explicit sort option that itself defines a total order and retains exact subset membership.

## Null handling

Whenever an optional metric participates in sorting, null ordering must be explicit (`NULLS LAST` for descending quality/rating metrics unless a section contract says otherwise). Never let database-default null placement decide a ranking.

## Tests

For every V1 ordered output, add at least one tie fixture that reaches the final stable key. Tests must assert the exact returned ID/key order, not only set membership/count.

At minimum cover:

- equal top ratings on the same finish date;
- equal genre/author frequency;
- equal average rating + sample count;
- equal publisher count/rating including null rating ordering;
- equal language counts under both UI locales;
- equal series activity/progress;
- equal calendar preview pages;
- equal record extrema;
- Insight candidates equal on semantic rank/significance but different `stableKey`;
- paginated exact-detail ties crossing a page boundary.

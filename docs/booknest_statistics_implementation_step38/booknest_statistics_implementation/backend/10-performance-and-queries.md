# Performance and query-plan acceptance

Statistics aggregates can become query-heavy. Correctness comes first, but **performance verification is a required backend acceptance checkpoint**, not an optional follow-up.

The first query-plan candidate is the period-scoped aggregation over `BookReadingProgressEvent`, because the same canonical activity source feeds:

- pages KPI;
- daily/weekly/monthly dynamics;
- active days;
- calendar intensity;
- streaks;
- biggest reading day / activity records;
- comparison-period activity.

## Current `dev` shape to account for

At package preparation time:

- `BookReadingProgressEvent` contains `bookId`, `date`, `pagesRead`;
- it has `@@index([bookId, date])`;
- the event itself does **not** contain `userId`;
- user scoping is available through the related `Book.userId`.

Claude must re-open the current Prisma schema before coding because `dev` can move, but it must not assume a direct event `userId` index exists.

## Repository requirements

- Scope every query by the authenticated user.
- Never aggregate another user's events and filter them later in application code.
- Avoid N+1 for books/authors/series/calendar days. In particular, Calendar Books mode must render from Overview `days[].booksPreview` and must not issue one `/reading-days/:date` request per visible day.
- Prefer grouped SQL/Prisma aggregations when readable and verify the produced database plan for heavy activity queries. Build per-day/per-book preview data in a bounded aggregate query/batch, not a loop of day queries.
- Repository may expose focused aggregate methods; service composes business meaning.
- No Prisma in service.
- Reuse one period-scoped activity dataset/query strategy where practical instead of independently rescanning the same events for every Overview card.
- Full day detail remains lazy after explicit interaction to avoid a giant calendar payload; compact `booksPreview` belongs in Overview.
- Return only compact `bookId/title/coverThumbUrl/pagesRead` metadata needed by the initial calendar/diary preview; do not embed full `BookView` per day.

## Mandatory `BookReadingProgressEvent` query-plan checkpoint

Before backend Statistics is accepted:

1. Identify the actual repository query/query family used for period-scoped reading activity.
2. Verify the SQL/Prisma-generated access path against PostgreSQL with a representative user dataset.
3. Inspect a real query plan using `EXPLAIN (ANALYZE, BUFFERS)` when safe in the test/dev environment, or the closest repository-approved equivalent if the project has an existing query-analysis workflow.
4. Check at minimum:
   - authenticated-user scoping happens in the database;
   - the selected period is applied in the database;
   - there is no accidental full-table event scan caused by application-side filtering;
   - there is no per-book/per-day N+1 query pattern;
   - comparison does not multiply the same expensive scan unnecessarily;
   - rows scanned/filtered and join strategy are reasonable for the available representative data.
5. Record a short implementation note with:
   - query shape inspected;
   - period/data scenario inspected;
   - relevant existing index(es) used or not used;
   - whether a schema/index change was required;
   - result after any change.

Do not invent a universal millisecond SLA in this package: local/test dataset size and hardware differ. The acceptance requirement is an inspected, explainable query plan with no obvious avoidable pathological scan/N+1 behavior.

## Representative scenarios

At minimum inspect the activity aggregation for:

- current-year or last-12-months period;
- comparison enabled;
- all-time or the largest realistically supported period;
- a user with enough books/events to exercise grouping rather than an almost-empty fixture.

If the normal seeded database is too small to reveal the access pattern, add representative data in the test/dev environment according to existing project practices before deciding on an index.

## Index decision rule

Before adding indexes, inspect existing indexes **and the actual query plan**.

Current likely access patterns:

- completed-reading-cycle queries by authenticated user / cycle `finishedAt`;
- progress events by user-owned books + event date;
- current-library books by user + publisher/status/ownership;
- historical completed-cycle metadata snapshot aggregation (authors/genres/publishers/languages/behavioral series) without rejoining mutable current Book relations as the semantic source;
- Series-domain joins/context needed only where canonical structural lifecycle resolution requires them.

For `BookReadingProgressEvent`, the existing `@@index([bookId, date])` is the starting point, not proof that the Statistics query is already optimal.

Add or change an index only when the implemented query + measured plan demonstrates the need. If an index migration is added:

- keep it purpose-specific;
- explain which observed plan problem it fixes;
- rerun the same `EXPLAIN (ANALYZE, BUFFERS)` scenario after the migration;
- verify write/read semantics and user isolation remain unchanged.

Do **not** add speculative indexes merely because a column appears in a filter.

## Caching / precomputation

Do not introduce Redis, materialized Statistics tables, cron precomputation or another cache layer in V1 unless actual measurements and query plans show that efficient database aggregation is still insufficient.

TanStack Query client cache + efficient database aggregation is preferred initially.

## Completion gate

Backend Statistics is **not complete** until:

- functional/integration tests pass;
- `BookReadingProgressEvent` activity aggregation has passed the explicit query-plan checkpoint above;
- any index added for Statistics is justified by before/after plan evidence;
- the final implementation has no known N+1/full-scan issue that should reasonably be fixed before frontend work.

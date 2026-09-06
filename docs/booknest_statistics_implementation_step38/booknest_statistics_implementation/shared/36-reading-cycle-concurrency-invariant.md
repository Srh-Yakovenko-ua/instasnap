# ReadingCycle concurrency and one-active-cycle invariant

## Decision

The V1 reading-cycle model requires **both** application-level serialization and a database-level uniqueness invariant.

Service locking coordinates normal concurrent commands. The database constraint is the final line of defense against races, forgotten call paths and future regressions.

## Application serialization

Every command that can create, reuse, finalize, abandon or otherwise mutate the current cycle must execute as:

`transaction → acquire book lock → load lifecycle state → transition → cycle/progress/event writes → dependent sync → commit`

This applies to:

- `changeReadingStatus`;
- `updateReadingProgress` when it can start/finish reading;
- `startReading`;
- Book update paths containing reading lifecycle data; Book create initializes its first lifecycle atomically inside the create transaction before external visibility;
- bulk reading-status operations;
- explicit historical correction if it affects the current cycle;
- trusted imports that write canonical cycles.

`startReading()` is not exempt merely because it currently accepts an optional transaction client. If a transaction is supplied, acquire the same per-book lock using that client; otherwise open the canonical transaction itself.

## Bulk lock ordering

If a bulk command mutates multiple Books in one transaction, acquire locks in a deterministic stable order (for example canonical `bookId ASC`) to reduce deadlock risk. Do not lock the same set in request order.

## Database invariant

Add a PostgreSQL partial unique index (or exact equivalent supported by the repository's established raw-index pattern) that guarantees no more than one active reading cycle per Book/user ownership boundary.

Conceptually:

```sql
UNIQUE (book_id)
WHERE state = 'active'
```

Use the final physical column/table names from the implemented schema. If user scoping is not structurally guaranteed by the Book FK, include the necessary user key.

The invariant should live with the repository's existing raw partial-index strategy if Prisma cannot represent it faithfully.

## Error handling

A unique-conflict caused by a legitimate start/reread race must be mapped to canonical idempotent behavior where possible:

1. reload the lifecycle under serialization;
2. reuse the already-created active cycle when it represents the same logical command;
3. do not leak a raw Prisma/Postgres error to the client.

Do not silently swallow conflicts that reveal a genuinely invalid transition.

## Migration safety

Before creating the unique index:

- reconcile/backfill cycle rows;
- assert there are no duplicate active cycles;
- fail migration verification if duplicates exist rather than choosing one arbitrarily.

Follow repo migration rules: create-only migration, review generated SQL, preserve unrelated raw indexes, then deploy.

## Tests

Include concurrency/retry tests for:

- two simultaneous `startReading` calls;
- two simultaneous reread starts;
- finish racing with progress update;
- bulk mutation versus single-book mutation on the same Book;
- unique-index conflict mapping/reload behavior;
- migration reconciliation detects duplicate active cycles.

## Do not do

- Do not rely only on `SELECT` then `INSERT` without lock/constraint.
- Do not rely only on a DB unique index while normal service transitions race unnecessarily.
- Do not assume `startReading` is safe because other ReadingService methods already lock.
- Do not remove unrelated partial/raw indexes from generated migrations.

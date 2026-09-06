# Reading statistics backend — implementation notes

These notes cover the backend half of the Statistics work: the reading-cycle history that had to
exist first, and the `/api/statistics` endpoints built on top of it. The frontend is not built yet.

## Why reading cycles came first

`BookReadingProgress` is one mutable row per book. It answers "where am I in this book right now",
which is the wrong question for statistics. Starting a reread cleared `finishedAt`, and a reset
deleted every progress event for the book, so last year's numbers could change because of something
you did today.

`BookReadingCycle` is the ledger that was missing: one row per read-through, terminal states are
never rewritten by ordinary reading commands, and each finished cycle carries a frozen copy of the
book metadata as it was on the day the read ended. Statistics reads cycles. The mutable snapshot
keeps serving the book page.

## What the write path looks like now

Every path that can change reading state goes through `ReadingLifecycleCoordinator`:

- `BookReadingService.changeReadingStatus` / `updateReadingProgress` / `startReading`
- `BooksService.create` and `BooksService.update`
- `BulkBooksService.setReadingStatus`, one book at a time in `bookId` order

The coordinator runs inside the caller's transaction, after the per-book advisory lock, and decides
what happens to the cycle: reuse the active one, start a new one, finalize the active one, edit the
latest terminal one, or do nothing. Repeating the same command does not produce a second cycle, and
a book can never hold two active cycles at once — the application lock is the everyday guard, and
the partial unique index `book_reading_cycles_active_book_idx` is the one that catches a write path
someone forgets to route through the coordinator.

Reset no longer deletes reading events. Removing a genuinely mistaken event is now its own explicit
action: `DELETE /api/books/:id/reading-events/:eventId`.

## Dates

Implicit reading dates used to be resolved in UTC, so someone reading late in the evening in Kyiv
could have it recorded as the next day. `UserSettingsContextService.today(userId)` now resolves the
default date in the reader's own timezone. Dates already stored keep their labels: a `@db.Date` is a
calendar label, not an instant, and nothing timezone-shifts it after the fact.

## Reading goals

Goals used to count a book from the mutable `BookReadingProgress.finishedAt`, which meant starting a
reread could uncount a book that had genuinely been finished. A book now qualifies from the earliest
finished cycle inside the goal window, the chosen cycle id is stored in
`reading_goal_books.qualified_reading_cycle_id`, and the book counts once no matter how many times it
is reread. Every goal formula still lives in `reading-goals`; only the input changed.

## Migrations

Three, applied in order:

1. `20260902200322_add_reading_cycle_history` — additive only. New tables, two nullable columns, no
   drops. The two spurious trigram `DROP INDEX` lines Prisma generates were stripped before deploy.
2. `20260902210000_backfill_reading_history_provenance` — records the cutover instant per user,
   creates at most one legacy finished cycle per book that already had a finish date, and points
   existing goal qualifications at their cycle. Idempotent: `legacy_source_key` makes a rerun a
   no-op, and existing provenance rows are never refreshed.
3. `20260902211500_add_reading_cycle_active_invariant` — the partial unique index, created only
   after reconciliation confirmed zero books with two active cycles.

Backfilled cycles are marked `legacy_current_metadata` and `first_known_only`. They are the earliest
completion BookNest knows about, not proof of a first-ever read, so discoveries, structural series
milestones and TBR forecasts exclude them rather than inventing a transition.

## Query plan check

Measured on the local dev database seeded to 400 books, 400 finished cycles and 124,800 progress
events, after `ANALYZE`.

| Query                            | Access path                                                      | Time     |
| -------------------------------- | ---------------------------------------------------------------- | -------- |
| Day aggregation, current year    | Nested loop, `book_reading_progress_events_book_id_date_idx`     | 1.6 ms   |
| Day aggregation, all time        | Seq scan + hash join                                             | 123.6 ms |
| Per-day book previews, 12 months | Seq scan + hash aggregate + window                               | 11.8 ms  |
| Finished cycles in period        | Bitmap index scan, `book_reading_cycles_user_id_finished_at_idx` | 0.4 ms   |

User scoping and the period filter both happen in the database. There is no per-day or per-book
query loop: the calendar preview is one window function over one bounded scan, and the day-details
endpoint is only called after someone opens a day.

**No index was added.** The existing `@@index([bookId, date])` already backs the bounded-period path,
and the all-time query legitimately reads every event the reader owns, so no index can shorten it.
The 12-month preview does discard 123,957 of 124,800 rows, which is the one place worth re-measuring
if a reader ever reaches roughly ten times this much history.

## What stays unavailable in V1

- **TBR flow** (`inflow` / `outflow` / `netChange`) — `HISTORY_NOT_TRACKED`. No ownership transition
  history exists, and `Book.updatedAt` is not a substitute.
- **Formats** — not in the response at all. `Book.formats[]` records which formats exist, not which
  one was read.
- **Favorites** — deliberately out of the ratings section until the product decides what a favorite
  means over a time period.
- **Structural series lifecycle and discoveries** — returned as `unavailable` when any completion in
  the period is a legacy backfill, because first-ever status cannot be proven for those.

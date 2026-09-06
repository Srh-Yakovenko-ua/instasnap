-- A book can be part-way through at most one read-through at a time. Prisma cannot express the
-- WHERE clause, so the invariant lives here as a raw partial unique index and is asserted by
-- core/database/raw-sql-indexes.test.ts. Per-book serialization in the reading lifecycle
-- coordinator handles ordinary concurrency; this index is what catches a forgotten write path.
-- Reconciliation ran before this migration and found no book with two active cycles.
CREATE UNIQUE INDEX book_reading_cycles_active_book_idx
  ON book_reading_cycles (book_id)
  WHERE state = 'active';

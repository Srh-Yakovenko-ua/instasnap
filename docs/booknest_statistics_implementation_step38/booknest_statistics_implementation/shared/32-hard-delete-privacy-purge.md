# Hard delete and privacy-purge semantics

Soft delete and permanent data erasure have intentionally different Statistics semantics. `shared/18-soft-deleted-book-eligibility.md` preserves historical reading facts after `Book.deletedAt`; this document defines what happens when the underlying user/book data is **actually hard-deleted/purged**.

## Core distinction

### Soft delete

`Book.deletedAt != null`:

- current library snapshot excludes the Book;
- historical cycles/events/snapshots remain;
- historical Statistics remains reproducible.

### Hard delete / privacy purge

Permanent erasure of the Book/account is an explicit destructive operation:

- canonical ReadingCycle rows for the purged entity are deleted;
- cycle completion metadata snapshots are deleted with them;
- progress events are deleted;
- Statistics no longer includes those facts;
- any persistent derived/cache material owned by Statistics is also deleted/invalidated.

A privacy purge is allowed to rewrite historical Statistics because its purpose is permanent data erasure. It is not the same operation as ordinary soft delete/reset/history correction.

## Book FK semantics

Recommended relational behavior for ReadingCycle/event ownership:

- normal `Book.deletedAt` does not touch FK rows;
- **actual hard deletion of a Book** cascades/deletes the Book-owned reading cycles/events/snapshots rather than leaving historical snapshot content orphaned indefinitely.

If project conventions require service-level explicit deletion rather than DB cascade, the resulting semantics must be equivalent and transactional.

Do not choose `SET NULL` merely to preserve Statistics after a true privacy purge.

## User/account purge

Permanent user/account deletion must remove all user-owned Statistics source data, including:

- `BookReadingCycle`;
- completion metadata snapshots;
- `BookReadingProgressEvent`;
- mutable `BookReadingProgress`;
- Books/current library data;
- Reading Goals and any Statistics-specific persisted helper rows if later introduced.

The purge path must not retain fallback snapshot titles/author/publisher labels in a separate Statistics table after the owning user is erased.

## No new hard-delete UX required

Statistics does not require adding a new “permanently delete reading history/book” UI if the product does not already expose one. This contract constrains existing/future hard-delete/account-purge infrastructure and FK choices.

Historical correction remains a separate capability from whole-entity privacy purge.

## Cache / generated data

V1 should not introduce persistent aggregate caches solely for Statistics. If such materialized/cache storage is added later, permanent purge must evict/delete user/book-derived entries. Ordinary in-memory/TanStack Query cache is invalidated normally and is not a historical source of truth.

## Backfill / migration logs

Migration/backfill observability must avoid logging unnecessary private book metadata. Counts and technical IDs are preferred. A purge must not depend on parsing historical logs to reconstruct deleted data.

## Referential integrity

Before choosing Prisma `onDelete` behavior, audit existing Book/User deletion conventions. The invariant is:

```text
soft delete => history preserved
hard delete/privacy purge => owned history erased
```

Do not create a FK configuration that makes ordinary Book hard deletion fail because immutable Statistics rows cannot be removed, and do not cascade on soft-delete state changes (which are not FK deletes).

## Idempotency

Permanent purge should be retry-safe: a repeated purge finds no remaining owned rows and succeeds/no-ops rather than recreating data or failing on already-deleted child rows.

## Tests

1. soft delete → historical Statistics unchanged;
2. restore soft-deleted Book → no duplicate historical rows;
3. hard delete Book → its cycles/events/snapshots disappear from Statistics;
4. account purge → no user-owned cycle/event/snapshot remains;
5. repeated purge is idempotent;
6. another user's similarly named Book/history is untouched;
7. generated/cache data, if any exists, cannot resurrect purged history.

## Do not do

- Do not preserve user-identifying completion snapshots after a true privacy purge solely to keep aggregate history pretty.
- Do not treat soft delete as privacy purge.
- Do not add permanent-delete UI solely because Statistics introduced immutable history.
- Do not let a hard purge leave orphan cycle metadata that can still be surfaced by Statistics.

# Reading lifecycle write-path integration

## Decision

`BookReadingCycle` becomes a canonical Books/Reading domain fact. Therefore **no backend write path may mutate reading lifecycle state or lifecycle-owned progress independently of the cycle-aware transition flow**.

Statistics must not be implemented by patching only `BookReadingService`. The current `dev` has other write paths that can change `readingStatus` / `readingProgress`, including ordinary Book create/update and bulk reading-status mutation. Those paths must be brought under one invariant before completion-based Statistics is enabled.

## Current-dev audit targets

At minimum audit and adapt:

- `BooksService.create()`;
- `BooksService.update()`;
- `BookReadingService.changeReadingStatus()`;
- `BookReadingService.updateReadingProgress()`;
- `BookReadingService.startReading()`;
- `BulkBooksService.setReadingStatus()`;
- imports / seed / fixtures / trusted correction paths that can write reading lifecycle fields directly;
- repository methods that currently accept `readingStatus` or `readingProgress` patches without cycle orchestration.

Do not assume this list is complete: use `/blast-radius` against shared DTOs, repository signatures and Prisma fields before implementation.

## Canonical orchestration boundary

Introduce or reuse one focused application/domain integration boundary for lifecycle mutations, for example a `ReadingLifecycleCoordinator`-style service. The exact class name is not prescribed; the invariant is.

The coordinator owns the ordered operation for an **existing Book**:

1. resolve authenticated-user local effective date;
2. acquire the per-book lifecycle serialization mechanism;
3. load canonical current Book + current progress + current active cycle;
4. validate the requested transition;
5. create/reuse/finalize/abandon the canonical cycle;
6. update mutable `BookReadingProgress` / `Book.readingStatus` snapshot;
7. record cycle-scoped progress event(s) if the command represents reading activity;
8. capture immutable completion metadata when a cycle becomes `finished`;
9. recompute dependent domains such as Reading Goals from canonical cycle facts;
10. return/assemble the resulting Book state.

Application callers may supply an existing transaction client when they are already inside a larger atomic Book mutation. Do not make application services call controllers or HTTP endpoints internally.

## Book create

Creating a Book with an initial reading state must obey the same lifecycle semantics.

Examples:

- create as `not_started` / `want_to_read` → no active cycle unless canonical domain rules explicitly require one;
- create as `reading` / `paused` → create one canonical active cycle and current progress snapshot;
- create as `finished` with a reliable finish date → create/finalize one canonical finished cycle and completion snapshot atomically;
- create as `dnf` → create/finalize the appropriate DNF cycle when the supplied state represents a real reading attempt.

Do **not** persist `Book.readingStatus = finished` + `BookReadingProgress.finishedAt` without a corresponding canonical finished cycle.

## Book update

`BooksService.update()` may continue to own unrelated scalar/relations/ownership changes, but reading lifecycle fields must be delegated through the canonical lifecycle boundary inside the same transaction.

Do not allow `resolveReadingProgressBlock()` or repository update payloads to become an alternate lifecycle state machine once cycles exist.

Metadata edits that do not change reading lifecycle remain ordinary Book updates. If the update simultaneously changes metadata and finishes a cycle, completion snapshot capture must use the intended committed metadata in a deterministic order inside the same transaction.

## Bulk reading status

Bulk reading-status mutation must not bypass cycle semantics with one blind `UPDATE books SET reading_status = ...`.

V1 acceptable implementation:

- resolve the owned target book ids;
- execute per-book lifecycle transitions through the same canonical coordinator;
- preserve one transaction where practical, but still acquire deterministic per-book locks in a stable order;
- return the actual successfully affected count;
- do not create duplicate cycles under retries.

If a bulk target status requires per-book data that the bulk command does not supply (for example a finish date/rating/progress detail), either use a documented canonical default or reject that target for bulk rather than inventing inconsistent history.

## Repository invariant

After this prerequisite lands, repository methods should not expose a convenient public path that can independently mutate lifecycle-owned fields while skipping cycle orchestration.

Keep low-level repository primitives available only where needed by the canonical coordinator/migration/correction layer. Do not duplicate transition logic in repositories.

## Tests

Cover at least:

1. create Book already finished → exactly one finished cycle + snapshot;
2. update Book status to finished → exactly one finished cycle;
3. update unrelated metadata → no cycle mutation;
4. `startReading` → one active cycle;
5. bulk set reading status → per-book canonical cycle transitions;
6. retry the same create/update/bulk logical command where idempotency applies → no duplicate cycle;
7. every public mutation route capable of changing reading lifecycle leaves Book snapshot and cycle ledger consistent;
8. `/blast-radius` finds no remaining unsupported direct lifecycle writer.

## Do not do

- Do not implement cycle history only inside Statistics queries.
- Do not leave `BooksService.create/update` as a second lifecycle implementation.
- Do not leave bulk status as a blind repository update after cycles are introduced.
- Do not call HTTP/controller code from another backend service.
- Do not force unrelated Book metadata mutations through reading lifecycle code when they do not touch lifecycle fields.

### Create-path atomicity note

A brand-new Book does not need to lock a pre-existing row before it exists. Initialize its first lifecycle/cycle state **inside the same Book-create transaction before commit/external visibility**. Once the Book exists, every subsequent lifecycle mutation uses the canonical per-book serialization boundary. The DB one-active-cycle invariant still applies.

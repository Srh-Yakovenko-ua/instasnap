# Explicit reading-history correction capability

## Decision

Because ordinary reset no longer deletes historical activity, V1 backend prerequisites must provide a **narrow explicit correction capability** for genuinely mistaken reading-history facts.

This is a correction tool, not a second general-purpose editing system and not an ordinary reset mode.

## Minimum V1 scope

Support explicit correction of a concrete owned reading-history fact by stable id:

- delete/correct a mistaken `BookReadingProgressEvent`;
- correct/remove a finished cycle only when the product/API explicitly addresses that cycle;
- correct cycle date/rating metadata only through a cycle-targeted command if such editing is included in the existing UX/API scope.

The minimum required capability for the Statistics prerequisite is **event correction/removal**, because users can otherwise be left with an accidentally over-recorded pages/calendar fact that ordinary reset intentionally preserves.

Do not add a broad free-form "rewrite my history" endpoint.

## Suggested API shape

Follow existing Books routing conventions. A narrow route may be conceptually equivalent to:

`DELETE /api/books/:bookId/reading-events/:eventId`

The exact controller path may adapt to current route structure. The semantics must remain exact-id correction, authenticated ownership-scoped and non-fuzzy.

If finished-cycle correction is exposed, target `readingCycleId` explicitly rather than "latest read".

## Authorization and validation

- authenticated user must own the Book/history fact;
- event/cycle id must belong to that Book;
- do not accept arbitrary `userId` from the client;
- reject correction of another user's history;
- correction must use the same transaction/serialization rules when it can affect current lifecycle state.

## Dependent-domain recomputation

After a successful correction, recompute/invalidate the affected derived state:

- Reading Goals qualification if a finished cycle is corrected;
- Statistics cache;
- Reading History view;
- any current progress snapshot if the corrected fact is explicitly current-state relevant.

Deleting an event changes pages/calendar/streak facts. It does not automatically delete a finished cycle unless the correction command explicitly targets that cycle and domain validation allows it.

## Auditability

Prefer retaining enough correction provenance to distinguish normal lifecycle writes from deliberate correction in tests/debugging. Do not introduce a heavy generic audit-log platform solely for this feature.

## Frontend scope

A full new correction UI is not required for the Statistics Overview itself. If an existing Reading History/detail surface can expose the action safely, reuse it. Otherwise the backend capability may be implemented as prerequisite plumbing and surfaced in a later focused UX task.

The absence of a new Statistics correction UI must not cause ordinary reset to regain destructive history semantics.

## Tests

- exact event correction removes only that event;
- wrong Book/event pair rejected;
- other-user correction rejected;
- correction invalidates/recomputes Statistics;
- correction does not erase unrelated events/cycles;
- repeated delete/correction has documented idempotent/not-found semantics;
- finished-cycle correction updates Reading Goals through canonical cycle qualification.

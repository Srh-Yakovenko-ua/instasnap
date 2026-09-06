# Reading activity event history

`BookReadingProgressEvent` is the canonical source for historical pages/activity/calendar/streak facts. Once an event represents real reading activity, an ordinary current-progress reset MUST NOT erase it.

## Canonical rule

Separate **current progress state** from **historical reading activity**:

- `BookReadingProgress.page` / current status may be reset for the active book UI;
- the current unfinished `BookReadingCycle` may be abandoned as a current-session lifecycle action;
- already persisted reading activity events remain historical facts and continue to contribute to pages, active days, calendar, streaks and day details.

A reset is not a history-correction command.

## Reset semantics

For ordinary `resetProgress` / return-to-`not_started` / return-to-`want_to_read` behavior:

1. reset mutable current-page/progress state as required by Books UX;
2. close/finalize the current unfinished cycle as `abandoned` according to the ReadingCycle state machine;
3. **do not delete cycle-owned progress events** that record actual activity;
4. do not delete legacy unassigned activity events;
5. future reading may start a new cycle while prior activity remains historically visible.

A abandoned cycle is not a `completedRead`, but its valid pages/activity events remain activity facts.

## Explicit correction is separate

If an event was entered by mistake and must be removed from historical Statistics, V1 backend prerequisites provide the narrow explicit correction/delete-reading-activity capability in `shared/38-reading-history-correction-capability.md`, with ownership authorization, exact event scope and dependent invalidation. Ordinary reset never performs this correction.

Until such a capability exists, Statistics MUST prefer preserving recorded activity over silently deleting history through reset.

Do not overload ordinary reset with “erase my reading history”.

## Aggregation rules

Global historical activity metrics consume valid reading events regardless of whether their owning cycle later becomes `finished`, `dnf` or `abandoned`, unless the event itself is explicitly corrected/deleted by a canonical history-correction action.

This applies to:

- `pagesRead`;
- active days;
- heatmap/calendar intensity;
- current/longest streak;
- most active weekday;
- biggest reading day;
- per-day book previews/details.

Completion metrics remain cycle-state-specific and are independent of this rule.

## Current-page recomputation

Do not reconstruct the current mutable page from all historical events after reset. Current progress snapshot and historical event ledger have different responsibilities.

## Migration

- stop current book-wide `deleteMany({ bookId })` behavior before Statistics relies on event history;
- do not backfill events that earlier resets already deleted;
- do not pretend pre-existing event history is complete if destructive resets were possible; quality for legacy activity is handled separately by the legacy activity-history contract;
- existing surviving events are preserved as historical activity facts.

## Tests

Cover at minimum:

1. read pages on day A → reset current progress → day A pages remain in Statistics;
2. reset unfinished cycle → no completed read is created;
3. start a new cycle after reset → old activity + new activity both remain in page/calendar totals;
4. the required explicit event-correction capability removes only the targeted event and invalidates Statistics; see `shared/38-reading-history-correction-capability.md`;
5. reset never deletes finalized-cycle or legacy-unassigned events;
6. cross-user isolation.

## Do not do

- Do not delete current-cycle events as a side effect of ordinary reset.
- Do not equate “reset current progress” with “erase historical reading activity”.
- Do not exclude activity solely because its cycle ended `dnf`/`abandoned`.
- Do not recreate current progress by summing the immutable historical ledger.

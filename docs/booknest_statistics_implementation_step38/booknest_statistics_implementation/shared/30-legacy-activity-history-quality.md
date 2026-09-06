# Legacy reading-activity history quality

Before `shared/27-reading-activity-event-history.md` is deployed, ordinary resets could delete `BookReadingProgressEvent` rows. Therefore surviving legacy events are real observed activity facts, but their absence does not prove that no reading occurred. Statistics MUST expose this limitation instead of presenting pre-cutover pages/calendar/streaks as exact history.

## Stable reliability boundary

Record one canonical **activity-history reliability cutover date** when destructive event deletion has been removed from all canonical write paths. Recommended semantic name:

```ts
activityHistoryReliableFrom: isoDay;
```

The value is a system/data-migration provenance boundary, not “the earliest event currently in the table”. It must be stable across requests/deploys.

Do not derive it dynamically from `MIN(event.date)`.

## History-quality primitive

Expose a small quality object for activity-derived Statistics, preferably under Overview `meta`:

```ts
activityHistory: {
  reliableFrom: isoDay;
  selectedPeriodQuality: 'exact' | 'legacy_lower_bound';
  reason?: 'LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED';
}
```

`selectedPeriodQuality = exact` only when every day in the normalized selected period that can affect activity metrics is on/after `reliableFrom`.

If the selected period includes any earlier date, the activity ledger is `legacy_lower_bound`. Surviving events before the boundary are still truthful observed activity; missing events are unknowable.

This is **not** `StatisticsCoverage`. The number of deleted legacy events is unknowable, so do not invent `knownCount / eligibleCount / percent`. Keep the shared availability/coverage contract intact for population-subset completeness.

## Metric behavior in a legacy-lower-bound period

### Monotonic metrics may be shown as lower bounds

The following recorded values may be returned, but the frontend must communicate lower-bound semantics (for example `≥ 12 430 сторінок` or helper `Історія до 2 вер. 2026 могла бути неповною`):

- pages read;
- recorded active-day count;
- observed longest streak;
- active-day percentage based on surviving active days **when the denominator range is explicit/finite** (lower bound for that returned range).

Their true historical values can only be equal or higher than the recorded lower-bound values.

### Non-monotonic/ranking activity metrics

Metrics whose identity may change when missing events are restored MUST NOT be presented as exact for a period overlapping unreliable history. Examples:

- most active weekday;
- peak month if based on progress events and old months overlap unreliable history;
- any “best/most” ranking where missing legacy events could change the winner.

Return those nested metrics as `unavailable` with reason `LEGACY_HISTORY_INCOMPLETE`, unless the specific metric is scoped entirely to dates on/after `reliableFrom`.

### Current streak

`currentStreak` may be exact only when the recent day window required to decide it is reliable. Because current-streak grace considers today/yesterday, require the necessary today/yesterday dates to be on/after `reliableFrom`; otherwise return `unavailable + LEGACY_HISTORY_INCOMPLETE`.

If the observed current streak reaches the reliability boundary, set canonical `currentStreak.data.continuesBeforeReliableHistory = true` rather than claiming that the boundary is the true start.

## Calendar day cells

Calendar `days[]` must distinguish reliable zero from legacy unknown. Add a per-day quality signal or an equivalent range-level rule consumable by the frontend:

```ts
{
  date: isoDay,
  pagesRead: number,
  booksCount: number,
  intensity: number,
  historyQuality: 'exact' | 'legacy_observed_only'
}
```

For `date < reliableFrom`:

- positive recorded activity is a real observed fact;
- `pagesRead = 0` does **not** mean proven no reading;
- UI must not render old zero cells with the same “known empty day” semantics as reliable dates.

The implementation may encode this efficiently using `reliableFrom` instead of repeating the field on every row, as long as the generated contract/frontend behavior remains unambiguous.

## All-time behavior

All-time completion metrics may be handled separately by ReadingCycle quality. For **activity-derived** metrics:

- include surviving legacy events as observed historical facts;
- mark the selected activity history `legacy_lower_bound` when the lifetime period extends before `reliableFrom`;
- the visible recent 12-month calendar is exact once its `displayRange.from >= reliableFrom`;
- do not claim that the earliest surviving legacy event marks the true beginning of tracked reading activity.

Calendar summary fields whose selected/lifetime metric scope crosses the unreliable boundary follow the lower-bound/unavailable rules above.

## Relation to availability/coverage

Do not weaken `shared/09-availability-and-coverage-contract.md` by inventing a fake percentage for lost events. Temporal event-ledger completeness uses this dedicated quality object. A nested metric may still use normal `availability` when it is semantically impossible to return safely (for example most active weekday over incomplete legacy history).

## Migration

- record/persist the reliability cutover as part of `shared/29-reading-history-migration-rollout.md`;
- do not backfill deleted events from `Book.updatedAt`, page count, completion dates or inferred averages;
- surviving legacy events remain read-only historical facts;
- after cutover, ordinary reset cannot reduce history completeness.

## Tests

1. selected period wholly after reliableFrom → exact activity quality;
2. period crossing reliableFrom → legacy lower bound;
3. pre-cutover positive event remains visible;
4. pre-cutover zero day is not presented as proven no-reading;
5. pages/activeDays/longestStreak lower-bound presentation;
6. most-active-weekday unavailable when missing legacy events could alter the winner;
7. current streak unavailable when required today/yesterday window crosses the reliability boundary;
8. recent All-time display window after cutover can be exact while lifetime activity summary remains lower-bound;
9. changing current Book metadata does not affect this quality boundary.

## Do not do

- Do not define reliable history as starting at `MIN(BookReadingProgressEvent.date)`.
- Do not treat missing pre-cutover events as known zeroes.
- Do not invent a numeric coverage percentage for events that may have been deleted.
- Do not discard surviving legacy events merely because the ledger is incomplete.

For All-time Calendar, the finite `metricRange` returned by the Calendar contract makes the displayed percentage a lower bound for that explicit observed window; do not label it as a precise lifetime rate before the event-history reliability boundary.

## Physical source of `reliableFrom`

The concrete persistence/source contract is `shared/39-activity-history-reliability-source.md`. Read `reliableFrom` from persisted per-user Reading-history provenance. Do not implement this document with an environment constant, deploy wall-clock calculation on every request, profile-editable setting or event-table minimum.

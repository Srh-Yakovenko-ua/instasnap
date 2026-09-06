# Persistence source for `activityHistoryReliableFrom`

## Decision

`activityHistoryReliableFrom` must be a persisted Reading-domain provenance value, not a runtime constant, deployment-time guess or `MIN(event.date)` query.

Use a small per-user reading-history state record (exact model name may follow repo conventions), conceptually:

```ts
UserReadingHistoryState {
  userId: string;
  activityReliableFrom: DateOnly;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

`userId` is unique/primary and ownership-scoped.

This is **Reading history provenance**, not a Statistics preference. Do not put it in `UserProfileSettings` as a user-editable field.

## Why per user

The cutover is a deployment/system event, but reliability is defined in stored **user-local date labels**. A user-local day that contains time before the canonical event-preservation rollout is not fully reliable.

During rollout, derive a conservative first fully reliable local calendar date for each user from:

- one recorded migration/cutover instant;
- the user's canonical timezone at rollout;
- the first full local day after that instant.

Persist the resulting date. Later timezone changes do not rewrite it or historical event dates.

## New users

Users created after the canonical activity-history rollout receive `activityReliableFrom` equal to their first applicable local calendar date under the canonical write system. The exact creation hook may be lazy/on-demand as long as the persisted result is deterministic and does not move between requests.

## Existing users / migration

Rollout procedure:

1. record a single explicit canonical cutover instant for the migration/deployment;
2. enumerate existing users/profile timezones through a controlled idempotent backfill;
3. compute the conservative first full local date after cutover;
4. upsert `UserReadingHistoryState` only when missing;
5. never refresh the date on rerun;
6. reconcile that every user who can request Statistics has a state row before enabling activity-history quality logic.

Do not derive this boundary from earliest/latest event data.

## API

Statistics reads this state and exposes it through:

```ts
meta.activityHistory.reliableFrom;
```

according to `shared/30-legacy-activity-history-quality.md`.

Missing state after rollout is an internal data-integrity problem, not `null = exact`. Fail safely / return explicit unavailable quality rather than inventing a boundary.

## Privacy purge

Account hard-delete/privacy purge removes the owned reading-history-state row together with cycles/events/snapshots.

## Tests

- timezone ahead of UTC at cutover → next full local day persisted;
- timezone behind UTC → next full local day persisted;
- rerun backfill → value unchanged;
- later timezone change → reliableFrom unchanged;
- new user gets deterministic state;
- Statistics meta reads persisted value;
- missing required state does not silently produce exact quality.

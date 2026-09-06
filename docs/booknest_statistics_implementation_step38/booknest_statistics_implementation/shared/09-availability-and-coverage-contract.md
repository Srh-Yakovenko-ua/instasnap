# Canonical availability and coverage contract

This file defines the single data-quality language for all Statistics sections.

## Shared primitives

Create reusable Zod schemas in `packages/shared`:

```ts
StatisticsAvailabilitySchema = z.enum(["available", "partial", "unavailable"]);

StatisticsCoverageSchema = z.object({
  eligibleCount: z.number().int().nonnegative(),
  knownCount: z.number().int().nonnegative(),
  percent: z.number().min(0).max(1).nullable(),
});
```

Validation/domain invariants:

- `knownCount <= eligibleCount`;
- `percent === null` only when `eligibleCount === 0`;
- otherwise `percent = knownCount / eligibleCount`;
- do not store/render a second percent with different denominator semantics under the same name.

A section/metric may compose these fields directly or through a small shared quality object:

```ts
{
  availability: "available" | "partial" | "unavailable";
  coverage?: StatisticsCoverage;
  reason?: SectionSpecificReasonCode;
}
```

Do not make one giant global reason enum. Reasons remain typed per section/metric, while `availability` and `coverage` are globally consistent.

## State semantics

### `available`

Use when the requested metric can be derived reliably for its intended semantics.

Examples:

- completed reads = `0` and unique completed books = `0` in an empty period;
- pages = `0` when reliable activity history exists and there was genuinely no reading activity;
- discoveries = empty array when there were genuinely no discoveries.

A known zero is still `available`.

### `partial`

Use when a reliable statistic can be calculated from a known subset, but not from the whole eligible population. `coverage` is mandatory.

Examples:

- average rating from 28 rated completed reads out of 37 completed reads;
- language distribution for 20 completed reads whose historical completion snapshots contain a valid canonical edition language out of 37 eligible reads (for example after conservative legacy backfill);
- publisher rating derived from the rated subset when the section still has enough sample to show it.

The UI must make the subset clear (`28 із 37 оцінено`; for a genuinely incomplete legacy language snapshot, `20 із 37 історичних читань мають надійно збережену мову видання`). Language coverage measures snapshot completeness only; it must not be used as a proxy for whether the current default `ukrainian` was manually confirmed. Percentages that describe categories use `knownCount` as their denominator unless the metric definition explicitly says otherwise.

### `unavailable`

Use when the intended metric cannot be derived reliably. The metric data/value is `null`/omitted, never `0`. A typed reason is required. `coverage` may still be returned when it helps explain the failure.

Examples:

- average rating when `knownCount = 0`; reason `NO_RATINGS`;
- an activity-derived nested metric that cannot be interpreted safely because selected legacy history is incomplete may be `unavailable` with typed reason `LEGACY_HISTORY_INCOMPLETE`; event-ledger temporal completeness itself follows `shared/30-legacy-activity-history-quality.md`;
- historical TBR flow when lifecycle transitions are not tracked; reason `HISTORY_NOT_TRACKED`;
- optional reading-format analytics, if that capability is exposed at all, when its canonical source becomes incomplete/unreliable; reason `READ_FORMAT_SEMANTICS_UNRELIABLE`. Guaranteed V1 does not need to expose/render a Formats section merely to return this unavailable state;
- top-rated-by-genre/publisher when sample is below the documented minimum; reason `INSUFFICIENT_SAMPLE`.

## Zero vs unavailable

These must never collapse into the same payload or UI:

```ts
// known zero
{ availability: "available", value: 0 }

// cannot know reliably
{ availability: "unavailable", value: null, reason: "LEGACY_HISTORY_INCOMPLETE" }
```

## Coverage examples

Ratings for 28 of 37 completed reads:

```json
{
  "availability": "partial",
  "coverage": {
    "eligibleCount": 37,
    "knownCount": 28,
    "percent": 0.7568
  }
}
```

Language metadata for every completed read:

```json
{
  "availability": "available",
  "coverage": {
    "eligibleCount": 37,
    "knownCount": 37,
    "percent": 1
  }
}
```

No eligible completed reads:

```json
{
  "availability": "available",
  "coverage": {
    "eligibleCount": 0,
    "knownCount": 0,
    "percent": null
  }
}
```

The section may then render a normal empty-period state; this is not missing data.

## Frontend rule

Frontend consumes the backend state; it does not infer availability from `null`, array length, or coverage percentage. One shared presentation helper/component may map:

- `available` → normal content/known empty state;
- `partial` → content + coverage caption;
- `unavailable` → `—`/section unavailable state + localized reason.

Never silently hide `partial` data quality when it materially changes interpretation.

## Conditional current-context metrics

The same vocabulary may be used by a nested metric whose applicability depends on period context. Example: Calendar `currentStreak` for a closed historical period returns `availability = unavailable`, `data = null`, reason `PERIOD_NOT_CURRENT`. This is **not** missing data and must not be rendered as zero/error; it means the metric is not semantically applicable to that period. A current period with no live streak is instead `available` with a known zero. See `shared/20-calendar-streak-period-semantics.md`.

## Temporal history completeness is separate

Legacy activity events are a special case where missing-row count is unknowable because earlier reset behavior could delete events. Do not violate the `partial => coverage` invariant by inventing a percentage. Activity-derived temporal completeness is represented separately by `shared/30-legacy-activity-history-quality.md`. Nested metrics that cannot be safely interpreted may still return normal `unavailable + LEGACY_HISTORY_INCOMPLETE`.

After the mandatory activity-history prerequisite exists, a fully reliable selected period with zero progress-event rows is an **available known zero** for pages/activity. Do not use `NO_PROGRESS_EVENTS` merely because the query returned no rows. Pre-cutover ambiguity is represented by `meta.activityHistory` and, where necessary, nested `LEGACY_HISTORY_INCOMPLETE`.

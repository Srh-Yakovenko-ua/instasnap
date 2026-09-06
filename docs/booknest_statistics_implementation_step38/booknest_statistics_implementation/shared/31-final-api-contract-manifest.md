# Final Statistics API / Zod contract manifest

This file is the field-naming and composition authority for the V1 Statistics HTTP contract. Per-section schemas remain split into focused files in `packages/shared`; this manifest prevents documentation/examples from drifting into alternate aliases.

## Source of truth

Implementation order of authority:

1. shared Zod schemas in `packages/shared`;
2. this manifest / metric dictionary;
3. response examples.

Maintain full contract fixtures in tests that parse through the actual Overview Zod schema. Documentation may contain clearly labelled partial semantic snippets, but every shown field must match its corresponding shared sub-schema. Do not treat a partial snippet as an alternate DTO. OpenAPI/Orval is generated from the shared/controller contract; frontend does not hand-write a parallel DTO.

## Top-level Overview keys

Guaranteed V1:

```ts
{
  (meta,
    period,
    comparison,
    hero,
    kpis,
    insights,
    dynamics,
    calendar,
    goal,
    ratings,
    genres,
    authors,
    publishers,
    languages,
    discoveries,
    series,
    libraryBalance,
    records);
}
```

`formats` is optional only after the capability gate from `shared/11-reading-format-capability.md`; it is not a guaranteed V1 key.

Do not add alternate top-level aliases such as `readingStats`, `favorites`, `tbr`, `readingGoal` or `calendarSummary`.

## `meta`

```ts
meta: {
  generatedAt: isoDateTime;
  timezone: string;
  weekStartDay: 'monday' | 'sunday';
  activityHistory: {
    reliableFrom: isoDay;
    selectedPeriodQuality: 'exact' | 'legacy_lower_bound';
    reason?: 'LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED';
  };
}
```

No `dataVersion` in V1. No duplicate `calendar.weekStartDay`.

## `period` and `comparison`

Normalized effective contract:

```ts
period: {
  kind: 'year' | 'last_12_months' | 'custom' | 'all_time';
  from: isoDay | null;
  to: isoDay;
  granularity: 'day' | 'week' | 'month';
}

comparison: null | {
  mode: 'previous_period' | 'same_period_last_year';
  from: isoDay;
  to: isoDay;
}
```

`comparison === null` is the single representation of comparison OFF/unavailable. Do not duplicate `period.comparisonEnabled`. Query input may have its own requested compare flag/mode, but normalized response uses the shape above.

## Comparison field primitives

### Count/amount comparison

```ts
NumericMetricComparison = {
  previous: number;
  absoluteDelta: number;
  percentDelta: number | null;
}
```

The current value lives in the containing metric's `value`; do not also expose `current` there. Zero-baseline semantics follow `shared/24-period-comparison-edge-contract.md`.

### Score comparison

For bounded ratings/scores, prefer absolute score change rather than a misleading relative percent:

```ts
ScoreMetricComparison = {
  previous: number;
  absoluteDelta: number;
}
```

### Rate comparison

```ts
RateMetricComparison = {
  previousRate: number;             // ratio 0..1
  percentagePointDelta: number;     // e.g. 6.4 means +6.4 p.p.
}
```

A metric may compose both count comparison and rate comparison when both are shown.

Never expose aliases `delta`, `deltaPercent`, `changePercent`, `pctDelta` for these canonical fields.

## KPI contract

```ts
kpis: {
  completedReads: {
    value: nonNegativeInt;
    comparison: NumericMetricComparison | null;
  };
  uniqueBooksCompleted: {
    value: nonNegativeInt;
    comparison: NumericMetricComparison | null;
  };
  pagesRead: {
    availability: StatisticsAvailability;
    value: nonNegativeNumber | null;
    comparison: NumericMetricComparison | null;
  };
  averageRating: {
    availability: StatisticsAvailability;
    value: number | null;            // canonical 0.5..10 when known
    coverage?: StatisticsCoverage;
    reason?: RatingReasonCode;
    comparison: ScoreMetricComparison | null;
  };
  activeDays: {
    value: nonNegativeInt;
    rate: number;                    // ratio 0..1
    countComparison: NumericMetricComparison | null;
    rateComparison: RateMetricComparison | null;
  };
}
```

The UI still renders four primary KPI cards: completed reads (with unique-books helper), pages, average rating, active days. `uniqueBooksCompleted` is supporting data, not a fifth card.

When activity history is `legacy_lower_bound`, presentation follows `shared/30-legacy-activity-history-quality.md`; the value remains the recorded lower bound and must not look exact. Comparison may be null/unavailable when two periods do not have comparable history quality.

## Insight comparison params

Code-specific Insight params use the same vocabulary where applicable. Example behavioral-read comparison:

```ts
{
  currentReads: number;
  comparisonReads: number;
  absoluteDeltaReads: number;
  percentDelta: number | null;
}
```

Do not use `deltaReads` / `deltaPercent` aliases.

## Count naming

Follow `shared/25-completed-read-count-semantics.md`:

- cycle count: `completedReads`, `completedReadCount`, `completedReadsCount` only where grammar/schema composition requires it; prefer singular stem `completedReadCount` for ranking row fields;
- distinct title count: `uniqueBooksCompleted`;
- do not expose cycle counts as `completedBooks`, `booksCount`, `ratedBooksCount`.

For rating coverage use `ratedReadsCount` + `completedReadsCount` in the rating-summary object because both are population totals. Ranking rows use singular `completedReadCount`.

## Calendar naming

Guaranteed keys:

```ts
calendar: {
  metricRange,
  displayRange,
  activeDays,
  activeDaysPercentage,
  longestStreak,
  currentStreak, // data includes continuesBeforeRange + continuesBeforeReliableHistory
  mostActiveWeekday,
  days
}

calendar.days[]: {
  date,
  pagesRead,
  booksCount,
  intensity,
  booksPreview,
  remainingBooksCount
}
```

Activity-history exact/lower-bound interpretation comes from `meta.activityHistory` plus the reliable boundary; do not invent a second unrelated calendar history-quality enum. Full day detail is a separate lazy endpoint.

## Availability naming

Only:

```text
available | partial | unavailable
```

Canonical metadata fields:

```text
availability
coverage
reason
```

Do not expose `hasData`, `insufficient`, `historyAvailability`, `qualityStatus` as competing availability states. Temporal legacy activity quality is the distinct `meta.activityHistory` concept defined above.

## Drill-down naming

Interactive aggregate items use only canonical:

```text
drilldown
contextActions
```

No arbitrary `url`, `href`, fuzzy `q` or presentation-owned route string in backend DTOs. Completed-read exact targets use `reading_cycle` / `completed_reads_subset`, not book-named aliases that collapse rereads.

## Historical book references

Where a historical item may reference a current soft-deleted Book:

```ts
bookState: "active" | "soft_deleted";
```

Do not encode this via `availability`.

## Contract tests

Required before frontend handoff:

1. full rich Overview test fixture parses the actual Overview schema;
2. full empty/partial/legacy-lower-bound test fixtures parse;
3. historical period fixture parses;
4. response serialization contains no `NaN`/`Infinity`;
5. grep/type test proves deprecated aliases (`deltaPercent`, KPI `delta`, `comparisonEnabled`, cycle `completedBooks`) are absent from the new Statistics DTO;
6. generated Orval types compile against Statistics frontend components without handwritten casts;
7. OpenAPI reflects nullable/optional fields exactly as Zod does.

## Documentation rule

If a response example and this manifest disagree, fix the example/schema immediately. Do not preserve multiple accepted shapes “for documentation continuity”.

# Period / comparison edge contract

This file defines the canonical Reading Statistics behavior for period validation, normalization, comparison ranges and delta semantics. Backend owns all of these rules; frontend only serializes the requested control state and renders the normalized response.

## 1. Canonical date model

All Statistics period bounds are logical inclusive `YYYY-MM-DD` dates. Follow `shared/16-reading-date-semantics.md`: do not derive inclusive day counts with timestamp millisecond arithmetic because DST/timezone offsets are irrelevant to date-only bounds.

Define:

```text
inclusiveDays(from, to) = number of calendar date labels from `from` through `to`, inclusive
```

Examples:

- `2026-08-18` → `2026-08-18` = 1 day;
- `2026-08-18` → `2026-08-19` = 2 days.

## 2. Valid requested periods

Supported product periods remain:

- calendar year;
- rolling last 12 months;
- custom `from/to`;
- all time.

Backend validation is authoritative even when the frontend prevents invalid selections.

### Calendar year

- past year → `YYYY-01-01 ... YYYY-12-31`;
- current year → `YYYY-01-01 ... userLocalToday`;
- future year → invalid request; do not return a zero-filled future dashboard.

### Rolling last 12 months

Ends at `userLocalToday`. Start is the date produced by subtracting 12 calendar months from today and then adding one calendar day. This is a trailing inclusive 12-month window, not `365 * 24h`.

Example for `today = 2026-09-02`:

```text
2025-09-03 ... 2026-09-02
```

Calendar arithmetic must handle leap years without timestamp-hour math.

### Custom range

- both `from` and `to` are required;
- both must be valid canonical `isoDay`;
- `from <= to`;
- explicit future bounds are invalid (`from > today` or `to > today`);
- a one-day range (`from == to`) is valid;
- never silently swap reversed bounds;
- never silently clamp an explicitly selected future custom bound to today.

The frontend should disable/prevent invalid choices, but API validation remains mandatory.

### All time

Logical meaning is **all canonical history currently retained/known through user-local today**, with per-capability quality metadata where legacy history may be incomplete. Future-dated facts are never included. Comparison is not supported.

Canonical normalized Reading range:

```ts
{ from: null, to: userLocalToday }
```

`from: null` means no artificial lower period bound. Activity-derived metrics use the explicit reliability semantics from `shared/30-legacy-activity-history-quality.md`; surviving pre-cutover events may be shown as observed lower-bound history and `MIN(event.date)` is never treated as the reliability boundary. `to` is never null for Reading Statistics because V1 is historical/current analytics, not a future projection.

If Delivery Statistics uses `null/null` or any other different all-time meaning, that is a concrete semantic mismatch: keep/adapt a Reading-specific normalized contract rather than hiding it through shared-type reuse. See `shared/13-statistics-common-primitives.md`.

## 3. Normalized response is source of truth

The Overview response returns the effective current range and, when enabled, the effective comparison range. Frontend labels/captions/charts/drill-downs use these backend-returned bounds and do not recalculate them independently.

Do not use the user's raw query as the final exact-drill-down scope after normalization. Exact targets use normalized backend ranges.

## 4. Comparison availability

- comparison OFF → no comparison deltas/series/insights;
- comparison ON for supported non-All-time period → backend returns one normalized comparison range;
- comparison ON + All time → invalid/unsupported combination; frontend disables the control and backend rejects contradictory input rather than silently ignoring it.

A comparison period with **zero activity** is still a valid comparison period. Zero data is not the same as unavailable comparison.

## 5. Comparison range rules

### Current partial calendar year

Use the same calendar span in the previous year:

```text
current:    2026-01-01 ... 2026-09-02
comparison: 2025-01-01 ... 2025-09-02
mode: same_period_last_year
```

### Full past calendar year

Use the full previous calendar year.

```text
current:    2025-01-01 ... 2025-12-31
comparison: 2024-01-01 ... 2024-12-31
```

### Rolling last 12 months

Use the immediately preceding interval with the **same inclusive calendar-day count** as the normalized current rolling range.

```text
comparison.to   = current.from - 1 calendar day
comparison.from = comparison.to - (inclusiveDays(current) - 1) calendar days
mode: previous_period
```

### Custom range

Use the immediately preceding interval with the exact same inclusive calendar-day count. A one-day current range therefore compares to the immediately previous day.

```text
comparison.to   = current.from - 1 calendar day
comparison.from = comparison.to - (inclusiveDays(current) - 1) calendar days
mode: previous_period
```

## 6. Leap-year rules

`same_period_last_year` is calendar-based, not duration-in-milliseconds based. Shift the current calendar boundaries by one year and clamp an invalid target day to the last valid day of that target month.

Example:

```text
2024-02-29 -> 2023-02-28
```

A same-period-last-year comparison may therefore differ by one calendar day around leap-year boundaries. This is expected calendar semantics, not an error. Metrics whose interpretation depends on exposure duration should compare rates rather than pretend the denominators are equal.

## 7. Granularity boundary rules

Granularity uses `inclusiveDays(current.from, current.to)`:

- 1–31 days → day;
- 32–180 days → week;
- > 180 days → month;
- All time → year.

Therefore exactly 31 days is daily and exactly 32 days is weekly; exactly 180 days is weekly and 181 days is monthly. One-day custom periods are valid daily series.

Week buckets still follow `meta.weekStartDay` and clip to the normalized current/comparison ranges.

## 8. Numeric delta semantics

For known scalar/count values:

```text
absoluteDelta = current - previous
```

Relative percent change is defined only when the previous denominator is non-zero:

```text
if previous > 0:
  percentDelta = ((current - previous) / previous) * 100
else:
  percentDelta = null
```

V1 Reading Statistics comparison metrics are non-negative measures, so no special negative-baseline interpretation is required.

Required edge cases:

- `current=10, previous=8` → `absoluteDelta=2`, `percentDelta=25`;
- `current=0, previous=8` → `absoluteDelta=-8`, `percentDelta=-100`;
- `current=5, previous=0` → `absoluteDelta=5`, `percentDelta=null`;
- `current=0, previous=0` → `absoluteDelta=0`, `percentDelta=null`.

Never emit Infinity/NaN and never invent `100% growth` from a zero baseline. Frontend may localize a null-percent zero-baseline case as `з 0 до 5` / `раніше 0`, while a `0 -> 0` case may render `без змін`; it must not fabricate a percentage.

If the existing Delivery `NumericDeltaSchema` has different zero-denominator semantics, do **not** force reuse merely because the shape matches.

## 9. Rates/proportions vs relative percent change

A rate/proportion must not be compared as though it were a raw count. Canonical V1 rates use ratio values in `[0, 1]`; frontend formats them as percentages.

For rate comparison return a dedicated semantic delta (Reading-specific if no compatible common primitive exists):

```ts
{
  currentRate: number; // 0..1
  previousRate: number; // 0..1
  percentagePointDelta: number; // (currentRate - previousRate) * 100
}
```

Example:

```text
41.6% vs 35.2% -> +6.4 percentage points
```

Do not label that `+18.2%` unless a separate explicitly named **relative rate change** metric is intentionally requested.

This rule applies to metrics such as active-day rate. Coverage `percent` continues to use the existing canonical ratio `[0,1]` from `shared/09-availability-and-coverage-contract.md`.

## 10. Empty / unknown comparison values

- valid comparison range + genuinely zero events/books → known `0`;
- comparison disabled/unsupported → comparison payload absent/null according to the shared schema;
- metric unavailable because source data is unreliable → use canonical `availability` semantics; do not convert it to previous `0`;
- if either numeric side is genuinely unknown/null, `absoluteDelta` and `percentDelta` are null.

## 11. API validation behavior

Use the project's existing Zod/controller error shape; do not invent a Statistics-only HTTP error envelope. The following inputs must fail validation rather than be silently rewritten:

- malformed date;
- custom missing one bound;
- `from > to`;
- explicit custom future bound;
- future calendar year;
- comparison requested for All time;
- unsupported period/comparison enum.

Frontend should prevent these states where practical, but backend tests prove the contract independently.

## 12. Required tests

At minimum cover:

1. one-day custom range;
2. reversed range;
3. malformed date;
4. custom future `from`;
5. custom future `to`;
6. future year;
7. current-year normalization through user-local today;
8. last-12-month normalization at ordinary and leap-year dates;
9. previous-period equal inclusive-day count;
10. same-period-last-year Feb 29 clamp;
11. comparison requested for All time;
12. valid comparison period with no activity;
13. percent delta for positive baseline, zero baseline, `0 -> 0` and `N -> 0`;
14. rate comparison expressed in percentage points;
15. 31/32 and 180/181 granularity boundaries;
16. exact drill-down uses backend-normalized current/comparison/bucket bounds;
17. frontend captions use returned comparison bounds and do not independently derive dates.

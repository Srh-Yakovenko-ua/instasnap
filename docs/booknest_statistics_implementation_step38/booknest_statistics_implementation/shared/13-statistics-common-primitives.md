# Shared Statistics period/comparison primitives

## Why this audit exists

Current `dev` already contains reusable-looking statistics primitives inside `packages/shared/src/order-statistics.ts`:

- `StatisticsPeriodSchema` — `{ from: isoDay | null, to: isoDay | null }`;
- `BookOrderStatisticsCompareModeSchema` — `previous_period | same_period_last_year`;
- `StatisticsComparisonPeriodSchema` — `{ from, to, mode }`;
- `NumericDeltaSchema` — `{ current, previous, absoluteDelta, percentDelta }`.

Reading Statistics MUST NOT create parallel equivalents before checking whether these semantics are actually the same. At the same time, Reading Statistics MUST NOT import Delivery/order-specific contracts merely because their field names look reusable.

## Required compatibility audit

Before adding Reading Statistics period/comparison schemas, compare the current `dev` contracts and domain rules against the Reading Statistics requirements. Verify at minimum:

1. **Date representation** — both features use the same canonical `isoDay` representation.
2. **Range semantics** — `from/to` inclusion rules are identical.
3. **All-time semantics** — nullable bounds mean the same thing in both features; do not reuse if one feature assigns a different meaning to `null`.
4. **Comparison modes** — `previous_period` and `same_period_last_year` have the same business meaning required by Reading Statistics.
5. **Comparison range semantics** — partial current year, full past year, last 12 months and custom equal-length previous interval map consistently to the shared mode/range representation.
6. **Delta semantics** — compare against `shared/24-period-comparison-edge-contract.md`: Reading requires `percentDelta = null` for a known zero previous baseline and never Infinity/NaN. Reuse `NumericDeltaSchema` only if Delivery has the same meaning, not merely the same nullable shape. Rate/proportion deltas may require a Reading-specific percentage-point contract rather than `NumericDeltaSchema`.
7. **Timezone/week start ownership** — generic period DTOs remain data contracts only. Reading Statistics resolves user-local `today`/relative endpoints from canonical `UserProfileSettings.timezone` and week alignment from `weekStartDay`, while persisted reading `@db.Date` values retain direct date-only membership per `shared/16-reading-date-semantics.md`. Do not bake Reading-specific calendar rules into a common DTO.
8. **Existing consumers/imports** — inspect current Delivery/API/frontend imports before moving symbols so the refactor does not break public/shared import paths or generated contracts.

Record the audit result in the implementation notes/tests.

## If semantics are exactly compatible

Prefer one small shared analytics-primitives module, for example:

```text
packages/shared/src/statistics-common.ts
```

It may own only genuinely generic primitives such as:

```ts
StatisticsPeriodSchema;
StatisticsComparisonPeriodSchema;
StatisticsCompareModeSchema; // generic name only if semantics are truly shared
NumericDeltaSchema;
```

Then:

- `order-statistics.ts` consumes the common primitives instead of defining parallel copies;
- Reading Statistics consumes the same common primitives;
- existing Delivery behavior and HTTP shapes remain unchanged;
- preserve existing public/shared import compatibility where the repo currently relies on it;
- add/adjust focused shared tests so extracting the primitive is a behavior-preserving refactor.

Do **not** move order-specific schemas such as currency coverage, lifecycle, store records, order drill-down destinations or source-quality payloads into this common module.

## If semantics are not exactly compatible

Keep separate contracts and document the concrete mismatch. Do not force a generic abstraction merely to reduce duplicate lines. In particular, an order-prefixed compare mode must remain order-specific if Reading Statistics needs different modes or meanings.

A failed compatibility audit is a valid outcome; hidden semantic coupling is worse than explicit duplication.

## Implementation rule

The implementation order is therefore:

1. audit existing `order-statistics` primitives and their consumers;
2. decide `reuse/extract` vs `keep separate` from semantic evidence;
3. only then add the Reading Statistics query/response contracts;
4. run Delivery Statistics shared/API tests after any extraction to prove there is no regression.

This is **targeted reuse**, not permission to create a generic BI/analytics framework.

The final Reading HTTP field composition is defined by `shared/31-final-api-contract-manifest.md`. Even if Delivery `NumericDeltaSchema` is reusable internally/shared, do not expose legacy/example aliases such as KPI `delta`/`deltaPercent`. Any extraction must map to the manifest without changing Delivery HTTP behavior.

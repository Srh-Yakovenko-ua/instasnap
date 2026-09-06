# Shared contract principles

`packages/shared` is single source of truth for HTTP schemas/types.

Statistics uses one canonical data-quality contract. Do not invent section-local variants such as `insufficient`, `historyAvailability`, `metadataState`, or ad-hoc nullable flags.

Canonical availability values:

- `available` — the metric/section is reliably derivable for its intended scope;
- `partial` — a reliable result can be produced only for a known subset and the contract exposes that subset coverage;
- `unavailable` — a reliable result cannot be produced; the data/value is `null`/omitted and a typed reason explains why.

Canonical coverage shape when a known subset matters:

```ts
{
  eligibleCount: number;
  knownCount: number;
  percent: number | null; // 0..1; null only when eligibleCount === 0
}
```

Invariants:

- `0 <= knownCount <= eligibleCount`;
- `percent = knownCount / eligibleCount` when `eligibleCount > 0`;
- `available + value: 0` means a known zero;
- `unavailable` must never be represented as numeric zero;
- `partial` requires coverage and all percentages/rankings must state or imply the known-subset denominator;
- section-specific causes use typed `reason` codes, while the three availability states stay shared and stable.

Implement these primitives once in `packages/shared` (for example `StatisticsAvailabilitySchema`, `StatisticsCoverageSchema`, and a small reusable quality wrapper/composition helper) and compose them into section schemas. Avoid forests of unrelated optional fields that create impossible combinations.

Expose semantic identifiers for:

- period kind;
- insight `code`/category;
- record type;
- availability/confidence state.

For Insights specifically:

- use a discriminated union keyed by stable `code`;
- each `code` owns a typed `params` schema;
- do not expose backend-localized `text`/`title`/`description` as the canonical insight payload;
- do not use untyped `Record<string, unknown>` params;
- keep optional actions semantic/typed rather than frontend-URL-shaped where possible.

Frontend localizes labels and insight wording; backend owns numbers, eligibility, significance, ranking and business meaning.

## Existing statistics primitive reuse

Before creating Reading Statistics period/comparison/delta types, audit the current reusable-looking primitives already defined for Order Statistics. Follow `shared/13-statistics-common-primitives.md`. Reuse/extract only contracts with identical semantics; do not create parallel generic-looking schemas by default, and do not couple Reading Statistics to order-specific semantics merely for deduplication.

## Exact drill-down

Interactive aggregates MUST follow `shared/10-exact-drilldown-contract.md`: primary click/chevron is an exact source-subset drill-down, while related-but-broader navigation is a separately typed context action. Backend/shared contracts expose semantic targets; frontend centrally maps them to routes. Do not put arbitrary frontend URLs into Statistics DTOs and do not use fuzzy search as a substitute for exact IDs/filters.

## Period / comparison edge semantics

Period validation/normalization, comparison ranges, zero-denominator numeric deltas and rate percentage-point semantics are backend-owned and defined by `shared/24-period-comparison-edge-contract.md`. Frontend must not independently repair or reinterpret those rules.

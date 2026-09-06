# Routing, period, comparison

## URL state

Period/comparison lives in query params.
Examples:

- year;
- last12;
- all;
- custom from/to;
- comparison enabled.

Do not mirror URL state into Zustand/useState.

## Header

- page title `Статистика`;
- Statistics tabs;
- period selector;
- comparison control;
- exact comparison caption when enabled.

Current year shows Jan 1 → today.

## Loading/error

Use project-standard query loading/error patterns.
Avoid 13 independent spinners if Overview is one endpoint.
Prefer page skeleton matching major layout zones.

## Response metadata

Use top-level Overview `meta.timezone` / `meta.weekStartDay` as the canonical resolved semantics for this response. Do not independently re-resolve those settings on the Statistics page or hardcode locale/server defaults. `meta.generatedAt` is diagnostic metadata; V1 does not need to display it or use it to recompute data freshness.

## Date-only rendering invariant

Follow `shared/16-reading-date-semantics.md`. Calendar/day keys returned as `YYYY-MM-DD` are logical date-only values. Do not pass them through an instant/timezone conversion that can move them to the previous/next day. Use a date-only-safe formatter for localized labels. `meta.timezone` is used for contextual `today` semantics, not to relabel historical day keys already computed by backend.

## Comparison delta presentation

- `percentDelta = null` from a zero previous baseline is not an error. Render a localized absolute/zero-baseline phrase (for example `з 0 до N` / `раніше 0`) instead of `∞%` or invented `100%`.
- `0 -> 0` may render `без змін`, but not `0%` if the contract percent is null.
- Rate metrics use percentage-point wording (`+6,4 в.п.` / localized equivalent) when the backend returns `percentagePointDelta`. Do not relabel it as a relative percent change.
- Canonical ratios such as active-day rate and coverage are formatted as percentages on frontend; do not mix ratio `[0,1]` with already-percent `[0,100]` values under the same field.

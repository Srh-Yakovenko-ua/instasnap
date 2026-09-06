# Series analytics

Soft-delete rule: historical first-completion/lifecycle facts remain historical even if the related Book is later soft-deleted. Any current-series catalog denominator must reuse canonical Series-domain current eligibility; Statistics must not invent a second blanket `deletedAt` rule. See `shared/18-soft-deleted-book-eligibility.md`.

Historical metadata rule: behavioral series membership (`series share`, `most active`, marathon membership) uses the completion-time series snapshot from `shared/19-historical-metadata-snapshots.md`. Moving a current Book into/out of a Series later must not rewrite old reads. Structural `started/continued/completed/caughtUp` history additionally requires immutable canonical Series-domain completion-time context or persisted lifecycle milestone facts; do not recompute an old period only from today's mutable Series status/denominator/order configuration.

## Lifecycle classifications

For global period, structural lifecycle uses **proven first-time book completion/progress**, not every reread cycle. Follow `shared/26-first-book-completion-reliability.md`; a legacy first-known completion is insufficient to claim a lifecycle transition:

- `started`: first-ever canonical completion of the user's first eligible book in the series occurs in period; rereading an already completed part does not start the series again.
- `continued`: at least one distinct series book was first completed before period + another distinct eligible series book is first completed in period; rereading the same part alone is not continuation progress.
- `completed`: user first reaches all required distinct books of a completed series in period.
- `caughtUp`: ongoing series first reaches all currently known/eligible distinct books in period.

`completed` and `caughtUp` are different.

## Reliability

Reuse canonical series order/status logic already present in project.
Do not duplicate order heuristics in Statistics. At each relevant first completion, persist/consume the smallest immutable canonical Series-domain structural context or milestone fact needed to keep historical lifecycle stable; current mutable Series metadata is not a historical ledger.

If total/order/status is unreliable:

- completed count/ranking may still work;
- denominator/progress/lifecycle that requires certainty must be null/unavailable.

## Section response

- lifecycle/progress counts based on distinct-book **proven first completions** where structural progress is intended;
- behavioral `seriesCompletedReadsCount / completedReadsCount` may count reread cycles because it describes what the user actually read in the selected period;
- series share;
- most active series;
- top 3 progress series;
- longest series marathon (≥2).

Do not use one ambiguous `seriesBooksCount` value for both structural distinct-book progress and behavioral read-cycle share. Name the response fields so the semantics are explicit.

## Marathon

Longest consecutive sequence of completed reads belonging to one series, without another completed standalone/series read between them.

## Most active

This is a behavioral ranking and may count completed reread cycles. Ranking is total and backend-owned:

1. `completedReadCycles DESC`;
2. `attributablePagesRead DESC`;
3. `latestFinishedAt DESC`;
4. `seriesId ASC` as the stable final tie-break.

Keep this separate from structural series progress/lifecycle, which uses distinct-book **proven first completions**.

## Deterministic ordering

Follow `shared/23-deterministic-ordering-policy.md`. Most-progress Top-3 uses `distinctProvenFirstCompletionsInPeriod DESC → seriesId ASC`. Marathon selection uses `marathonLength DESC → marathonEndFinishedAt DESC → seriesId ASC → startReadingCycleId ASC`. Never use current series name or incidental relation order as a tie-break.

## Legacy first-completion reliability

If a required distinct-book first-ever completion cannot be proven because pre-cutover history may be incomplete, do not fabricate `started / continued / completed / caughtUp`. Return the affected structural lifecycle capability as `partial` or `unavailable` according to the shared quality contract. Behavioral Series metrics that count completed reads remain independent of this uncertainty.

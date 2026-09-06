# Statistics query invalidation

Statistics is a cross-feature derived read model. Its TanStack Query cache MUST be invalidated when a successful mutation changes any canonical input consumed by Statistics.

The invalidation contract belongs at API/mutation-sync boundaries, **not inside page components**.

## Current dev precedent

The current frontend already uses centralized mutation synchronization for books (`useBookMutationSync`) and centralized query-key helpers (`bookKeys`, `seriesKeys`, `goalKeys`). `useBookMutationSync` updates the changed Book detail and invalidates related Books, Reading Queue/History, Series and Delivery queries.

Extend this pattern for Statistics instead of scattering `queryClient.invalidateQueries(...)` calls through presentation components.

Do not edit Orval-generated files manually.

## Canonical Statistics matcher/helper

All Statistics queries — Overview variants and lazy exact-detail/day-detail queries — MUST be matchable by one stable helper.

Follow the repository's actual generated-query-key shape after `pnpm gen:api`. With the current route-string-first convention, the intended shape is equivalent to:

```ts
const STATISTICS_API_PREFIX = "/api/statistics";

export function matchesStatisticsKey(query: { queryKey: QueryKey }) {
  return (
    typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith(STATISTICS_API_PREFIX)
  );
}

export function invalidateStatisticsQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: matchesStatisticsKey });
}
```

This is illustrative, not a requirement to ignore the actual generated key utilities. If Orval exposes a safer canonical key factory, reuse it. The invariant is one centralized matcher/helper that covers **every** `/api/statistics...` query key.

Do not assume that invalidating only the currently selected Overview key is enough. A mutation can affect:

- another period already cached;
- comparison-enabled and comparison-disabled variants;
- All-time data;
- lazy `/statistics/reading-days/:date` details;
- future exact Statistics detail endpoints.

V1 therefore uses conservative full Statistics-prefix invalidation for every Statistics-affecting mutation.

## Mutation → Statistics dependency matrix

Invalidate the Statistics query family after a **successful** mutation in these areas.

### Books / Reading — mandatory

Invalidate after mutations that can change reading facts, current-library snapshots or Statistics presentation enrichment, including:

- reading status changes;
- reading progress/page updates;
- finishing a reading cycle;
- starting/finishing a reread;
- current-cycle reset;
- required explicit reading-event correction/removal;
- explicit finished-cycle/history correction if later exposed;
- rating changes that update canonical reading-cycle/rating facts;
- Book soft delete / restore;
- ownership changes used by current library/TBR snapshot;
- Book metadata changes consumed by current Statistics or presentation enrichment: title, cover, `pagesCount`, language, authors, genres, publisher, series membership/part metadata;
- favorite-only changes do **not** invalidate Statistics in V1 because favorite state is not part of the approved Statistics contract. If Favorites analytics is introduced later, update the dependency matrix only together with its explicit semantics.

Historical completion metadata snapshots remain immutable as specified elsewhere. Invalidating after a current metadata edit does **not** mean historical membership is recomputed from current metadata; it only refreshes any allowed current snapshot/presentation enrichment.

The existing `useBookMutationSync` is the natural integration point for Book mutations that already flow through it. Extend that synchronization path rather than adding Statistics invalidation separately to each Book component.

### Reading Goals — mandatory

Invalidate after successful:

- create goal;
- update goal;
- archive/unarchive/reactivate if supported;
- delete goal;
- any canonical Reading Goals mutation that changes goal status or metrics consumed by the Statistics goal snapshot.

Statistics still does not calculate goal metrics itself; invalidation only causes the Overview adapter to fetch fresh canonical Reading Goals results.

### Series — mandatory when Statistics-relevant

Invalidate after successful Series mutations that can change current canonical Series state or presentation used by Statistics, for example:

- series metadata/status changes;
- canonical order/part corrections;
- book-to-series membership changes;
- total/known-series structure corrections;
- any explicit canonical Series-history correction introduced for Statistics structural milestones.

Immutable historical completion-time snapshot/milestone semantics still apply; invalidation must not cause current mutable Series metadata to rewrite historical membership.

### Profile settings — mandatory

Invalidate the full Statistics family after successful change of:

- `timezone`;
- `weekStartDay`.

These settings affect `meta`, current-period boundaries, current-streak semantics, weekly bucketing/order and user-local `today` behavior. No component may wait for stale-time expiry or window-focus refetch to make these changes visible.

Changing timezone does not relabel stored historical `@db.Date` facts; invalidation simply recomputes timezone-dependent current/relative semantics.

### Author / Publisher / related entity metadata

If current Statistics response enriches historical identities with current display names/covers/labels, invalidate after successful mutations to those presentation entities so the visible label can refresh without changing historical membership.

If a mutation changes no field consumed or displayed by Statistics, do not invalidate merely because the entity is adjacent to Books.

## What does NOT invalidate Statistics by default

Do not invalidate Statistics for unrelated mutations that are explicitly outside Overview scope, such as pure Delivery/Order, Loan or Wishlist operational changes, **unless** the final Statistics contract later starts consuming that exact data.

Period/comparison control changes are not mutations; they are represented in the Statistics query key/URL and naturally select/fetch the matching cached query.

## Success/error semantics

- Invalidate only after the server mutation succeeds (`onSuccess` or the repository-equivalent success synchronization point).
- A failed mutation MUST NOT invalidate Statistics as if data changed.
- Do not optimistically hand-edit the large aggregated Overview cache with `setQueryData` for cross-feature mutations. Statistics has too many coupled sections and exact-detail caches for reliable manual patching.
- Prefer invalidation/refetch over duplicating backend aggregation logic on frontend.
- Active matching Statistics queries may refetch immediately according to TanStack Query semantics; inactive variants should at minimum be marked stale so the next mount does not display a supposedly-fresh old aggregate.

Do not add a polling loop merely to compensate for missing mutation invalidation.

## Avoid invalidation fan-out duplication

A single user mutation may already pass through a shared feature sync helper. Ensure Statistics invalidation is wired **once per successful logical mutation path**, not once in every component/hook layer that observes the same result.

Recommended ownership:

- Book mutations → existing Book mutation synchronization helper;
- Reading Goal mutations → Reading Goals API mutation hooks/shared goal mutation sync;
- Series mutations → existing/shared Series mutation sync layer;
- profile settings → profile mutation success synchronization;
- Statistics-local future correction mutations → Statistics API mutation sync.

If a domain lacks a shared mutation sync helper, add the smallest local API-layer helper rather than importing Statistics page components into that feature.

## Tests

Add focused frontend/API-hook tests that prove:

1. successful reading progress/status mutation invalidates the Statistics family;
2. successful Book metadata/soft-delete/restore mutation invalidates Statistics through the shared Book sync path;
3. successful Reading Goal mutation invalidates Statistics;
4. successful Statistics-relevant Series mutation invalidates Statistics;
5. successful timezone/week-start update invalidates Statistics;
6. failed mutations do not trigger Statistics invalidation;
7. the Statistics matcher covers Overview query variants and `/api/statistics/reading-days/:date` detail keys;
8. the Statistics matcher does not accidentally match unrelated `/api/books`, `/api/delivery`, `/api/goals`, etc.;
9. no frontend mutation test relies on manually recomputing Overview aggregates.

Use existing project query-client/test utilities and existing mutation-hook testing conventions.

## Acceptance rule

After any successful mutation of canonical data consumed by Statistics, navigating to or already viewing Statistics MUST not show that pre-mutation aggregate as fresh. The invalidation mechanism must be centralized, testable and independent of component mount order.

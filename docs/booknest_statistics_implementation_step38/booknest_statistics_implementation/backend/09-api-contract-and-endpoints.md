# API shape

Prefer a small number of cohesive endpoints over dozens of widget endpoints.

## Proposed endpoints

### GET `/api/statistics/overview`

Query: normalized period + optional comparison.

Returns:

- canonical top-level `meta` (`generatedAt`, resolved user `timezone`, resolved `weekStartDay`, `activityHistory`) per `shared/15-overview-response-meta.md`;
- period metadata;
- hero;
- kpis;
- insights;
- dynamics;
- calendar summary including explicit `metricRange` + `displayRange`, period-aware streak semantics, and compact per-day `booksPreview`/`remainingBooksCount` sufficient to render Books mode without per-day requests;
- ratings;
- genres;
- authors;
- publishers;
- languages using canonical `BookLanguageSchema` values and declared-edition-language semantics from `shared/22-language-reliability-semantics.md`;
- optional formats capability/section only when backed by reliable actually-read-format semantics; not required for guaranteed V1;
- discoveries;
- series;
- libraryBalance;
- goal;
- records;
- canonical `availability: available | partial | unavailable` and `{ eligibleCount, knownCount, percent }` coverage metadata where relevant;
- historical rows may reference a currently soft-deleted Book and must remain in exact historical subsets; historical book references that can do so expose `bookState: active | soft_deleted` for presentation. This field is separate from metric `availability`. Current-library snapshot DTOs exclude soft-deleted Books by backend eligibility.

`hero.featuredInsight` and `insights.items[]` MUST be two projections of **one backend Insight Engine ranked pool**. The featured candidate is excluded from `insights.items`; do not run independent hero/card selection pipelines.

### GET `/api/statistics/reading-days/:date`

Lazy **full** day details after explicit user interaction. It MUST NOT be called once per visible calendar day to construct Books mode; the Overview calendar payload already carries compact previews.

### Optional exact-detail endpoints

Only create when payload/user interaction proves necessary:

- genre subset detail;
- author subset detail;
- publisher subset detail;
- other Statistics-local subset details required when an existing destination cannot reproduce the exact metric membership.

Prefer navigation to an existing filtered page **only when** its current filter contract reproduces the exact Statistics source subset (period + eligibility + entity/rating/bucket filters). Otherwise keep the primary interaction in an exact Statistics detail endpoint/UI or deliberately add the missing exact destination filter capability. Broader entity/list navigation remains a separate context action.

### Completed-read count naming

Follow `shared/25-completed-read-count-semantics.md`. The Overview contract exposes `kpis.completedReads` for finalized reading-cycle count and `kpis.uniqueBooksCompleted` for distinct `bookId` count. Cycle-based Dynamics/ranking fields use `completedReads` / `completedReadCount`; do not expose them as `completedBooks` / `booksCount`. `uniqueBooksCompleted` is separate and is not equivalent to `firstBookCompletion`.

### Reading-cycle identity

Completion-derived Overview data follows `shared/17-reading-cycle-history.md`. Exact completed-read items/scopes carry `readingCycleId` + `bookId`; the same book may contribute multiple completed reads after rereads. Do not collapse these rows in the backend contract. Metrics that represent first-time state transitions (discovery, structural series progress, TBR reduction) explicitly use first-completion/lifecycle semantics instead of the raw completed-read-cycle count.

## Contract location

Schemas/types live in `packages/shared`.
Before adding period/comparison/delta schemas, follow `shared/13-statistics-common-primitives.md`: audit the reusable-looking primitives already in `order-statistics.ts`, extract/reuse only the semantically identical generic subset, and keep Reading-specific contracts for real differences. Any extraction must preserve existing Delivery Statistics HTTP behavior and shared imports.
Controller DTOs wrap those Zod schemas via project-standard `createZodDto`.
OpenAPI → Orval generated FE client.

## Data-quality contract

The Overview response MUST always expose `meta`; do not invent a V1 `dataVersion`, and do not duplicate a second independently-populated `calendar.weekStartDay`.

All endpoint sections reuse the shared primitives from `shared/09-availability-and-coverage-contract.md`.

Do not introduce endpoint-specific aliases such as `insufficient`, `historyAvailability`, `hasData`, or infer availability only from nullable values. Section-specific `reason` codes remain typed in their own schema.

## Exact drill-down contract

Interactive response items expose the shared semantic `drilldown`/`contextActions` contract from `shared/10-exact-drilldown-contract.md`. The backend provides canonical period/filter/entity semantics required to reproduce membership; it does not return arbitrary frontend URLs. Do not use display labels or fuzzy search strings as identifiers.

## Calendar range/streak contract

`calendar.metricRange`, `calendar.displayRange`, `longestStreak` and conditional `currentStreak` follow `shared/20-calendar-streak-period-semantics.md`. A historical period returns `currentStreak = unavailable/PERIOD_NOT_CURRENT`; All-time KPI scope remains reliably tracked lifetime activity while `calendar.days[]` is bounded to the returned last-12-month `displayRange`.

## Period/comparison validation contract

All query validation, normalized ranges, comparison availability, leap-year behavior and delta semantics follow `shared/24-period-comparison-edge-contract.md`. The API uses the project-standard Zod/controller error response for invalid requests; it does not silently swap reversed dates, clamp explicit future custom dates, enable comparison for All time or emit Infinity/NaN percent deltas. Frontend captions and exact drill-down scopes consume backend-normalized ranges.

## Final field-level authority

Implement `shared/31-final-api-contract-manifest.md`. In particular, normalized response uses `comparison: null | {...}` rather than `period.comparisonEnabled`, KPI comparison fields use `comparison.previous / absoluteDelta / percentDelta`, rating comparison uses score delta, active-day rate uses percentage points, and deprecated `delta` / `deltaPercent` aliases are not part of the new Statistics DTO. Response fixtures must parse the actual Zod schema.

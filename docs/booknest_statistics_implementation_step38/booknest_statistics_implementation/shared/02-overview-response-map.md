# Overview response map

Conceptual top-level shape:

- `meta` — canonical response metadata from `shared/15-overview-response-meta.md` (`generatedAt`, resolved `timezone`, resolved `weekStartDay`, `activityHistory`);
- `period`
- `comparison`
- `hero`
- `kpis`
- `insights`
- `dynamics`
- `calendar`
- `goal`
- `ratings` — V1 rating analytics + top-rated reads only; this is the `Оцінки` section, not Favorites analytics (see `shared/21-ratings-vs-favorites-semantics.md`)
- `genres`
- `authors`
- `publishers`
- `languages`
- optional `formats` capability/section only when a reliable actually-read-format source exists; it is not guaranteed V1 payload/UI
- `discoveries`
- `series`
- `libraryBalance`
- `records`

`period`/`comparison` validation, normalized bounds, leap-year behavior and delta semantics follow `shared/24-period-comparison-edge-contract.md`. Frontend uses the backend-normalized ranges for captions, chart pairing and exact drill-down; it does not recalculate them from raw URL state.

`meta.weekStartDay` is the single response-level source for calendar weekday ordering and weekly bucket presentation; do not duplicate an independently-populated `calendar.weekStartDay`. Calendar also exposes explicit `metricRange` vs `displayRange` per `shared/20-calendar-streak-period-semantics.md`: summary KPI scope MUST NOT be inferred from the bounded visible heatmap. `calendar.days[]` additionally carries a compact exact Books-mode projection: `booksPreview` (max 3) + `remainingBooksCount`. This is required Overview data, not a lazy per-day fan-out; full `/statistics/reading-days/:date` data is fetched only after explicit interaction. See `shared/12-calendar-books-preview-contract.md`.

Each section owns:

- data;
- canonical `availability` + `coverage` from `shared/09-availability-and-coverage-contract.md` when relevant;
- optional typed `drilldown` + `contextActions` following `shared/10-exact-drilldown-contract.md`; primary drill-down reproduces the exact aggregate subset, and backend does not return arbitrary frontend URLs.

`hero.featuredInsight` (if present) and `insights.items[]` use the same shared typed Insight union **and are selected from one backend-ranked candidate pool**. The featured semantic candidate is excluded from regular items. Insight payloads contain stable `code` + code-specific typed `params`; no backend-localized sentence is part of the canonical HTTP contract. See `shared/14-single-insight-pool.md`.

Keep schemas split by section in small files and compose the Overview schema. Do not put the entire contract in one giant file.

Every ordered array returned by Overview/detail endpoints follows `shared/23-deterministic-ordering-policy.md`: backend semantic ranking keys end in a canonical non-localized stable key, and frontend preserves that order. Paginated exact-detail endpoints apply the full total order before limit/cursor pagination.

All sections MUST reuse the same `available | partial | unavailable` vocabulary. Do not expose parallel fields such as `historyAvailability` or an `insufficient` availability value; insufficient sample/history is expressed as `availability: "unavailable"` plus a typed section reason.

Completion-based sections use canonical finished reading cycles from `shared/17-reading-cycle-history.md`. `completedReads` is the cycle/read-through count and may contain repeated `bookId` values in exact details; `uniqueBooksCompleted` is the distinct-book companion metric. State-transition metrics (discoveries, structural series progress, TBR reduction) explicitly use first-time completion semantics instead. Do not expose cycle counts under `completedBooks`.
Historical classification metadata for those cycles comes from immutable completion-time snapshots in `shared/19-historical-metadata-snapshots.md`. Current Book/entity joins may enrich presentation but must not redefine historical author/genre/publisher/language/series membership or book-length records.

Field names and common nested shapes are authoritative in `shared/31-final-api-contract-manifest.md`; response examples are not permitted to introduce alternate aliases.

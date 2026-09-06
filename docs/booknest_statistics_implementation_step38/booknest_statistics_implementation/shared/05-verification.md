# Final verification

Run from repo root using current repository gates (`shared/40-repo-specific-verification.md`):

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm exec vitest run <only touched/relevant test files>`
- `/blast-radius` for every contract-shaped milestone and before backend done
- API OpenAPI generation
- `pnpm gen:api`
- backend runtime health/affected-endpoint curl checks
- frontend runtime/visual checks when frontend is implemented

Do not routinely run full `pnpm test` or `pnpm knip`; current root `CLAUDE.md` reserves them for explicit user request, CI reproduction or release-oriented verification.

Manual checks:

- uk/en;
- desktop/mobile;
- current partial year;
- past year;
- last 12 months;
- custom short/medium/long periods;
- all time;
- comparison on/off;
- user with rich data;
- empty user;
- partial metadata;
- no progress events;
- multiple goals;
- no goal;
- unknown series metadata.

## Shared period/comparison primitive verification

- Confirm the implementation audited current `order-statistics.ts` primitives/consumers before adding Reading equivalents.
- If common primitives were extracted, run existing Delivery Statistics shared/API tests and verify HTTP/OpenAPI behavior did not change unintentionally.
- Verify existing public/shared import paths used by current code remain valid or were deliberately migrated everywhere in the same change.
- If Reading kept a separate primitive, record the concrete semantic mismatch that justified it.
- Do not accept a refactor that moves Delivery-specific lifecycle/currency/source-quality/drill-down contracts into a generic statistics module.

## Reading-cycle history verification

- Finish a book, start `rereading`, and confirm the original finalized cycle remains queryable with its original `finishedAt` and rating.
- Finish the reread in another period and confirm both periods count the correct completed read; exact details distinguish the cycles by id.
- Exercise ordinary reset and confirm it does not erase earlier finalized cycles/events.
- Confirm all newly written progress events are associated with the current cycle and legacy unassigned events still contribute to pages/activity without fabricated cycle assignment.
- Inspect migration/backfill output and confirm it creates only facts supported by current snapshot data; no historical rereads are guessed.
- Confirm Statistics completion/rating/duration queries read canonical cycle history rather than mutable current progress fields.
- Confirm a reread increments behavioral completed-read metrics but does **not** create a second discovery, advance the same structural series part twice, or accelerate TBR forecast throughput.

## Performance verification

- Inspect the actual period-scoped `BookReadingProgressEvent` repository query/query family after it is implemented.
- On the safe test/dev PostgreSQL environment, run `EXPLAIN (ANALYZE, BUFFERS)` (or the repository-approved equivalent) for representative current/last-12-months, comparison and large/all-time scenarios.
- Confirm user + period filtering happen in SQL and there is no per-book/per-day N+1 or obvious avoidable full event-table scan.
- Record whether the existing `@@index([bookId, date])` is used effectively.
- Add/change an index only if the observed plan justifies it; rerun the same plan after the migration and record the result.
- Do not use an arbitrary local millisecond threshold as the only pass/fail criterion.

## Overview response metadata verification

- Inspect rich, empty and partial Overview responses and confirm top-level `meta` is always present.
- Confirm `meta.timezone` / `meta.weekStartDay` match the resolved profile settings and the actual backend bucket/day semantics.
- Confirm stored reading `@db.Date` values are filtered/grouped as date-only labels without timezone re-bucketing.
- With a frozen instant around UTC midnight, verify Books/Reading implicit `date/updateDate` uses authenticated-user timezone for both ahead-of-UTC and behind-UTC profiles; explicit ISO dates remain unchanged.
- Change profile timezone in a test and verify existing event/finish dates do not move to another historical day.
- If existing Reading History still exposes `today`-relative activity windows, verify its anchor uses the same user-local current date as Statistics rather than UTC.
- Confirm changing either setting is reflected by the next response without a Statistics schema migration.
- Validate `meta.generatedAt` as an ISO-8601 instant; do not treat it as a dataset version or transaction snapshot marker.
- Confirm there is no duplicate independently-populated `calendar.weekStartDay` and no invented V1 `dataVersion`.

Security:

- no statistics from another user;
- every repository query scoped correctly.

## Drill-down verification

- For representative interactive aggregates, compare displayed aggregate membership/count with records resolved by the exact drill-down scope.
- Confirm global period and bucket/entity filters survive the interaction.
- Confirm broader profile/list links are explicit context actions.
- Confirm unsupported exact destination filters do not fall back to fuzzy/approximate navigation.

## Language reliability verification

- Confirm current create/edit semantics use canonical `BookLanguageSchema` and that the Statistics API returns canonical values such as `ukrainian` / `english`, not `uk` / `en`.
- Verify `ukrainian` is counted as a valid declared-edition-language observation even though it is the current product default.
- Verify language coverage changes only for genuinely missing/invalid completion-snapshot language, not because confirmation provenance is unknowable.
- Verify no language is inferred from title/author/publisher/UI locale and no original-language/read-in-original metric appears without a canonical source.
- Run the pre-release distribution sanity audit from `shared/22-language-reliability-semantics.md`; record anomalies, but do not reclassify values heuristically.

## Historical metadata drift verification

- Finish a tracked cycle, record its completion-time analytics metadata snapshot, then edit current Book author/genres/publisher/language/pagesCount/series membership.
- Re-query the original period and prove aggregate counts/rankings/records/exact drill-down membership are unchanged.
- Verify current entity names/covers may change presentation without changing snapshot identity/membership.
- Verify structural Series historical milestones do not change when current Series status/denominator/order metadata changes.
- Verify a legacy backfilled snapshot is frozen after migration and carries explicit legacy provenance.

## Statistics cache invalidation verification

- Open Statistics, perform a successful Reading progress/status mutation elsewhere, and confirm the active Statistics query is invalidated/refetched rather than remaining fresh with old values.
- Cache at least two Overview period/comparison variants plus a reading-day detail, perform a Statistics-affecting mutation, and confirm the centralized matcher marks the full Statistics family stale/invalidated.
- Repeat for a Reading Goal mutation, a Statistics-relevant Series mutation and profile `timezone` / `weekStartDay` changes.
- Verify failed mutations do not trigger invalidation.
- Verify unrelated operational mutations outside Statistics scope do not cause unnecessary Statistics invalidation.
- Inspect frontend code and confirm no page component manually recomputes or `setQueryData` patches aggregate Statistics after cross-feature mutations.

## Deterministic-order verification

- repeat the same Overview request against unchanged fixture data and compare ordered ID/key arrays;
- exercise ties through the final stable key for every ranked/preview/record surface;
- verify translated UI locale changes labels only, not analytics ranking order;
- verify exact-detail pagination with equal primary metrics does not duplicate/skip rows across pages.

## Period/comparison edge verification

- Run focused unit/API tests from `shared/24-period-comparison-edge-contract.md`, including invalid/future/reversed inputs, leap day, one-day period and granularity boundaries.
- Verify a zero comparison baseline serializes `percentDelta: null` with a finite absolute delta and no Infinity/NaN in JSON/logs.
- Verify active-day rate comparison is presented in percentage points from canonical ratio inputs.
- Verify frontend exact comparison caption and drill-down scopes use response-normalized bounds rather than local date math.

- Verify legacy backfilled cycles remain first-known-only unless a trusted canonical source proves first-ever completion, while post-cutover first reads can be classified deterministically.
- Verify discovery, structural Series lifecycle and TBR first-completion analytics never promote unknown legacy firsts.

- Verify current-progress reset preserves current-cycle activity events and that those events remain visible in page/calendar/streak aggregates.

- Exercise duplicate/retried start, reread, finish, DNF and reset commands and confirm cycle counts remain idempotent.
- Confirm only `finished` cycles contribute `completedReads` and terminal cycles are not reopened.

- Run the Reading-history backfill twice and confirm the second run creates no duplicate cycles and does not rewrite frozen metadata.
- Reconcile preflight legacy finished snapshots with backfill created/skipped counts before enabling Statistics.

- Verify pre-cutover activity periods surface lower-bound quality and post-cutover periods surface exact quality using a stable reliability boundary, not `MIN(event.date)`.

- Parse every full Overview contract fixture through the actual shared Zod schema and validate partial documentation snippets against their referenced sub-schemas and compare OpenAPI/Orval nullability/field names against `shared/31-final-api-contract-manifest.md`.

- Verify soft delete preserves historical Statistics while a true hard-delete/account-purge test removes owned cycles/events/snapshots and cannot leak them through Statistics.

- Verify duration edge fixtures against `shared/33-reading-duration-semantics.md`, especially same-day=1, leap boundaries and invalid/missing starts.

- Run `shared/34-final-consistency-gate.md` as the final documentation/schema/Orval handoff check.

## Final ReadingCycle integration verification

- use `/blast-radius` to prove no lifecycle-mutating writer still bypasses the cycle-aware coordinator;
- create/update a Book directly into lifecycle states and verify cycles/snapshots are created consistently;
- exercise bulk reading-status and prove it uses canonical per-book transitions;
- run focused concurrent `startReading`/reread tests and verify the DB partial unique invariant;
- finish a Book counted by a goal, start/finish a reread, and verify the goal remains counted exactly once;
- correct the selected qualifying cycle and verify Reading Goals chooses the next eligible cycle or uncounts correctly;
- remove one mistaken progress event through the explicit correction capability and verify only that event changes pages/calendar/streak outputs;
- inspect persisted per-user reliability state and verify it remains stable after a profile timezone change;
- review migration SQL for unintended raw-index drops before deploy.

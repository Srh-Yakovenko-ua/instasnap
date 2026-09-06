# BookNest Statistics — implementation package

Цей пакет призначений для Claude Code / інженера, який реалізує велику задачу **Statistics → Overview** у `dev`-гілці BookNest.

## Порядок роботи

1. Прочитати кореневі `CLAUDE.md`, `.claude/agents/backend-engineer.md`, `.claude/agents/frontend-engineer.md`, `docs/code-principles.md`.
2. Реалізувати **backend повністю** за папкою `backend/`.
3. Оновити `packages/shared`, OpenAPI і виконати `pnpm gen:api`.
4. Лише після стабільного API реалізувати **frontend** за папкою `frontend/`.
5. Наприкінці виконати verification з `shared/05-verification.md`.

## Незмінні принципи проєкту

- Monorepo: Next.js 16 / React 19 + NestJS 11 + Prisma 7 + PostgreSQL.
- Backend feature module: `api / application / domain / infrastructure`.
- Prisma — тільки в repository/infrastructure layer.
- DTO/API contract — через `packages/shared` Zod schemas.
- Controller → service → repository; controller без business logic.
- Statistics application service/composer оркеструє; складні незалежні analytics rules живуть у focused framework-independent domain units, а не в одному god service/repository.
- Frontend використовує Orval-generated TanStack Query client. Не писати ручні `fetch`.
- Server data не класти в Zustand/useState.
- Не редагувати generated API files вручну.
- Не реконструювати відсутню історію через `updatedAt`.
- Historical completions/rereads come from canonical Books/Reading cycle history (`shared/17-reading-cycle-history.md`), never from the single mutable current `BookReadingProgress.finishedAt` snapshot. Statistics names cycle counts `completedReads` and distinct-title counts `uniqueBooksCompleted`; it never labels a cycle count as `completedBooks`.
- Soft-deleted Books use split eligibility: historical reading facts stay historical, while current library/TBR snapshots exclude deleted Books (`shared/18-soft-deleted-book-eligibility.md`).
- Усі агрегати, thresholds, forecasts, streaks, comparison, insights і records рахує backend.

## Структура

- `backend/` — поетапна backend-реалізація.
- `frontend/` — UI після завершення backend.
- `shared/` — контракт, rollout, перевірка.
- `reference/overview-approved-spec.md` — погоджена продуктова специфікація Overview.

## Додаткові файли для стабільної реалізації

- `IMPLEMENTATION_ORDER.md` — checkbox-порядок реалізації між сесіями.
- `shared/07-acceptance-checklist.md` — Definition of Done.
- `shared/08-metric-dictionary.md` — канонічні визначення метрик.
- `shared/09-availability-and-coverage-contract.md` — єдиний `available | partial | unavailable` + coverage contract.
- `shared/10-exact-drilldown-contract.md` — exact subset navigation invariant.
- `shared/11-reading-format-capability.md` — Formats не входять у guaranteed V1 без reliable actually-read-format source.
- `shared/12-calendar-books-preview-contract.md` — compact day previews for Books mode without N+1 requests.
- `shared/20-calendar-streak-period-semantics.md` — explicit Calendar KPI vs display ranges, historical/current streak semantics and All-time scope.
- `shared/21-ratings-vs-favorites-semantics.md` — V1 `Оцінки` section semantics; Favorites state is intentionally out of scope until separately defined.
- `shared/13-statistics-common-primitives.md` — semantic audit/reuse gate for shared Statistics period/comparison primitives.
- `shared/14-single-insight-pool.md` — one ranked Insight Engine pool for Hero + regular cards.
- `shared/15-overview-response-meta.md` — canonical top-level `generatedAt` / resolved `timezone` / `weekStartDay` / `activityHistory` metadata.
- `shared/16-reading-date-semantics.md` — canonical `@db.Date` semantics + mandatory user-timezone fix for implicit Books/Reading `today` writes.
- `shared/17-reading-cycle-history.md` — mandatory append-oriented read-through history so rereading/reset cannot rewrite historical completions, ratings or finalized activity.
- `shared/23-deterministic-ordering-policy.md` — canonical total-order comparator matrix for rankings, previews, records, Insights and exact-detail pagination.
- `shared/24-period-comparison-edge-contract.md` — canonical invalid/future/one-day/leap-year period rules, comparison normalization and zero-baseline/rate delta semantics.
- `shared/25-completed-read-count-semantics.md` — explicit `completedReads` vs `uniqueBooksCompleted` naming/UI/API semantics after rereads.
- `backend/13-response-examples.md` — semantic API examples.
- `backend/14-test-fixtures.md` — рекомендований test dataset.
- `backend/10-performance-and-queries.md` — mandatory query-plan/performance gate for activity aggregation.
- `backend/15-migrations-and-data-availability.md` — правила schema changes.
- `backend/16-domain-decomposition.md` — межі application/domain/infrastructure і правила декомпозиції Statistics logic.
- `frontend/11-component-map.md` — карта компонентів і меж відповідальності.
- `reference/decisions-log.md` — погоджені `не робимо` рішення.

## Interaction invariant

Statistics uses the canonical exact drill-down contract: click/chevron reproduces the exact source subset; related-but-broader navigation is an explicit context action. See `shared/10-exact-drilldown-contract.md`.

## Historical correctness prerequisites

Before implementing historical completion/taste/series/record aggregates, read:

- `shared/16-reading-date-semantics.md`;
- `shared/17-reading-cycle-history.md`;
- `shared/18-soft-deleted-book-eligibility.md`;
- `shared/19-historical-metadata-snapshots.md`;
- `shared/25-completed-read-count-semantics.md`.

- First-ever lifecycle semantics are governed by `shared/26-first-book-completion-reliability.md`; the earliest legacy completion known to BookNest is not automatically a proven first read.

## Final gate

Before implementation handoff, run `shared/34-final-consistency-gate.md`. It defines the final authority order and stale-contract sweep after all Statistics cleanup iterations.

## Final cross-feature integration prerequisites

The Statistics design is implementation-ready only together with the final ReadingCycle integration hardening:

- `shared/35-reading-lifecycle-write-path-integration.md` — no Book/Reading/Bulk lifecycle writer bypasses cycles;
- `shared/36-reading-cycle-concurrency-invariant.md` — transaction/lock + mandatory DB one-active-cycle invariant;
- `shared/37-reading-goals-cycle-qualification.md` — count-based goals qualify from canonical finished cycles, not mutable progress;
- `shared/38-reading-history-correction-capability.md` — exact correction replaces destructive reset for mistaken activity;
- `shared/39-activity-history-reliability-source.md` — persisted per-user reliability provenance;
- `shared/40-repo-specific-verification.md` — current repo quality/migration/blast-radius gates.

Do not begin completion-based Statistics aggregation until these prerequisites are implemented and verified against current `dev`.

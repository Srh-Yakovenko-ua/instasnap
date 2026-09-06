# Frontend — старт після backend

Frontend починати лише після того, як Statistics API стабільний і `pnpm gen:api` створив generated hooks/models.

## Rules

- Feature: `apps/web/src/features/statistics`.
- Route/page follows existing `[locale]/(app)` patterns.
- Data: Orval-generated TanStack Query hooks/wrappers.
- Cross-feature cache freshness follows `frontend/12-query-invalidation.md`; Statistics invalidation belongs in mutation/API sync layers, not page components.
- No manual `fetch`.
- No duplicate Zod/API types.
- URL is source of truth for period/comparison.
- Do not recompute backend aggregates.
- Reuse existing BookNest components/patterns before adding new primitives.
- Follow the domain-oriented Statistics component ownership in `frontend/01-feature-structure.md`; organize by reading/tastes/progress/controls/details rather than by rendering technology such as a generic `charts/` folder.
- `components/ui` vendored shadcn primitives не редагувати.
- `uk.json` + `en.json` localization.

Use generated Orval types from the finalized shared contract in `shared/31-final-api-contract-manifest.md`; do not hand-write compatibility aliases for old documentation examples.

# Backend — старт

## Мета

Створити окремий feature `statistics`, який віддає готову аналітику для `Statistics → Overview`. Frontend не повинен збирати сторінку з 10–20 існуючих endpoint-ів і не повинен сам рахувати агрегати.

## Спочатку зробити audit

Перевір актуальний `dev`, не припускай структуру за цією документацією:

- `apps/api/src/modules/*` — 2–3 найближчі canonical modules.
- `reading-goals`, `reading-queue`, `series`, `books`.
- `packages/shared/src`, especially existing `order-statistics.ts` period/comparison/delta primitives and their consumers before creating Reading Statistics equivalents.
- authentication/user scoping.
- API tests і repository test patterns.

## Запропонована структура

`apps/api/src/modules/statistics/`

- `api/`
- `application/`
- `domain/`
- `infrastructure/`
- `statistics.module.ts`
- `index.ts`

Не створюй generic analytics framework. Це feature BookNest Statistics.

Складні незалежні analytics rules не накопичуй в одному великому service/repository. Application layer оркеструє, infrastructure виконує focused DB access, а framework-independent period/calendar/streak/rating/taste/insight/record rules рознось у focused domain units з окремими тестами. Детальні критерії: `backend/16-domain-decomposition.md`.

## Execution order

1. Audit/reuse existing shared Statistics period/comparison/delta primitives where semantics match; only then finalize Reading Statistics query/response contracts.
2. Period/comparison domain logic.
3. Reading core aggregates.
4. Calendar/day details.
5. Taste aggregates.
6. Series analytics.
7. Library balance + prerequisites.
8. Goals snapshot.
9. Insight/record selection.
10. Controller + tests + OpenAPI.

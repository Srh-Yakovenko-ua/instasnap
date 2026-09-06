# Feature structure

Suggested structure; adapt filenames to the actual neighboring feature conventions, but keep the ownership boundaries below.

`features/statistics/`

- `api/` — thin generated-client wrappers/hooks only if the existing feature pattern uses them; keep the centralized Statistics query-key matcher/invalidation helper here (or the nearest existing API key-helper location) per `frontend/12-query-invalidation.md`.
- `components/`
  - `overview/` — page composition, hero and KPI presentation that belongs only to the Statistics overview.
  - `controls/` — period/comparison controls and Statistics-specific toolbar controls.
  - `reading/` — dynamics, calendar/heatmap, books calendar and other reading-activity presentation.
  - `tastes/` — ratings, genres, authors, publishers, languages and discovery/taste presentation.
  - `progress/` — Reading Goal snapshot, series progress, library balance and records/progress presentation.
  - `details/` — exact drill-down/day-detail presentation that is opened from overview metrics.
- `model/` — UI-only types/constants if needed.
- `hooks/` — reusable stateful UI logic only.
- `index.ts` — public feature API.

## Domain-oriented ownership rule

Organize components by the user-facing Statistics domain, **not by rendering technology**.

Do **not** create a top-level `components/charts/` folder just because several sections render charts. A chart belongs beside the section whose semantics it represents, for example:

- `components/reading/reading-dynamics-chart.tsx`;
- `components/reading/reading-heatmap.tsx`;
- `components/tastes/rating-distribution.tsx`.

Likewise, use `components/controls/` instead of the narrower `period-controls/`, because comparison and future Statistics-specific controls belong to the same UI responsibility.

If the repository's current conventions require a slightly different folder name, preserve the same semantic ownership. Do not move components into a generic technical bucket merely to match this example tree.

## Boundaries

- `overview/` composes sections; it must not own rating, calendar, series or goal business/presentation logic that belongs to another domain folder.
- Domain folders may contain small section-local primitives when they are genuinely shared within that domain.
- Promote a primitive across domains only when 2+ real consumers need the same behavior and the abstraction does not erase domain semantics.
- Exact drill-down route/detail resolution remains centralized as required by the exact drill-down contract; domain components must not build ad-hoc URLs.

Keep one concern per file.
Split components around ~200 lines / 3 distinct sections per repo principles.

Do not build a generic dashboard framework.

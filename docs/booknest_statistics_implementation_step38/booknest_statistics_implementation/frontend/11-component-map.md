# Statistics Overview component map

This is an ownership map, not a mandate for exact filenames. Match current feature conventions.

## Suggested folder ownership

Keep this component map aligned with `frontend/01-feature-structure.md`:

- `overview/` — `StatisticsOverviewPage`, hero/KPI composition pieces that are overview-only;
- `controls/` — `StatisticsPeriodSelect`, `StatisticsComparisonControl` and other Statistics-specific controls;
- `reading/` — `ReadingDynamicsCard`, `ReadingDynamicsChart`, `ReadingCalendarCard`, `ReadingHeatmap`, `ReadingBooksCalendar`;
- `tastes/` — ratings, genres, authors, publishers, languages and discovery presentation;
- `progress/` — goal snapshot, series reading, library balance and records;
- `details/` — `ReadingDayDetails` and other exact Statistics drill-down detail surfaces.

Rendering technology is not a folder boundary. In particular, do not introduce a top-level `charts/` folder: `ReadingDynamicsChart` belongs to `reading/`, while `RatingDistribution` belongs to `tastes/`.

## Page level

`StatisticsOverviewPage`

- owns layout composition only;
- reads URL period/comparison state;
- invokes Overview query;
- renders section states.

## Header

`StatisticsHeader`
`StatisticsPeriodSelect`
`StatisticsComparisonControl`

Reusable inside Statistics pages, not globally unless another feature genuinely needs them.

## Hero / KPI

`StatisticsHero`
`StatisticsKpiGrid`
`StatisticsKpiCard`

KPI card may be reusable within Statistics. Do not turn it into a generic app dashboard primitive unless existing project patterns already support that.

## Reading

`ReadingDynamicsCard`
`ReadingDynamicsChart`
`ReadingCalendarCard`
`ReadingHeatmap`
`ReadingBooksCalendar`
`ReadingDayDetails`

`ReadingDayDetails` should be shared by heatmap and books-mode interactions.

## Goal

`ReadingGoalSnapshotCard`

Prefer existing goal progress components if suitable.

## Taste sections

`RatingsSection`
`RatingDistribution`
`TopRatedBooks`

`GenresSection`
`AuthorsSection`
`PublishersSection`
`LanguagesSection` — declared edition language from immutable cycle snapshots; canonical enum labels are localized on frontend per `shared/22-language-reliability-semantics.md`.

`FormatsSection` is **not required in guaranteed V1**. Add/render it only if the backend exposes a reliable actually-read-format capability; otherwise do not create a placeholder component just to mirror `Book.formats[]`.

Use small ranking-row primitives only if 2+ sections genuinely share behavior.

## Discovery / progress

`DiscoveriesSection`
`SeriesReadingSection`
`LibraryBalanceSection`
`RecordsSection`

## Mobile-specific wrappers

Do not fork whole desktop components.
Prefer responsive rendering or narrowly scoped mobile presentation components:

- bottom sheet content;
- swipe container;
- reading diary mode.

## Avoid

- one 1000+ line `StatisticsOverview.tsx`;
- dozens of 10-line components with no reuse or semantic boundary;
- generic `AnalyticsCard<T>` abstractions that hide domain meaning;
- a new modal/bottom-sheet framework.

## Navigation model helper

`build-statistics-drilldown-target.ts` is the single typed route/detail resolver for generated `StatisticsExactDrilldown` targets. Components pass semantic targets into it; they do not concatenate URLs/query strings themselves. Related `contextActions` are rendered explicitly and are not routed through the primary metric click.

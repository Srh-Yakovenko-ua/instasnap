# Ratings vs Favorites semantics

## Decision

The guaranteed V1 Statistics section is **`Оцінки`**, not `Оцінки та фаворити`.

It contains:

- canonical `0.5–10.0` rating aggregates and coverage;
- rating distribution;
- high-rating share;
- `Найвище оцінені` completed reading cycles/books for the selected Statistics period.

`Top-rated` is a rating concept. It MUST NOT be presented or modeled as `favorite`.

## Why Favorites are not part of V1

The current Book domain exposes `Book.isFavorite` and `favoriteAddedAt`, but those fields do not by themselves define a Statistics period metric. At least three materially different product meanings are possible:

1. **Current favorite among reads completed in the selected period** — filters historical reads by today's mutable favorite state. A later toggle rewrites the old period's result.
2. **Favorited during the selected period** — an event/time-window metric based on when favorite state was added; this is not the same question as which completed reads were liked most.
3. **Favorite state at completion** — a historical completion-time fact that would need an explicit snapshot/history rule.

V1 MUST NOT silently choose among these semantics.

## V1 contract

- No `favorites` section/metric is required in `/api/statistics/overview`.
- `ratings` does not contain `isFavorite`, favorite count/share, `favoriteAddedAt`, or a favorite ranking.
- The UI label is `Оцінки`.
- The right side/subsection remains `Найвище оцінені`.
- Favorite-only Book mutations do not invalidate Statistics V1.
- Exact drill-down for rating rows/top-rated reads is based on canonical rating/cycle eligibility, never favorite state.

## Future capability gate

If Favorites analytics is requested later:

1. choose and document one product meaning explicitly;
2. define its period semantics and historical stability;
3. decide whether current Book state, an event log, or completion-time snapshot is the canonical source;
4. add shared contract/coverage/drill-down rules;
5. only then add frontend UI and favorite-mutation Statistics invalidation.

Do not introduce a new persistence/event model merely to preserve the old section title.

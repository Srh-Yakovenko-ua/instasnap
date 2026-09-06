# Accessibility, i18n, tests

## Accessibility

- chart values have accessible textual equivalents.
- segmented controls keyboard accessible.
- cover images have meaningful alt text.
- tooltips are not the only way to access data.
- sufficient contrast for heatmap levels.

## i18n

All UI strings in next-intl messages (`uk` + `en`).
Do not localize backend semantic type identifiers; localize presentation.

Insights follow the same rule strictly:

- backend sends stable typed `code` + raw typed `params`, never the finished localized sentence;
- frontend has an explicit message mapping for every supported insight `code` in both `uk` and `en`;
- locale-aware number/percent/date/plural formatting happens on frontend;
- tests cover at least one parameterized insight in both locales and assert that unsupported/malformed insight data fails safely rather than exposing a raw code as user-facing copy.

## Tests

Use project test utils.
Test user-visible behavior:

- period URL state;
- comparison on/off;
- mode toggles;
- calendar weekday order for both `monday` and `sunday` week start;
- date-only Statistics keys such as `2026-09-02` render as that same calendar date and are not shifted by browser/system timezone;
- canonical available/partial/unavailable states, coverage captions and localized reason states;
- mobile expand;
- exact drill-down interactions: chevron only with a typed exact target, route/detail scope preserves period + filters, and broader related navigation is a separately labelled context action.

Mock network boundary according to project testing rules; do not mock internal hooks unnecessarily.

Frontend tests must verify that a known zero is rendered as zero, `partial` keeps its valid value plus coverage caption, and `unavailable` renders `—`/explanation instead of zero.

## Query invalidation tests

Follow `frontend/12-query-invalidation.md`.

At minimum test successful vs failed mutation behavior for Reading/Book, Reading Goal, Series and profile timezone/week-start paths, plus matcher coverage for Overview variants and reading-day detail queries. Verify unrelated API keys are not accidentally matched.

## Period/comparison edge tests

- one-day custom period renders normally;
- reversed/future custom input is prevented in controls and backend validation errors are handled through project-standard error UI;
- All-time disables comparison;
- exact comparison caption uses backend-returned normalized range;
- zero previous baseline never renders Infinity/NaN/fabricated `100%`;
- rate deltas localize as percentage points, not relative percent;
- active-day/coverage ratios are formatted from `[0,1]` consistently in uk/en.

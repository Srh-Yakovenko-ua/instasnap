# Empty, partial, unavailable data

Frontend preserves the canonical backend data-quality contract from `shared/09-availability-and-coverage-contract.md`. It must not infer a different state from `null`, empty arrays or local heuristics.

## `available`

Render normal content, including honest known-zero/empty states.
Examples:

- completed reads = `0` and unique completed books = `0` in an empty period;
- no discoveries = known empty array;
- no series reading = honest section empty state.

## `partial`

Render the valid known-subset result and expose coverage when it affects interpretation.
Examples:

- average rating: `8,6 / 10 · 28 із 37 читань оцінено`;
- languages: partial coverage is shown only when some historical completion snapshots genuinely lack a valid canonical language, e.g. `20 із 37 історичних читань мають надійно збережену мову видання`; do not use partial coverage to represent uncertainty about whether the default `ukrainian` was manually confirmed.
- publisher metadata coverage shown explicitly.

Do not present subset percentages as if they covered all eligible books.

## `unavailable`

Render `—` or a section-level unavailable state plus localized explanation from the typed `reason`; never render `0`.
Examples:

- no rated observations for average rating → `—`, `Немає оцінених книг`;
- fully reliable period with no progress events → known zero/empty activity state; pre-cutover ambiguity follows `meta.activityHistory` lower-bound rules, and only nested metrics that cannot be interpreted safely use `unavailable + LEGACY_HISTORY_INCOMPLETE`;
- missing TBR transition history → current snapshot remains visible, period flow unavailable;
- unreliable/missing actually-read-format semantics → Formats are omitted from guaranteed V1; do not fabricate analytics and do not show a permanent unavailable placeholder solely for this deferred capability.

Other product empty states:

- no active goal → `Створити ціль`.

Do not render a cemetery of 0 cards for an empty period; use page-level/section-level empty state from contract. A shared UI helper may map `availability + reason + coverage` to consistent captions, but business eligibility stays on backend.

## Historical current-streak state

`currentStreak` is a conditional nested metric, not a generic no-data failure. When backend returns `availability = unavailable` with `reason = PERIOD_NOT_CURRENT`, do not show `0` and do not show an alarming error state. Hide/reflow the `Поточна серія` KPI for that historical period. A current period with no live streak is instead an **available known zero**.

## Legacy activity lower-bound state

When `meta.activityHistory.selectedPeriodQuality = legacy_lower_bound`, do not style the activity section as an error and do not silently show exact-looking values. Use localized lower-bound/helper semantics from `shared/30-legacy-activity-history-quality.md` (for example `≥` for monotonic totals and a compact note that pre-cutover activity may be incomplete). Calendar days before `reliableFrom` must not render zero activity as a proven empty day.

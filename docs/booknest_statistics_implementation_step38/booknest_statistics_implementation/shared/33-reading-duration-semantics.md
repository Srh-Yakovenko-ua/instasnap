# Reading duration semantics

This contract defines the exact meaning of elapsed reading duration for finished ReadingCycles. It is calendar elapsed span, **not** active reading time and not reading speed.

## Canonical eligible cycle

A duration is known only for a canonical `finished` ReadingCycle where both date-only fields are valid:

```text
startedAt != null
finishedAt != null
finishedAt >= startedAt
```

`dnf` / `abandoned` cycles are not completed-read duration samples. Legacy finished cycles with unknown start date remain valid completed reads but have unknown duration.

## Formula

Use **inclusive calendar-day span**:

```text
elapsedDays = calendarDayDifference(startedAt, finishedAt) + 1
```

Examples:

- `2026-09-02 → 2026-09-02` = **1 day**;
- `2026-09-01 → 2026-09-02` = **2 days**;
- `2024-02-28 → 2024-03-01` = **3 days** (leap year).

Do not use epoch milliseconds / `24h` division. Both values are canonical `@db.Date` labels; do not timezone-shift them.

## Meaning

`elapsedDays` answers approximately:

> “Over how many calendar days did this read-through span from recorded start through completion?”

It includes:

- paused days;
- days with zero recorded progress;
- gaps between reading sessions.

It does **not** mean:

- hours spent reading;
- active reading days;
- reading speed;
- pages/day effort.

UI wording must stay factual, e.g. `Завершено за 6 днів`, not `Прочитано за 6 днів без перерв` or `Швидкість читання`.

## Invalid date order

If `finishedAt < startedAt`:

- do not swap values;
- do not clamp duration to `0` or `1`;
- exclude the cycle from duration samples;
- expose duration quality/coverage as incomplete;
- use typed internal/section reason such as `INVALID_DATE_ORDER` when the individual/detail metric needs an explanation.

For **new canonical writes**, reject a finish/correction that would create `finishedAt < startedAt` when both dates are known. Legacy invalid rows remain data-quality issues rather than being silently rewritten.

## Missing start date

A finished legacy/read-repair cycle may truthfully have `startedAt = null`. It contributes to `completedReads`, ratings and other eligible metrics, but not to duration average/median/fastest calculations.

Do not fill missing `startedAt` from Book/cycle `createdAt`, first progress-event timestamp or mutable `updatedAt`.

## Coverage

For a duration population:

```text
eligibleCount = finished completed reads in the relevant scope
knownCount = eligible cycles with valid startedAt + finishedAt order
percent = knownCount / eligibleCount
```

Use the shared availability contract:

- all/adequate sample known → `available`;
- some known, some missing/invalid → `partial` + coverage;
- none known → `unavailable` + reason such as `NO_RELIABLE_DURATION_DATA`.

Minimum-sample rules for a surfaced average/median may additionally produce `INSUFFICIENT_SAMPLE`.

## Fastest completed read record

`fastest completed read` uses only valid duration samples. Deterministic ordering remains:

```text
elapsedDays ASC
→ finishedAt DESC
→ readingCycleId ASC
```

A same-day finished cycle has `elapsedDays = 1` and may legitimately win. Do not exclude it merely because the duration is short.

Historical metadata/title/cover follows completion snapshot + presentation enrichment rules.

## Rereads

Each finished reread cycle has its own `startedAt`, `finishedAt` and duration. Do not reuse the previous cycle's start date. Rereads may therefore independently participate in behavioral fastest/duration metrics.

## Pauses

Pause/resume stays inside one active cycle. V1 does not subtract paused intervals because there is no canonical clock-time/interval ledger. Elapsed duration remains full inclusive calendar span.

## Future detail analytics

Any future average/median/genre-duration/author-duration analytics must reuse this exact definition and coverage rule. Do not create a second “duration” formula elsewhere.

## Tests

1. same-day finish = 1;
2. adjacent dates = 2;
3. month/year/leap-day boundaries;
4. missing start excluded from known duration but cycle still counts as completed read;
5. `finishedAt < startedAt` rejected on new write and treated unavailable/unknown for legacy;
6. pause gaps remain included;
7. reread cycles use independent starts;
8. fastest tie uses finishedAt then readingCycleId;
9. no millisecond/timezone arithmetic.

## Do not do

- Do not define same-day elapsed duration as zero.
- Do not subtract paused/zero-progress days in V1.
- Do not call elapsed calendar duration reading speed.
- Do not repair invalid legacy date order by swapping/clamping.

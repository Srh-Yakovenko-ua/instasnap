# Canonical metric dictionary

All backend services and tests must use these definitions consistently.

## readingDate

A canonical persisted reading calendar-date label (`YYYY-MM-DD`) stored in PostgreSQL `DATE` / Prisma `@db.Date`. It is not a timestamp instant. Preserve/filter/group the stored date directly; never timezone-shift it. User timezone is used to resolve new implicit `today` and relative current-day context. See `shared/16-reading-date-semantics.md`.

## completedRead

One canonical finalized reading cycle whose stored date-only cycle `finishedAt` falls inside the inclusive normalized Statistics `from/to` range. Do not timezone-convert `finishedAt`. The same `bookId` may contribute multiple completed reads when it is reread and finished more than once. A later soft delete of the related Book does not retroactively remove the cycle from historical Statistics. See `shared/17-reading-cycle-history.md` and `shared/18-soft-deleted-book-eligibility.md`.

## completedReads

See `shared/25-completed-read-count-semantics.md`.

Count/list of canonical `completedRead` facts. This is the behavioral read-through count: a finished reread contributes another completed read. It is **not** `COUNT(DISTINCT bookId)` and it is not derived from mutable current `BookReadingProgress.finishedAt`. Exact historical items carry `readingCycleId` + `bookId`.

The new Statistics API MUST use the name `completedReads` / `completedReadCount` for this cycle-based quantity. Do not expose a cycle count under `completedBooks`.

## uniqueBooksCompleted

`COUNT(DISTINCT bookId)` over canonical `completedRead` facts inside the selected period. This answers how many distinct titles/books had at least one completed read in scope. A book reread twice in the same period contributes `2` to `completedReads` but `1` to `uniqueBooksCompleted`.

`uniqueBooksCompleted` is **not** the same as `firstBookCompletion`: a book first completed before the selected period and reread inside the selected period still contributes `1` unique completed book for that period, but does not create another first-completion transition. Historical soft-delete rules still apply: a later soft delete does not remove the historical distinct book from this period metric.

## historicalCompletionMetadata

Immutable typed metadata snapshot captured when a reading cycle is finalized as finished. Historical author/genre/publisher/language/behavioral-series membership and book-length records use this snapshot rather than mutable current Book metadata. Current entity data may enrich presentation only. See `shared/19-historical-metadata-snapshots.md`.

## declaredEditionLanguage

The canonical `BookLanguageSchema` value captured in a finished cycle's immutable completion metadata snapshot. It represents the edition language stored in BookNest at completion, not separately verified manual-confirmation provenance and not original-work language. `ukrainian` remains a valid value even though it is the current product default. Language coverage measures snapshot completeness only. See `shared/22-language-reliability-semantics.md`.

## firstKnownBookCompletion

The earliest canonical finished reading cycle currently known for a given `bookId`. This is not automatically proof of the first-ever read when legacy history may be incomplete.

## firstBookCompletion

A **proven first-ever** canonical finished reading cycle for a given `bookId`, as defined by `shared/26-first-book-completion-reliability.md`. Use this only for state-transition metrics such as discovery, first-time Series lifecycle/progress and TBR outflow. A legacy backfilled earliest-known cycle is not automatically a `firstBookCompletion`. Later rereads never create another firstBookCompletion.

## readingElapsedDays

Inclusive calendar-day span for a canonical finished reading cycle with reliable `startedAt` and `finishedAt`: `calendarDayDifference(startedAt, finishedAt) + 1`. Same-day completion = 1. Missing start or `finishedAt < startedAt` is not a known duration sample. See `shared/33-reading-duration-semantics.md`.

## pagesRead

Sum of surviving canonical `BookReadingProgressEvent.pagesRead` whose stored date-only `event.date` belongs to the inclusive normalized period. Exact-vs-legacy-lower-bound interpretation follows `shared/30-legacy-activity-history-quality.md`. Never infer from `Book.pagesCount` and never replace/re-bucket the date from `event.createdAt`. Historical events already recorded remain eligible after a later soft delete of the related Book **and after an ordinary current-progress reset**. A reset does not erase valid historical activity; see `shared/27-reading-activity-event-history.md`.

## activeDay

A canonical stored `BookReadingProgressEvent.date` on which sum of surviving `pagesRead` across events is greater than zero. For pre-cutover history this is an observed active day; absence of an event is not proof of inactivity. See `shared/30-legacy-activity-history-quality.md`. `today/yesterday` comparisons use `UserProfileSettings.timezone`, but historical event dates are not shifted through that timezone.

## calendarMetricRange

Exact inclusive date-only range used by Calendar summary metrics. For non-All-time periods it is the effective selected period with future days excluded. For All time it uses the finite observed Calendar window defined by `shared/20-calendar-streak-period-semantics.md`; the earliest surviving event is not a reliability boundary, and legacy lower-bound quality comes from `shared/30-legacy-activity-history-quality.md`. See `shared/20-calendar-streak-period-semantics.md`.

## calendarDisplayRange

Exact inclusive date-only range represented by `calendar.days[]`. It equals `calendarMetricRange` for non-All-time periods. For All time it is the backend-resolved bounded rolling last 12 months, clipped to the earliest reliable activity date when tracking is newer.

## activeDaysPercentage

`activeDays / eligible calendar days in calendarMetricRange`. Canonical API representation is a ratio in `[0,1]`; frontend performs locale-aware percent formatting.
Future dates are never included. For All time with legacy-lower-bound history, `activeDaysPercentage` may be unavailable because the true historical denominator/start is not reliable; do not derive it from the earliest surviving event.

## weekStartDay

Canonical `UserProfileSettings.weekStartDay` controlling week-aligned aggregation and calendar weekday ordering. Supported values are `monday | sunday`; current default is `monday`. It is a presentation/aggregation boundary setting, not a timezone replacement.

## weeklyBucket

A week-aligned bucket whose boundary starts on canonical `weekStartDay` in the user timezone and is clipped to the selected statistics period at its edges. Never assume ISO/Monday weeks when the user setting is `sunday`.

## currentStreak

A selected-period current-context metric defined by `shared/20-calendar-streak-period-semantics.md`. It is available only when `calendarMetricRange.to` is canonical user-local today. The sequence may end on today or yesterday, is clipped at `calendarMetricRange.from`, and exposes `continuesBeforeRange` when it extends earlier. Historical closed periods return `unavailable + PERIOD_NOT_CURRENT`, not zero. Stored historical activity dates remain date-only labels and are never timezone-rebucketed.

## longestStreak

Maximum sequence of consecutive active calendar days **inside `calendarMetricRange`**, clipped at both period boundaries. All-time uses the full reliably tracked activity range even though the visible calendar is only `calendarDisplayRange`.

## ratingScale

Canonical BookNest reading rating is `0.5–10.0` inclusive with step `0.5`. Statistics uses the stored canonical value directly; no 5-star conversion is allowed.

## averageRating

Arithmetic mean of canonical `0.5–10.0` **cycle-level ratings** of completed reads in scope that were actually rated. Present as `x.x / 10`. Do not use only mutable latest book progress rating for historical periods.

## highRatingShare

`rated completed reads with rating >= 8.0 / rated completed reads`.

## ratingCoverage

`rated completed reads / completed reads`.

## topRatedBook

Completed read with a cycle-level rating, sorted `rating DESC → finishedAt DESC → readingCycleId ASC`. Multiple read cycles of the same book may be distinct exact results. Historical author/genre/publisher/series grouping around that read uses its completion-time metadata snapshot.

## newAuthor

Author first encountered through a **proven** canonical `firstBookCompletion` in scope and absent from all earlier proven first completions. Unknown legacy first-ever status must not fabricate discovery. Later rereads do not create another discovery.

## newGenre

Genre first encountered through a **proven** canonical `firstBookCompletion` in scope and absent from all earlier proven first completions. Unknown legacy first-ever status must not fabricate discovery. Later rereads do not create another discovery.

## newPublisher

Publisher first encountered through a **proven** canonical `firstBookCompletion` in scope with no earlier proven first completion from that publisher. Unknown legacy first-ever status must not fabricate discovery. Later rereads do not create another discovery.

## returningAuthor

Lifetime author relationship ranked `distinctReadingYears DESC → completedReadCount DESC → latestFinishedAt DESC → authorId ASC`.

## seriesStarted

The first **distinct-book first completion** in that series occurs in scope. Rereading an already completed part does not start the series again.

## seriesContinued

At least one distinct series book has a first completion before scope and another distinct eligible series book gets its first completion in scope. A reread alone is not structural continuation.

## seriesCompleted

User first reaches all required distinct books of a completed series in scope; reread cycles do not advance structural completeness twice.

## seriesCaughtUp

For an ongoing series, user first reaches all currently known/eligible distinct books in scope; reread cycles do not advance structural progress twice.

## seriesMarathon

Longest uninterrupted sequence of completed reads from the same series with no completed standalone/other-series read between them.
Only surface when length ≥2.

## seriesShare

`completed reads belonging to a series / all completed reads in scope`.

## publisherConcentration

Share of completed reads with known publisher that belong to the top 3 publishers by completed-read count.

## tbr

Canonical **active/non-deleted** owned books (`Book.deletedAt IS NULL`) that are not finished and are eligible for current reading-state statistics. This is a current-library snapshot population, not a historical reading-fact population.

## tbrInflow

A canonical transition into owned + not-finished TBR during scope.
Requires reliable lifecycle history.

## tbrOutflow

A canonical transition out of TBR during scope, including **first-time completion of an unread book** and other explicit supported reasons. A reread of an already-read book is not another TBR outflow.
Requires reliable lifecycle history.

## netTbrChange

`tbrInflow - tbrOutflow` after canonical transition classification.

## tbrForecastDuration

Estimated duration that current TBR would last at recent sustainable **TBR-reducing first-completion/outflow rate**. Global completed-read-cycle rate must not be used when it includes rereads.
This is not a prediction of future collection completion.

## discovery

A newly encountered author/genre/publisher in scope based on first completed reading, not database creation.

## comparisonDelta

Difference between current metric and normalized previous-period metric.

## insight

Deterministic interpretation of one or more reliable metrics after eligibility, significance, sample-size and diversification checks.

Wire semantics: a stable typed `code` plus code-specific typed `params` and optional semantic action metadata. The backend does not return the localized human sentence; the frontend renders it from i18n messages using those params.

## record

Deterministic extremum inside scope, such as longest completed book or most pages in one active day.
For records that depend on book length, use the completed cycle's `pagesCount` snapshot; current mutable `Book.pagesCount` must not rewrite an old record.

## availability

Canonical Statistics data-quality state: `available | partial | unavailable`. `insufficient` is not a fourth availability state; it is represented by `unavailable` plus a typed reason such as `INSUFFICIENT_SAMPLE`.

## coverage

Canonical known-subset metadata `{ eligibleCount, knownCount, percent }`. `percent = knownCount / eligibleCount` when `eligibleCount > 0`, otherwise `null`. `partial` results require coverage.

## unknown

Data cannot be derived reliably. Public Statistics payload represents this as `availability: "unavailable"` with `value/data: null` and a typed reason.

## zero

A known value equal to zero.

`unknown` and `zero` must never be interchanged.

## deterministicOrdering

Every ordered metric uses a total backend-owned comparator defined in `shared/23-deterministic-ordering-policy.md`; canonical IDs/keys/dates are final tie-breaks, never localized labels or incidental row order.

## numericPercentDelta

Relative change for a known non-negative scalar/count. `((current - previous) / previous) * 100` only when `previous > 0`; otherwise `null`. `0 -> 0` therefore has `absoluteDelta = 0`, `percentDelta = null`. Never Infinity/NaN. See `shared/24-period-comparison-edge-contract.md`.

## percentagePointDelta

For ratio/rate metrics stored canonically in `[0,1]`: `(currentRate - previousRate) * 100`. Example `0.416 - 0.352 = +6.4 percentage points`. This is not the same as a relative percent change.

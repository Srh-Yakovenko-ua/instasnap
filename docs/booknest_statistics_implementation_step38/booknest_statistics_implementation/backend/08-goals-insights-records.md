# Goal snapshot, insights, records

## Goal snapshot

Current `dev` already exposes a canonical `ReadingGoalMetricsSchema`; do not treat progress/forecast/risk as an unimplemented prerequisite. Existing metrics include:

- `completedCount`, `remainingCount`, `progressPercent`;
- `elapsedDays`, `totalDays`, `elapsedPercent`, `expectedCompletedCount`;
- `actualBooksPerDay`, `averageDaysPerBook`;
- `requiredBooksPerDay`, `requiredDaysPerBook`;
- `pace`, `paceDeltaBooks`, `paceDeltaPercent`;
- `projectedCompletionDate`, `projectedDaysDelta`, `projectionConfidence`;
- `riskLevel`, `riskReasons`;
- `daysLeft`, `daysSinceLastCounted`, `lastCountedAt`.

Reading Goals also already has `ReadingGoalsOverviewSchema` for aggregate active/attention/completed/success data. Statistics should plan its compact goal snapshot against these existing contracts/application capabilities rather than assuming only `targetCount/deadline` exist.

### Canonical ownership rule

`reading-goals` is the **only owner of Reading Goal calculations**. The Statistics module is a consumer/adapter and MUST NOT implement a second calculator for any canonical goal metric.

Statistics MUST NOT independently calculate or reinterpret:

- `completedCount`, `remainingCount`, `progressPercent`;
- elapsed/expected progress;
- actual or required pace;
- `pace` or pace deltas;
- projection date/delta/confidence;
- `riskLevel` or `riskReasons`;
- goal completion/success semantics.

The Statistics application layer must obtain the already-computed canonical goal snapshot/metrics from the existing Reading Goals application/domain capability and only map the required fields into the Statistics Overview contract. It may perform **presentation-oriented selection/composition** (for example: choose which already-computed fields are exposed in the compact card), but it may not reproduce the formulas or derive a competing status from raw goal/book data.

If the Statistics Overview needs a goal value that the canonical Reading Goals capability does not currently expose, extend/refactor the Reading Goals domain/application API first, then consume that canonical result from Statistics. Do not patch the gap with Statistics-local math.

This rule also applies to tests: do not copy Reading Goals formulas into Statistics tests. Statistics tests should verify integration/mapping/primary selection and that canonical values pass through unchanged.

Response:

- primary active goal;
- current/target;
- progress;
- remaining;
- pace status;
- forecast/projection only according to canonical confidence/availability semantics;
- risk/attention context only if useful for the compact Overview card;
- completed state;
- active goals count.

Current schema is count-based. Do not invent pages/multi-type goals unless existing `dev` code already added them.

### Deterministic primary-goal selection for V1

V1 does **not** add `isPrimary` and does not change the ReadingGoal schema merely for the Statistics card. Selecting which already-computed active goal to feature is Statistics presentation-oriented selection, not a second Reading Goals calculator.

Rules:

1. Candidate set contains only goals whose canonical Reading Goals output has `status = active`. Do not infer active state again from `archivedAt`, `deadline` or raw progress.
2. No candidates → `primaryGoal = null` and render the existing create-goal empty state.
3. One candidate → select it.
4. Multiple candidates → sort **`deadline ASC` → `createdAt ASC` → `id ASC`** and select the first.
5. `activeGoalsCount` is based on the same canonical active candidate set; the card may show `Ще N активних` for the remainder.
6. Selection MUST be independent of frontend ordering, cursor/default pagination and incidental database row order. Do not select `items[0]` from a partially fetched Reading Goals page unless that internal call is explicitly guaranteed to cover/order the full candidate set.
7. Implement the ordering as a small deterministic Statistics selector/helper with focused tests, or reuse an existing canonical Reading Goals application selector if `dev` already has an equivalent one. Do not add competing progress/status math.

An explicit user-controlled primary-goal domain field may be introduced later only as a separate Reading Goals product feature. It is outside V1 Statistics scope; do not add a migration, create/update field or UI control for it in this implementation.

## Insight engine

Deterministic, no LLM.

Pipeline (single source for both Hero and the regular Insights block):
`candidates → eligibility → significance → minimum sample → dedupe/diversify → priority/ranking → ranked pool`.

The Insight Engine MUST build and rank this pool **once**. Do not implement separate `buildHeroInsight()` and `buildInsights()` pipelines with independent eligibility, significance, priority or diversification rules.

Selection policy after the shared ranked pool exists:

1. `hero.featuredInsight` = the first ranked candidate that is eligible for featured presentation; if all V1 insight codes are hero-safe, this is simply `rankedPool[0]`; no eligible candidate → `null`.
2. `insights.items` = the next highest-ranked candidates from the **same pool**, excluding the featured candidate, capped at 4.
3. The same semantic candidate MUST NOT appear in both Hero and the regular cards. Deduplication happens before ranking/selection, not independently per surface.
4. Hero selection does not trigger a second pass that could change thresholds, sample rules or ranking.
5. If `featuredInsight` is `null`, regular Insights may still render from the ranked pool when candidates exist but are intentionally not hero-eligible.

Categories:
reading, activity, genres, authors, series, library, ratings, discovery, collection.

### Canonical Insight contract

Backend owns **which insight is true/relevant** and all business values used by it, but it MUST NOT own the final localized sentence.

Return a discriminated union based on a stable semantic `code`. Example shape (illustrative names; keep the final enum small and domain-specific):

```ts
type StatisticsInsight =
  | {
      code: "reading_more_than_comparison";
      category: "reading";
      tone: "positive" | "neutral" | "negative";
      params: {
        currentReads: number;
        comparisonReads: number;
        absoluteDeltaReads: number;
        percentDelta: number | null;
      };
      action?: StatisticsInsightAction;
    }
  | {
      code: "most_active_weekday";
      category: "activity";
      tone: "neutral";
      params: {
        weekday: number;
        activeDays: number;
        pagesRead: number;
      };
      action?: StatisticsInsightAction;
    };
```

Rules:

- do **not** return `text`, `title`, `description` or another backend-localized sentence for an insight;
- do not return translation keys generated dynamically from arbitrary data;
- `code` is a stable enum/discriminator in `packages/shared`;
- `params` are code-specific typed schemas, not an untyped `Record<string, unknown>`;
- params contain canonical raw/business values needed for presentation; do not pre-format localized numbers, percentages, dates or plurals;
- optional `action` is also semantic/typed (entity/filter/action identifier + required IDs), not a hardcoded frontend URL where avoidable;
- the same insight schema **and the same single ranked candidate pool** are used by both the regular Insights block and any featured Hero insight;
- backend returns already selected `hero.featuredInsight` and `insights.items`; frontend MUST NOT rerank, dedupe, promote or substitute insights between surfaces;
- frontend maps `code` to `next-intl` messages (`uk` + `en`) and formats `params` for the active locale;
- unknown insight codes must be impossible in generated types; if runtime compatibility handling is needed, fail safely/omit the unsupported card rather than display backend text.

No judgement wording/colors. Tone is semantic metadata for presentation and MUST NOT encode moral judgement.

## Record engine

Deterministic, up to 4.
High-priority candidates:

- longest completed book/read (do not surface duplicate reread copies as separate identical length records; choose one deterministic representative cycle/book);
- most pages in a day;
- fastest completed **reading cycle** using canonical inclusive `elapsedDays` from `shared/33-reading-duration-semantics.md`; same-day = 1, missing/invalid date order is ineligible;
- longest series marathon.

Fallback:

- longest reading streak;
- peak month;
- shortest book.

Do not use `highest rating = 10` as a record.

## Deterministic ordering integration

All Insight/Record selection follows `shared/23-deterministic-ordering-policy.md`. Insight candidates append a canonical internal `stableKey ASC` after the existing semantic priority/significance keys. Record type output follows the approved fixed priority order and each record type has an explicit total comparator; do not let database/input order choose equal extrema. Exact tests must assert winner IDs/keys under ties.

### Reading duration

Any duration-based Record/Insight uses `shared/33-reading-duration-semantics.md`. Do not implement a local `finishedAt - startedAt` millisecond formula or subtract pauses. Invalid/missing start dates affect canonical duration coverage rather than being guessed.

## ReadingGoal qualification source after ReadingCycle rollout

Do not feed Reading Goals from mutable current `BookReadingProgress.finishedAt` once canonical cycles are introduced. Follow `shared/37-reading-goals-cycle-qualification.md`.

For each `ReadingGoalBook`, select the earliest canonical `finished` cycle inside the goal counting window (`finishedAt ASC → readingCycleId ASC`) and count that Book at most once for the count-based goal. Persist/reference the selected cycle identity so corrections can deterministically requalify to the next eligible cycle.

Reread behavior is explicit:

- starting a reread does not uncount the Book;
- finishing another reread in the same goal does not count the Book twice;
- only an explicit historical correction can force reevaluation/unqualification.

The existing Reading Goals metric engine remains the only owner of progress/pace/risk/projection formulas.

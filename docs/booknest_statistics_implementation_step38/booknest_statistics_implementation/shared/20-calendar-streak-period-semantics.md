# Calendar / streak period semantics

This contract removes ambiguity between the **Statistics period used for metrics** and the **bounded day range actually rendered by the calendar UI**.

## 1. Two explicit ranges

Calendar response MUST expose two inclusive date-only ranges:

```ts
calendar: {
  metricRange: {
    from: isoDay;
    to: isoDay;
  }
  displayRange: {
    from: isoDay;
    to: isoDay;
  }
  // ...summary + days
}
```

### `metricRange`

The exact range used for Calendar summary metrics such as `activeDays`, `activeDaysPercentage`, `longestStreak` and `mostActiveWeekday`.

Rules:

- for year / last-12-months / custom periods, use the effective normalized Statistics range after excluding future calendar days;
- `metricRange.to` never extends beyond user-local `today`;
- for **All time**, activity may include surviving pre-cutover events, but exactness is governed by `shared/30-legacy-activity-history-quality.md`; do not call `MIN(event.date)` a reliability boundary. `metricRange`/summary values must carry the activity-history quality semantics described there;
- if no reliable progress-event range exists, Calendar is `unavailable` rather than inventing a lifetime denominator.

### `displayRange`

The exact range represented by `calendar.days[]` / heatmap / Books-mode diary.

Rules:

- for non-All-time periods, `displayRange = metricRange`;
- for **All time**, `displayRange` is a bounded rolling **last 12 months** window ending at user-local `today`, clipped to `metricRange.from` when activity tracking started more recently;
- backend resolves and returns the exact date boundaries; frontend does not derive them independently;
- `calendar.days[]` is scoped to `displayRange`, while summary KPI values are scoped to `metricRange`.

Therefore, in All-time mode it is valid and intentional that the visible heatmap covers the last 12 months while `activeDays`, `longestStreak` and `mostActiveWeekday` describe all reliably tracked activity.

## 2. Active-day metrics

### `activeDays`

Count distinct canonical `activeDay` labels inside `metricRange`. The top-level Overview KPI `kpis.activeDays` and Calendar summary MUST use the same normalized period semantics/value; do not compute two differently scoped "active days" numbers for the same response.

### `activeDaysPercentage`

`activeDays / eligibleCalendarDays(metricRange)`. Canonical API value is a **ratio in `[0,1]`** (for example `0.416`); frontend formats it as `41.6%`.

- denominator is inclusive calendar days in `metricRange`;
- future days are never eligible;
- for All time, do not infer exact lifetime activity percentage across an unreliable pre-cutover ledger. Follow `shared/30-legacy-activity-history-quality.md`: the recorded ratio may only be presented as a lower bound when the selected scope crosses the reliability boundary;
- known zero activity in a valid current/historical range is `available` with value `0`, not `unavailable`.

### `mostActiveWeekday`

Computed from active/page activity inside `metricRange`. `weekStartDay` only changes weekday ordering/presentation and week bucket boundaries; it does not relabel the actual weekday.

## 3. `longestStreak`

`longestStreak` is **period-scoped**.

- Find the maximum sequence of consecutive canonical active date labels inside `metricRange`.
- Clip the sequence at both `metricRange` boundaries.
- Do not silently count active days before `metricRange.from` or after `metricRange.to` merely because a real-world streak crosses the selected-period boundary.
- Response SHOULD include `{ days, startDate, endDate }` so exact detail/drill-down can reproduce the streak.
- No activity in an otherwise valid range is an available known zero (`days = 0`, dates null).

This makes `longestStreak` comparable to the selected Statistics period and prevents a prior-year/month streak from leaking into another period.

## 4. `currentStreak`

`currentStreak` is meaningful only for a Statistics Calendar whose `metricRange.to` equals canonical user-local `today`.

### Current period

When `metricRange.to == today`:

- consecutive active dates may end on `today`;
- if the user has not read today, activity through `yesterday` still keeps the streak alive until the current user-local day ends;
- if neither today nor yesterday belongs to an active sequence, value is a known `0`;
- counting is clipped at `metricRange.from` to preserve selected-period semantics;
- if the real sequence continues before `metricRange.from`, return `continuesBeforeRange: true` so UI can avoid implying the clipped value is the full lifetime streak (for example show `7+ днів`).

Recommended shape:

```ts
currentStreak: {
  availability: "available";
  data: {
    days: number;
    startDate: isoDay | null;
    endDate: isoDay | null;
    continuesBeforeRange: boolean;
    continuesBeforeReliableHistory: boolean;
  }
}
```

### Current period with unreliable recent history

If `metricRange.to == today` but the canonical today/yesterday window required to decide the live streak is not fully reliable under `shared/30-legacy-activity-history-quality.md`, return:

```ts
currentStreak: {
  availability: "unavailable";
  data: null;
  reason: "LEGACY_HISTORY_INCOMPLETE";
}
```

Do not return a false zero merely because the missing recent event history cannot prove activity.

### Historical period

When `metricRange.to < today`, **do not return `0` as "current streak"**.

Return:

```ts
currentStreak: {
  availability: "unavailable";
  data: null;
  reason: "PERIOD_NOT_CURRENT";
}
```

Frontend hides the `Поточна серія` KPI for historical periods or reflows the remaining Calendar summary metrics. V1 does not invent a second "current streak as of 2024" metric.

## 5. All-time behavior

All time is a mixed-scope presentation by design and MUST also honor `shared/30-legacy-activity-history-quality.md`:

- normalized Statistics period remains `{ from: null, to: today }`;
- Calendar `metricRange.from` is the earliest **surviving observed activity date** when one exists, otherwise the stable `activityHistory.reliableFrom`; this finite range is an observed Calendar window, **not** the reliability boundary;
- `displayRange` = bounded last 12 months → today, clipped to the finite Calendar window as needed;
- if `metricRange.from < activityHistory.reliableFrom`, recorded `activeDays` and `longestStreak` are lower-bound values;
- `activeDaysPercentage` is computed over the explicit finite `metricRange`; when that range crosses pre-cutover history it is an observed **lower-bound rate for that returned range**, not a claim about unknowable earlier lifetime days;
- `currentStreak` follows the recent-day reliability rules from `shared/30`;
- `mostActiveWeekday` is unavailable when the All-time activity ledger is legacy-lower-bound;
- `calendar.days[]` covers only `displayRange`, and pre-cutover zero cells are unknown rather than proven empty.

The UI MUST explicitly communicate the narrower visualization window (`Календар: останні 12 місяців`) and any legacy lower-bound quality. Do not call the earliest surviving event the beginning of reliable/lifetime activity.

## 6. Historical periods

For a closed historical year/custom range:

- `metricRange = displayRange = selected historical range`;
- `activeDays`, percentage, longest streak and weekday metric are historical-period scoped;
- `currentStreak` is unavailable with `PERIOD_NOT_CURRENT`;
- no `today/yesterday` grace logic is applied to a closed past period.

## 7. Exactness and drill-down

If a streak/Calendar summary becomes interactive:

- use returned exact `startDate/endDate` and `metricRange` semantics;
- do not navigate to a broader activity list that includes days outside the metric;
- `displayRange` is presentation scope and MUST NOT replace `metricRange` when resolving summary KPI details.

## 8. Tests

At minimum cover:

1. current-year period where yesterday is active and today is not yet active;
2. current period with a streak that started before `metricRange.from` → clipped value + `continuesBeforeRange = true`;
3. past year → `currentStreak = unavailable/PERIOD_NOT_CURRENT`, not zero;
4. longest streak crossing `metricRange.from` → only in-range days count;
5. All time with >12 months of activity → lifetime/tracked KPI values but only 12-month `displayRange`/days payload;
6. All time with tracking newer than 12 months → `displayRange` clipped to earliest reliable event;
7. no progress history → Calendar unavailable, no fake All-time denominator;
8. user timezone boundary → `today` eligibility/current-streak state follows canonical profile timezone without shifting stored event dates.

## Legacy event-ledger completeness

All Calendar/streak semantics in this document are additionally constrained by `shared/30-legacy-activity-history-quality.md`. Pre-cutover zero cells are unknown rather than proven no-reading, monotonic activity values may become lower bounds, and non-monotonic rankings such as most-active-weekday may be unavailable when the selected period overlaps unreliable history.

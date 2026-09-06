# Reading calendar

## Calendar summary

Повернути:

- `metricRange`: exact inclusive range used by Calendar KPI/summary metrics;
- `displayRange`: exact inclusive range represented by `days[]`;
- `days[]`: `date`, `pagesRead`, `booksCount`, `intensity`, compact `booksPreview[]`, `remainingBooksCount`;
- `booksPreview[]` — максимум 3 книги для первинного рендеру Books mode без додаткових day requests; кожен item містить мінімум `bookId`, `title`, `coverThumbUrl | null`, `pagesRead`;
- `activeDays`
- `activeDaysPercentage` — canonical ratio `0..1`; frontend formats as `%`
- `longestStreak`
- `currentStreak`
- `mostActiveWeekday`

## Week start / calendar layout

`UserProfileSettings.weekStartDay` є canonical source для week ordering. Backend не hardcode-ить Monday-first calendar semantics.

- `monday` → calendar/week presentation починається з понеділка;
- `sunday` → calendar/week presentation починається з неділі;
- `mostActiveWeekday` залишається фактичним weekday metric і не змінює значення через порядок відображення;
- weekly aggregates у Dynamics використовують ту саму week-start semantics, що й calendar;
- Overview top-level `meta.weekStartDay` повертає resolved value, щоб FE не вгадував порядок колонок; `calendar` не дублює окремий independently-populated week-start field.

## Intensity

Рівні relative до active-day distribution користувача в period.
Не hardcode єдині абсолютні page thresholds для всіх користувачів.

## Streak

Follow the complete scope rules in `shared/20-calendar-streak-period-semantics.md`.

- active day: pagesRead > 0;
- `longestStreak` is scoped and clipped to Calendar `metricRange`; it does not absorb active days outside the selected metric period;
- `currentStreak` is available only when `metricRange.to` equals canonical user-local `today`; a closed historical period returns `unavailable + PERIOD_NOT_CURRENT`, **not `0`**;
- for a current period, current streak remains alive through today when the last active day was yesterday; counting is clipped at `metricRange.from`, with `continuesBeforeRange = true` when the real sequence started earlier;
- `today/yesterday` context is timezone-aware through existing `UserProfileSettings.timezone`; the boundary does not depend on server timezone;
- canonical activity membership itself uses stored `BookReadingProgressEvent.date` (`@db.Date`) directly. Do not timezone-shift/re-bucket persisted event dates and do not replace them with `createdAt`; see `shared/16-reading-date-semantics.md`.

## Books preview contract — no N+1

Overview MUST contain enough compact per-day data to render both desktop month-grid Books mode and the initial mobile reading diary **without** calling the day-details endpoint for every visible day.

Canonical daily aggregation:

- group progress events by user-local `date` + `bookId`;
- per-book `pagesRead` is the sum for that day;
- only books with per-book `pagesRead > 0` participate in `booksCount`, preview and day details;
- `booksCount` is the full distinct count for the day;
- choose `booksPreview` from that same set, ordered deterministically by `pagesRead DESC` → `bookId ASC`;
- cap preview at **3** books per day;
- `remainingBooksCount = max(booksCount - booksPreview.length, 0)`;
- do not prioritize books merely because they have a cover; missing cover renders the normal placeholder.

The preview is a **projection of the exact day subset**, not an independently queried/re-ranked approximation. Heatmap mode may ignore `booksPreview`, but it is still part of the single Overview calendar payload.

Do not return full `BookView`/full media objects for every day. Use a compact shared preview DTO (for example `bookId`, `title`, `coverThumbUrl`, `pagesRead`).

## Day details endpoint

Full details remain lazy and are loaded **only after an explicit day interaction** (click/tap/open details), not as a prerequisite for rendering the month/diary.

`GET /api/statistics/reading-days/:date`

Повернути:

- total pages;
- full books count;
- all books from the same canonical daily subset: id/title/cover/pagesRead.

Heatmap and Books mode reuse the same day-details UI after interaction, but **Books mode does not preload/fan out this endpoint for visible days**.

## Period scope / All time

Do not infer Calendar KPI scope from the visible heatmap. Use `shared/20-calendar-streak-period-semantics.md`:

- non-All-time: `metricRange = displayRange =` effective selected period (future dates excluded);
- All time: normalized period has no artificial lower bound; Calendar uses the finite observed window + legacy quality rules from `shared/20-calendar-streak-period-semantics.md` and `shared/30-legacy-activity-history-quality.md`. Never call earliest surviving event the reliability boundary; `displayRange` remains bounded rolling last 12 months;
- `activeDays`, percentage, `longestStreak` and `mostActiveWeekday` use `metricRange`; `days[]` uses `displayRange`;
- All-time UI must disclose the narrower visible calendar range instead of silently changing KPI scope to last 12 months.

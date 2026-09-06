# Calendar Books preview contract

## Goal

`Активність | Книги` must not turn the Statistics Overview into an N+1 API flow. The initial desktop month grid and mobile reading diary are rendered from the **single `/api/statistics/overview` response**.

## Canonical day membership

For a user-local calendar date:

1. take canonical reading progress events in that date;
2. aggregate by `bookId`;
3. sum `pagesRead` per book;
4. keep only books with per-book `pagesRead > 0`;
5. this exact set defines `booksCount`, preview candidates and `/statistics/reading-days/:date` full-detail membership.

Do not count a zero-page-only event as a book read that day.

## Overview day shape

Conceptually:

```ts
type StatisticsCalendarBookPreview = {
  bookId: string;
  title: string;
  coverThumbUrl: string | null;
  pagesRead: number;
};

type StatisticsCalendarDay = {
  date: string;
  pagesRead: number;
  booksCount: number;
  intensity: number;
  booksPreview: StatisticsCalendarBookPreview[]; // max 3
  remainingBooksCount: number;
};
```

Use project-standard Zod/shared schema naming during implementation. The shape above defines semantics, not mandatory symbol names.

## Preview selection

- maximum 3 books;
- deterministic ordering: `pagesRead DESC` → `bookId ASC`;
- `remainingBooksCount = max(booksCount - booksPreview.length, 0)`;
- missing cover does not remove/re-rank the book; render the existing cover placeholder;
- preview data is minimal: do not embed full `BookView` or full book detail payload for each calendar day.

## Lazy full details

`GET /api/statistics/reading-days/:date` returns the full exact day subset and is called only after explicit user interaction.

Allowed:

- initial Overview request;
- user clicks August 18 → one day-details request for August 18.

Forbidden:

- render August month → 31 day-details requests;
- render mobile diary → request every active date merely to get covers.

## Backend implementation

Produce preview data through the same bounded period/day aggregate pipeline as calendar activity. A repository may use grouped queries/batches suitable for the current PostgreSQL/Prisma patterns, but must not loop over days and query each day separately.

## Frontend behavior

- desktop month cell renders up to 3 covers/placeholders and `+N`;
- mobile diary can render the same previews and a summary;
- click/tap opens shared full day-details UI;
- Heatmap mode may ignore preview fields;
- frontend never reconstructs membership or preview ranking.

## Tests

Cover at minimum:

- 1, 2, 3 and 4+ books on one day;
- tie on per-book pages → `bookId ASC`;
- missing cover;
- zero-page-only event excluded;
- `booksCount == full day-detail book count`;
- preview items are a subset of full day details;
- no per-visible-day frontend requests / no per-day backend query loop.

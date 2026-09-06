# Response examples

These are semantic examples/snippets, not a schema replacement. Keep the real contract in `packages/shared`. A snippet may omit unrelated required top-level fields, but every field it does show must match the corresponding shared sub-schema. Full rich/empty/partial/historical contract fixtures used in tests MUST parse the actual Overview Zod schema. All data-quality states below use the canonical `available | partial | unavailable` + coverage contract; `insufficient` is never a fourth public availability value.

## 1. Rich data

```json
{
  "meta": {
    "generatedAt": "2026-08-19T14:35:21.482Z",
    "timezone": "Europe/Kyiv",
    "weekStartDay": "monday",
    "activityHistory": {
      "reliableFrom": "2025-01-01",
      "selectedPeriodQuality": "exact"
    }
  },
  "period": {
    "kind": "year",
    "from": "2026-01-01",
    "to": "2026-08-19",
    "granularity": "month"
  },
  "comparison": {
    "mode": "same_period_last_year",
    "from": "2025-01-01",
    "to": "2025-08-19"
  },
  "kpis": {
    "completedReads": {
      "value": 37,
      "comparison": { "previous": 29, "absoluteDelta": 8, "percentDelta": 27.6 }
    },
    "uniqueBooksCompleted": {
      "value": 35,
      "comparison": { "previous": 29, "absoluteDelta": 6, "percentDelta": 20.7 }
    },
    "pagesRead": {
      "value": 12840,
      "availability": "available",
      "comparison": { "previous": 10420, "absoluteDelta": 2420, "percentDelta": 23.2 }
    },
    "averageRating": {
      "value": 8.6,
      "availability": "partial",
      "coverage": { "eligibleCount": 37, "knownCount": 28, "percent": 0.7568 },
      "comparison": { "previous": 8.2, "absoluteDelta": 0.4 }
    },
    "activeDays": {
      "value": 96,
      "rate": 0.4156,
      "countComparison": { "previous": 80, "absoluteDelta": 16, "percentDelta": 20 },
      "rateComparison": { "previousRate": 0.35, "percentagePointDelta": 6.56 }
    }
  },
  "calendar": {
    "metricRange": { "from": "2026-01-01", "to": "2026-08-19" },
    "displayRange": { "from": "2026-01-01", "to": "2026-08-19" },
    "activeDays": 96,
    "activeDaysPercentage": 0.4156,
    "longestStreak": { "days": 11, "startDate": "2026-04-03", "endDate": "2026-04-13" },
    "currentStreak": {
      "availability": "available",
      "data": {
        "days": 4,
        "startDate": "2026-08-15",
        "endDate": "2026-08-18",
        "continuesBeforeRange": false,
        "continuesBeforeReliableHistory": false
      }
    },
    "days": [
      {
        "date": "2026-08-18",
        "pagesRead": 86,
        "booksCount": 4,
        "intensity": 3,
        "booksPreview": [
          {
            "bookId": "book-a",
            "title": "Book A",
            "coverThumbUrl": "https://example.test/a-thumb",
            "pagesRead": 42
          },
          { "bookId": "book-b", "title": "Book B", "coverThumbUrl": null, "pagesRead": 27 },
          {
            "bookId": "book-c",
            "title": "Book C",
            "coverThumbUrl": "https://example.test/c-thumb",
            "pagesRead": 17
          }
        ],
        "remainingBooksCount": 1
      }
    ]
  },
  "hero": {
    "featuredInsight": {
      "code": "reading_more_than_comparison",
      "category": "reading",
      "tone": "positive",
      "params": {
        "currentReads": 37,
        "comparisonReads": 29,
        "absoluteDeltaReads": 8,
        "percentDelta": 27.6
      }
    }
  },
  "insights": {
    "items": [
      {
        "code": "most_active_weekday",
        "category": "activity",
        "tone": "neutral",
        "params": {
          "weekday": 6,
          "activeDays": 19,
          "pagesRead": 2410
        }
      }
    ]
  }
}
```

In this contract `kpis.completedReads.value = 37` means 37 canonical finished reading cycles, while `kpis.uniqueBooksCompleted.value = 35` means those reads represent 35 distinct `bookId` values in scope. A reread may increment `completedReads` without incrementing `uniqueBooksCompleted`; exact completion details keep `readingCycleId` so duplicate book ids remain distinguishable. The API never names a cycle count `completedBooks`. State-transition metrics such as discovery/series progress/TBR throughput use first-time completion semantics instead.

Calendar summary scope follows `shared/20-calendar-streak-period-semantics.md`: `metricRange` is the exact KPI scope and `displayRange` is the day-cell payload scope. For All time these intentionally differ (tracked lifetime metrics vs bounded last-12-month visualization). Closed historical periods return `currentStreak` as `unavailable + PERIOD_NOT_CURRENT`, not `0`.

The rating value is the canonical BookNest score on the `0.5–10.0` scale; the API does not convert it to stars. `meta.timezone` and `meta.weekStartDay` are resolved from existing `UserProfileSettings` and describe the user-local current-day/week context used by this response; persisted reading `@db.Date` keys keep their stored calendar labels and are not timezone-shifted. `generatedAt` is response-generation/debug metadata, not a dataset version or transaction-snapshot guarantee. Calendar `booksPreview` is intentionally compact and capped at 3; it comes from the same exact daily per-book aggregate as `booksCount` and the lazy full day details. The frontend renders `+remainingBooksCount` rather than fetching every visible day.

Insight examples intentionally contain no user-facing `text`. `code` is the shared discriminator and `params` are raw typed business values. Frontend maps the code to `next-intl` messages and performs locale-aware formatting. The exact enum names may be refined during implementation, but the `code + typed params` contract rule is mandatory. In this example `reading_more_than_comparison` is featured and therefore is **not repeated** in `insights.items`: Hero and regular cards are selected from one backend-ranked pool.

## 2. Historical calendar period

A closed past period has no user-facing `currentStreak`:

```json
{
  "calendar": {
    "metricRange": { "from": "2025-01-01", "to": "2025-12-31" },
    "displayRange": { "from": "2025-01-01", "to": "2025-12-31" },
    "currentStreak": {
      "availability": "unavailable",
      "data": null,
      "reason": "PERIOD_NOT_CURRENT"
    }
  }
}
```

Do not render this as `0 днів`. Hide/reflow the `Поточна серія` KPI for the historical view.

## 3. No ratings

```json
{
  "averageRating": {
    "value": null,
    "availability": "unavailable",
    "coverage": { "eligibleCount": 12, "knownCount": 0, "percent": 0 },
    "reason": "NO_RATINGS"
  }
}
```

Frontend renders `—` and `Немає оцінених книг`, not `0.0`.

## 4. No activity in a reliable period

When the selected period is fully inside the canonical reliable event-history window and contains no progress events, this is a **known zero**, not missing data:

```json
{
  "pagesRead": {
    "value": 0,
    "availability": "available",
    "comparison": null
  }
}
```

For a selected period that overlaps pre-cutover history, use `meta.activityHistory.selectedPeriodQuality = "legacy_lower_bound"` and the rules from `shared/30-legacy-activity-history-quality.md`. Do not translate absence of old rows into exact zero, and do not substitute completed-book `pagesCount`.

## 5. Partial metadata coverage

Language uses canonical `BookLanguageSchema` values. This partial example represents genuinely missing/invalid **legacy snapshot** language; it must not be used as a proxy for uncertainty about whether `ukrainian` was explicitly confirmed. See `shared/22-language-reliability-semantics.md`.

```json
{
  "languages": {
    "availability": "partial",
    "coverage": { "eligibleCount": 37, "knownCount": 20, "percent": 0.5405 },
    "items": [
      { "language": "ukrainian", "books": 12, "shareOfKnown": 0.6 },
      { "language": "english", "books": 8, "shareOfKnown": 0.4 }
    ]
  }
}
```

## 6. TBR history unavailable

```json
{
  "libraryBalance": {
    "periodFlow": {
      "availability": "unavailable",
      "reason": "HISTORY_NOT_TRACKED",
      "data": null
    },
    "current": {
      "ownedBooks": 186,
      "tbrBooks": 87,
      "finishedOwnedBooks": 99
    },
    "forecast": {
      "availability": "available",
      "data": { "durationMonths": 19 }
    }
  }
}
```

## 7. Comparison off

No fake empty previous values:

```json
{
  "comparison": null,
  "dynamics": {
    "current": [],
    "previous": null
  }
}
```

## 8. Empty period

```json
{
  "kpis": {
    "completedReads": { "value": 0, "comparison": null },
    "uniqueBooksCompleted": { "value": 0, "comparison": null },
    "pagesRead": { "value": 0, "availability": "available", "comparison": null }
  }
}
```

The frontend may choose one coherent empty-page state instead of rendering every widget with zeros. The real Overview response still includes top-level `meta` even when the selected period is empty.

## 9. Exact drill-down vs context action

Example for an author ranking row representing **5 completed reads in the active Statistics period**:

```json
{
  "authorId": "author_123",
  "name": "Example Author",
  "completedReadCount": 5,
  "drilldown": {
    "kind": "completed_reads_subset",
    "period": { "from": "2026-01-01", "to": "2026-08-19" },
    "filters": { "authorId": "author_123" }
  },
  "contextActions": [{ "kind": "open_author", "authorId": "author_123" }]
}
```

Primary row click resolves the `drilldown` and must show exactly the 5 contributing completed reads/cycles. `open_author` is related navigation and is rendered separately. If the current Books route cannot reproduce the period + author subset exactly, the frontend uses an exact Statistics detail surface instead of silently dropping the period.

## 10. Historical row whose Book is now soft-deleted

```json
{
  "readingCycleId": "cycle-2025-a",
  "bookId": "book-a",
  "bookState": "soft_deleted",
  "title": "Book A",
  "finishedAt": "2025-06-10",
  "rating": 8.5
}
```

This row remains in an exact 2025 completion/rating drill-down because the reading cycle is a historical fact. `bookState` describes the Book record's current state; it is not Statistics `availability`. If the ordinary Book page cannot open soft-deleted records, frontend keeps the row in Statistics details and omits/disables `Open book` rather than removing it from the subset.

For `libraryBalance.current`, soft-deleted Books are excluded from `ownedBooks`, `tbrBooks` and `finishedOwnedBooks`; those values represent the active current library only.

## Period/comparison edge examples

Canonical rules are in `shared/24-period-comparison-edge-contract.md`. Representative delta payloads:

```json
{
  "positiveBaseline": { "current": 10, "previous": 8, "absoluteDelta": 2, "percentDelta": 25 },
  "zeroBaseline": { "current": 5, "previous": 0, "absoluteDelta": 5, "percentDelta": null },
  "bothZero": { "current": 0, "previous": 0, "absoluteDelta": 0, "percentDelta": null },
  "dropToZero": { "current": 0, "previous": 8, "absoluteDelta": -8, "percentDelta": -100 },
  "activeDayRate": { "currentRate": 0.416, "previousRate": 0.352, "percentagePointDelta": 6.4 }
}
```

A null zero-baseline `percentDelta` is intentional and must not be serialized as Infinity/NaN or converted to `100%`. Rates use ratio values and a separately named percentage-point delta.

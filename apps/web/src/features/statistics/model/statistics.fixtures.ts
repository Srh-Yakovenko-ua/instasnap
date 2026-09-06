import type {
  CompletedReadRef,
  ReadingDayDetails,
  ReadingStatisticsCalendarSection,
  ReadingStatisticsOverview,
  StatisticsCalendarDay,
} from "@app/shared";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";

const SECOND_BOOK_ID = "22222222-2222-4222-8222-222222222222";

const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";

const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";

const SERIES_ID = "55555555-5555-4555-8555-555555555555";

const GOAL_ID = "66666666-6666-4666-8666-666666666666";

const CYCLE_ID = "77777777-7777-4777-8777-777777777777";

const SECOND_CYCLE_ID = "88888888-8888-4888-8888-888888888888";

export const statisticsIds = {
  authorId: AUTHOR_ID,
  bookId: BOOK_ID,
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  publisherId: PUBLISHER_ID,
  secondBookId: SECOND_BOOK_ID,
  secondCycleId: SECOND_CYCLE_ID,
  seriesId: SERIES_ID,
} as const;

export function calendarDayFixture(
  overrides: Partial<StatisticsCalendarDay> = {},
): StatisticsCalendarDay {
  return {
    booksCount: 0,
    booksPreview: [],
    date: "2026-03-02",
    drilldown: { date: "2026-03-02", kind: "reading_day" },
    historyQuality: "exact",
    intensity: 0,
    pagesRead: 0,
    remainingBooksCount: 0,
    ...overrides,
  };
}

export function calendarFixture(
  overrides: Partial<ReadingStatisticsCalendarSection> = {},
): ReadingStatisticsCalendarSection {
  return {
    activeDays: 2,
    activeDaysPercentage: { availability: "available", value: 0.416 },
    availability: "available",
    currentStreak: {
      availability: "available",
      data: {
        continuesBeforeRange: false,
        continuesBeforeReliableHistory: false,
        days: 3,
        endDate: "2026-03-03",
        startDate: "2026-03-01",
      },
    },
    days: [
      calendarDayFixture({
        booksCount: 2,
        booksPreview: [
          { bookId: BOOK_ID, coverThumbUrl: null, pagesRead: 80, title: "Чарівник Земномор'я" },
          { bookId: SECOND_BOOK_ID, coverThumbUrl: null, pagesRead: 44, title: "Друга книга" },
        ],
        date: "2026-03-02",
        drilldown: { date: "2026-03-02", kind: "reading_day" },
        intensity: 3,
        pagesRead: 124,
        remainingBooksCount: 0,
      }),
      calendarDayFixture({
        booksCount: 4,
        booksPreview: [
          { bookId: BOOK_ID, coverThumbUrl: null, pagesRead: 30, title: "Чарівник Земномор'я" },
        ],
        date: "2026-03-03",
        drilldown: { date: "2026-03-03", kind: "reading_day" },
        intensity: 2,
        pagesRead: 60,
        remainingBooksCount: 3,
      }),
    ],
    displayRange: { from: "2026-03-01", to: "2026-03-31" },
    longestStreak: { days: 3, endDate: "2026-03-03", startDate: "2026-03-01" },
    metricRange: { from: "2026-01-01", to: "2026-03-31" },
    mostActiveWeekday: {
      availability: "available",
      data: { activeDays: 2, pagesRead: 184, weekday: 1 },
    },
    ...overrides,
  };
}

export function completedReadFixture(overrides: Partial<CompletedReadRef> = {}): CompletedReadRef {
  return {
    authorName: "Урсула Ле Ґуїн",
    book: {
      bookId: BOOK_ID,
      bookState: "active",
      coverThumbUrl: null,
      title: "Чарівник Земномор'я",
    },
    contextActions: [{ bookId: BOOK_ID, kind: "open_book" }],
    drilldown: { bookId: BOOK_ID, kind: "reading_cycle", readingCycleId: CYCLE_ID },
    finishedAt: "2026-03-14",
    rating: 9,
    readingCycleId: CYCLE_ID,
    ...overrides,
  };
}

export function overviewFixture(
  overrides: Partial<ReadingStatisticsOverview> = {},
): ReadingStatisticsOverview {
  return {
    authors: {
      availability: "available",
      coverage: { eligibleCount: 3, knownCount: 3, percent: 1 },
      frequency: [
        {
          authorId: AUTHOR_ID,
          completedReadCount: 2,
          contextActions: [{ authorId: AUTHOR_ID, kind: "open_author" }],
          drilldown: {
            filters: { authorId: AUTHOR_ID },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          name: "Урсула Ле Ґуїн",
        },
      ],
      returning: {
        availability: "available",
        items: [
          {
            authorId: AUTHOR_ID,
            completedReadCount: 11,
            distinctReadingYears: 4,
            latestFinishedAt: "2026-03-14",
            name: "Урсула Ле Ґуїн",
          },
        ],
      },
      topRated: { availability: "unavailable", items: [], reason: "INSUFFICIENT_SAMPLE" },
    },
    calendar: calendarFixture(),
    comparison: null,
    discoveries: {
      author: {
        authorId: AUTHOR_ID,
        averageRating: 9,
        completedReadsAfterDiscovery: 2,
        drilldown: {
          filters: { authorId: AUTHOR_ID },
          kind: "completed_reads_subset",
          period: { from: "2026-01-01", to: "2026-03-31" },
        },
        firstFinishedAt: "2026-01-20",
        name: "Урсула Ле Ґуїн",
      },
      availability: "available",
      coverage: { eligibleCount: 3, knownCount: 3, percent: 1 },
      genre: null,
      newAuthorsCount: 1,
      newGenresCount: 0,
      newPublishersCount: 0,
      publisher: null,
    },
    dynamics: {
      buckets: [
        {
          completedReads: 3,
          drilldown: {
            filters: { finishedFrom: "2026-03-01", finishedTo: "2026-03-31" },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          end: "2026-03-31",
          pagesRead: 1200,
          start: "2026-03-01",
          uniqueBooksCompleted: 2,
        },
      ],
      comparisonBuckets: null,
      peakCompletedReads: null,
      peakPagesRead: null,
    },
    genres: {
      availability: "available",
      coverage: { eligibleCount: 3, knownCount: 3, percent: 1 },
      frequency: [
        {
          completedReadCount: 2,
          drilldown: {
            filters: { genre: "fantasy" },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          genreKey: "fantasy",
          shareOfCompletedReads: 0.667,
        },
      ],
      topRated: { availability: "unavailable", items: [], reason: "INSUFFICIENT_SAMPLE" },
    },
    goal: {
      activeGoalsCount: 1,
      primaryGoal: {
        contextActions: [{ goalId: GOAL_ID, kind: "open_goal" }],
        deadline: "2026-12-31",
        goalId: GOAL_ID,
        listName: "Класика",
        metrics: {
          actualBooksPerDay: 0.05,
          averageDaysPerBook: 20,
          completedCount: 3,
          daysLeft: 302,
          daysSinceLastCounted: 2,
          elapsedDays: 63,
          elapsedPercent: 17.3,
          expectedCompletedCount: 2,
          lastCountedAt: "2026-03-14",
          pace: "on_track",
          paceDeltaBooks: 1,
          paceDeltaPercent: 12,
          progressPercent: 25,
          projectedCompletionDate: "2026-11-02",
          projectedDaysDelta: -59,
          projectionConfidence: "medium",
          remainingCount: 9,
          requiredBooksPerDay: 0.03,
          requiredDaysPerBook: 33,
          riskLevel: "none",
          riskReasons: [],
          totalDays: 365,
        },
        name: "12 книг за рік",
        status: "active",
        targetCount: 12,
      },
    },
    hero: {
      featuredInsight: {
        category: "genres",
        code: "top_genre_share",
        params: { completedReadCount: 2, genreKey: "fantasy", shareOfCompletedReads: 0.667 },
        tone: "neutral",
      },
      recentCompletedReads: [completedReadFixture()],
    },
    insights: {
      items: [
        {
          category: "activity",
          code: "most_active_weekday",
          params: { activeDays: 2, pagesRead: 184, weekday: 1 },
          tone: "positive",
        },
      ],
    },
    kpis: {
      activeDays: {
        countComparison: null,
        rate: 0.416,
        rateComparison: null,
        value: 96,
      },
      averageRating: {
        availability: "partial",
        comparison: null,
        coverage: { eligibleCount: 37, knownCount: 28, percent: 0.7568 },
        value: 8.6,
      },
      completedReads: { comparison: null, value: 37 },
      pagesRead: { availability: "available", comparison: null, value: 12840 },
      uniqueBooksCompleted: { comparison: null, value: 35 },
    },
    languages: {
      availability: "available",
      coverage: { eligibleCount: 3, knownCount: 3, percent: 1 },
      items: [
        {
          completedReadCount: 2,
          drilldown: {
            filters: { language: "ukrainian" },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          language: "ukrainian",
          shareOfKnown: 0.667,
        },
      ],
    },
    libraryBalance: {
      currentOwnedTotal: 186,
      currentTbrCount: 87,
      flow: { availability: "unavailable", data: null, reason: "HISTORY_NOT_TRACKED" },
      forecast: { availability: "available", data: { monthsRemaining: 21.8, readsPerMonth: 4 } },
      readRatio: 0.53,
    },
    meta: {
      activityHistory: { reliableFrom: "2026-01-01", selectedPeriodQuality: "exact" },
      generatedAt: "2026-03-31T09:00:00.000Z",
      timezone: "Europe/Kyiv",
      weekStartDay: "monday",
    },
    period: { from: "2026-01-01", granularity: "month", kind: "year", to: "2026-03-31" },
    publishers: {
      availability: "available",
      coverage: { eligibleCount: 3, knownCount: 3, percent: 1 },
      items: [
        {
          averageRating: 8.5,
          completedReadCount: 2,
          contextActions: [{ kind: "open_publisher", publisherId: PUBLISHER_ID }],
          drilldown: {
            filters: { publisherId: PUBLISHER_ID },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          name: "Видавництво Старого Лева",
          publisherId: PUBLISHER_ID,
        },
      ],
      topThreeConcentration: 0.8,
      totalPublishers: 4,
    },
    ratings: {
      availability: "partial",
      averageRating: 8.6,
      completedReadsCount: 37,
      coverage: { eligibleCount: 37, knownCount: 28, percent: 0.7568 },
      distribution: [
        { completedReadCount: 4, rating: 9 },
        { completedReadCount: 2, rating: 8 },
      ],
      highRatedReadsCount: 18,
      highRatedShare: 0.64,
      ratedReadsCount: 28,
      topRated: [completedReadFixture()],
    },
    records: {
      items: [
        {
          data: {
            date: "2026-03-02",
            drilldown: { date: "2026-03-02", kind: "reading_day" },
            pagesRead: 124,
          },
          type: "most_pages_in_day",
        },
      ],
    },
    series: {
      availability: "available",
      completedReadsCount: 37,
      lifecycle: {
        availability: "available",
        data: { caughtUp: 1, completed: 2, continued: 3, started: 4 },
      },
      marathon: {
        availability: "available",
        data: { endFinishedAt: "2026-03-14", length: 3, name: "Земномор'я", seriesId: SERIES_ID },
      },
      mostActive: [
        {
          attributablePagesRead: 900,
          completedReadCycles: 3,
          contextActions: [{ kind: "open_series", seriesId: SERIES_ID }],
          drilldown: {
            filters: { seriesId: SERIES_ID },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
          latestFinishedAt: "2026-03-14",
          name: "Земномор'я",
          seriesId: SERIES_ID,
        },
      ],
      seriesCompletedReadsCount: 16,
      seriesShare: 0.43,
      topProgress: [{ distinctFirstCompletions: 4, name: "Земномор'я", seriesId: SERIES_ID }],
    },
    ...overrides,
  };
}

export function readingDayDetailsFixture(
  overrides: Partial<ReadingDayDetails> = {},
): ReadingDayDetails {
  return {
    books: [
      {
        bookId: BOOK_ID,
        bookState: "active",
        coverThumbUrl: null,
        pagesRead: 80,
        title: "Чарівник Земномор'я",
      },
      {
        bookId: SECOND_BOOK_ID,
        bookState: "soft_deleted",
        coverThumbUrl: null,
        pagesRead: 44,
        title: "Видалена книга",
      },
    ],
    booksCount: 2,
    date: "2026-03-02",
    historyQuality: "exact",
    pagesRead: 124,
    ...overrides,
  };
}

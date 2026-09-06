import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { FIRST_COMPLETION_RELIABILITY, READING_CYCLE_STATE } from "../../books/index.js";

const completedReadArgs = {
  select: {
    book: {
      select: {
        coverMedia: true,
        deletedAt: true,
        title: true,
      },
    },
    bookId: true,
    completionMetadata: true,
    finishedAt: true,
    firstCompletionReliability: true,
    id: true,
    rating: true,
    startedAt: true,
  },
} satisfies Prisma.BookReadingCycleDefaultArgs;

const CompletionTotalsRowSchema = z.object({
  completedReads: z.number().int().nonnegative(),
  ratedReads: z.number().int().nonnegative(),
  ratingSum: z.number().nullable(),
  uniqueBooks: z.number().int().nonnegative(),
});

const PriorExposureRowSchema = z.object({
  authorIds: z.array(z.string()),
  genreKeys: z.array(z.string()),
  publisherIds: z.array(z.string()),
});

const ReturningAuthorRowSchema = z.object({
  authorId: z.string(),
  completedReadCount: z.number().int().nonnegative(),
  distinctReadingYears: z.number().int().nonnegative(),
  latestFinishedAt: z.date(),
  name: z.string(),
});

const CountRowSchema = z.object({ count: z.number().int().nonnegative() });

const SeriesFirstCompletionRowSchema = z.object({
  distinctBooks: z.number().int().nonnegative(),
  seriesId: z.string(),
});

export type CompletedReadRow = Prisma.BookReadingCycleGetPayload<typeof completedReadArgs>;

export type CompletionTotals = z.infer<typeof CompletionTotalsRowSchema>;

export type PeriodScope = { from: Nullable<string>; to: string; userId: string };

export type ReturningAuthor = {
  authorId: string;
  completedReadCount: number;
  distinctReadingYears: number;
  latestFinishedAt: string;
  name: string;
};

@Injectable()
export class StatisticsCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countFirstCompletionsSince({
    since,
    userId,
  }: {
    since: string;
    userId: string;
  }): Promise<number> {
    const rows = await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT cycle.book_id)::int AS "count"
      FROM book_reading_cycles cycle
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
        AND cycle.finished_at >= ${since}::date
    `;

    const [row] = z.array(CountRowSchema).parse(rows);
    return row?.count ?? 0;
  }

  async countPriorExposure({
    before,
    userId,
  }: {
    before: Nullable<string>;
    userId: string;
  }): Promise<z.infer<typeof PriorExposureRowSchema>> {
    if (before === null) {
      return { authorIds: [], genreKeys: [], publisherIds: [] };
    }

    const rows = await this.prisma.$queryRaw`
      SELECT
        COALESCE(array_agg(DISTINCT author ->> 'authorId') FILTER (WHERE author IS NOT NULL), '{}') AS "authorIds",
        COALESCE(array_agg(DISTINCT genre) FILTER (WHERE genre IS NOT NULL), '{}') AS "genreKeys",
        COALESCE(
          array_agg(DISTINCT cycle.completion_metadata -> 'publisher' ->> 'publisherId')
            FILTER (WHERE cycle.completion_metadata -> 'publisher' ->> 'publisherId' IS NOT NULL),
          '{}'
        ) AS "publisherIds"
      FROM book_reading_cycles cycle
      LEFT JOIN LATERAL jsonb_array_elements(cycle.completion_metadata -> 'authors') AS author ON TRUE
      LEFT JOIN LATERAL jsonb_array_elements_text(cycle.completion_metadata -> 'book' -> 'genres') AS genre ON TRUE
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
        AND cycle.finished_at < ${before}::date
    `;

    const [row] = z.array(PriorExposureRowSchema).parse(rows);
    return row ?? { authorIds: [], genreKeys: [], publisherIds: [] };
  }

  async countSeriesFirstCompletionsBefore({
    before,
    userId,
  }: {
    before: Nullable<string>;
    userId: string;
  }): Promise<Map<string, number>> {
    if (before === null) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw`
      SELECT
        cycle.completion_metadata -> 'series' ->> 'seriesId' AS "seriesId",
        COUNT(DISTINCT cycle.book_id)::int AS "distinctBooks"
      FROM book_reading_cycles cycle
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
        AND cycle.finished_at < ${before}::date
        AND cycle.completion_metadata -> 'series' ->> 'seriesId' IS NOT NULL
      GROUP BY 1
    `;

    return new Map(
      z
        .array(SeriesFirstCompletionRowSchema)
        .parse(rows)
        .map((row) => [row.seriesId, row.distinctBooks]),
    );
  }

  async countTotals({ from, to, userId }: PeriodScope): Promise<CompletionTotals> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "completedReads",
        COUNT(DISTINCT cycle.book_id)::int AS "uniqueBooks",
        COUNT(cycle.rating)::int AS "ratedReads",
        SUM(cycle.rating)::float8 AS "ratingSum"
      FROM book_reading_cycles cycle
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.finished_at IS NOT NULL
        AND (${from}::date IS NULL OR cycle.finished_at >= ${from}::date)
        AND cycle.finished_at <= ${to}::date
    `;

    const [row] = z.array(CompletionTotalsRowSchema).parse(rows);
    return row ?? { completedReads: 0, ratedReads: 0, ratingSum: null, uniqueBooks: 0 };
  }

  findCompletedReads({ from, to, userId }: PeriodScope): Promise<CompletedReadRow[]> {
    return this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      where: {
        finishedAt: {
          gte: from === null ? undefined : parseIsoDate(from),
          lte: parseIsoDate(to),
          not: null,
        },
        state: READING_CYCLE_STATE.finished,
        userId,
      },
      ...completedReadArgs,
    });
  }

  async findEarliestFinishedAt(userId: string): Promise<Nullable<Date>> {
    const earliest = await this.prisma.bookReadingCycle.aggregate({
      _min: { finishedAt: true },
      where: { state: READING_CYCLE_STATE.finished, userId },
    });
    return earliest._min.finishedAt;
  }

  async findReturningAuthors({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<ReturningAuthor[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        author ->> 'authorId' AS "authorId",
        (array_agg(author ->> 'name' ORDER BY cycle.finished_at DESC))[1] AS "name",
        COUNT(*)::int AS "completedReadCount",
        COUNT(DISTINCT date_part('year', cycle.finished_at))::int AS "distinctReadingYears",
        MAX(cycle.finished_at) AS "latestFinishedAt"
      FROM book_reading_cycles cycle
      JOIN LATERAL jsonb_array_elements(cycle.completion_metadata -> 'authors') AS author ON TRUE
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.finished_at IS NOT NULL
      GROUP BY 1
      HAVING COUNT(DISTINCT date_part('year', cycle.finished_at)) >= 2
      ORDER BY 4 DESC, 3 DESC, 5 DESC, 1 ASC
      LIMIT ${limit}
    `;

    return z
      .array(ReturningAuthorRowSchema)
      .parse(rows)
      .map((row) => ({ ...row, latestFinishedAt: toIsoDate(row.latestFinishedAt) }));
  }
}

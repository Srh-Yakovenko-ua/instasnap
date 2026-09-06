import type { Nullable } from "@app/shared";

import { CALENDAR_BOOKS_PREVIEW_LIMIT } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";

const DayActivityRowSchema = z.object({
  booksCount: z.number().int().nonnegative(),
  date: z.date(),
  pagesRead: z.number().int().nonnegative(),
});

const BookPagesRowSchema = z.object({
  bookId: z.string(),
  pagesRead: z.number().int().nonnegative(),
});

const DayBookRowSchema = z.object({
  bookId: z.string(),
  date: z.date(),
  pagesRead: z.number().int().nonnegative(),
});

const TotalPagesRowSchema = z.object({ pagesRead: z.number().int().nonnegative() });

export type ActivityScope = { from: Nullable<string>; to: string; userId: string };

export type DayActivityRow = { booksCount: number; date: string; pagesRead: number };

export type DayBookRow = { bookId: string; date: string; pagesRead: number };

export type DayBookWithPresentation = DayBookRow & {
  coverMedia: Nullable<MediaAssetModel>;
  deletedAt: Nullable<Date>;
  title: string;
};

@Injectable()
export class StatisticsActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateDays({ from, to, userId }: ActivityScope): Promise<DayActivityRow[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        event.date AS "date",
        SUM(event.pages_read)::int AS "pagesRead",
        COUNT(DISTINCT event.book_id)::int AS "booksCount"
      FROM book_reading_progress_events event
      JOIN books book ON book.id = event.book_id
      WHERE book.user_id = ${userId}::uuid
        AND (${from}::date IS NULL OR event.date >= ${from}::date)
        AND event.date <= ${to}::date
      GROUP BY event.date
      ORDER BY event.date ASC
    `;

    return z
      .array(DayActivityRowSchema)
      .parse(rows)
      .map((row) => ({ ...row, date: toIsoDate(row.date) }));
  }

  async aggregatePagesByBook({ from, to, userId }: ActivityScope): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw`
      SELECT event.book_id AS "bookId", SUM(event.pages_read)::int AS "pagesRead"
      FROM book_reading_progress_events event
      JOIN books book ON book.id = event.book_id
      WHERE book.user_id = ${userId}::uuid
        AND (${from}::date IS NULL OR event.date >= ${from}::date)
        AND event.date <= ${to}::date
      GROUP BY event.book_id
    `;

    return new Map(
      z
        .array(BookPagesRowSchema)
        .parse(rows)
        .map((row) => [row.bookId, row.pagesRead]),
    );
  }

  async findDayBookPreviews({
    from,
    to,
    userId,
  }: {
    from: string;
    to: string;
    userId: string;
  }): Promise<DayBookWithPresentation[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT ranked.date AS "date", ranked.book_id AS "bookId", ranked."pagesRead"
      FROM (
        SELECT
          event.date,
          event.book_id,
          SUM(event.pages_read)::int AS "pagesRead",
          ROW_NUMBER() OVER (
            PARTITION BY event.date
            ORDER BY SUM(event.pages_read) DESC, event.book_id ASC
          ) AS position
        FROM book_reading_progress_events event
        JOIN books book ON book.id = event.book_id
        WHERE book.user_id = ${userId}::uuid
          AND event.date >= ${from}::date
          AND event.date <= ${to}::date
        GROUP BY event.date, event.book_id
        HAVING SUM(event.pages_read) > 0
      ) ranked
      WHERE ranked.position <= ${CALENDAR_BOOKS_PREVIEW_LIMIT}
      ORDER BY ranked.date ASC, ranked."pagesRead" DESC, ranked.book_id ASC
    `;

    return this.withPresentation({
      rows: z
        .array(DayBookRowSchema)
        .parse(rows)
        .map((row) => ({ ...row, date: toIsoDate(row.date) })),
      userId,
    });
  }

  async findDayDetails({
    date,
    userId,
  }: {
    date: string;
    userId: string;
  }): Promise<DayBookWithPresentation[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT event.date AS "date", event.book_id AS "bookId", SUM(event.pages_read)::int AS "pagesRead"
      FROM book_reading_progress_events event
      JOIN books book ON book.id = event.book_id
      WHERE book.user_id = ${userId}::uuid
        AND event.date = ${date}::date
      GROUP BY event.date, event.book_id
      HAVING SUM(event.pages_read) > 0
      ORDER BY SUM(event.pages_read) DESC, event.book_id ASC
    `;

    return this.withPresentation({
      rows: z
        .array(DayBookRowSchema)
        .parse(rows)
        .map((row) => ({ ...row, date: toIsoDate(row.date) })),
      userId,
    });
  }

  async findEarliestActivityDate(userId: string): Promise<Nullable<string>> {
    const earliest = await this.prisma.bookReadingProgressEvent.aggregate({
      _min: { date: true },
      where: { book: { userId } },
    });
    const date = earliest._min.date;
    return date === null ? null : toIsoDate(date);
  }

  async hasActivityBefore({ date, userId }: { date: string; userId: string }): Promise<boolean> {
    const event = await this.prisma.bookReadingProgressEvent.findFirst({
      select: { id: true },
      where: {
        book: { userId },
        date: { lt: parseIsoDate(date) },
        pagesRead: { gt: 0 },
      },
    });
    return event !== null;
  }

  async sumPages({ from, to, userId }: ActivityScope): Promise<number> {
    const rows = await this.prisma.$queryRaw`
      SELECT COALESCE(SUM(event.pages_read), 0)::int AS "pagesRead"
      FROM book_reading_progress_events event
      JOIN books book ON book.id = event.book_id
      WHERE book.user_id = ${userId}::uuid
        AND (${from}::date IS NULL OR event.date >= ${from}::date)
        AND event.date <= ${to}::date
    `;

    const [row] = z.array(TotalPagesRowSchema).parse(rows);
    return row?.pagesRead ?? 0;
  }

  private async withPresentation({
    rows,
    userId,
  }: {
    rows: DayBookRow[];
    userId: string;
  }): Promise<DayBookWithPresentation[]> {
    const bookIds = [...new Set(rows.map((row) => row.bookId))];
    if (bookIds.length === 0) {
      return [];
    }

    const books = await this.prisma.book.findMany({
      select: { coverMedia: true, deletedAt: true, id: true, title: true },
      where: { id: { in: bookIds }, userId },
    });
    const byId = new Map(books.map((book) => [book.id, book]));

    return rows.flatMap((row) => {
      const book = byId.get(row.bookId);
      return book === undefined
        ? []
        : [
            {
              ...row,
              coverMedia: book.coverMedia,
              deletedAt: book.deletedAt,
              title: book.title,
            },
          ];
    });
  }
}

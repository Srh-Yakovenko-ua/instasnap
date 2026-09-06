import type { Currency, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookBudgetModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type BudgetVersionKey = {
  currency: Currency;
  userId: string;
  validFromMonth: Date;
};

@Injectable()
export class BookBudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  closeVersionCovering(
    { currency, userId, validToMonth }: { currency: Currency; userId: string; validToMonth: Date },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.bookBudget
      .updateMany({
        data: { validToMonth },
        where: {
          currency,
          OR: [{ validToMonth: null }, { validToMonth: { gt: validToMonth } }],
          userId,
          validFromMonth: { lt: validToMonth },
        },
      })
      .then((result) => result.count);
  }

  create(
    {
      currency,
      monthlyAmount,
      userId,
      validFromMonth,
      validToMonth,
    }: BudgetVersionKey & { monthlyAmount: number; validToMonth: Nullable<Date> },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookBudgetModel> {
    return client.bookBudget.create({
      data: { currency, monthlyAmount, userId, validFromMonth, validToMonth },
    });
  }

  deleteById(
    { id }: { id: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookBudgetModel> {
    return client.bookBudget.delete({ where: { id } });
  }

  findByStartMonth(
    { currency, userId, validFromMonth }: BudgetVersionKey,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookBudgetModel>> {
    return client.bookBudget.findUnique({
      where: { userId_currency_validFromMonth: { currency, userId, validFromMonth } },
    });
  }

  findEffectiveAt(
    { currency, month, userId }: { currency: Currency; month: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookBudgetModel>> {
    return client.bookBudget.findFirst({
      orderBy: { validFromMonth: "desc" },
      where: {
        currency,
        OR: [{ validToMonth: null }, { validToMonth: { gt: month } }],
        userId,
        validFromMonth: { lte: month },
      },
    });
  }

  findEffectiveOrLater(
    { month, userId }: { month: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookBudgetModel[]> {
    return client.bookBudget.findMany({
      orderBy: [{ validFromMonth: "asc" }, { id: "asc" }],
      where: { OR: [{ validToMonth: null }, { validToMonth: { gt: month } }], userId },
    });
  }

  findFirstStartingAfter(
    { currency, month, userId }: { currency: Currency; month: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookBudgetModel>> {
    return client.bookBudget.findFirst({
      orderBy: { validFromMonth: "asc" },
      where: { currency, userId, validFromMonth: { gt: month } },
    });
  }

  async findScheduledStop(
    { currency, month, userId }: { currency: Currency; month: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookBudgetModel & { validToMonth: Date }>> {
    const closing = await client.bookBudget.findFirst({
      orderBy: { validFromMonth: "desc" },
      where: { currency, userId, validToMonth: { gt: month } },
    });
    if (closing === null || closing.validToMonth === null) {
      return null;
    }

    const following = await client.bookBudget.findFirst({
      where: { currency, userId, validFromMonth: closing.validToMonth },
    });

    return following === null ? { ...closing, validToMonth: closing.validToMonth } : null;
  }

  reopenVersionEndingAt(
    {
      currency,
      endedAt,
      userId,
      validToMonth,
    }: { currency: Currency; endedAt: Date; userId: string; validToMonth: Nullable<Date> },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.bookBudget
      .updateMany({
        data: { validToMonth },
        where: { currency, userId, validToMonth: endedAt },
      })
      .then((result) => result.count);
  }

  updateAmountByStartMonth(
    {
      currency,
      monthlyAmount,
      userId,
      validFromMonth,
    }: BudgetVersionKey & { monthlyAmount: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.bookBudget
      .updateMany({
        data: { monthlyAmount },
        where: { currency, userId, validFromMonth },
      })
      .then((result) => result.count);
  }
}

import { describe, expect, it } from "vitest";

import type { LoansQueryState } from "./loans-query";

import {
  countActiveLoanFilters,
  hasActiveLoanFilters,
  hasInvalidLoanRange,
  LOANS_ADVANCED_EMPTY,
  toLoansListParams,
} from "./loans-query";

const BASE_STATE: LoansQueryState = {
  ...LOANS_ADVANCED_EMPTY,
  filter: "all",
  q: "",
  sort: "overdue_first",
};

describe("toLoansListParams", () => {
  it("sends every advanced condition under its API name", () => {
    const params = toLoansListParams(
      {
        ...BASE_STATE,
        contactId: "11111111-1111-4111-8111-111111111111",
        dueFrom: "2026-08-01",
        dueTo: "2026-08-31",
        hasNote: true,
        loanFrom: "2026-07-01",
        loanTo: "2026-07-31",
        q: "  дюна  ",
        reminder: "off",
      },
      "lent_to_someone",
    );

    expect(params).toMatchObject({
      contactId: "11111111-1111-4111-8111-111111111111",
      expectedReturnDateFrom: "2026-08-01",
      expectedReturnDateTo: "2026-08-31",
      hasNote: "true",
      loanDateFrom: "2026-07-01",
      loanDateTo: "2026-07-31",
      reminder: "off",
      search: "дюна",
      type: "lent_to_someone",
    });
  });

  it("keeps a quick filter alongside the advanced ones", () => {
    const params = toLoansListParams(
      { ...BASE_STATE, filter: "overdue", reminder: "off" },
      "lent_to_someone",
    );

    expect(params.filter).toBe("overdue");
    expect(params.reminder).toBe("off");
  });

  it("asks for loans without a note", () => {
    const params = toLoansListParams({ ...BASE_STATE, hasNote: false }, "lent_to_someone");

    expect(params.hasNote).toBe("false");
  });

  it("sends an open-ended range", () => {
    const params = toLoansListParams({ ...BASE_STATE, dueFrom: "2026-08-01" }, "lent_to_someone");

    expect(params.expectedReturnDateFrom).toBe("2026-08-01");
    expect(params.expectedReturnDateTo).toBeUndefined();
  });

  it("drops an inverted range instead of asking for it", () => {
    const params = toLoansListParams(
      { ...BASE_STATE, dueFrom: "2026-08-31", dueTo: "2026-08-01", loanFrom: "2026-07-01" },
      "lent_to_someone",
    );

    expect(params.expectedReturnDateFrom).toBeUndefined();
    expect(params.expectedReturnDateTo).toBeUndefined();
    expect(params.loanDateFrom).toBe("2026-07-01");
  });

  it("leaves out the conditions nobody set", () => {
    const params = toLoansListParams(BASE_STATE, "borrowed_from_someone");

    expect(params).toEqual({
      filter: "all",
      pageSize: 10,
      sort: "overdue_first",
      type: "borrowed_from_someone",
    });
  });
});

describe("hasInvalidLoanRange", () => {
  it("flags a range that ends before it starts", () => {
    expect(
      hasInvalidLoanRange({
        ...LOANS_ADVANCED_EMPTY,
        loanFrom: "2026-08-10",
        loanTo: "2026-08-01",
      }),
    ).toBe(true);
  });

  it("accepts an open-ended range", () => {
    expect(hasInvalidLoanRange({ ...LOANS_ADVANCED_EMPTY, loanFrom: "2026-08-10" })).toBe(false);
  });
});

describe("countActiveLoanFilters", () => {
  it("counts a date range as one condition", () => {
    expect(
      countActiveLoanFilters({
        ...LOANS_ADVANCED_EMPTY,
        dueFrom: "2026-08-01",
        dueTo: "2026-08-31",
      }),
    ).toBe(1);
  });

  it("counts every dimension the reader picked", () => {
    expect(
      countActiveLoanFilters({
        ...LOANS_ADVANCED_EMPTY,
        contactId: "11111111-1111-4111-8111-111111111111",
        dueFrom: "2026-08-01",
        hasNote: false,
        loanTo: "2026-07-31",
        reminder: "on",
      }),
    ).toBe(5);
  });
});

describe("hasActiveLoanFilters", () => {
  it("notices an advanced condition while the quick filter stays default", () => {
    expect(hasActiveLoanFilters({ ...BASE_STATE, reminder: "on" })).toBe(true);
  });

  it("stays quiet when nothing is set", () => {
    expect(hasActiveLoanFilters(BASE_STATE)).toBe(false);
  });
});

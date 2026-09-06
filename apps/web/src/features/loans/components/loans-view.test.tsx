import "@testing-library/jest-dom/vitest";

import type {
  LoanContactView,
  LoanDirectionSummary,
  LoanHistoryOverviewView,
  LoanListItemView,
  LoansSummaryView,
  LoanType,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { addDays, format } from "date-fns";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LOANS_PAGE_SIZE } from "../model/loans-query";
import { LoansView } from "./loans-view";

const push = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const CONTACT_IDS = {
  iryna: "33333333-3333-4333-8333-333333333333",
  olena: "11111111-1111-4111-8111-111111111111",
  olya: "44444444-4444-4444-8444-444444444444",
  petro: "22222222-2222-4222-8222-222222222222",
} as const;

const copy = messages.loans;
const actions = messages.loans.actions;
const contactDrawer = messages.loans.contactDrawer;
const stats = messages.loans.stats;
const attention = messages.loans.sidebar.attention;
const longHeld = messages.loans.sidebar.longHeld;
const people = messages.loans.sidebar.people;
const quickFilters = messages.loans.quickFilters;
const advanced = messages.loans.advancedFilters;
const activeFilters = messages.loans.activeFilters;
const library = messages.books.library.activeFilters;
const row = messages.loans.row;
const sort = messages.loans.sort;
const upcoming = messages.loans.sidebar.upcoming;
const requestedUrls: string[] = [];

const EMPTY_DIRECTION_SUMMARY: LoanDirectionSummary = {
  earliestLoanDate: null,
  longHeldCount: 0,
  longHeldLoans: [],
  nearestReturnDate: null,
  noReminderWithDateCount: 0,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  topPeople: [],
  totalCount: 0,
  upcomingReturns: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  requestedUrls.length = 0;
  push.mockClear();
});

describe("LoansView", () => {
  it("asks the API only for borrowed loans and renders the borrowed page", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    expect(
      await screen.findByRole("heading", { level: 1, name: copy.pages.borrowed.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Гобіт")).toBeInTheDocument();
    expect(listUrl()).toContain("type=borrowed_from_someone");
    expect(listUrl()).not.toContain("lent_to_someone");
  });

  it("asks the API only for lent loans and renders the lent page", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone");

    expect(
      await screen.findByRole("heading", { level: 1, name: copy.pages.lent.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(listUrl()).toContain("type=lent_to_someone");
  });

  it("opens the person card from the name in a row", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone");

    const card = await findLoanCard("Дюна");
    await userEvent.click(within(card).getByRole("button", { name: openContactLabel("Оля") }));

    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByRole("heading", { name: "Оля" })).toBeInTheDocument();
    expect(requestedUrls).toContain(`/api/loans/contacts/${CONTACT_IDS.olya}`);
  });

  it("renders no tab switcher", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    await screen.findByText("Гобіт");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("keeps search and filters from the URL in the request", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone", "?q=hobbit&filter=overdue&sort=title");

    await screen.findByText("Гобіт");
    expect(listUrl()).toContain("search=hobbit");
    expect(listUrl()).toContain("filter=overdue");
    expect(listUrl()).toContain("sort=title");
  });

  it("counts the quick filter chips from the summary, zero included", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReturnDateCount: 2,
        overdueCount: 3,
        returningSoonCount: 0,
        totalCount: 9,
      },
    });

    renderLoans("borrowed_from_someone");

    await waitFor(() => {
      expect(within(chip(quickFilters.all)).getByText("9")).toBeInTheDocument();
    });
    expect(within(chip(quickFilters.overdue)).getByText("3")).toBeInTheDocument();
    expect(within(chip(quickFilters.return_soon)).getByText("0")).toBeInTheDocument();
    expect(within(chip(quickFilters.no_return_date)).getByText("2")).toBeInTheDocument();
  });

  it("keeps the quick filters to loan status on both pages", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, noReminderWithDateCount: 5, totalCount: 6 },
    });

    renderLoans("lent_to_someone");

    await findChip(quickFilters.all);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByRole("radio", { name: /нагадування/i })).not.toBeInTheDocument();
  });

  it("filters the list from a chip and starts it over at the first page", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockLoans(
      Array.from({ length: 12 }, (_, index) =>
        loanItem("borrowed_from_someone", `Книга ${index + 1}`),
      ),
      { borrowed: { ...EMPTY_DIRECTION_SUMMARY, overdueCount: 4, totalCount: 12 } },
    );

    renderLoans("borrowed_from_someone", "", onUrlUpdate);

    expect(await screen.findByText("Книга 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.loadMore }));
    expect(await screen.findByText("Книга 11")).toBeInTheDocument();
    expect(listUrls().some((url) => url.includes("pageNumber=2"))).toBe(true);

    requestedUrls.length = 0;
    await userEvent.click(await findChip(quickFilters.overdue));

    await waitFor(() => {
      expect(events.at(-1)?.searchParams.get("filter")).toBe("overdue");
    });
    await waitFor(() => {
      expect(listUrls().some((url) => url.includes("filter=overdue"))).toBe(true);
    });
    expect(listUrls().every((url) => url.includes("pageNumber=1"))).toBe(true);
    await waitFor(() => {
      expect(screen.queryByText("Книга 11")).not.toBeInTheDocument();
    });
  });

  it("counts the shown loans against every active loan of this page", async () => {
    mockLoans(
      Array.from({ length: 12 }, (_, index) =>
        loanItem("borrowed_from_someone", `Книга ${index + 1}`),
      ),
      { borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 17 } },
    );

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText("Показано 12 із 17 книг")).toBeInTheDocument();
  });

  it("leads the borrowed card with the term and the owner", async () => {
    mockLoans([
      loanItem("borrowed_from_someone", "Гобіт", {
        expectedReturnDate: isoDaysFromToday(5),
        personName: "Ігор",
      }),
    ]);

    renderLoans("borrowed_from_someone");

    const card = await findLoanCard("Гобіт");
    expect(within(card).getByText("Повернути через 5 днів")).toBeInTheDocument();
    expect(within(card).getByText("Ігор")).toBeInTheDocument();
    expect(within(card).getByText(row.personBorrowed)).toBeInTheDocument();
  });

  it("spells the return term once, with the exact date underneath", async () => {
    const due = dueIn(-3);
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: due.iso,
        loanUiStatus: "overdue",
      }),
    ]);

    renderLoans("lent_to_someone");

    const card = await findLoanCard("Дюна");
    expect(within(card).getByText("Прострочено на 3 дні")).toBeInTheDocument();
    expect(
      within(card).getByText(row.term.wasDue.replace("{date}", due.display)),
    ).toBeInTheDocument();
    expect(within(card).queryByText(messages.loans.status.overdue)).not.toBeInTheDocument();
    expect(within(card).queryByText(due.display)).not.toBeInTheDocument();
  });

  it.each([
    { expected: row.term.today, offset: 0, status: "return_soon" as const },
    { expected: row.term.tomorrow, offset: 1, status: "return_soon" as const },
    { expected: "Повернути через 2 дні", offset: 2, status: "return_soon" as const },
    { expected: "Повернути через 9 днів", offset: 9, status: "on_time" as const },
  ])("reads a $offset-day term as its own sentence", async ({ expected, offset, status }) => {
    const due = dueIn(offset);
    mockLoans([
      loanItem("borrowed_from_someone", "Гобіт", {
        expectedReturnDate: due.iso,
        loanUiStatus: status,
      }),
    ]);

    renderLoans("borrowed_from_someone");

    const card = await findLoanCard("Гобіт");
    expect(within(card).getByText(expected)).toBeInTheDocument();
    expect(
      within(card).getByText(row.term.dueBy.replace("{date}", due.display)),
    ).toBeInTheDocument();
    expect(within(card).queryByText(messages.loans.status[status])).not.toBeInTheDocument();
  });

  it("leaves a loan without a due date with a single line", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: null,
        loanUiStatus: "no_return_date",
      }),
    ]);

    renderLoans("lent_to_someone");

    const card = await findLoanCard("Дюна");
    expect(within(card).getByText(row.term.none)).toBeInTheDocument();
    expect(within(card).queryByText(messages.loans.status.no_return_date)).not.toBeInTheDocument();
    expect(within(card).queryByText(/^До /)).not.toBeInTheDocument();
    expect(within(card).queryByText(/^Термін був /)).not.toBeInTheDocument();
  });

  it("counts how long a lent book is overdue and closes the loan from the menu", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: isoDaysFromToday(-8),
        loanUiStatus: "overdue",
        personName: "Олена",
      }),
    ]);

    renderLoans("lent_to_someone");

    const card = await findLoanCard("Дюна");
    expect(within(card).getByText("Прострочено на 8 днів")).toBeInTheDocument();
    expect(within(card).getByText(row.personLent)).toBeInTheDocument();

    const menuTriggers = within(card).getAllByRole("button", {
      name: messages.loans.actions.menu,
    });
    await userEvent.click(menuTriggers[0] ?? card);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: messages.loans.actions.markReturned }),
    );

    expect(
      await screen.findByRole("alertdialog", { name: messages.loans.return.titleLent }),
    ).toBeInTheDocument();
  });

  it("offers the quick actions of a dated loan", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: isoDaysFromToday(5),
        remindBeforeDays: 3,
        remindToReturn: true,
      }),
    ]);

    renderLoans("lent_to_someone");

    await openLoanMenu("Дюна");

    expect(await screen.findByRole("menuitem", { name: actions.changeReturnDate })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Продовжити на 7 днів" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Продовжити на 14 днів" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Нагадування: за 3 дні/ })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: actions.edit })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: actions.markReturned })).toBeVisible();
  });

  it("asks the API to push the return date and names the new one", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна", { expectedReturnDate: isoDaysFromToday(5) })]);

    renderLoans("lent_to_someone");

    await openLoanMenu("Дюна");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Продовжити на 7 днів" }));

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes("/loan/extend"))).toBe(true);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Новий термін повернення —"),
      );
    });
  });

  it("keeps the extend and reminder actions away from a loan without a return date", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: null,
        loanUiStatus: "no_return_date",
      }),
    ]);

    renderLoans("lent_to_someone");

    await openLoanMenu("Дюна");

    expect(await screen.findByRole("menuitem", { name: actions.setReturnDate })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: /Продовжити/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Нагадування/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: actions.reminderSetup })).not.toBeInTheDocument();
  });

  it("counts an overdue loan from today instead of offering to extend it", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: isoDaysFromToday(-4),
        loanUiStatus: "overdue",
      }),
    ]);

    renderLoans("lent_to_someone");

    await openLoanMenu("Дюна");

    expect(
      await screen.findByRole("menuitem", { name: "Новий термін через 7 днів" }),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Новий термін через 14 днів" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: /Продовжити/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: actions.reminderSetup })).not.toBeInTheDocument();
  });

  it("says a loan has no return date instead of leaving the term blank", async () => {
    mockLoans([
      loanItem("lent_to_someone", "Дюна", {
        expectedReturnDate: null,
        loanUiStatus: "no_return_date",
      }),
    ]);

    renderLoans("lent_to_someone");

    const card = await findLoanCard("Дюна");
    expect(within(card).getByText(row.term.none)).toBeInTheDocument();
  });

  it("asks for the urgency order by default", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    await screen.findByText("Гобіт");
    expect(listUrl()).toContain("sort=overdue_first");
  });

  it("falls back to the urgency order when the URL still asks for the retired sort", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone", "?sort=return_soonest");

    await screen.findByText("Гобіт");
    expect(listUrl()).toContain("sort=overdue_first");
    expect(listUrl()).not.toContain("return_soonest");
  });

  it("names the sorts after the page the reader is on", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone", "?sort=person");

    await screen.findByText("Гобіт");
    await userEvent.click(screen.getByText(sort.mobile.trigger.borrowed.person));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(sort.borrowed.overdue_first)).toBeInTheDocument();
    expect(within(sheet).getByText(sort.borrowed.loan_date)).toBeInTheDocument();
    expect(within(sheet).getByText(sort.borrowed.person)).toBeInTheDocument();
    expect(within(sheet).queryByText(sort.lent.loan_date)).not.toBeInTheDocument();
    expect(within(sheet).queryByText(sort.lent.person)).not.toBeInTheDocument();
  });

  it("names the same sorts after the lent page", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "?sort=person");

    await screen.findByText("Дюна");
    await userEvent.click(screen.getByText(sort.mobile.trigger.lent.person));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(sort.lent.overdue_first)).toBeInTheDocument();
    expect(within(sheet).getByText(sort.lent.loan_date)).toBeInTheDocument();
    expect(within(sheet).getByText(sort.lent.person)).toBeInTheDocument();
    expect(within(sheet).queryByText(sort.borrowed.loan_date)).not.toBeInTheDocument();
    expect(within(sheet).queryByText(sort.borrowed.person)).not.toBeInTheDocument();
  });

  it("shows the next loans in place instead of paging through them", async () => {
    mockLoans(
      Array.from({ length: 12 }, (_, index) =>
        loanItem("borrowed_from_someone", `Книга ${index + 1}`),
      ),
    );

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText("Книга 1")).toBeInTheDocument();
    expect(screen.queryByText("Книга 11")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: copy.loadMore }));

    expect(await screen.findByText("Книга 11")).toBeInTheDocument();
    expect(screen.getByText("Книга 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.loadMore })).not.toBeInTheDocument();
  });

  it("keeps the show-more button away when every loan already fits", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    await screen.findByText("Гобіт");
    expect(screen.queryByRole("button", { name: copy.loadMore })).not.toBeInTheDocument();
  });

  it("builds the borrowed stat cards from the summary", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        earliestLoanDate: isoDaysFromToday(-47),
        longHeldCount: 2,
        nearestReturnDate: isoDaysFromToday(2),
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 3,
        peopleCount: 5,
        returningSoonCount: 4,
        totalCount: 8,
      },
    });

    renderLoans("borrowed_from_someone");

    const total = await findStatCard(stats.borrowed.total.label);
    expect(within(total).getByText("8")).toBeInTheDocument();
    expect(within(total).getByText("книг")).toBeInTheDocument();
    expect(within(total).getByText("Від 5 різних людей")).toBeInTheDocument();

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(within(returningSoon).getByText("4")).toBeInTheDocument();
    expect(within(returningSoon).getByText("Найближче — через 2 дні")).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText("3")).toBeInTheDocument();
    expect(within(overdue).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const longHeld = await findStatCard(stats.borrowed.longHeld.label);
    expect(within(longHeld).getByText("2")).toBeInTheDocument();
    expect(within(longHeld).getByText("Найдовше — 47 днів")).toBeInTheDocument();
  });

  it("builds the lent stat cards from the summary", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        nearestReturnDate: isoDaysFromToday(2),
        noReturnDateCount: 4,
        noReturnDatePeopleCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 3,
        peopleCount: 5,
        returningSoonCount: 4,
        totalCount: 8,
      },
    });

    renderLoans("lent_to_someone");

    const total = await findStatCard(stats.lent.total.label);
    expect(within(total).getByText("8")).toBeInTheDocument();
    expect(within(total).getByText("книг")).toBeInTheDocument();
    expect(within(total).getByText("У 5 різних людей")).toBeInTheDocument();

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(within(returningSoon).getByText("4")).toBeInTheDocument();
    expect(within(returningSoon).getByText("Найближче — через 2 дні")).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText("3")).toBeInTheDocument();
    expect(within(overdue).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const noReturnDate = await findStatCard(stats.lent.noReturnDate.label);
    expect(within(noReturnDate).getByText("4")).toBeInTheDocument();
    expect(within(noReturnDate).getByText("У 3 різних людей")).toBeInTheDocument();
  });

  it("keeps the borrowed-only cards off the lent page", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    await findStatCard(stats.lent.total.label);
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.longHeld.label)).not.toBeInTheDocument();
  });

  it("names today and tomorrow instead of counting days to the nearest return", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        nearestReturnDate: isoDaysFromToday(1),
        returningSoonCount: 1,
        totalCount: 1,
      },
    });

    renderLoans("borrowed_from_someone");

    const card = await findStatCard(stats.returningSoon.label);
    expect(within(card).getByText(stats.returningSoon.tomorrow)).toBeInTheDocument();
  });

  it("falls back to the calm wording when a borrowed stat is empty", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(
      within(returningSoon).getByText("Немає повернень у найближчі 7 днів"),
    ).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText(stats.overdue.empty)).toBeInTheDocument();

    const longHeld = await findStatCard(stats.borrowed.longHeld.label);
    expect(
      within(longHeld).getByText("Немає книг, позичених 30 днів і більше"),
    ).toBeInTheDocument();
  });

  it("falls back to the calm wording when every lent loan has a return date", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    const noReturnDate = await findStatCard(stats.lent.noReturnDate.label);
    expect(within(noReturnDate).getByText(stats.lent.noReturnDate.empty)).toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is borrowed", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 } });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(copy.states.typeEmpty.borrowed.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.borrowed.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is lent out", async () => {
    mockLoans([], { borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 } });

    renderLoans("lent_to_someone");

    expect(await screen.findByText(copy.states.typeEmpty.lent.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.lent.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.lent.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("lists what needs attention in the borrowed sidebar", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReturnDateCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 2,
        totalCount: 8,
      },
    });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(attention.title)).toBeInTheDocument();

    const overdueRow = await screen.findByRole("button", { name: /2 книги прострочено/ });
    expect(within(overdueRow).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const noReturnDateRow = screen.getByRole("button", { name: /3 книги без дати повернення/ });
    expect(
      within(noReturnDateRow).getByText(attention.borrowed.no_return_date.detail),
    ).toBeInTheDocument();
  });

  it("applies the existing loans filter when an attention row is clicked", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        oldestOverdueReturnDate: isoDaysFromToday(-3),
        overdueCount: 1,
        totalCount: 4,
      },
    });

    renderLoans("borrowed_from_someone");

    await userEvent.click(await screen.findByRole("button", { name: /1 книга прострочена/ }));

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes("filter=overdue"))).toBe(true);
    });
  });

  it("lights up the matching chip when an attention row applies its filter", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReturnDateCount: 3,
        overdueCount: 2,
        totalCount: 8,
      },
    });

    renderLoans("borrowed_from_someone");

    await userEvent.click(
      await screen.findByRole("button", { name: /3 книги без дати повернення/ }),
    );

    await waitFor(() => {
      expect(chip(quickFilters.no_return_date)).toBeChecked();
    });
    expect(chip(quickFilters.all)).not.toBeChecked();
  });

  it("reassures the reader when no borrowed loan needs attention", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 },
    });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(attention.allClear.title)).toBeInTheDocument();
    expect(screen.getByText(attention.borrowed.allClearText)).toBeInTheDocument();
  });

  it("lists what needs attention in the lent sidebar, most urgent first", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReminderWithDateCount: 5,
        noReturnDateCount: 4,
        noReturnDatePeopleCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-12),
        overdueCount: 3,
        totalCount: 12,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(attention.title);
    const rows = within(block).getAllByRole("button");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("3 книги не повернули вчасно");
    expect(rows[0]).toHaveTextContent("Найдовше — на 12 днів");
    expect(rows[1]).toHaveTextContent("4 книги без дати повернення");
    expect(rows[1]).toHaveTextContent("У 3 різних людей");
    expect(rows[2]).toHaveTextContent("5 книг без нагадування");
    expect(rows[2]).toHaveTextContent("Для 5 вказано дату повернення");
  });

  it("turns the attention row into the reminder filter", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, noReminderWithDateCount: 2, totalCount: 6 },
    });

    renderLoans("lent_to_someone");

    await userEvent.click(await screen.findByRole("button", { name: /2 книги без нагадування/ }));

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes("reminder=off"))).toBe(true);
    });
    expect(requestedUrls.some((url) => url.includes("filter=without_reminder"))).toBe(false);
  });

  it("keeps loans that are merely due soon out of the lent attention block", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        nearestReturnDate: isoDaysFromToday(1),
        returningSoonCount: 4,
        totalCount: 4,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(attention.title);
    expect(within(block).queryAllByRole("button")).toHaveLength(0);
    expect(within(block).getByText(attention.allClear.title)).toBeInTheDocument();
    expect(within(block).getByText(attention.lent.allClearText)).toBeInTheDocument();
  });

  it("builds the upcoming returns block from the summary, not from the visible page", async () => {
    mockLoans([loanItem("lent_to_someone", "Гобіт")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        totalCount: 9,
        upcomingReturns: [
          loanItem("lent_to_someone", "Дюна", {
            expectedReturnDate: isoDaysFromToday(0),
            personName: "Ігор",
          }),
          loanItem("lent_to_someone", "Соляріс", {
            expectedReturnDate: isoDaysFromToday(1),
            personName: "Марта",
          }),
          loanItem("lent_to_someone", "Кобзар", {
            expectedReturnDate: isoDaysFromToday(3),
            personName: "Тарас",
          }),
        ],
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(upcoming.title);
    expect(within(block).getByText("Дюна")).toBeInTheDocument();
    expect(within(block).getByText("Ігор")).toBeInTheDocument();
    expect(within(block).getByText(upcoming.today)).toBeInTheDocument();
    expect(within(block).getByText(upcoming.tomorrow)).toBeInTheDocument();
    expect(within(block).getByText("Через 3 дні")).toBeInTheDocument();
    expect(within(block).queryByText("Гобіт")).not.toBeInTheDocument();
  });

  it("says there is nothing scheduled when no return is upcoming", async () => {
    mockLoans([loanItem("lent_to_someone", "Гобіт")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, noReturnDateCount: 1, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(upcoming.title);
    expect(within(block).getByText(upcoming.empty)).toBeInTheDocument();
  });

  it("lists the people holding the most books, with their book counts", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [
          { bookCount: 4, contactId: CONTACT_IDS.olena, covers: [], personName: "Олена" },
          { bookCount: 2, contactId: CONTACT_IDS.petro, covers: [], personName: "Петро" },
          { bookCount: 1, contactId: CONTACT_IDS.iryna, covers: [], personName: "Ірина" },
        ],
        totalCount: 7,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(people.title);
    const rows = within(block).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Олена");
    expect(rows[0]).toHaveTextContent("4 книги");
    expect(rows[1]).toHaveTextContent("Петро");
    expect(rows[1]).toHaveTextContent("2 книги");
    expect(rows[2]).toHaveTextContent("Ірина");
    expect(rows[2]).toHaveTextContent("1 книга");
    expect(
      within(block).getByRole("button", { name: openContactLabel("Олена") }),
    ).toBeInTheDocument();
    expect(
      within(block).getByRole("button", { name: personFilterLabel("Олена") }),
    ).toBeInTheDocument();
  });

  it("opens the person card from the name in the people block", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [{ bookCount: 3, contactId: CONTACT_IDS.olya, covers: [], personName: "Оля" }],
        totalCount: 3,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(people.title);
    const filterToggle = within(block).getByRole("button", { name: personFilterLabel("Оля") });

    await userEvent.click(within(block).getByRole("button", { name: openContactLabel("Оля") }));

    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByRole("heading", { name: "Оля" })).toBeInTheDocument();
    expect(requestedUrls).toContain(`/api/loans/contacts/${CONTACT_IDS.olya}`);
    expect(filterToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("filters the list by a person when the row is clicked, and clears it on a second click", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [
          { bookCount: 3, contactId: CONTACT_IDS.olena, covers: [], personName: "Олена" },
        ],
        totalCount: 3,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(people.title);
    const filterToggle = within(block).getByRole("button", { name: personFilterLabel("Олена") });

    await userEvent.click(filterToggle);
    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes(`contactId=${CONTACT_IDS.olena}`))).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(filterToggle).toHaveAttribute("aria-pressed", "true");
    });

    requestedUrls.length = 0;
    await userEvent.click(filterToggle);
    await waitFor(() => {
      expect(filterToggle).toHaveAttribute("aria-pressed", "false");
    });
    expect(requestedUrls.every((url) => !url.includes("contactId="))).toBe(true);
  });

  it("drops a legacy person filter from the URL instead of asking the API for it", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [
          { bookCount: 3, contactId: CONTACT_IDS.olena, covers: [], personName: "Олена" },
        ],
        totalCount: 3,
      },
    });

    renderLoans("lent_to_someone", `?person=${encodeURIComponent("Олена")}&contactId=olena`);

    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(listUrl()).not.toContain("person=");
    expect(listUrl()).not.toContain("contactId=");

    const block = await findSidebarBlock(people.title);
    expect(within(block).getByRole("button", { name: personFilterLabel("Олена") })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("hides the people block when nobody is holding a book", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 0 },
    });

    renderLoans("lent_to_someone");

    await findSidebarBlock(upcoming.title);
    expect(within(sidebar()).queryByText(people.title)).not.toBeInTheDocument();
  });

  it("lists the long-held loans of the borrowed page, oldest first", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        longHeldCount: 2,
        longHeldLoans: [
          loanItem("borrowed_from_someone", "Дюна", {
            loanDate: isoDaysFromToday(-47),
            personName: "Ігор",
          }),
          loanItem("borrowed_from_someone", "Соляріс", {
            loanDate: isoDaysFromToday(-31),
            personName: "Марта",
          }),
        ],
        totalCount: 9,
      },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByText("Дюна")).toBeInTheDocument();
    expect(within(block).getByText("Ігор")).toBeInTheDocument();
    expect(within(block).getByText("47 днів у вас")).toBeInTheDocument();
    expect(within(block).getByText("31 день у вас")).toBeInTheDocument();
    expect(within(block).queryByText("Гобіт")).not.toBeInTheDocument();
  });

  it("opens the book behind a long-held loan", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        longHeldCount: 1,
        longHeldLoans: [
          loanItem("borrowed_from_someone", "Дюна", { loanDate: isoDaysFromToday(-33) }),
        ],
        totalCount: 2,
      },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByRole("link", { name: /Дюна/ })).toHaveAttribute(
      "href",
      "/books/book-Дюна",
    );
  });

  it("says no book has been held long when none is", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByText(longHeld.empty)).toBeInTheDocument();
  });

  it("keeps the lent-only sidebar blocks off the borrowed page", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    await findSidebarBlock(longHeld.title);
    expect(within(sidebar()).queryByText(upcoming.title)).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText(people.title)).not.toBeInTheDocument();
  });

  it("sends the reader to the other page when this one has no loans", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 3 } });

    renderLoans("borrowed_from_someone");

    await userEvent.click(
      await screen.findByRole("button", { name: copy.states.typeEmpty.borrowed.openOther }),
    );

    expect(push).toHaveBeenCalledWith("/loans/lent");
  });
});

describe("LoansView advanced filters", () => {
  it("keeps the draft out of the list until it is applied", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone");
    await openAdvancedFilters();

    await userEvent.click(await screen.findByRole("radio", { name: advanced.noteOptions.with }));

    expect(requestedUrls.every((url) => !url.includes("hasNote"))).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(listUrls().some((url) => url.includes("hasNote=true"))).toBe(true);
    });
    expect(await screen.findByText(activeFilters.noteWith)).toBeInTheDocument();
  });

  it("asks the API for loans with the reminder turned off", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockLoans([loanItem("lent_to_someone", "Дюна")], undefined);

    renderLoans("lent_to_someone", "", onUrlUpdate);
    await openAdvancedFilters();

    await userEvent.click(await screen.findByRole("radio", { name: advanced.reminderOptions.off }));
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(events.at(-1)?.searchParams.get("reminder")).toBe("off");
    });
    await waitFor(() => {
      expect(listUrls().some((url) => url.includes("reminder=off"))).toBe(true);
    });
    expect(listUrls().every((url) => url.includes("pageNumber=1"))).toBe(true);
  });

  it("combines an advanced filter with a quick one", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "filter=overdue");
    await openAdvancedFilters();

    await userEvent.click(await screen.findByRole("radio", { name: advanced.reminderOptions.off }));
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(
        listUrls().some((url) => url.includes("reminder=off") && url.includes("filter=overdue")),
      ).toBe(true);
    });
    expect(chip(quickFilters.overdue)).toHaveAttribute("data-state", "on");
  });

  it("drops one condition from its chip and keeps the rest", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "reminder=off&hasNote=true");

    const reminderChip = await screen.findByText(activeFilters.reminder.off);
    await userEvent.click(
      screen.getByRole("button", {
        name: library.remove.replace("{label}", activeFilters.reminder.off),
      }),
    );

    await waitFor(() => {
      expect(reminderChip).not.toBeInTheDocument();
    });
    expect(screen.getByText(activeFilters.noteWith)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        listUrls().some((url) => url.includes("hasNote=true") && !url.includes("reminder=off")),
      ).toBe(true);
    });
  });

  it("clears the search from its own chip without touching the filters", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "q=дюна&reminder=off");

    const searchLabel = activeFilters.search.replace("{query}", "дюна");
    await screen.findByText(searchLabel);
    await userEvent.click(
      screen.getByRole("button", { name: library.remove.replace("{label}", searchLabel) }),
    );

    await waitFor(() => {
      expect(screen.queryByText(searchLabel)).not.toBeInTheDocument();
    });
    expect(screen.getByText(activeFilters.reminder.off)).toBeInTheDocument();
  });

  it("clears search and every filter at once", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "q=дюна&reminder=off&filter=overdue");

    await userEvent.click(await screen.findByRole("button", { name: library.clearAll }));

    await waitFor(() => {
      expect(
        listUrls().some(
          (url) =>
            !url.includes("reminder=") &&
            !url.includes("search=") &&
            !url.includes("filter=overdue"),
        ),
      ).toBe(true);
    });
    expect(screen.queryByText(activeFilters.reminder.off)).not.toBeInTheDocument();
  });

  it("counts the applied conditions on the trigger", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone", "reminder=off&hasNote=true&dueFrom=2026-08-01");

    const trigger = await screen.findByRole("button", { name: new RegExp(advanced.trigger) });
    expect(within(trigger).getByText("3")).toBeInTheDocument();
  });
});

function chip(label: string): HTMLElement {
  return screen.getByRole("radio", { name: chipName(label) });
}

function chipName(label: string): (name: string) => boolean {
  return (name) => name.startsWith(label);
}

function contactsPage() {
  return {
    counts: { active: 1, all: 1, archived: 0 },
    items: [
      {
        activeBorrowedCount: 1,
        activeLentCount: 1,
        archivedAt: null,
        contact: null,
        createdAt: "2026-01-01T10:00:00.000Z",
        id: CONTACT_IDS.olya,
        loanCount: 1,
        name: "Оля",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
    ],
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: 1,
  };
}

function contactView(): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    id: CONTACT_IDS.olya,
    loanCount: 1,
    name: "Оля",
    updatedAt: "2026-01-01T10:00:00.000Z",
  };
}

function countedStats(items: LoanListItemView[], type: LoanType): LoanDirectionSummary {
  return {
    ...EMPTY_DIRECTION_SUMMARY,
    totalCount: items.filter((item) => item.type === type).length,
  };
}

function dueIn(offset: number): { display: string; iso: string } {
  const date = addDays(new Date(), offset);
  return { display: format(date, "dd.MM.yyyy"), iso: format(date, "yyyy-MM-dd") };
}

function extendedBookView() {
  return makeBookView({
    loanInfo: {
      contact: null,
      expectedReturnDate: isoDaysFromToday(12),
      loanContactId: CONTACT_IDS.olya,
      loanDate: isoDaysFromToday(-3),
      loanType: "lent_to_someone",
      loanUiStatus: "on_time",
      note: null,
      personName: "Оля",
      remindBeforeDays: null,
      remindToReturn: false,
    },
    ownershipStatus: "lent_to_someone",
  });
}

function findChip(label: string): Promise<HTMLElement> {
  return screen.findByRole("radio", { name: chipName(label) });
}

async function findLoanCard(title: string): Promise<HTMLElement> {
  const card = (await screen.findByText(title)).closest<HTMLElement>("article");
  if (card === null) throw new Error(`Loan card not found: ${title}`);
  return card;
}

function findSidebarBlock(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const block = within(sidebar()).getByText(title).closest<HTMLElement>("section");
    if (block === null) throw new Error(`Sidebar block not found: ${title}`);
    if (block.querySelector('[data-slot="skeleton"]') !== null) {
      throw new Error(`Sidebar block is still loading: ${title}`);
    }
    return block;
  });
}

function findStatCard(label: string): Promise<HTMLElement> {
  return waitFor(() => {
    const card = screen
      .getAllByText(label)
      .map((node) => node.closest<HTMLElement>('[data-slot="stat-card"]'))
      .find((node) => node !== null);
    if (card === undefined) throw new Error(`Stat card not found: ${label}`);
    return card;
  });
}

function historyOverview(): LoanHistoryOverviewView {
  return {
    duration: { averageDays: null, longestDays: null, shortestDays: null },
    reliability: { lateCount: 0, noDueDateCount: 0, onTimeCount: 0, onTimePercent: null },
    summary: {
      averageDelayDays: null,
      averageDurationDays: null,
      borrowedCount: 0,
      durationCount: 0,
      lateCount: 0,
      lentCount: 0,
      noDueDateCount: 0,
      onTimeCount: 0,
      onTimePercent: null,
      totalCompleted: 0,
    },
    topPeople: [],
  };
}

function isoDaysFromToday(offset: number): string {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function listUrl(): string {
  const [found] = listUrls();
  if (found === undefined) throw new Error("the loans list was never requested");
  return found;
}

function listUrls(): string[] {
  return requestedUrls.filter(
    (url) => url.includes("/api/loans") && !url.includes("/api/loans/summary"),
  );
}

function loanItem(
  type: LoanType,
  title: string,
  overrides: Partial<LoanListItemView> = {},
): LoanListItemView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Дж. Р. Р. Толкін",
      id: `book-${title}`,
      originalTitle: null,
      ownershipStatus: "owned",
      publisher: null,
      title,
    },
    contact: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    expectedReturnDate: "2026-02-01",
    id: `loan-${title}`,
    loanContactId: CONTACT_IDS.olya,
    loanDate: "2026-01-05",
    loanUiStatus: "on_time",
    note: null,
    personName: "Оля",
    remindBeforeDays: null,
    remindToReturn: false,
    type,
    updatedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

function loansPage(items: LoanListItemView[], url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  const pageSize = Number(params.get("pageSize") ?? LOANS_PAGE_SIZE);
  const page = Number(params.get("pageNumber") ?? 1);

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pagesCount: Math.ceil(items.length / pageSize),
    pageSize,
    totalCount: items.length,
  };
}

function mockLoans(items: LoanListItemView[], summaryOverrides?: Partial<LoansSummaryView>) {
  const summary: LoansSummaryView = {
    borrowed: countedStats(items, "borrowed_from_someone"),
    lent: countedStats(items, "lent_to_someone"),
    ...summaryOverrides,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/api/loans/summary")) return Promise.resolve(jsonResponse(summary));
      if (url.includes("/api/loans/contacts?")) {
        return Promise.resolve(jsonResponse(contactsPage()));
      }
      if (url.includes("/api/loans/contacts/")) {
        return Promise.resolve(jsonResponse(contactView()));
      }
      if (url.includes("/api/loans/history/overview")) {
        return Promise.resolve(jsonResponse(historyOverview()));
      }
      if (url.includes("/api/loans")) return Promise.resolve(jsonResponse(loansPage(items, url)));
      if (url.includes("/loan/extend") || url.includes("/loan/reminder")) {
        return Promise.resolve(jsonResponse(extendedBookView()));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

async function openAdvancedFilters(): Promise<void> {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(advanced.trigger) }));
  await screen.findByRole("dialog", { name: advanced.title });
}

function openContactLabel(name: string): string {
  return contactDrawer.openContact.replace("{name}", name);
}

async function openLoanMenu(title: string): Promise<void> {
  const card = await findLoanCard(title);
  const [trigger] = within(card).getAllByRole("button", { name: messages.loans.actions.menu });
  await userEvent.click(trigger ?? card);
}

function personFilterLabel(name: string): string {
  return people.filter.replace("{name}", name);
}

function renderLoans(type: LoanType, searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <LoansView type={type} />
    </NuqsTestingAdapter>,
  );
}

function sidebar(): HTMLElement {
  return screen.getByRole("complementary", { name: copy.sidebar.label });
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

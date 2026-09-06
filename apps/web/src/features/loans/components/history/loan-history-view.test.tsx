import "@testing-library/jest-dom/vitest";

import type {
  LoanContactView,
  LoanHistoryDetailView,
  LoanHistoryOverviewView,
  LoanHistoryResultCounts,
  Nullable,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LoanHistoryView } from "./loan-history-view";

type HistoryFixture = LoanHistoryDetailView;

type MockOptions = {
  overview?: LoanHistoryOverviewView;
  people?: { contactId: string; personName: string; totalCount: number }[];
  resultCounts?: LoanHistoryResultCounts;
};

type RecordedRequest = {
  body?: string;
  method: string;
  url: string;
};

const CONTACT_IDS = {
  ihor: "22222222-2222-4222-8222-222222222222",
  olena: "11111111-1111-4111-8111-111111111111",
} as const;

const CONTACT_NAMES: Record<string, string> = {
  [CONTACT_IDS.ihor]: "Ігор",
  [CONTACT_IDS.olena]: "Олена",
};

const TODAY = new Date(2026, 7, 14, 9, 0, 0);

const copy = messages.loans.history;
const activeFilters = messages.loans.history.activeFilters;
const advanced = messages.loans.history.advancedFilters;
const quickFilters = messages.loans.history.quickFilters;
const contactDrawer = messages.loans.contactDrawer;
const library = messages.books.library.activeFilters;

const requests: RecordedRequest[] = [];

const server = {
  correctionError: null as Nullable<{ body: unknown; status: number }>,
  listPending: false,
  listStatus: null as Nullable<number>,
};

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const OVERVIEW: LoanHistoryOverviewView = {
  duration: { averageDays: 18, longestDays: 73, shortestDays: 2 },
  reliability: { lateCount: 9, noDueDateCount: 2, onTimeCount: 26, onTimePercent: 74 },
  summary: {
    averageDelayDays: 6,
    averageDurationDays: 18,
    borrowedCount: 16,
    durationCount: 29,
    lateCount: 9,
    lentCount: 21,
    noDueDateCount: 2,
    onTimeCount: 26,
    onTimePercent: 74,
    totalCompleted: 37,
  },
  topPeople: [
    {
      borrowedCount: 3,
      contactId: CONTACT_IDS.olena,
      lentCount: 5,
      personName: "Олена",
      totalCount: 8,
    },
    {
      borrowedCount: 2,
      contactId: CONTACT_IDS.ihor,
      lentCount: 0,
      personName: "Ігор",
      totalCount: 2,
    },
  ],
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  server.correctionError = null;
  server.listPending = false;
  server.listStatus = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(toast.success).mockClear();
  requests.length = 0;
});

describe("LoanHistoryView states", () => {
  it("renders only the empty state when the reader has no completed loans", async () => {
    mockHistory([]);

    renderHistory();

    expect(await screen.findByText(copy.states.empty.title)).toBeInTheDocument();
    expect(screen.queryByText(copy.cards.total.label)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: new RegExp(advanced.trigger) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps the cards, the toolbar and the clear action when the filters match nothing", async () => {
    mockHistory([]);

    renderHistory("?q=нічого");

    expect(await screen.findByText(copy.states.noResults.title)).toBeInTheDocument();
    expect(screen.getByText(copy.cards.total.label)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(advanced.trigger) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.states.noResults.clear })).toBeInTheDocument();
    expect(lastListUrl()).toContain(`search=${encodeURIComponent("нічого")}`);
  });

  it("drops every filter from the request when the reader clears them", async () => {
    mockHistory([]);

    renderHistory("?q=нічого&result=late&type=lent_to_someone");

    await screen.findByText(copy.states.noResults.title);
    await userEvent.click(screen.getByRole("button", { name: copy.states.noResults.clear }));

    await waitFor(() => {
      expect(lastListUrl()).not.toContain("search=");
    });
    expect(lastListUrl()).toContain("result=all");
    expect(lastListUrl()).not.toContain("type=");
  });

  it("announces that the history is loading while the first page is in flight", async () => {
    server.listPending = true;
    mockHistory([historyItem()]);

    renderHistory();

    expect(await screen.findByText(copy.states.loading)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("offers a retry that loads the history after a failed request", async () => {
    server.listStatus = 500;
    mockHistory([historyItem()]);

    renderHistory();

    expect(await screen.findByText(copy.states.error.title)).toBeInTheDocument();

    server.listStatus = null;
    await userEvent.click(screen.getByRole("button", { name: copy.states.error.retry }));

    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(screen.queryByText(copy.states.error.title)).not.toBeInTheDocument();
  });

  it("hides the toolbar and the sidebar while the history cannot be loaded", async () => {
    server.listStatus = 500;
    mockHistory([historyItem()]);

    renderHistory();

    await screen.findByText(copy.states.error.title);
    expect(
      screen.queryByRole("button", { name: new RegExp(advanced.trigger) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView summary cards", () => {
  it("counts the completed loans the backend reported, not the loaded page", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const total = await findStatCard(copy.cards.total.label);
    expect(within(total).getByText("37")).toBeInTheDocument();
    expect(within(total).getByText("21 передано · 16 позичено")).toBeInTheDocument();
  });

  it("measures the on-time share against the loans that had a deadline", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const onTime = await findStatCard(copy.cards.onTime.label);
    expect(within(onTime).getByText("26")).toBeInTheDocument();
    expect(within(onTime).getByText("74% позик із визначеним строком")).toBeInTheDocument();
    expect(within(onTime).queryByText(/70%/)).not.toBeInTheDocument();
  });

  it("skips the on-time percent when no loan carried a deadline", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        reliability: { ...OVERVIEW.reliability, onTimePercent: null },
        summary: {
          ...OVERVIEW.summary,
          averageDelayDays: null,
          lateCount: 0,
          noDueDateCount: 37,
          onTimeCount: 0,
          onTimePercent: null,
        },
      },
    });

    renderHistory();

    const onTime = await findStatCard(copy.cards.onTime.label);
    expect(within(onTime).getByText(copy.cards.onTime.empty)).toBeInTheDocument();
    expect(within(onTime).queryByText(/0%/)).not.toBeInTheDocument();
  });

  it("keeps a real zero percent apart from a missing one", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        reliability: { ...OVERVIEW.reliability, onTimeCount: 0, onTimePercent: 0 },
        summary: { ...OVERVIEW.summary, onTimeCount: 0, onTimePercent: 0 },
      },
    });

    renderHistory();

    const onTime = await findStatCard(copy.cards.onTime.label);
    expect(within(onTime).getByText("0% позик із визначеним строком")).toBeInTheDocument();
  });

  it("names the average delay on the late card", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const late = await findStatCard(copy.cards.late.label);
    expect(within(late).getByText("9")).toBeInTheDocument();
    expect(within(late).getByText("У середньому — на 6 днів")).toBeInTheDocument();
  });

  it("claims no delays, not an all-on-time dataset, when nothing came back late", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        reliability: { ...OVERVIEW.reliability, lateCount: 0, onTimePercent: 100 },
        summary: {
          ...OVERVIEW.summary,
          averageDelayDays: null,
          lateCount: 0,
          onTimePercent: 100,
        },
      },
    });

    renderHistory();

    const late = await findStatCard(copy.cards.late.label);
    expect(within(late).getByText(copy.cards.late.noDelays)).toBeInTheDocument();
  });

  it("says how many loans the average duration covers", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const duration = await findStatCard(copy.cards.duration.label);
    expect(within(duration).getByText("18")).toBeInTheDocument();
    expect(within(duration).getByText("За 29 позиками з відомим початком")).toBeInTheDocument();
  });

  it("reads a zero-day average as a real same-day duration", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        duration: { ...OVERVIEW.duration, averageDays: 0 },
        summary: { ...OVERVIEW.summary, averageDurationDays: 0, durationCount: 4 },
      },
    });

    renderHistory();

    const duration = await findStatCard(copy.cards.duration.label);
    expect(within(duration).getByText("0")).toBeInTheDocument();
    expect(within(duration).getByText("За 4 позиками з відомим початком")).toBeInTheDocument();
    expect(within(duration).queryByText(copy.cards.duration.empty)).not.toBeInTheDocument();
  });

  it("says the duration is still unknown when no loan has a start", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        duration: { averageDays: null, longestDays: null, shortestDays: null },
        summary: { ...OVERVIEW.summary, averageDurationDays: null, durationCount: 0 },
      },
    });

    renderHistory();

    const duration = await findStatCard(copy.cards.duration.label);
    expect(within(duration).getByText("—")).toBeInTheDocument();
    expect(within(duration).getByText(copy.cards.duration.empty)).toBeInTheDocument();

    const tile = await findMobileTile(copy.cards.duration.mobile.compact);
    expect(within(tile).getByText("—")).toBeInTheDocument();
  });
});

describe("LoanHistoryView toolbar", () => {
  it("asks for one direction when the reader applies it", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.click(chip(copy.direction.borrowed_from_someone));
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).toContain("type=borrowed_from_someone");
    });
  });

  it("asks for one result when the reader picks a quick filter", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await userEvent.click(await findChip(quickFilters.late));

    await waitFor(() => {
      expect(lastListUrl()).toContain("result=late");
    });
  });

  it("asks for one person when the reader picks one from the filters", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await pickPerson("Олена");
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).toContain(`contactId=${CONTACT_IDS.olena}`);
    });
  });

  it("goes back to every person when the reader clears the picker", async () => {
    mockHistory([historyItem()]);

    renderHistory(`?contactId=${CONTACT_IDS.olena}`);

    await findRow("Дюна");
    await openAdvancedFilters();

    const picker = personPicker();
    await waitFor(() => {
      expect(picker).toHaveValue("Олена");
    });

    await userEvent.click(
      within(filterSection(advanced.sections.person)).getByRole("button", {
        name: copy.person.clear,
      }),
    );
    expect(picker).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).not.toContain("contactId=");
    });
  });

  it("drops a legacy person filter from the URL instead of asking the API for it", async () => {
    mockHistory([historyItem()]);

    renderHistory(`?person=${encodeURIComponent("Олена")}&contactId=olena`);

    await findRow("Дюна");
    expect(lastListUrl()).not.toContain("person=");
    expect(lastListUrl()).not.toContain("contactId=");
    expect(screen.queryByRole("group", { name: library.label })).not.toBeInTheDocument();
  });

  it("asks for another order when the reader changes the sort", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await pickOption(copy.toolbar.sortLabel, copy.sort.options.all.duration_desc);

    await waitFor(() => {
      expect(lastListUrl()).toContain("sort=duration_desc");
    });
  });

  it("names the sort options after the direction the reader filtered by", async () => {
    mockHistory([historyItem()]);

    renderHistory("?type=lent_to_someone");

    await findRow("Дюна");
    await userEvent.click(screen.getByRole("combobox", { name: copy.toolbar.sortLabel }));

    expect(
      await screen.findByRole("option", { name: copy.sort.options.lent_to_someone.loan_date_desc }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: copy.sort.options.all.loan_date_desc }),
    ).not.toBeInTheDocument();
  });

  it("sends the typed query once the reader stops typing", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await userEvent.type(screen.getByRole("textbox", { name: copy.toolbar.searchLabel }), "Дюна");

    await waitFor(() => {
      expect(lastListUrl()).toContain(`search=${encodeURIComponent("Дюна")}`);
    });
  });

  it("falls back to the newest-returned order when the URL asks for an unknown sort", async () => {
    mockHistory([historyItem()]);

    renderHistory("?sort=oldest_first&result=whatever");

    await findRow("Дюна");
    expect(lastListUrl()).toContain("sort=returned_desc");
    expect(lastListUrl()).toContain("result=all");
    expect(lastListUrl()).not.toContain("oldest_first");
  });

  it("falls back to every result when the URL asks for an unknown one", async () => {
    mockHistory([historyItem()]);

    renderHistory("?result=very_late");

    await findRow("Дюна");
    expect(lastListUrl()).toContain("result=all");
    expect(requests.every((entry) => !entry.url.includes("very_late"))).toBe(true);
  });

  it("ignores an unknown direction in the URL instead of forwarding it", async () => {
    mockHistory([historyItem()]);

    renderHistory("?type=given_away");

    await findRow("Дюна");
    expect(lastListUrl()).not.toContain("type=");
  });
});

describe("LoanHistoryView quick filters", () => {
  it("counts the outcomes the backend measured, zero included", async () => {
    mockHistory([historyItem()], {
      resultCounts: { all: 37, late: 9, no_due_date: 0, on_time: 28 },
    });

    renderHistory();

    await waitFor(() => {
      expect(within(chip(quickFilters.all)).getByText("37")).toBeInTheDocument();
    });
    expect(within(chip(quickFilters.on_time)).getByText("28")).toBeInTheDocument();
    expect(within(chip(quickFilters.late)).getByText("9")).toBeInTheDocument();
    expect(within(chip(quickFilters.no_due_date)).getByText("0")).toBeInTheDocument();
  });

  it("keeps every count as it was when one outcome is picked", async () => {
    mockHistory([historyItem()], {
      resultCounts: { all: 37, late: 9, no_due_date: 0, on_time: 28 },
    });

    renderHistory();

    await userEvent.click(await findChip(quickFilters.late));

    await waitFor(() => {
      expect(lastListUrl()).toContain("result=late");
    });
    expect(chip(quickFilters.late)).toHaveAttribute("data-state", "on");
    expect(within(chip(quickFilters.all)).getByText("37")).toBeInTheDocument();
    expect(within(chip(quickFilters.on_time)).getByText("28")).toBeInTheDocument();
  });

  it("leaves the chips without numbers until the first page arrives", async () => {
    server.listPending = true;
    mockHistory([historyItem()]);

    renderHistory();

    const all = await findChip(quickFilters.all);
    expect(all).toHaveTextContent(quickFilters.all);
    expect(within(all).queryByText(/\d/)).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView advanced filters", () => {
  it("counts the four filter dimensions on the trigger", async () => {
    mockHistory([historyItem()]);

    renderHistory(
      `?type=lent_to_someone&contactId=${CONTACT_IDS.olena}&from=2026-01-01&to=2026-12-31&loanFrom=2026-02-01`,
    );

    const trigger = await screen.findByRole("button", { name: new RegExp(advanced.trigger) });
    expect(within(trigger).getByText("4")).toBeInTheDocument();
  });

  it("leaves the search and the picked outcome out of that count", async () => {
    mockHistory([historyItem()]);

    renderHistory("?q=дюна&result=late");

    await findRow("Дюна");
    const trigger = screen.getByRole("button", { name: new RegExp(advanced.trigger) });
    expect(within(trigger).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it("leaves an inverted range out of that count", async () => {
    mockHistory([historyItem()]);

    renderHistory("?from=2026-05-01&to=2026-01-01");

    await findRow("Дюна");
    const trigger = screen.getByRole("button", { name: new RegExp(advanced.trigger) });
    expect(within(trigger).queryByText(/\d/)).not.toBeInTheDocument();
    expect(lastListUrl()).not.toContain("returnedFrom");
  });

  it("writes every applied dimension to the URL in one step", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockHistory([historyItem()]);

    renderHistory("?loanFrom=2026-02-01", onUrlUpdate);

    await findRow("Дюна");
    await openAdvancedFilters();

    await userEvent.click(chip(copy.direction.lent_to_someone));
    await pickPerson("Олена");
    await userEvent.click(chip(copy.period.thisYear));

    expect(events).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(events).toHaveLength(1);
    });
    const applied = events[0]?.searchParams;
    expect(applied?.get("type")).toBe("lent_to_someone");
    expect(applied?.get("contactId")).toBe(CONTACT_IDS.olena);
    expect(applied?.get("from")).toBe("2026-01-01");
    expect(applied?.get("to")).toBe("2026-12-31");
    expect(applied?.get("loanFrom")).toBe("2026-02-01");
  });

  it("resets the draft inside the sheet without touching the applied filters", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockHistory([historyItem()]);

    renderHistory("?type=lent_to_someone&from=2026-01-01&to=2026-12-31", onUrlUpdate);

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.click(screen.getByRole("button", { name: advanced.clear }));

    expect(
      within(filterSection(advanced.sections.direction)).getByRole("radio", {
        name: copy.direction.all,
      }),
    ).toBeChecked();
    expect(events).toHaveLength(0);
    expect(lastListUrl()).toContain("type=lent_to_someone");

    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).not.toContain("type=");
    });
    expect(lastListUrl()).not.toContain("returnedFrom");
  });

  it.each([
    { from: "2026-01-01", preset: "thisYear", to: "2026-12-31" },
    { from: "2025-01-01", preset: "lastYear", to: "2025-12-31" },
  ] as const)("turns the $preset preset into a date-only returned range", async (period) => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.click(chip(copy.period[period.preset]));
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).toContain(`returnedFrom=${period.from}`);
    });
    expect(lastListUrl()).toContain(`returnedTo=${period.to}`);
  });

  it("drops both returned bounds when the reader goes back to all time", async () => {
    mockHistory([historyItem()]);

    renderHistory("?from=2025-01-01&to=2025-12-31");

    await findRow("Дюна");
    expect(lastListUrl()).toContain("returnedFrom=2025-01-01");

    await openAdvancedFilters();
    await userEvent.click(chip(copy.period.all));
    await userEvent.click(screen.getByRole("button", { name: advanced.apply }));

    await waitFor(() => {
      expect(lastListUrl()).not.toContain("returnedFrom");
    });
    expect(lastListUrl()).not.toContain("returnedTo");
  });

  it("refuses to apply an inverted loan-date range", async () => {
    mockHistory([historyItem()]);

    renderHistory("?loanFrom=2026-08-12&loanTo=2026-08-02");

    await findRow("Дюна");
    await openAdvancedFilters();

    expect(screen.getByRole("button", { name: advanced.apply })).toBeDisabled();
    expect(screen.getByText(advanced.range.invalid)).toBeInTheDocument();
    expect(lastListUrl()).not.toContain("loanDate");
  });

  it("narrows the people to the direction of the draft", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.click(chip(copy.direction.borrowed_from_someone));

    await waitFor(() => {
      expect(lastPeopleUrl()).toContain("type=borrowed_from_someone");
    });
  });
});

describe("LoanHistoryView active filters", () => {
  it("shows one chip per applied condition", async () => {
    mockHistory([historyItem()]);

    renderHistory(
      `?q=дюна&type=lent_to_someone&contactId=${CONTACT_IDS.olena}&from=2026-01-01&to=2026-12-31&loanFrom=2026-02-01`,
    );

    expect(await screen.findByText(searchChip("дюна"))).toBeInTheDocument();
    expect(screen.getByText(activeFilters.direction.lent_to_someone)).toBeInTheDocument();
    expect(await screen.findByText(personChip("Олена"))).toBeInTheDocument();
    expect(screen.getByText(activeFilters.returnedPreset.thisYear)).toBeInTheDocument();
    expect(
      screen.getByText(
        activeFilters.loanDateFrom.lent_to_someone.replace("{value}", "1 лют. 2026 р."),
      ),
    ).toBeInTheDocument();
  });

  it("leaves the picked outcome to the quick filters", async () => {
    mockHistory([historyItem()]);

    renderHistory("?result=late&type=lent_to_someone");

    const group = await screen.findByRole("group", { name: library.label });
    expect(within(group).getByText(activeFilters.direction.lent_to_someone)).toBeInTheDocument();
    expect(within(group).queryByText(quickFilters.late)).not.toBeInTheDocument();
  });

  it("drops one condition from its chip and keeps the rest", async () => {
    mockHistory([historyItem()]);

    renderHistory(`?type=lent_to_someone&contactId=${CONTACT_IDS.olena}`);

    const directionChip = await screen.findByText(activeFilters.direction.lent_to_someone);
    await userEvent.click(
      screen.getByRole("button", {
        name: library.remove.replace("{label}", activeFilters.direction.lent_to_someone),
      }),
    );

    await waitFor(() => {
      expect(directionChip).not.toBeInTheDocument();
    });
    expect(screen.getByText(personChip("Олена"))).toBeInTheDocument();
    await waitFor(() => {
      expect(lastListUrl()).not.toContain("type=");
    });
    expect(lastListUrl()).toContain(`contactId=${CONTACT_IDS.olena}`);
  });

  it("clears the search from its own chip without touching the filters", async () => {
    mockHistory([historyItem()]);

    renderHistory("?q=дюна&type=lent_to_someone");

    const searchLabel = searchChip("дюна");
    await screen.findByText(searchLabel);
    await userEvent.click(
      screen.getByRole("button", { name: library.remove.replace("{label}", searchLabel) }),
    );

    await waitFor(() => {
      expect(screen.queryByText(searchLabel)).not.toBeInTheDocument();
    });
    expect(screen.getByText(activeFilters.direction.lent_to_someone)).toBeInTheDocument();
  });

  it("clears the search, the outcome and every filter at once", async () => {
    mockHistory([historyItem()]);

    renderHistory(`?q=дюна&result=late&type=lent_to_someone&contactId=${CONTACT_IDS.olena}`);

    await userEvent.click(await screen.findByRole("button", { name: library.clearAll }));

    await waitFor(() => {
      expect(lastListUrl()).toContain("result=all");
    });
    expect(lastListUrl()).not.toContain("search=");
    expect(lastListUrl()).not.toContain("type=");
    expect(lastListUrl()).not.toContain("contactId=");
    expect(screen.queryByRole("group", { name: library.label })).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView person picker", () => {
  it("lists the people of the history with their loan counts", async () => {
    mockHistory([historyItem()], {
      people: [
        { contactId: CONTACT_IDS.olena, personName: "Олена", totalCount: 8 },
        { contactId: CONTACT_IDS.ihor, personName: "Ігор", totalCount: 2 },
      ],
    });

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.click(personPicker());

    const olena = await screen.findByRole("option", { name: /Олена/ });
    expect(within(olena).getByText("8 позик")).toBeInTheDocument();
    expect(
      within(screen.getByRole("option", { name: /Ігор/ })).getByText("2 позики"),
    ).toBeInTheDocument();
  });

  it("offers no way to create a contact from the filters", async () => {
    mockHistory([historyItem()], { people: [] });

    renderHistory();

    await findRow("Дюна");
    await openAdvancedFilters();
    await userEvent.type(personPicker(), "Нова людина");

    expect(await screen.findByText(copy.person.empty)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("keeps the chosen person named when the scope no longer lists them", async () => {
    mockHistory([historyItem()], {
      people: [{ contactId: CONTACT_IDS.olena, personName: "Олена", totalCount: 8 }],
    });

    renderHistory(`?contactId=${CONTACT_IDS.ihor}`);

    await findRow("Дюна");
    expect(await screen.findByText(personChip("Ігор"))).toBeInTheDocument();

    await openAdvancedFilters();

    await waitFor(() => {
      expect(personPicker()).toHaveValue("Ігор");
    });
  });
});

describe("LoanHistoryView result count", () => {
  it("counts the loaded loans against the filtered total", async () => {
    mockHistory(historyItems(12));

    renderHistory();

    expect(await screen.findByText(shownCount(10, 12))).toBeInTheDocument();
  });

  it("grows the count when the reader asks for more", async () => {
    mockHistory(historyItems(12));

    renderHistory();

    await screen.findByText(shownCount(10, 12));
    await userEvent.click(screen.getByRole("button", { name: copy.loadMore }));

    expect(await screen.findByText(shownCount(12, 12))).toBeInTheDocument();
  });

  it("says nothing while the first page is in flight", async () => {
    server.listPending = true;
    mockHistory(historyItems(12));

    renderHistory();

    await screen.findByText(copy.states.loading);
    expect(screen.queryByText(/Показано/)).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView row", () => {
  it("spans a lent loan from handover to return, with the plan underneath", async () => {
    mockHistory([
      historyItem({
        expectedReturnDate: "2026-07-10",
        loanDate: "2026-06-12",
        returnedDate: "2026-07-04",
      }),
    ]);

    renderHistory();

    const period = await findPeriod("Дюна");
    expect(period).toHaveTextContent(`${copy.loanPeriod.lent} 12.06.2026`);
    expect(period).toHaveTextContent(`${copy.loanPeriod.returned} 04.07.2026`);
    expect(period).toHaveTextContent(plannedOn("10.07.2026"));
  });

  it("calls the start of a borrowed loan a borrowing, not a handover", async () => {
    mockHistory([historyItem({ loanDate: "2026-02-14", type: "borrowed_from_someone" })]);

    renderHistory();

    const period = await findPeriod("Дюна");
    expect(period).toHaveTextContent(`${copy.loanPeriod.borrowed} 14.02.2026`);
    expect(period).not.toHaveTextContent(copy.loanPeriod.lent);
    expect(
      within(await findRow("Дюна")).getByText(copy.direction.borrowed_from_someone),
    ).toBeInTheDocument();
  });

  it("keeps the return date as prominent as the date the loan started", async () => {
    mockHistory([historyItem({ loanDate: "2026-06-12", returnedDate: "2026-07-04" })]);

    renderHistory();

    const period = await findPeriod("Дюна");
    const [start, returned] = ["12.06.2026", "04.07.2026"].map(
      (date) => within(period).getByText(date).className,
    );
    expect(start).toBe(returned);
  });

  it("keeps the plan a secondary line whether the return beat it, hit it or missed it", async () => {
    const returns = [
      { returnedDate: "2026-07-04", title: "Соляріс" },
      { returnedDate: "2026-07-10", title: "Тигролови" },
      { returnedDate: "2026-07-16", title: "Кобзар" },
    ];

    mockHistory(
      returns.map(({ returnedDate, title }) => ({
        ...historyItem({ expectedReturnDate: "2026-07-10", returnedDate }),
        book: { ...historyItem().book, id: `book-${title}`, title },
        id: `loan-${title}`,
      })),
    );

    renderHistory();

    for (const { returnedDate, title } of returns) {
      const period = await findPeriod(title);
      expect(period).toHaveTextContent(`${copy.loanPeriod.returned} ${formatUkDate(returnedDate)}`);
      expect(within(period).getByText(plannedOn("10.07.2026"))).toBeInTheDocument();
    }
  });

  it("shows a same-day loan as a period that starts and ends on one date", async () => {
    mockHistory([
      historyItem({
        durationDays: 0,
        expectedReturnDate: "2026-08-30",
        loanDate: "2026-08-23",
        returnedDate: "2026-08-23",
      }),
    ]);

    renderHistory();

    const period = await findPeriod("Дюна");
    expect(period).toHaveTextContent(`${copy.loanPeriod.lent} 23.08.2026`);
    expect(period).toHaveTextContent(`${copy.loanPeriod.returned} 23.08.2026`);
  });

  it("drops the arrow and says so when the loan never got a start date", async () => {
    mockHistory([
      historyItem({ durationDays: null, expectedReturnDate: "2026-08-30", loanDate: null }),
    ]);

    renderHistory();

    const period = await findPeriod("Дюна");
    expect(period).toHaveTextContent(copy.loanPeriod.startUnknown);
    expect(period).toHaveTextContent(plannedOn("30.08.2026"));
    expect(period).not.toHaveTextContent(copy.loanPeriod.lent);
    expect(period).not.toHaveTextContent("\u2192");
  });

  it("says a start-less loan had no deadline either, without inventing a date", async () => {
    mockHistory([
      historyItem({
        durationDays: null,
        expectedReturnDate: null,
        historyResult: "no_due_date",
        loanDate: null,
      }),
    ]);

    renderHistory();

    const period = await findPeriod("Дюна");
    expect(period).toHaveTextContent(copy.loanPeriod.startUnknown);
    expect(period).toHaveTextContent(copy.loanPeriod.noTerm);
    expect(period).toHaveTextContent(`${copy.loanPeriod.returned} 04.07.2026`);
    expect(period).not.toHaveTextContent(plannedOn("").trim());
  });

  it("names the person as one clickable entity in both directions", async () => {
    mockHistory([
      historyItem({ type: "lent_to_someone" }),
      historyItem({
        book: { ...historyItem().book, id: "book-solaris", title: "Соляріс" },
        id: "loan-solaris",
        type: "borrowed_from_someone",
      }),
    ]);

    renderHistory();

    for (const title of ["Дюна", "Соляріс"]) {
      const trigger = within(await findRow(title)).getByRole("button", {
        name: openContactLabel("Олена"),
      });
      expect(within(trigger).getByText("Олена")).toBeInTheDocument();
    }
  });

  it("keeps the contact details out of the card and inside the person card", async () => {
    mockHistory([historyItem({ contact: "olena@example.com" })]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).queryByText("olena@example.com")).not.toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: openContactLabel("Олена") }),
    ).not.toHaveAccessibleDescription();
  });

  it("marks a returned-on-time loan and labels how long it lasted", async () => {
    mockHistory([historyItem({ durationDays: 26, historyResult: "on_time" })]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByText(copy.result.on_time)).toBeInTheDocument();
    expect(within(row).getByText("Тривалість: 26 днів")).toBeInTheDocument();
  });

  it.each([
    { case: "on the due date", returnedDate: "2026-07-10" },
    { case: "before the due date", returnedDate: "2026-07-04" },
  ])("counts a loan returned $case as on time", async ({ returnedDate }) => {
    mockHistory([historyItem({ durationDays: 22, historyResult: "on_time", returnedDate })]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByText(copy.result.on_time)).toBeInTheDocument();
    expect(within(row).queryByText(/Із запізненням/)).not.toBeInTheDocument();
  });

  it.each([
    { delayDays: 1, delayText: "Із запізненням на 1 день" },
    { delayDays: 2, delayText: "Із запізненням на 2 дні" },
    { delayDays: 12, delayText: "Із запізненням на 12 днів" },
  ])("keeps the $delayDays-day delay apart from the duration", async ({ delayDays, delayText }) => {
    mockHistory([
      historyItem({
        delayDays,
        durationDays: 40,
        expectedReturnDate: "2026-05-28",
        historyResult: "late",
        returnedDate: "2026-06-02",
      }),
    ]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByText(delayText)).toBeInTheDocument();
    expect(within(row).getByText("Тривалість: 40 днів")).toBeInTheDocument();
  });

  it.each([
    { durationDays: 1, durationText: "Тривалість: 1 день" },
    { durationDays: 2, durationText: "Тривалість: 2 дні" },
    { durationDays: 5, durationText: "Тривалість: 5 днів" },
  ])("declines the $durationDays-day duration", async ({ durationDays, durationText }) => {
    mockHistory([historyItem({ durationDays })]);

    renderHistory();

    expect(within(await findRow("Дюна")).getByText(durationText)).toBeInTheDocument();
  });

  it("keeps a real same-day loan at zero days instead of hiding it", async () => {
    mockHistory([
      historyItem({
        durationDays: 0,
        loanDate: "2026-07-04",
        returnedDate: "2026-07-04",
      }),
    ]);

    renderHistory();

    expect(within(await findRow("Дюна")).getByText("Тривалість: 0 днів")).toBeInTheDocument();
  });

  it("says a loan had no due date without repeating the loan-period wording", async () => {
    mockHistory([
      historyItem({ durationDays: 15, expectedReturnDate: null, historyResult: "no_due_date" }),
    ]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(await findPeriod("Дюна")).getByText(copy.loanPeriod.noTerm)).toBeInTheDocument();
    expect(within(row).getByText(copy.row.outcome.noDueDate)).toBeInTheDocument();
    expect(within(row).getByText("Тривалість: 15 днів")).toBeInTheDocument();
    expect(within(row).queryByText(copy.result.no_due_date)).not.toBeInTheDocument();
    expect(within(row).queryAllByText(copy.loanPeriod.noTerm)).toHaveLength(1);
  });

  it("still names the outcome of a no-due-date loan whose duration is unknown", async () => {
    mockHistory([
      historyItem({
        durationDays: null,
        expectedReturnDate: null,
        historyResult: "no_due_date",
        loanDate: null,
      }),
    ]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByText(copy.row.outcome.noDueDate)).toBeInTheDocument();
    expect(within(row).queryByText(/Тривалість/)).not.toBeInTheDocument();
    expect(within(row).queryByText(copy.result.no_due_date)).not.toBeInTheDocument();
  });

  it.each([
    { expectedReturnDate: "2026-07-10", historyResult: "on_time" },
    { delayDays: 9, expectedReturnDate: "2026-06-25", historyResult: "late" },
    { expectedReturnDate: null, historyResult: "no_due_date" },
  ] as const)(
    "drops the duration of a $historyResult loan that never got a start date",
    async (outcome) => {
      mockHistory([historyItem({ ...outcome, durationDays: null, loanDate: null })]);

      renderHistory();

      const row = await findRow("Дюна");
      expect(within(row).queryByText(/Тривалість/)).not.toBeInTheDocument();
      expect(within(row).queryByText(copy.duration.unknown)).not.toBeInTheDocument();
    },
  );

  it("labels the duration the same way for a borrowed loan", async () => {
    mockHistory([historyItem({ durationDays: 26, type: "borrowed_from_someone" })]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByText(copy.direction.borrowed_from_someone)).toBeInTheDocument();
    expect(within(row).getByText("Тривалість: 26 днів")).toBeInTheDocument();
  });

  it("keeps the active-loan actions off a completed loan", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    await userEvent.click(within(row).getByRole("button", { name: copy.actions.menu }));

    expect(
      await screen.findByRole("menuitem", { name: copy.actions.correctDate }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: messages.loans.actions.markReturned }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Продовжити/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Нагадування/ })).not.toBeInTheDocument();
  });

  it("leaves the row menu with nothing but the two corrections", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    await userEvent.click(within(row).getByRole("button", { name: copy.actions.menu }));

    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([copy.actions.correctDate, copy.actions.editNote]);
  });

  it("sends the reader to the book through the card, not through the row menu", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(within(row).getByRole("link", { name: "Дюна" })).toHaveAttribute(
      "href",
      "/books/book-dune",
    );

    await userEvent.click(within(row).getByRole("button", { name: copy.actions.menu }));

    const menu = await screen.findByRole("menu");
    expect(
      within(menu).queryByRole("menuitem", { name: copy.actions.openBook }),
    ).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView detail sheet", () => {
  it("opens the details from the result block", async () => {
    mockHistory([historyItem({ contact: "olena@example.com", note: "Повернулася із закладкою" })]);

    renderHistory();

    await userEvent.click(await findResultBlock("Дюна"));

    const sheet = await screen.findByRole("dialog", { name: copy.detail.title });
    expect(within(sheet).getByText("olena@example.com")).toBeInTheDocument();
    expect(within(sheet).getByText("Повернулася із закладкою")).toBeInTheDocument();
    expect(lastDetailUrl()).toBe("/api/loans/history/loan-dune");
  });

  it.each([
    { historyResult: "on_time", outcome: copy.result.on_time },
    { delayDays: 9, historyResult: "late", outcome: "Із запізненням на 9 днів" },
    { expectedReturnDate: null, historyResult: "no_due_date", outcome: copy.row.outcome.noDueDate },
  ] as const)("opens the details from a $historyResult result block", async (item) => {
    mockHistory([historyItem(item)]);

    renderHistory();

    const trigger = await findResultBlock("Дюна");
    expect(within(trigger).getByText(item.outcome)).toBeInTheDocument();

    await userEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: copy.detail.title })).toBeInTheDocument();
    expect(lastDetailUrl()).toBe("/api/loans/history/loan-dune");
  });

  it.each(["{Enter}", " "])("opens the details when the reader presses %s", async (key) => {
    mockHistory([historyItem()]);

    renderHistory();

    const trigger = await findResultBlock("Дюна");
    trigger.focus();
    await userEvent.keyboard(key);

    expect(await screen.findByRole("dialog", { name: copy.detail.title })).toBeInTheDocument();
  });

  it("names the result block as the only way the card itself opens the details", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([openContactLabel("Олена"), copy.row.openDetails, copy.actions.menu]);
  });

  it("leaves the details closed when the reader clicks the empty part of the card", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await userEvent.click(await findRow("Дюна"));
    await userEvent.click(await findPeriod("Дюна"));

    expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
    expect(requests.some((entry) => isDetailRequest(entry.url))).toBe(false);
  });

  it("opens the person card from the name in a row, leaving the details closed", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    await userEvent.click(within(row).getByRole("button", { name: openContactLabel("Олена") }));

    expect(await screen.findByRole("dialog", { name: "Олена" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
    expect(requests.some((entry) => entry.url === `/api/loans/contacts/${CONTACT_IDS.olena}`)).toBe(
      true,
    );
  });

  it("leaves the details closed when the reader follows the book title", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    const title = within(row).getByRole("link", { name: "Дюна" });

    await userEvent.click(title);

    expect(title).toHaveAttribute("href", "/books/book-dune");
    expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
  });

  it("leaves the details closed when the reader follows the cover", async () => {
    mockHistory([historyItem({ book: { ...historyItem().book, cover: bookCover() } })]);

    renderHistory();

    const row = await findRow("Дюна");
    const links = within(row).getAllByRole("link", { name: "Дюна" });
    expect(links).toHaveLength(2);

    const cover = links[0] ?? row;
    await userEvent.click(cover);

    expect(cover).toHaveAttribute("href", "/books/book-dune");
    expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
  });

  it("leaves the details closed when the reader opens the row menu", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const row = await findRow("Дюна");
    await userEvent.click(within(row).getByRole("button", { name: copy.actions.menu }));

    await screen.findByRole("menuitem", { name: copy.actions.correctDate });
    expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
  });

  it("says the note is missing rather than showing an empty section", async () => {
    mockHistory([historyItem({ note: null })]);

    renderHistory();

    await userEvent.click(await findResultBlock("Дюна"));

    const sheet = await screen.findByRole("dialog", { name: copy.detail.title });
    expect(within(sheet).getByText(copy.detail.noteEmpty)).toBeInTheDocument();
  });
});

describe("LoanHistoryView focus", () => {
  it.each(["click", "keyboard"] as const)(
    "hands focus back to the result block when the details sheet closes after a %s open",
    async (how) => {
      mockHistory([historyItem()]);

      renderHistory();

      const trigger = await findResultBlock("Дюна");

      if (how === "click") {
        await userEvent.click(trigger);
      } else {
        trigger.focus();
        await userEvent.keyboard("{Enter}");
      }
      await screen.findByRole("dialog", { name: copy.detail.title });
      await userEvent.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    },
  );

  it("hands focus back to the row menu when a correction opened there closes", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await openCorrectionDialog(copy.actions.correctDate);
    await screen.findByRole("dialog", { name: copy.correctDate.title });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: copy.correctDate.title }),
      ).not.toBeInTheDocument();
    });

    const row = await findRow("Дюна");
    await waitFor(() => {
      expect(within(row).getByRole("button", { name: copy.actions.menu })).toHaveFocus();
    });
  });

  it("keeps each row focus restore on its own card", async () => {
    mockHistory(historyItems(3));

    renderHistory();

    const trigger = await findResultBlock("Книга 2");

    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: copy.detail.title });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: copy.detail.title })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps focus inside the details sheet when a correction opened there closes", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await userEvent.click(await findResultBlock("Дюна"));

    const sheet = await screen.findByRole("dialog", { name: copy.detail.title });
    const sheetAction = await within(sheet).findByRole("button", {
      name: copy.actions.correctDate,
    });

    await userEvent.click(sheetAction);
    await screen.findByRole("dialog", { name: copy.correctDate.title });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: copy.correctDate.title }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(sheetAction).toHaveFocus();
    });
    expect(screen.getByRole("dialog", { name: copy.detail.title })).toBeInTheDocument();
  });
});

describe("LoanHistoryView analytics sidebar", () => {
  it("breaks down the people the reader lends to most", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const block = await findSidebarBlock(copy.sidebar.people.title);
    const rows = within(block).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Олена");
    expect(rows[0]).toHaveTextContent("8 позик");
    expect(rows[0]).toHaveTextContent("5 передано · 3 позичено");
    expect(
      within(block).getByRole("button", { name: openContactLabel("Олена") }),
    ).toBeInTheDocument();
    expect(within(block).getAllByRole("button")).toHaveLength(2);
  });

  it("opens the person card from the people block instead of filtering", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockHistory([historyItem()]);

    renderHistory("", onUrlUpdate);

    const block = await findSidebarBlock(copy.sidebar.people.title);

    await userEvent.click(within(block).getByRole("button", { name: openContactLabel("Олена") }));

    expect(await screen.findByRole("dialog", { name: "Олена" })).toBeInTheDocument();
    expect(events).toHaveLength(0);
  });

  it("reports the durations the backend measured", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const block = await findSidebarBlock(copy.sidebar.duration.title);
    expect(within(block).getByText("18 днів")).toBeInTheDocument();
    expect(within(block).getByText("73 дні")).toBeInTheDocument();
    expect(within(block).getByText("2 дні")).toBeInTheDocument();
  });

  it("reads the sidebar percent off the same deadline-bound formula as the card", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const block = await findSidebarBlock(copy.sidebar.reliability.title);
    expect(within(block).getByText("74% повернуто вчасно")).toBeInTheDocument();
    expect(within(block).getByText("26 вчасно · 9 із запізненням")).toBeInTheDocument();
  });

  it("keeps the loans with no deadline out of the sidebar percentage", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    const block = await findSidebarBlock(copy.sidebar.reliability.title);
    expect(within(block).getByText("2 позики без визначеного строку")).toBeInTheDocument();
    expect(within(block).getByText(copy.sidebar.reliability.noDueDateNote)).toBeInTheDocument();
  });

  it("drops the sidebar percentage when no loan carried a deadline", async () => {
    mockHistory([historyItem()], {
      overview: {
        ...OVERVIEW,
        reliability: { lateCount: 0, noDueDateCount: 37, onTimeCount: 0, onTimePercent: null },
      },
    });

    renderHistory();

    const block = await findSidebarBlock(copy.sidebar.reliability.title);
    expect(within(block).getByText(copy.sidebar.reliability.noDueDateOnly)).toBeInTheDocument();
    expect(within(block).queryByText(/0% повернуто вчасно/)).not.toBeInTheDocument();
  });
});

describe("LoanHistoryView pagination", () => {
  it("keeps the loans beyond the first page off the screen", async () => {
    mockHistory(historyItems(12));

    renderHistory();

    await findRow("Книга 1");
    expect(screen.getByText(shownCount(10, 12))).toBeInTheDocument();
    expect(screen.queryByText("Книга 11")).not.toBeInTheDocument();
  });

  it("appends the next page when the reader asks for more", async () => {
    mockHistory(historyItems(12));

    renderHistory();

    await findRow("Книга 1");
    await userEvent.click(screen.getByRole("button", { name: copy.loadMore }));

    expect(await screen.findByText("Книга 11")).toBeInTheDocument();
    expect(screen.getByText("Книга 1")).toBeInTheDocument();
    expect(requests.some((entry) => entry.url.includes("pageNumber=2"))).toBe(true);
  });

  it("keeps the show-more button away when every loan already fits", async () => {
    mockHistory(historyItems(3));

    renderHistory();

    await findRow("Книга 1");
    expect(screen.queryByRole("button", { name: copy.loadMore })).not.toBeInTheDocument();
  });

  it("returns to the first page when a filter changes", async () => {
    mockHistory(historyItems(12));

    renderHistory();

    await findRow("Книга 1");
    await userEvent.click(screen.getByRole("button", { name: copy.loadMore }));
    await screen.findByText("Книга 11");

    await userEvent.click(chip(quickFilters.on_time));

    await waitFor(() => {
      expect(screen.queryByText("Книга 11")).not.toBeInTheDocument();
    });
    expect(lastListUrl()).toContain("pageNumber=1");
    expect(lastListUrl()).toContain("result=on_time");
  });
});

describe("LoanHistoryView correction", () => {
  it("sends only the corrected return date", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await correctReturnedDate();

    await waitFor(() => {
      expect(lastCorrection()).toEqual({
        payload: { returnedDate: "2026-07-01" },
        url: "/api/loans/history/loan-dune",
      });
    });
  });

  it("confirms the correction and closes the dialog", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await correctReturnedDate();

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(copy.correctDate.success);
    });
    expect(screen.queryByRole("dialog", { name: copy.correctDate.title })).not.toBeInTheDocument();
  });

  it("sends only the edited note", async () => {
    mockHistory([historyItem()]);

    renderHistory();

    await openCorrectionDialog(copy.actions.editNote);
    const dialog = await screen.findByRole("dialog", { name: copy.editNote.title });

    await userEvent.type(
      within(dialog).getByLabelText(copy.editNote.label),
      "Повернули із листівкою",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: copy.editNote.save }));

    await waitFor(() => {
      expect(lastCorrection().payload).toEqual({ note: "Повернули із листівкою" });
    });
  });

  it("shows a rejected date under the field instead of a toast", async () => {
    server.correctionError = {
      body: {
        errorsMessages: [
          { field: "returnedDate", message: "Returned date cannot precede the loan date" },
        ],
      },
      status: 400,
    };
    mockHistory([historyItem()]);

    renderHistory();

    await openCorrectionDialog(copy.actions.correctDate);
    const dialog = await screen.findByRole("dialog", { name: copy.correctDate.title });
    await userEvent.click(within(dialog).getByRole("button", { name: copy.correctDate.save }));

    const fieldError = await within(dialog).findByRole("alert");
    expect(fieldError).toHaveAttribute("id", "loan-history-returned-date-error");
    expect(within(dialog).getByRole("button", { name: copy.correctDate.label })).toHaveAttribute(
      "aria-describedby",
      "loan-history-returned-date-error",
    );
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it("repeats the reason the backend gave for refusing the note", async () => {
    server.correctionError = { body: { message: "Note is too long for storage" }, status: 422 };
    mockHistory([historyItem()]);

    renderHistory();

    await openCorrectionDialog(copy.actions.editNote);
    const dialog = await screen.findByRole("dialog", { name: copy.editNote.title });

    await userEvent.type(within(dialog).getByLabelText(copy.editNote.label), "Нотатка");
    await userEvent.click(within(dialog).getByRole("button", { name: copy.editNote.save }));

    expect(await within(dialog).findByText("Note is too long for storage")).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });
});

function bookCover(): NonNullable<HistoryFixture["book"]["cover"]> {
  return {
    contentType: "image/webp",
    createdAt: "2026-06-01T08:00:00.000Z",
    height: 900,
    id: "media-dune",
    kind: "book_cover",
    name: null,
    sizeBytes: 12_000,
    urls: {
      card: "https://cdn.example.com/dune-card.webp",
      full: "https://cdn.example.com/dune-full.webp",
      thumb: "https://cdn.example.com/dune-thumb.webp",
    },
    width: 600,
  };
}

function chip(label: string): HTMLElement {
  return screen.getByRole("radio", { name: chipName(label) });
}

function chipName(label: string): (name: string) => boolean {
  return (name) => name.startsWith(label);
}

function contactView(contactId: string): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    id: contactId,
    loanCount: 8,
    name: CONTACT_NAMES[contactId] ?? "Невідомий",
    updatedAt: "2026-01-01T10:00:00.000Z",
  };
}

async function correctReturnedDate(): Promise<void> {
  await openCorrectionDialog(copy.actions.correctDate);
  const dialog = await screen.findByRole("dialog", { name: copy.correctDate.title });

  await userEvent.click(within(dialog).getByRole("button", { name: copy.correctDate.label }));
  const calendar = await screen.findByRole("grid");
  await userEvent.click(within(calendar).getByRole("button", { name: /^\D+, 1-е липня 2026/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: copy.correctDate.save }));
}

function countResults(items: HistoryFixture[]): LoanHistoryResultCounts {
  return {
    all: items.length,
    late: items.filter((item) => item.historyResult === "late").length,
    no_due_date: items.filter((item) => item.historyResult === "no_due_date").length,
    on_time: items.filter((item) => item.historyResult === "on_time").length,
  };
}

function filterSection(title: string): HTMLElement {
  const section = screen
    .getAllByText(title)
    .map((node) => node.closest<HTMLElement>('[data-slot="filter-section"]'))
    .find((node) => node !== null);
  if (section === undefined) throw new Error(`Filter section not found: ${title}`);
  return section;
}

function findChip(label: string): Promise<HTMLElement> {
  return screen.findByRole("radio", { name: chipName(label) });
}

function findMobileTile(compactLabel: string): Promise<HTMLElement> {
  return waitFor(() => {
    const tile = screen
      .getAllByText(compactLabel)
      .map((node) => node.closest<HTMLElement>('[data-slot="card"]'))
      .find((node) => node !== null);
    if (tile === undefined) throw new Error(`Mobile tile not found: ${compactLabel}`);
    return tile;
  });
}

async function findPeriod(title: string): Promise<HTMLElement> {
  const row = await findRow(title);
  const block = within(row).getByText(copy.loanPeriod.title).parentElement;
  if (block === null) throw new Error(`Loan period block not found: ${title}`);
  return block;
}

async function findResultBlock(title: string): Promise<HTMLElement> {
  const row = await findRow(title);
  return within(row).getByRole("button", { name: copy.row.openDetails });
}

async function findRow(title: string): Promise<HTMLElement> {
  const heading = await screen.findByText(title);
  const row = heading.closest<HTMLElement>("article");
  if (row === null) throw new Error(`History row not found: ${title}`);
  return row;
}

function findSidebarBlock(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const sidebar = screen.getByRole("complementary", { name: copy.sidebar.label });
    const block = within(sidebar).getByText(title).closest<HTMLElement>("section");
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

function formatUkDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function historyItem(overrides: Partial<HistoryFixture> = {}): HistoryFixture {
  return {
    book: {
      cover: null,
      firstAuthorName: "Френк Герберт",
      id: "book-dune",
      originalTitle: null,
      ownershipStatus: "owned",
      publisher: null,
      title: "Дюна",
    },
    contact: null,
    createdAt: "2026-06-12T08:00:00.000Z",
    delayDays: null,
    durationDays: 22,
    expectedReturnDate: "2026-07-10",
    historyResult: "on_time",
    id: "loan-dune",
    loanContactId: CONTACT_IDS.olena,
    loanDate: "2026-06-12",
    note: null,
    personName: "Олена",
    returnedAt: "2026-07-04T10:00:00.000Z",
    returnedDate: "2026-07-04",
    type: "lent_to_someone",
    updatedAt: "2026-07-04T10:00:00.000Z",
    ...overrides,
  };
}

function historyItems(count: number): HistoryFixture[] {
  return Array.from({ length: count }, (_, index) =>
    historyItem({
      book: { ...historyItem().book, id: `book-${index + 1}`, title: `Книга ${index + 1}` },
      id: `loan-${index + 1}`,
    }),
  );
}

function isDetailRequest(url: string): boolean {
  if (!url.startsWith("/api/loans/history/")) return false;
  return !url.includes("/overview") && !url.includes("/people");
}

function isListRequest(url: string): boolean {
  return url.split("?")[0] === "/api/loans/history";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastCorrection(): { payload: unknown; url: string } {
  const found = requests.filter((entry) => entry.method === "PATCH").at(-1);
  if (found?.body === undefined) throw new Error("the correction was never sent");
  return { payload: JSON.parse(found.body), url: found.url };
}

function lastDetailUrl(): string {
  const found = requests
    .filter((entry) => entry.method === "GET" && isDetailRequest(entry.url))
    .at(-1);
  if (found === undefined) throw new Error("the loan detail was never requested");
  return found.url;
}

function lastListUrl(): string {
  const found = requests.filter((entry) => isListRequest(entry.url)).at(-1);
  if (found === undefined) throw new Error("the history list was never requested");
  return found.url;
}

function lastPeopleUrl(): string {
  const found = requests.filter((entry) => entry.url.includes("/api/loans/history/people")).at(-1);
  if (found === undefined) throw new Error("the history people were never requested");
  return found.url;
}

function mockHistory(items: HistoryFixture[], options: MockOptions = {}) {
  const pageSize = 10;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      requests.push({ body: typeof init?.body === "string" ? init.body : undefined, method, url });

      if (url.includes("/api/profile/settings")) {
        return Promise.resolve(jsonResponse(defaultUserProfileSettings));
      }

      if (url.includes("/api/loans/contacts/")) {
        return Promise.resolve(jsonResponse(contactView(url.split("/").at(-1) ?? "")));
      }

      if (url.includes("/api/loans/history/overview")) {
        return Promise.resolve(jsonResponse(options.overview ?? OVERVIEW));
      }

      if (url.includes("/api/loans/history/people")) {
        return Promise.resolve(
          jsonResponse({
            items: options.people ?? [
              { contactId: CONTACT_IDS.olena, personName: "Олена", totalCount: 8 },
            ],
          }),
        );
      }

      if (isListRequest(url)) {
        if (server.listPending) return new Promise<Response>(() => undefined);
        if (server.listStatus !== null) {
          return Promise.resolve(jsonResponse({ message: "boom" }, server.listStatus));
        }

        const pageNumber = Number(
          new URL(url, "http://localhost").searchParams.get("pageNumber") ?? 1,
        );

        return Promise.resolve(
          jsonResponse({
            items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
            page: pageNumber,
            pagesCount: Math.max(1, Math.ceil(items.length / pageSize)),
            pageSize,
            resultCounts: options.resultCounts ?? countResults(items),
            totalCount: items.length,
          }),
        );
      }

      if (url.split("?")[0] === "/api/loans") {
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pagesCount: 1, pageSize, totalCount: 0 }),
        );
      }

      if (method === "PATCH" && server.correctionError !== null) {
        return Promise.resolve(
          jsonResponse(server.correctionError.body, server.correctionError.status),
        );
      }

      const loan = items.find((item) => url.endsWith(item.id));
      if (loan === undefined) return Promise.resolve(jsonResponse({ message: "not found" }, 404));
      return Promise.resolve(jsonResponse(loan));
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

async function openCorrectionDialog(action: string) {
  const row = await findRow("Дюна");
  await userEvent.click(within(row).getByRole("button", { name: copy.actions.menu }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

function personChip(name: string): string {
  return activeFilters.person.replace("{name}", name);
}

function personPicker(): HTMLElement {
  return screen.getByRole("combobox", { name: copy.person.label });
}

async function pickOption(selectLabel: string, optionName: RegExp | string) {
  await userEvent.click(screen.getByRole("combobox", { name: selectLabel }));
  await userEvent.click(await screen.findByRole("option", { name: optionName }));
}

async function pickPerson(name: string): Promise<void> {
  await userEvent.click(personPicker());
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

function plannedOn(date: string): string {
  return copy.loanPeriod.plan.replace("{date}", date);
}

function renderHistory(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <LoanHistoryView />
    </NuqsTestingAdapter>,
  );
}

function searchChip(query: string): string {
  return activeFilters.search.replace("{query}", query);
}

function shownCount(shown: number, total: number): string {
  return `Показано ${shown} із ${total} позик`;
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import {
  calendarFixture,
  overviewFixture,
  readingDayDetailsFixture,
} from "../../model/statistics.fixtures";
import { ReadingCalendarCard } from "./reading-calendar-card";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const { meta } = overviewFixture();

function dayRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/statistics/reading-days/"));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/api/statistics/reading-days/")) {
      return Promise.resolve(
        new Response(JSON.stringify(readingDayDetailsFixture()), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingCalendarCard", () => {
  it("renders the books month grid from the overview previews without one request per day", async () => {
    renderWithProviders(<ReadingCalendarCard calendar={calendarFixture()} meta={meta} />);

    await userEvent.click(screen.getByRole("radio", { name: "Книги" }));

    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(dayRequests()).toHaveLength(0);
  });

  it("loads the full day only after the reader opens one", async () => {
    renderWithProviders(<ReadingCalendarCard calendar={calendarFixture()} meta={meta} />);

    await userEvent.click(screen.getByRole("button", { name: /2 березня 2026/ }));

    await waitFor(() => expect(dayRequests()).toHaveLength(1));
    expect(dayRequests()[0]).toContain("2026-03-02");
    expect(await screen.findByText("Видалена книга")).toBeInTheDocument();
    expect(screen.getByText("Книгу видалено з бібліотеки")).toBeInTheDocument();
  });

  it("hides the current streak for a closed historical period instead of showing zero", () => {
    renderWithProviders(
      <ReadingCalendarCard
        calendar={calendarFixture({
          currentStreak: { availability: "unavailable", data: null, reason: "PERIOD_NOT_CURRENT" },
        })}
        meta={meta}
      />,
    );

    expect(screen.queryByText("Поточна серія")).not.toBeInTheDocument();
    expect(screen.getByText("Найдовша серія")).toBeInTheDocument();
  });

  it("marks a clipped current streak instead of implying it is the whole streak", () => {
    renderWithProviders(
      <ReadingCalendarCard
        calendar={calendarFixture({
          currentStreak: {
            availability: "available",
            data: {
              continuesBeforeRange: true,
              continuesBeforeReliableHistory: false,
              days: 7,
              endDate: "2026-03-03",
              startDate: "2026-03-01",
            },
          },
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText("7+ днів")).toBeInTheDocument();
    expect(screen.getByText("Серія почалася до початку періоду")).toBeInTheDocument();
  });

  it("explains an unavailable weekday metric instead of silently dropping it", () => {
    renderWithProviders(
      <ReadingCalendarCard
        calendar={calendarFixture({
          mostActiveWeekday: {
            availability: "unavailable",
            data: null,
            reason: "LEGACY_HISTORY_INCOMPLETE",
          },
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText("Найактивніший день тижня")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Частина періоду передує повному обліку історії, тому показник був би оманливим.",
      ),
    ).toBeInTheDocument();
  });

  it("says explicitly when the drawn range is narrower than the measured one", () => {
    renderWithProviders(<ReadingCalendarCard calendar={calendarFixture()} meta={meta} />);

    expect(screen.getByText(/Календар показує/)).toBeInTheDocument();
    expect(screen.getByText(/Показники за/)).toBeInTheDocument();
  });

  it("renders an unavailable calendar with its reason instead of an empty grid", () => {
    renderWithProviders(
      <ReadingCalendarCard
        calendar={calendarFixture({
          activeDays: 0,
          availability: "unavailable",
          days: [],
          reason: "NO_ACTIVITY_HISTORY",
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText("Календар недоступний")).toBeInTheDocument();
    expect(screen.getByText("Ще немає жодного запису про прочитані сторінки.")).toBeInTheDocument();
  });

  it("orders the heatmap weekdays by the resolved week start", () => {
    const { unmount } = renderWithProviders(
      <ReadingCalendarCard calendar={calendarFixture()} meta={meta} />,
    );

    expect(screen.getAllByText("пн").length).toBeGreaterThan(0);
    unmount();

    renderWithProviders(
      <ReadingCalendarCard
        calendar={calendarFixture()}
        meta={{ ...meta, weekStartDay: "sunday" }}
      />,
    );

    expect(screen.getAllByText("нд").length).toBeGreaterThan(0);
  });
});

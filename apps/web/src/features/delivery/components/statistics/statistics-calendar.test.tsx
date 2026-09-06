import type { BookOrderStatisticsDaily, StatisticsPeriod } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { StatisticsCalendar } from "./statistics-calendar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TODAY = "2026-03-08";

const PERIOD: StatisticsPeriod = { from: "2026-03-02", to: "2026-03-08" };

const DAILY: BookOrderStatisticsDaily = [
  {
    booksCount: 4,
    date: "2026-03-03",
    drilldown: { targets: [{ booksCount: 4, destination: "in_transit", ordersCount: 2 }] },
    ordersCount: 2,
    totalsByCurrency: [{ currency: "UAH", total: 6773 }],
  },
  {
    booksCount: 3,
    date: "2026-03-05",
    drilldown: {
      targets: [
        { booksCount: 1, destination: "in_transit", ordersCount: 1 },
        { booksCount: 2, destination: "history_received", ordersCount: 2 },
      ],
    },
    ordersCount: 3,
    totalsByCurrency: [],
  },
];

function renderCalendar({
  daily = DAILY,
  isTruncated = false,
  period = PERIOD,
}: {
  daily?: BookOrderStatisticsDaily;
  isTruncated?: boolean;
  period?: StatisticsPeriod;
} = {}) {
  return renderWithProviders(
    <StatisticsCalendar
      daily={daily}
      drilldown={{
        currencyFilter: null,
        displayCurrency: "UAH",
        isStale: false,
        orderState: null,
        store: null,
      }}
      isTruncated={isTruncated}
      period={period}
      today={TODAY}
    />,
  );
}

describe("StatisticsCalendar", () => {
  it("keeps its name and says which date it groups by", () => {
    renderCalendar();

    expect(screen.getByText("Календар покупок")).toBeInTheDocument();
    expect(
      screen.getByText("Покупки за датою оформлення замовлення. Темніший день — більше замовлень."),
    ).toBeInTheDocument();
  });

  it("moves the subtitle and the legend to books when the mode changes", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("radio", { name: "Книги" }));

    expect(
      screen.getByText("Покупки за датою оформлення замовлення. Темніший день — більше книг."),
    ).toBeInTheDocument();
    expect(screen.getByText("Менше книг")).toBeInTheDocument();
  });

  it("explains that the shading is relative to the busiest day shown", () => {
    renderCalendar();

    expect(
      screen.getByText(
        "Насиченість показує активність відносно найактивнішого дня показаного періоду.",
      ),
    ).toBeInTheDocument();
  });

  it("names the weekdays down the side", () => {
    renderCalendar();

    expect(screen.getByText("пн")).toBeInTheDocument();
    expect(screen.getByText("нд")).toBeInTheDocument();
  });

  it("leaves a quiet day out of the tab order rather than linking it nowhere", () => {
    renderCalendar();

    expect(
      screen.getByRole("img", { name: /2 березня 2026 р.: без замовлень/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /2 березня 2026 р.: без замовлень/ }),
    ).not.toBeInTheDocument();
  });

  it("opens a day that lives in one place straight there, on that exact order date", () => {
    renderCalendar();

    expect(
      screen.getByRole("link", { name: /3 березня 2026 р.: 2 замовлення, 4 книги/ }),
    ).toHaveAttribute("href", "/delivery/in-transit?orderedFrom=2026-03-03&orderedTo=2026-03-03");
  });

  it("offers a choice for a day whose orders ended up in two places", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /5 березня 2026 р./ }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?orderedFrom=2026-03-05&orderedTo=2026-03-05",
    );
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&from=2026-03-05&to=2026-03-05",
    );
  });

  it("hides the destinations a day never reached", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /5 березня 2026 р./ }));

    expect(screen.queryByRole("menuitem", { name: /Скасовані/ })).not.toBeInTheDocument();
  });

  it("stops promising an exact day once the source was cut short", () => {
    renderCalendar({ isTruncated: true });

    expect(screen.queryByRole("link", { name: /3 березня 2026 р./ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3 березня 2026 р./ })).toBeInTheDocument();
  });

  it("says the calendar has nothing to draw when the period lies ahead", () => {
    renderCalendar({ period: { from: "2027-01-01", to: "2027-12-31" } });

    expect(screen.getByText("Немає даних для календаря покупок.")).toBeInTheDocument();
  });

  it("keeps the grid but names the quiet year", () => {
    renderCalendar({ daily: [], period: { from: "2026-01-01", to: "2026-03-08" } });

    expect(screen.getByText("У 2026 році покупок не було.")).toBeInTheDocument();
  });
});

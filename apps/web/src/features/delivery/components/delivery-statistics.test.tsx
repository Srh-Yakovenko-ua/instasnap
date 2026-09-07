import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { STATISTICS_QUERY_KEY } from "../api/use-statistics";
import {
  makeActiveMoneyAge,
  makeBookBudgetOverview,
  makeStatisticsView,
} from "../model/statistics.fixtures";
import { DeliveryStatistics } from "./delivery-statistics";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

type StatisticsHandlers = {
  activeAge: () => Promise<Response>;
  budgets: () => Promise<Response>;
  statistics: () => Promise<Response>;
};

const SECTION_ORDER = [
  "Витрачено",
  "Бюджет на книги",
  "Динаміка покупок",
  "Як формується ціна книги",
  "Рейтинг магазинів",
  "Порівняння магазинів",
  "Шлях замовлень",
  "Активні замовлення за часом від оформлення",
  "Календар покупок",
  "Рекорди",
  "Найдорожчі замовлення",
];

const EMPTY_VIEW = makeStatisticsView({
  summary: { ...makeStatisticsView().summary, ordersCount: 0 },
});

const fetchMock = vi.fn();

const handlers: StatisticsHandlers = {
  activeAge: () => Promise.resolve(jsonResponse(makeActiveMoneyAge())),
  budgets: () => Promise.resolve(jsonResponse(makeBookBudgetOverview())),
  statistics: () => Promise.resolve(jsonResponse(makeStatisticsView())),
};

function cardOf(title: string): HTMLElement {
  const card = screen.getByText(title).closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error(`Card not found: ${title}`);
  return card;
}

function failingResponse(): Response {
  return new Response(JSON.stringify({ message: "boom" }), {
    headers: { "Content-Type": "application/json" },
    status: 500,
  });
}

function follows(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
}

function hangs(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function renderStatistics(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={searchParams}>
      <DeliveryStatistics />
    </NuqsTestingAdapter>,
  );
}

function rowOf(title: string): HTMLElement {
  const row = cardOf(title).parentElement;
  if (!(row instanceof HTMLElement)) throw new Error(`Row not found: ${title}`);
  return row;
}

async function settle(): Promise<void> {
  for (const title of ["Динаміка покупок", "Порівняння магазинів", "Календар покупок"]) {
    await screen.findByText(title);
  }
}

beforeEach(() => {
  handlers.activeAge = () => Promise.resolve(jsonResponse(makeActiveMoneyAge()));
  handlers.budgets = () => Promise.resolve(jsonResponse(makeBookBudgetOverview()));
  handlers.statistics = () => Promise.resolve(jsonResponse(makeStatisticsView()));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/delivery/orders/statistics/active-age")) return handlers.activeAge();
    if (url.includes("/api/delivery/orders/statistics")) return handlers.statistics();
    if (url.includes("/api/delivery/budgets")) return handlers.budgets();
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryStatistics layout", () => {
  it("renders every section once, in the final reading order", async () => {
    renderStatistics();
    await settle();

    SECTION_ORDER.map((title) => screen.getByText(title)).reduce((previous, node) => {
      expect(follows(previous, node)).toBe(true);
      return node;
    });
  });

  it("puts the insights in their own card beside the dynamics chart, at the same height", async () => {
    renderStatistics();
    await settle();

    const dynamicsColumn = rowOf("Динаміка покупок");
    const row = rowOf("Ключове за період");

    expect(cardOf("Динаміка покупок")).not.toContainElement(screen.getByText("Ключове за період"));
    expect(dynamicsColumn.className).toContain("lg:col-span-2");
    expect(dynamicsColumn.parentElement).toBe(row);
    expect(row.className).toContain("lg:grid-cols-3");
    expect(row).not.toHaveClass("items-start");
    expect(dynamicsColumn).toHaveClass("grid");
  });

  it("pairs the two store cards in one two-column row", async () => {
    renderStatistics();
    await settle();

    const row = rowOf("Рейтинг магазинів");

    expect(rowOf("Порівняння магазинів")).toBe(row);
    expect(row.className).toContain("lg:grid-cols-2");
    expect(row.className).toContain("items-start");
  });

  it("pairs the lifecycle cards in one two-column row", async () => {
    renderStatistics();
    await settle();

    const row = rowOf("Шлях замовлень");

    expect(rowOf("Активні замовлення за часом від оформлення")).toBe(row);
    expect(row.className).toContain("lg:grid-cols-2");
    expect(row.className).toContain("items-start");
  });

  it("gives the calendar a full-width row of its own", async () => {
    renderStatistics();
    await settle();

    const calendar = cardOf("Календар покупок");

    expect(rowOf("Календар покупок").className).not.toContain("grid-cols");
    expect(calendar.className).not.toContain("h-full");
    expect(rowOf("Рекорди")).not.toBe(rowOf("Календар покупок"));
  });

  it("closes the page with records at one third and top orders at two thirds", async () => {
    renderStatistics();
    await settle();

    const row = rowOf("Рекорди");
    const topOrders = rowOf("Найдорожчі замовлення");

    expect(row.className).toContain("lg:grid-cols-3");
    expect(row.className).toContain("items-start");
    expect(topOrders.className).toContain("lg:col-span-2");
    expect(topOrders.parentElement).toBe(row);
  });

  it("lets paired cards keep their natural height", async () => {
    renderStatistics();
    await settle();

    for (const title of SECTION_ORDER.slice(1)) {
      expect(cardOf(title).className).not.toContain("h-full");
    }
  });

  it("loads with a skeleton that follows the same order", () => {
    handlers.statistics = hangs;

    renderStatistics();

    [
      screen.getByTestId("statistics-skeleton-kpi"),
      cardOf("Бюджет на книги"),
      screen.getByTestId("statistics-skeleton-dynamics"),
      screen.getByTestId("statistics-skeleton-costs"),
      screen.getByTestId("statistics-skeleton-stores"),
      screen.getByTestId("statistics-skeleton-lifecycle"),
      screen.getByTestId("statistics-skeleton-calendar"),
      screen.getByTestId("statistics-skeleton-records"),
    ].reduce((previous, node) => {
      expect(follows(previous, node)).toBe(true);
      return node;
    });
  });

  it("names the loading region for a screen reader", () => {
    handlers.statistics = hangs;

    renderStatistics();

    expect(screen.getByRole("status", { name: "Завантажуємо статистику…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("DeliveryStatistics query isolation", () => {
  it("keeps the budget and the active orders when the period query fails", async () => {
    handlers.statistics = () => Promise.resolve(failingResponse());

    renderStatistics();

    expect(await screen.findByText("Не вдалося завантажити дані")).toBeInTheDocument();
    expect(await screen.findByText("Бюджет на книги")).toBeInTheDocument();
    expect(screen.getByText("Активні замовлення за часом від оформлення")).toBeInTheDocument();
  });

  it("shows the budget while the period query is still loading", () => {
    handlers.statistics = hangs;

    renderStatistics();

    expect(screen.getByText("Бюджет на книги")).toBeInTheDocument();
    expect(screen.getByText("Активні замовлення за часом від оформлення")).toBeInTheDocument();
  });

  it("keeps a failed budget inside its own card", async () => {
    handlers.budgets = () => Promise.resolve(failingResponse());

    renderStatistics();
    await settle();

    expect(await screen.findByText("Не вдалося завантажити бюджет.")).toBeInTheDocument();
    expect(
      screen.queryByText("Задайте місячний бюджет, щоб бачити прогрес і прогноз витрат."),
    ).toBe(null);
  });

  it("keeps a failed active-age inside its own card, and never calls it empty", async () => {
    handlers.activeAge = () => Promise.resolve(failingResponse());

    renderStatistics();
    await settle();

    expect(
      await screen.findByText("Не вдалося завантажити активні замовлення."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Немає активних замовлень.")).toBe(null);
  });
});

describe("DeliveryStatistics empty states", () => {
  it("answers an empty period with one region instead of eight empty cards", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(EMPTY_VIEW));

    renderStatistics();

    expect(await screen.findByText("У вибраному періоді немає замовлень")).toBeInTheDocument();
    expect(screen.getByText("Витрачено")).toBeInTheDocument();
    expect(screen.getByText("Бюджет на книги")).toBeInTheDocument();
    expect(screen.getByText("Активні замовлення за часом від оформлення")).toBeInTheDocument();
    for (const title of ["Динаміка покупок", "Рейтинг магазинів", "Календар покупок", "Рекорди"]) {
      expect(screen.queryByText(title)).toBe(null);
    }
  });

  it("offers to reset the filters rather than to widen the period", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(EMPTY_VIEW));

    renderStatistics("?currency=EUR");

    expect(await screen.findByText("За цими фільтрами нічого не знайдено")).toBeInTheDocument();
    expect(screen.getByText("Спробуйте змінити або скинути фільтри.")).toBeInTheDocument();
    expect(screen.queryByText("Змінити період")).toBe(null);
  });

  it("greets a truly empty library with one onboarding state", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(EMPTY_VIEW));

    renderStatistics("?period=all_time");

    expect(await screen.findByText("Покупок ще немає")).toBeInTheDocument();
    expect(screen.getByText("Бюджет на книги")).toBeInTheDocument();
    expect(screen.queryByText("Витрачено")).toBe(null);
    expect(screen.queryByText("Активні замовлення за часом від оформлення")).toBe(null);
  });

  it("does not call an empty year an empty library", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(EMPTY_VIEW));

    renderStatistics();

    expect(await screen.findByText("У вибраному періоді немає замовлень")).toBeInTheDocument();
    expect(screen.queryByText("Покупок ще немає")).toBe(null);
  });
});

describe("DeliveryStatistics data quality", () => {
  it("says the source was cut short without hiding the page", async () => {
    const view = makeStatisticsView();
    handlers.statistics = () =>
      Promise.resolve(
        jsonResponse({
          ...view,
          meta: {
            ...view.meta,
            currentSource: { isTruncated: true, loadedOrdersCount: 5000, maxOrders: 5000 },
          },
        }),
      );

    renderStatistics();
    await settle();

    expect(screen.getByText("Неповні дані")).toBeInTheDocument();
    expect(screen.getByText("Динаміка покупок")).toBeInTheDocument();
  });
});

describe("DeliveryStatistics refreshing", () => {
  it("keeps the dashboard on screen while a new filter set is loading", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await settle();

    handlers.statistics = hangs;
    await user.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(await screen.findByText("Оновлюємо статистику…")).toBeInTheDocument();
    expect(screen.getByText("Динаміка покупок")).toBeInTheDocument();
    expect(screen.queryByTestId("statistics-skeleton-kpi")).toBe(null);
  });

  it("keeps the last numbers when a refetch fails", async () => {
    const { queryClient } = renderStatistics();
    await settle();

    handlers.statistics = () => Promise.resolve(failingResponse());
    void queryClient.refetchQueries({ queryKey: [STATISTICS_QUERY_KEY] });

    expect(
      await screen.findByText("Не вдалося оновити статистику. Показуємо останні завантажені дані."),
    ).toBeInTheDocument();
    expect(screen.getByText("Динаміка покупок")).toBeInTheDocument();
    expect(screen.queryByText("Не вдалося завантажити дані")).toBe(null);
  });
});

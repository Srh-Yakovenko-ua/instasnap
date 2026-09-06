import "@testing-library/jest-dom/vitest";

import type { BookOrderStatisticsView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import {
  makeActiveMoneyAge,
  makeBookBudgetOverview,
  makeMixedStatisticsView,
} from "../model/statistics.fixtures";
import { DeliveryStatistics } from "./delivery-statistics";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

type StatisticsHandlers = {
  activeAge: () => Promise<Response>;
  budgets: () => Promise<Response>;
  statistics: () => Promise<Response>;
};

const ACTIVE_AGE = makeActiveMoneyAge({
  buckets: [
    {
      booksCount: 6,
      key: "8_14",
      ordersCount: 3,
      shipmentsCount: 3,
      totalsByCurrency: [{ currency: "EUR", total: 180 }],
    },
  ],
});

const MIXED = makeMixedStatisticsView();

const fetchMock = vi.fn();

const requestedUrls: string[] = [];

const handlers: StatisticsHandlers = {
  activeAge: () => Promise.resolve(jsonResponse(ACTIVE_AGE)),
  budgets: () => Promise.resolve(jsonResponse(makeBookBudgetOverview())),
  statistics: () => Promise.resolve(jsonResponse(MIXED)),
};

function cardOf(title: string): HTMLElement {
  const card = screen.getByText(title).closest('[data-slot="card"], [data-slot="stat-card"]');
  if (!(card instanceof HTMLElement)) throw new Error(`Card not found: ${title}`);
  return card;
}

function currencyChoice(currency: string): HTMLElement {
  return within(screen.getByLabelText("Валюта показників")).getByRole("radio", { name: currency });
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

async function settle(): Promise<void> {
  for (const title of ["Динаміка покупок", "Порівняння магазинів", "Календар покупок"]) {
    await screen.findByText(title);
  }
}

function urlsOf(path: string): string[] {
  return requestedUrls.filter((url) => url.includes(path));
}

beforeEach(() => {
  requestedUrls.length = 0;
  handlers.activeAge = () => Promise.resolve(jsonResponse(ACTIVE_AGE));
  handlers.budgets = () => Promise.resolve(jsonResponse(makeBookBudgetOverview()));
  handlers.statistics = () => Promise.resolve(jsonResponse(MIXED));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
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

describe("Scenario A — mixed currencies", () => {
  it("shows every money section in the same currency at once", async () => {
    renderStatistics();
    await settle();

    expect(within(cardOf("Витрачено")).getByText("12 000 UAH")).toBeInTheDocument();
    expect(within(cardOf("Рейтинг магазинів")).getByText("12 000 UAH")).toBeInTheDocument();
    expect(within(cardOf("Найдорожчі замовлення")).getByText("5 200 UAH")).toBeInTheDocument();
  });

  it("moves every money section together when the page currency changes", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await settle();

    await user.click(currencyChoice("EUR"));

    expect(within(cardOf("Рейтинг магазинів")).getByText("180 EUR")).toBeInTheDocument();
    expect(within(cardOf("Найдорожчі замовлення")).getByText("72 EUR")).toBeInTheDocument();
    expect(within(cardOf("Рейтинг магазинів")).queryByText("12 000 UAH")).toBe(null);
  });

  it("leaves the counting sections alone when the money currency changes", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await settle();
    const lifecycleBefore = cardOf("Шлях замовлень").textContent;

    await user.click(currencyChoice("EUR"));

    expect(cardOf("Шлях замовлень").textContent).toBe(lifecycleBefore);
  });

  it("offers no currency the dataset never carried", async () => {
    renderStatistics();
    await settle();

    const choices = within(screen.getByLabelText("Валюта показників"));
    expect(choices.getByRole("radio", { name: "UAH" })).toBeInTheDocument();
    expect(choices.queryByRole("radio", { name: "USD" })).toBe(null);
  });
});

describe("Scenario B — dataset currency filter", () => {
  it("carries the filter into the period and the current-state reads, but not into the budget", async () => {
    renderStatistics("?currency=EUR");
    await settle();

    expect(urlsOf("/api/delivery/orders/statistics?").at(0)).toContain("currency=EUR");
    expect(urlsOf("/api/delivery/orders/statistics/active-age").at(0)).toContain("currency=EUR");
    expect(urlsOf("/api/delivery/budgets").at(0)).not.toContain("currency=EUR");
  });

  it("fixes the page currency to the filter instead of offering a choice", async () => {
    renderStatistics("?currency=EUR");
    await settle();

    expect(screen.getByText("EUR · визначено фільтром")).toBeInTheDocument();
    expect(screen.queryByLabelText("Валюта показників")).toBe(null);
  });

  it("keeps the filter on every drill-down it hands out", async () => {
    renderStatistics("?currency=EUR");
    await settle();

    expect(
      within(cardOf("Рейтинг магазинів")).getByRole("link", { name: /Book Depository/ }),
    ).toHaveAttribute("href", expect.stringContaining("currency=EUR"));
    expect(
      within(cardOf("Активні замовлення за часом від оформлення")).getByRole("link", {
        name: /8–14 днів/,
      }),
    ).toHaveAttribute("href", expect.stringContaining("ageBucket=8_14"));
  });
});

describe("Scenario C — order-state filter", () => {
  it("narrows the period read and the current-state read the same way", async () => {
    renderStatistics("?orderState=partially_shipped");
    await settle();

    expect(urlsOf("/api/delivery/orders/statistics?").at(0)).toContain(
      "orderState=partially_shipped",
    );
    expect(urlsOf("/api/delivery/orders/statistics/active-age").at(0)).toContain(
      "orderState=partially_shipped",
    );
  });

  it("carries the state into an aggregate drill-down", async () => {
    renderStatistics("?orderState=partially_shipped");
    await settle();

    expect(
      within(cardOf("Рекорди")).getByRole("link", { name: "Найбільше замовлень у магазині" }),
    ).toHaveAttribute("href", expect.stringContaining("orderState=partially_shipped"));
  });
});

describe("Scenario F — incomplete money", () => {
  it("names the population a metric was computed on instead of padding it with zeros", async () => {
    renderStatistics();
    await settle();

    expect(within(cardOf("Як формується ціна книги")).getByText(/9 із 10/)).toBeInTheDocument();
  });

  it("leaves an order without a resolved amount out of the totals rather than as a zero", async () => {
    handlers.statistics = () =>
      Promise.resolve(
        jsonResponse({
          ...MIXED,
          summary: {
            ...MIXED.summary,
            financialCoverageByCurrency: [
              { currency: "UAH", ordersInScope: 6, ordersWithResolvedAmount: 4 },
            ],
          },
        } satisfies BookOrderStatisticsView),
      );

    renderStatistics();
    await settle();

    expect(within(cardOf("Витрачено")).getByText("12 000 UAH")).toBeInTheDocument();
    expect(
      within(cardOf("Витрачено")).getByText("2 замовлення без визначеної суми"),
    ).toBeInTheDocument();
  });
});

describe("Scenario G — truncated source", () => {
  const TRUNCATED: BookOrderStatisticsView = {
    ...MIXED,
    meta: {
      ...MIXED.meta,
      currentSource: { isTruncated: true, loadedOrdersCount: 5000, maxOrders: 5000 },
    },
    records: { ...MIXED.records, scope: { ...MIXED.records.scope, isTruncated: true } },
  };

  it("says once, at the top, that the source was cut short", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(TRUNCATED));

    renderStatistics();
    await settle();

    expect(screen.getAllByText("Неповні дані").length).toBeGreaterThan(0);
    expect(screen.getByText(/5000 замовленнями з ліміту 5000/)).toBeInTheDocument();
  });

  it("stops promising an aggregate drill-down but keeps the exact orders reachable", async () => {
    handlers.statistics = () => Promise.resolve(jsonResponse(TRUNCATED));

    renderStatistics();
    await settle();

    const records = within(cardOf("Рекорди"));
    expect(records.queryByRole("link", { name: "Найбільше замовлень у магазині" })).toBe(null);
    expect(records.getByRole("link", { name: "Найдорожче замовлення" })).toHaveAttribute(
      "href",
      expect.stringContaining("orderId=order-uah-1"),
    );
  });
});

describe("Scenario H — empty comparison period", () => {
  it("keeps the current chart and says the comparison period held nothing", async () => {
    handlers.statistics = () =>
      Promise.resolve(
        jsonResponse({
          ...MIXED,
          dynamics: {
            ...MIXED.dynamics,
            buckets: MIXED.dynamics.buckets.map((bucket) => ({
              ...bucket,
              comparison: {
                booksCount: 0,
                booksPerOrder: null,
                from: "2025-03-01",
                ordersCount: 0,
                to: "2025-03-31",
                totalsByCurrency: [],
              },
            })),
          },
          meta: {
            ...MIXED.meta,
            comparisonPeriod: {
              from: "2025-01-01",
              mode: "same_period_last_year",
              to: "2025-08-26",
            },
            comparisonSource: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
          },
        } satisfies BookOrderStatisticsView),
      );

    renderStatistics();
    await settle();

    expect(
      within(cardOf("Динаміка покупок")).getByText("У періоді порівняння немає покупок."),
    ).toBeInTheDocument();
    expect(within(cardOf("Витрачено")).getByText("12 000 UAH")).toBeInTheDocument();
  });
});

describe("Scenario J — background refresh", () => {
  it("keeps the old numbers visible, but stops them from opening a list under new filters", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await settle();

    expect(
      within(cardOf("Рекорди")).getByRole("link", { name: "Найдорожче замовлення" }),
    ).toBeInTheDocument();

    handlers.statistics = hangs;
    await user.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(await screen.findByText("Оновлюємо статистику…")).toBeInTheDocument();
    expect(within(cardOf("Витрачено")).getByText("12 000 UAH")).toBeInTheDocument();
    expect(within(cardOf("Рекорди")).queryByRole("link", { name: "Найдорожче замовлення" })).toBe(
      null,
    );
  });

  it("gives the links back once the new data lands", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await settle();

    handlers.statistics = hangs;
    await user.click(screen.getByRole("switch", { name: "Порівняти" }));
    await screen.findByText("Оновлюємо статистику…");

    handlers.statistics = () => Promise.resolve(jsonResponse(MIXED));
    await user.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(
      await within(cardOf("Рекорди")).findByRole("link", { name: "Найдорожче замовлення" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Оновлюємо статистику…")).toBe(null);
  });
});

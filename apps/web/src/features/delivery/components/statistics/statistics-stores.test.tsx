import type {
  BookOrderStatisticsBestValueStoreByCurrency,
  BookOrderStatisticsStore,
  Currency,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { StoreMetric } from "../../model/statistics-stores";

import { STORE_METRICS } from "../../model/statistics-stores";
import { makeStatisticsStore } from "../../model/statistics.fixtures";
import { StatisticsMetricTabs } from "./statistics-section";
import { StatisticsStores } from "./statistics-stores";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const YAKABOO = makeStatisticsStore({
  averageBookPriceByCurrency: [{ average: 578.75, currency: "UAH" }],
  averageLandedBookCostByCurrency: [{ average: 582.69, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 841.67, currency: "UAH" }],
  booksCount: 13,
  booksCountByCurrency: [{ count: 13, currency: "UAH" }],
  drilldown: { targets: [{ booksCount: 13, destination: "history_received", ordersCount: 9 }] },
  ordersCount: 9,
  ordersCountByCurrency: [{ count: 9, currency: "UAH" }],
  store: "Yakaboo",
  totalsByCurrency: [{ currency: "UAH", total: 7575 }],
});

const VIVAT = makeStatisticsStore({
  booksCount: 6,
  booksCountByCurrency: [{ count: 6, currency: "UAH" }],
  drilldown: {
    targets: [
      { booksCount: 2, destination: "in_transit", ordersCount: 1 },
      { booksCount: 4, destination: "history_received", ordersCount: 3 },
    ],
  },
  ordersCount: 4,
  ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
  store: "Vivat",
  totalsByCurrency: [{ currency: "UAH", total: 4840 }],
});

const BEST_VALUE_YAKABOO: BookOrderStatisticsBestValueStoreByCurrency = [
  {
    averageLandedBookCost: 582.69,
    currency: "UAH",
    drilldown: { targets: [{ booksCount: 13, destination: "history_received", ordersCount: 9 }] },
    eligibleBooksCount: 13,
    store: "Yakaboo",
    storeKey: "yakaboo",
  },
];

const BEST_VALUE_VIVAT: BookOrderStatisticsBestValueStoreByCurrency = [
  {
    averageLandedBookCost: 410,
    currency: "UAH",
    drilldown: { targets: [{ booksCount: 4, destination: "history_received", ordersCount: 3 }] },
    eligibleBooksCount: 4,
    store: "Vivat",
    storeKey: "vivat",
  },
];

const PAGED_STORES = Array.from({ length: 12 }, (_, index) => {
  const rank = 12 - index;
  return makeStatisticsStore({
    booksCount: rank * 2,
    booksCountByCurrency: [{ count: rank * 2, currency: "UAH" }],
    drilldown: {
      targets: [{ booksCount: rank * 2, destination: "history_received", ordersCount: rank }],
    },
    ordersCount: rank,
    ordersCountByCurrency: [{ count: rank, currency: "UAH" }],
    store: `Store ${index + 1}`,
    totalsByCurrency: [{ currency: "UAH", total: rank * 100 }],
  });
});

function ranks() {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span")?.textContent ?? "");
}

function renderStores({
  bestValueStores = [] as BookOrderStatisticsBestValueStoreByCurrency,
  currency = "UAH" as Currency,
  highlightedStoreKey = null as Nullable<string>,
  onHighlight = vi.fn(),
  stores = [YAKABOO, VIVAT] as BookOrderStatisticsStore[],
} = {}) {
  return renderWithProviders(
    <StoresHarness
      bestValueStores={bestValueStores}
      currency={currency}
      highlightedStoreKey={highlightedStoreKey}
      onHighlight={onHighlight}
      stores={stores}
    />,
  );
}

function rowOf(store: string) {
  const row = screen.getByText(store).closest("li");

  if (row === null) {
    throw new Error(`No row for ${store}`);
  }

  return row;
}

function StoresHarness({
  bestValueStores,
  currency,
  highlightedStoreKey,
  onHighlight,
  stores,
}: {
  bestValueStores: BookOrderStatisticsBestValueStoreByCurrency;
  currency: Currency;
  highlightedStoreKey: Nullable<string>;
  onHighlight: (storeKey: Nullable<string>) => void;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.stores");
  const [metric, setMetric] = useState<StoreMetric>("spend");

  return (
    <>
      <StatisticsMetricTabs
        label={t("metricLabel")}
        metrics={STORE_METRICS}
        onChange={setMetric}
        optionLabel={(value) => t(`metrics.${value}`)}
        value={metric}
      />
      <StatisticsStores
        bestValueStores={bestValueStores}
        currency={currency}
        drilldown={{
          currencyFilter: null,
          displayCurrency: currency,
          isStale: false,
          orderState: null,
          store: null,
        }}
        highlightedStoreKey={highlightedStoreKey}
        metric={metric}
        onHighlight={onHighlight}
        stores={stores}
      />
    </>
  );
}

describe("StatisticsStores", () => {
  it("ranks the stores by spend in the currency it counted in", () => {
    renderStores();

    expect(screen.getByText("Рейтинг магазинів")).toBeInTheDocument();
    expect(screen.getByText("7 575 UAH")).toBeInTheDocument();
  });

  it("numbers the rows by their place in the ranking", () => {
    renderStores();

    expect(ranks()).toEqual(["1", "2"]);
  });

  it("leaves the currency badge to the section around it", () => {
    renderStores();

    expect(screen.queryByText("UAH")).toBe(null);
  });

  it("says what the spend bought and what a book actually cost", () => {
    renderStores();

    expect(screen.getByText("9 замовлень · 13 книг · 582,69 UAH / книгу")).toBeInTheDocument();
  });

  it("drops the average order and the raw price from the row", () => {
    renderStores();

    expect(screen.queryByText(/841,67/)).toBe(null);
    expect(screen.queryByText(/578,75/)).toBe(null);
    expect(screen.queryByText("До знижок і доставки")).toBe(null);
  });

  it("leads with the orders and follows with the books per order", async () => {
    const user = userEvent.setup();
    renderStores();

    await user.click(screen.getByRole("radio", { name: "Замовлення" }));

    expect(within(rowOf("Yakaboo")).getByText("9 замовлень")).toBeInTheDocument();
    expect(
      within(rowOf("Yakaboo")).getByText("13 книг · 1,4 книги на замовлення"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/582,69/)).toBe(null);
    expect(screen.queryByText("7 575 UAH")).toBe(null);
  });

  it("leads with the books and follows with the orders behind them", async () => {
    const user = userEvent.setup();
    renderStores();

    await user.click(screen.getByRole("radio", { name: "Книги" }));

    expect(within(rowOf("Yakaboo")).getByText("13 книг")).toBeInTheDocument();
    expect(
      within(rowOf("Yakaboo")).getByText("9 замовлень · 1,4 книги на замовлення"),
    ).toBeInTheDocument();
  });

  it("marks the store the backend named the best value", () => {
    renderStores({ bestValueStores: BEST_VALUE_YAKABOO });

    expect(within(rowOf("Yakaboo")).getByText("Найвигідніший")).toBeInTheDocument();
    expect(within(rowOf("Vivat")).queryByText("Найвигідніший")).toBe(null);
  });

  it("never picks the winner itself", () => {
    renderStores({ bestValueStores: BEST_VALUE_VIVAT });

    expect(within(rowOf("Vivat")).getByText("Найвигідніший")).toBeInTheDocument();
    expect(within(rowOf("Yakaboo")).queryByText("Найвигідніший")).toBe(null);
  });

  it("keeps the best-value mark out of the metrics that are not money", async () => {
    const user = userEvent.setup();
    renderStores({ bestValueStores: BEST_VALUE_YAKABOO });

    await user.click(screen.getByRole("radio", { name: "Замовлення" }));

    expect(screen.queryByText("Найвигідніший")).toBe(null);
  });

  it("explains what the best-value mark means", async () => {
    const user = userEvent.setup();
    renderStores({ bestValueStores: BEST_VALUE_YAKABOO });

    await user.hover(screen.getByRole("button", { name: "Найвигідніший" }));

    expect(
      await screen.findByText(
        "Найнижча середня фактична вартість книги серед магазинів із достатньою кількістю даних.",
      ),
    ).toBeInTheDocument();
  });

  it("opens the only place a store's orders ended up", () => {
    renderStores();

    expect(
      screen.getByRole("link", { name: "Переглянути замовлення магазину Yakaboo" }),
    ).toHaveAttribute("href", "/delivery/history?tab=received&store=Yakaboo&currency=UAH");
  });

  it("offers a choice when a store's orders ended up in two places", async () => {
    const user = userEvent.setup();
    renderStores();

    await user.click(screen.getByRole("button", { name: "Переглянути замовлення магазину Vivat" }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toBeInTheDocument();
  });

  it("keeps the store name out of the click targets", () => {
    renderStores();

    expect(screen.queryByRole("link", { name: "Yakaboo" })).toBe(null);
    expect(screen.queryByRole("button", { name: "Vivat" })).toBe(null);
  });

  it("tells the paired card which store the reader is on", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    renderStores({ onHighlight });

    await user.hover(screen.getByText("Yakaboo"));

    expect(onHighlight).toHaveBeenCalledWith("yakaboo");
  });

  it("says a currency is empty rather than falling back to another one", () => {
    renderStores({ currency: "EUR" });

    expect(screen.getByText("Немає витрат у EUR за вибраний період.")).toBeInTheDocument();
    expect(screen.queryByText("7 575 UAH")).toBe(null);
  });

  describe("pagination", () => {
    it("opens on the first five stores and cannot go back", () => {
      renderStores({ stores: PAGED_STORES });

      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      expect(screen.getByText("1–5 із 12")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Попередня сторінка" })).toBeDisabled();
    });

    it("moves to the next page and says where the reader is", async () => {
      const user = userEvent.setup();
      renderStores({ stores: PAGED_STORES });

      await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));

      expect(screen.getByText("6–10 із 12")).toBeInTheDocument();
      expect(screen.getByText("Store 6")).toBeInTheDocument();
      expect(screen.queryByText("Store 5")).toBe(null);
    });

    it("carries the ranking numbers across the pages", async () => {
      const user = userEvent.setup();
      renderStores({ stores: PAGED_STORES });

      expect(ranks()).toEqual(["1", "2", "3", "4", "5"]);

      await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));

      expect(ranks()).toEqual(["6", "7", "8", "9", "10"]);
    });

    it("stops on the last page", async () => {
      const user = userEvent.setup();
      renderStores({ stores: PAGED_STORES });
      const next = screen.getByRole("button", { name: "Наступна сторінка" });

      await user.click(next);
      await user.click(next);

      expect(screen.getByText("11–12 із 12")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(next).toBeDisabled();
    });

    it("returns to the first page when the metric changes", async () => {
      const user = userEvent.setup();
      renderStores({ stores: PAGED_STORES });

      await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));
      await user.click(screen.getByRole("radio", { name: "Замовлення" }));

      expect(screen.getByText("1–5 із 12")).toBeInTheDocument();
      expect(screen.getByText("Store 1")).toBeInTheDocument();
    });

    it("hides the controls when every store fits on one page", () => {
      renderStores();

      expect(screen.queryByRole("button", { name: "Наступна сторінка" })).toBe(null);
      expect(screen.queryByText(/із 2$/)).toBe(null);
    });
  });
});

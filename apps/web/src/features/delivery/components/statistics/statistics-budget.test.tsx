import type { BookBudgetOverview } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { StatisticsBudget } from "./statistics-budget";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const CURRENT_MONTH = {
  budget: 25000,
  daysInMonth: 31,
  deliveryShareOfBudgetPercent: 1.5,
  elapsedDays: 21,
  forecast: 26959.67,
  isForecastComplete: true,
  month: "2026-08-01",
  outlook: "at_risk",
  projectedOverage: 1959.67,
  projectedRemaining: 0,
  remaining: 6737,
  remainingSigned: 6737,
  spentToDate: 18263,
  usedPercent: 73.05,
  validFromMonth: "2026-08-01",
  validToMonth: null,
} satisfies NonNullable<BookBudgetOverview["budgets"][number]["currentMonth"]>;

const CONFIGURED: BookBudgetOverview = {
  budgets: [
    {
      currency: "UAH",
      currentMonth: CURRENT_MONTH,
      spendCoverage: {
        ordersCount: 0,
        ordersWithoutResolvedAmount: 0,
        ordersWithResolvedAmount: 0,
      },
      upcomingChanges: [{ effectiveFromMonth: "2026-09-01", kind: "change", monthlyAmount: 9000 }],
    },
  ],
  month: "2026-08-01",
};

function renderBudget(overview: BookBudgetOverview | undefined) {
  return renderWithProviders(
    <StatisticsBudget currency="UAH" onCurrencyChange={vi.fn()} scope={scopeOf(overview)} />,
  );
}

function scopeOf(
  overview: BookBudgetOverview | undefined,
): StatisticsScopeState<BookBudgetOverview> {
  return {
    data: overview,
    hasUsableData: overview !== undefined,
    isInitialError: false,
    isInitialLoading: false,
    isRefetchError: false,
    isRefreshing: false,
    retry: vi.fn(),
  };
}

describe("StatisticsBudget", () => {
  it("invites the reader to set a budget instead of showing an error", () => {
    renderBudget({ budgets: [], month: "2026-08-01" });

    expect(
      screen.getByText("Задайте місячний бюджет, щоб бачити прогрес і прогноз витрат."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Налаштувати бюджет" })).toBeInTheDocument();
    expect(screen.getByText("Бюджет у UAH не задано.")).toBeInTheDocument();
  });

  it("shows the spend against the budget", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText("18 263 UAH / 25 000 UAH")).toBeInTheDocument();
    expect(screen.getByText("Залишилось 6 737 UAH")).toBeInTheDocument();
  });

  it("reports how much of the budget is used to assistive tech", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "73");
  });

  it("warns about the projected overspend", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText("Є ризик перевищення бюджету")).toBeInTheDocument();
    expect(screen.getByText("Прогноз ≈26 959,67 UAH до кінця місяця")).toBeInTheDocument();
    expect(screen.getByText("Очікуване перевищення ≈1 959,67 UAH")).toBeInTheDocument();
  });

  it("announces the budget that takes over next month", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText(/З вересня 2026 — 9 000 UAH \/ місяць/)).toBeInTheDocument();
    expect(screen.getByText("Наступна зміна")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати зміну" })).toBeInTheDocument();
  });

  it("explains that the forecast needs a few days of data", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: {
            ...CURRENT_MONTH,
            forecast: null,
            outlook: "forecast_pending",
            projectedOverage: null,
            projectedRemaining: null,
          },
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [],
        },
      ],
    });

    expect(screen.getByText(/Прогноз зʼявиться після/)).toBeInTheDocument();
  });

  it("says the budget is exceeded rather than showing a negative remainder", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: {
            ...CURRENT_MONTH,
            remaining: 0,
            remainingSigned: -3000,
            usedPercent: 112,
          },
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [],
        },
      ],
    });

    expect(screen.getByText("Бюджет перевищено на 3 000 UAH")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "112");
  });

  it("offers every currency, not only the ones already configured", () => {
    renderBudget({ budgets: [], month: "2026-08-01" });

    expect(screen.getByRole("radio", { name: "EUR" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "USD" })).toBeInTheDocument();
  });

  it("says how many days of the month have passed", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText("Минуло 21 із 31 днів місяця")).toBeInTheDocument();
  });

  it("says nothing was spent rather than forecasting a zero", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: {
            ...CURRENT_MONTH,
            forecast: 0,
            remaining: 25000,
            remainingSigned: 25000,
            spentToDate: 0,
            usedPercent: 0,
          },
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [],
        },
      ],
    });

    expect(screen.getByText(/Витрат цього місяця ще не було/)).toBeInTheDocument();
    expect(screen.queryByText(/Прогноз ≈/)).not.toBeInTheDocument();
  });

  it("names the orders it could not count into the spend", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: { ...CURRENT_MONTH, isForecastComplete: false },
          spendCoverage: {
            ordersCount: 12,
            ordersWithoutResolvedAmount: 2,
            ordersWithResolvedAmount: 10,
          },
          upcomingChanges: [],
        },
      ],
    });

    expect(screen.getByText("2 замовлення без визначеної суми не враховані")).toBeInTheDocument();
    expect(screen.getByText("Прогноз за неповними даними")).toBeInTheDocument();
  });

  it("offers to cancel a scheduled stop rather than calling it a change", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: CURRENT_MONTH,
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [
            { effectiveFromMonth: "2026-11-01", kind: "stop", monthlyAmount: null },
          ],
        },
      ],
    });

    expect(screen.getByText(/Бюджет буде вимкнено з листопада 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати вимкнення" })).toBeInTheDocument();
  });

  it("keeps more than one scheduled change visible as a count", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: CURRENT_MONTH,
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [
            { effectiveFromMonth: "2026-09-01", kind: "change", monthlyAmount: 9000 },
            { effectiveFromMonth: "2026-11-01", kind: "stop", monthlyAmount: null },
          ],
        },
      ],
    });

    expect(screen.getByText("Ще 1 зміна")).toBeInTheDocument();
  });

  it("shows a local error instead of pretending the budget is unconfigured", () => {
    renderWithProviders(
      <StatisticsBudget
        currency="UAH"
        onCurrencyChange={vi.fn()}
        scope={{
          data: undefined,
          hasUsableData: false,
          isInitialError: true,
          isInitialLoading: false,
          isRefetchError: false,
          isRefreshing: false,
          retry: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("Не вдалося завантажити бюджет.")).toBeInTheDocument();
    expect(screen.queryByText("Бюджет у UAH не задано.")).not.toBeInTheDocument();
  });
});

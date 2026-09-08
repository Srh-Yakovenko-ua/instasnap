import type { StatisticsDynamics, StatisticsDynamicsFacts } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import type { DynamicsMetric, DynamicsPoint } from "../../model/statistics-dynamics";

import {
  DynamicsTooltip,
  StatisticsDynamics as StatisticsDynamicsSection,
} from "./statistics-dynamics";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function facts(overrides: Partial<StatisticsDynamicsFacts> = {}): StatisticsDynamicsFacts {
  return {
    booksCount: 0,
    booksPerOrder: null,
    from: "2026-01-01",
    ordersCount: 0,
    to: "2026-01-31",
    totalsByCurrency: [],
    ...overrides,
  };
}

const CURRENT = facts({
  booksCount: 4,
  booksPerOrder: 2,
  ordersCount: 2,
  totalsByCurrency: [{ currency: "UAH", total: 1800 }],
});

function renderDynamics({
  comparisonLabel = null as null | string,
  dynamics,
}: {
  comparisonLabel?: null | string;
  dynamics: StatisticsDynamics;
}) {
  return renderWithProviders(
    <StatisticsDynamicsSection
      comparisonLabel={comparisonLabel}
      currency="UAH"
      currentLabel="1 – 31 січня 2026 р."
      drilldown={{
        currencyFilter: null,
        displayCurrency: "UAH",
        isStale: false,
        orderState: null,
        store: null,
      }}
      dynamics={dynamics}
      highlightedBucketKey={null}
      metric="spend"
      onHighlightBucket={vi.fn()}
      onMetricChange={vi.fn()}
    />,
  );
}

describe("StatisticsDynamics comparison", () => {
  it("says nothing about a comparison nobody asked for", () => {
    renderDynamics({
      dynamics: {
        buckets: [
          { comparison: null, current: CURRENT, drilldown: { targets: [] }, key: "2026-01" },
        ],
        granularity: "month",
      },
    });

    expect(screen.queryByText("У періоді порівняння немає покупок.")).toBe(null);
  });

  it("names a comparison period that turned out to hold no purchases", () => {
    renderDynamics({
      comparisonLabel: "1 – 31 січня 2025 р.",
      dynamics: {
        buckets: [
          {
            comparison: facts({ from: "2025-01-01", to: "2025-01-31" }),
            current: CURRENT,
            drilldown: { targets: [] },
            key: "2026-01",
          },
        ],
        granularity: "month",
      },
    });

    expect(screen.getByText("У періоді порівняння немає покупок.")).toBeInTheDocument();
  });

  it("stays quiet once the comparison period actually has purchases", () => {
    renderDynamics({
      comparisonLabel: "1 – 31 січня 2025 р.",
      dynamics: {
        buckets: [
          {
            comparison: facts({
              booksCount: 2,
              from: "2025-01-01",
              ordersCount: 1,
              to: "2025-01-31",
              totalsByCurrency: [{ currency: "UAH", total: 900 }],
            }),
            current: CURRENT,
            drilldown: { targets: [] },
            key: "2026-01",
          },
        ],
        granularity: "month",
      },
    });

    expect(screen.queryByText("У періоді порівняння немає покупок.")).toBe(null);
  });

  it("stands alone as the chart card", () => {
    renderDynamics({
      dynamics: {
        buckets: [
          { comparison: null, current: CURRENT, drilldown: { targets: [] }, key: "2026-01" },
        ],
        granularity: "month",
      },
    });

    expect(screen.getByText("Динаміка покупок")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Стовпчикова діаграма: Витрати" })).toBeInTheDocument();
  });
});

const PAGE_PERIOD = "1 – 31 січня 2026 р.";

const GROUP_SPACE = "\u00a0";

function point({
  comparison = null as null | StatisticsDynamicsFacts,
  comparisonValue = null as null | number,
  value,
}: {
  comparison?: null | StatisticsDynamicsFacts;
  comparisonValue?: null | number;
  value: number;
}): DynamicsPoint {
  return {
    bucket: { comparison, current: CURRENT, drilldown: { targets: [] }, key: "2026-01" },
    comparisonValue,
    key: "2026-01",
    label: "січ. 2026 р.",
    value,
  };
}

function renderTooltip({
  metric = "spend" as DynamicsMetric,
  tooltipPoint,
}: {
  metric?: DynamicsMetric;
  tooltipPoint: DynamicsPoint;
}) {
  return renderWithProviders(
    <DynamicsTooltip
      active
      formatValue={(value) =>
        metric === "spend"
          ? `${new Intl.NumberFormat("uk").format(value)} UAH`
          : new Intl.NumberFormat("uk").format(value)
      }
      granularity="month"
      metric={metric}
      payload={[{ payload: tooltipPoint }]}
    />,
  );
}

const LAST_YEAR = facts({ from: "2025-01-01", to: "2025-01-31" });

function deltaLineOf(container: HTMLElement): string {
  return container.querySelector("p")?.textContent ?? "";
}

describe("DynamicsTooltip", () => {
  it("headlines the bucket it belongs to instead of the whole page period", () => {
    renderTooltip({
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 380, value: 20163 }),
    });

    expect(screen.getByText("січ. 2026 р.")).toBeInTheDocument();
    expect(screen.queryByText(PAGE_PERIOD)).toBe(null);
  });

  it("keeps growth many times over at its real size", () => {
    const { container } = renderTooltip({
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 380, value: 20163 }),
    });

    expect(screen.getByText("Поточний")).toBeInTheDocument();
    expect(screen.getByText("січ. 2025 р.")).toBeInTheDocument();
    expect(deltaLineOf(container)).toBe(`+19${GROUP_SPACE}783 UAH·+5${GROUP_SPACE}206,1%`);
  });

  it("names the drop with a real minus sign", () => {
    const { container } = renderTooltip({
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 1000, value: 400 }),
    });

    expect(deltaLineOf(container)).toBe("−600 UAH·−60%");
  });

  it("shows the absolute delta alone when there was nothing to grow from", () => {
    const { container } = renderTooltip({
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 0, value: 20163 }),
    });

    expect(deltaLineOf(container)).toBe(`+20${GROUP_SPACE}163 UAH`);
    expect(deltaLineOf(container)).not.toContain("%");
  });

  it("says so plainly when the two periods came out level", () => {
    renderTooltip({
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 20163, value: 20163 }),
    });

    expect(screen.getByText("Без змін")).toBeInTheDocument();
  });

  it("drops to the metric and its value when no comparison was asked for", () => {
    const { container } = renderTooltip({ tooltipPoint: point({ value: 20163 }) });

    expect(screen.getByText("Витрати")).toBeInTheDocument();
    expect(screen.getByText("20 163 UAH")).toBeInTheDocument();
    expect(screen.queryByText("Поточний")).toBe(null);
    expect(screen.queryByText("січ. 2025 р.")).toBe(null);
    expect(deltaLineOf(container)).toBe("");
  });

  it("counts orders without dressing them as money", () => {
    const { container } = renderTooltip({
      metric: "orders",
      tooltipPoint: point({ comparison: LAST_YEAR, comparisonValue: 2, value: 5 }),
    });

    expect(deltaLineOf(container)).toBe("+3·+150%");
  });
});

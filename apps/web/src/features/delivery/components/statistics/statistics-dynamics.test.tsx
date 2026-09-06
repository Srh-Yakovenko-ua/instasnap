import type { StatisticsDynamics, StatisticsDynamicsFacts } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsDynamics as StatisticsDynamicsSection } from "./statistics-dynamics";

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
      insights={<p>insights slot</p>}
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

  it("keeps the insights slot inside the same section", () => {
    renderDynamics({
      dynamics: {
        buckets: [
          { comparison: null, current: CURRENT, drilldown: { targets: [] }, key: "2026-01" },
        ],
        granularity: "month",
      },
    });

    expect(screen.getByText("insights slot")).toBeInTheDocument();
  });
});

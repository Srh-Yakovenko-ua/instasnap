import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { StatisticsKpiGrid } from "./statistics-kpi-grid";

const { kpis } = overviewFixture();

describe("StatisticsKpiGrid", () => {
  it("names the cycle count as reads and the distinct count as books", () => {
    renderWithProviders(<StatisticsKpiGrid isLowerBound={false} kpis={kpis} />);

    expect(screen.getByText("37")).toBeInTheDocument();
    expect(screen.getByText("читань")).toBeInTheDocument();
    expect(screen.getByText("35 унікальних книг")).toBeInTheDocument();
    expect(screen.queryByText("37 книг")).not.toBeInTheDocument();
  });

  it("shows rating coverage instead of implying every read was rated", () => {
    renderWithProviders(<StatisticsKpiGrid isLowerBound={false} kpis={kpis} />);

    expect(screen.getByText("8,6")).toBeInTheDocument();
    expect(screen.getByText("28 із 37 читань оцінено")).toBeInTheDocument();
  });

  it("renders an unavailable average rating as a dash, never as zero", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          averageRating: {
            availability: "unavailable",
            comparison: null,
            coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
            reason: "NO_RATINGS",
            value: null,
          },
        }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Немає оцінених читань")).toBeInTheDocument();
    expect(screen.queryByText("0,0")).not.toBeInTheDocument();
  });

  it("trusts availability over the value, not the other way round", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          averageRating: {
            availability: "unavailable",
            comparison: null,
            coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
            reason: "INSUFFICIENT_SAMPLE",
            value: 8.6,
          },
        }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Замало оцінок для середнього")).toBeInTheDocument();
    expect(screen.queryByText("8,6")).not.toBeInTheDocument();
  });

  it("renders a known zero as a real zero", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          completedReads: { comparison: null, value: 0 },
          pagesRead: { availability: "available", comparison: null, value: 0 },
          uniqueBooksCompleted: { comparison: null, value: 0 },
        }}
      />,
    );

    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByText("0 унікальних книг")).toBeInTheDocument();
  });

  it("marks monotonic values as a lower bound when the ledger is legacy", () => {
    renderWithProviders(<StatisticsKpiGrid isLowerBound kpis={kpis} />);

    expect(screen.getByText("≥ 12 840")).toBeInTheDocument();
    expect(screen.getByText("≥ 96")).toBeInTheDocument();
  });

  it("renders a zero-baseline comparison without inventing a percentage", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          completedReads: {
            comparison: { absoluteDelta: 37, percentDelta: null, previous: 0 },
            value: 37,
          },
        }}
      />,
    );

    expect(screen.getByText("з 0 до 37 читань")).toBeInTheDocument();
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it("renders an unchanged comparison without a percentage", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          completedReads: {
            comparison: { absoluteDelta: 0, percentDelta: null, previous: 37 },
            value: 37,
          },
        }}
      />,
    );

    expect(screen.getByText("Без змін")).toBeInTheDocument();
  });

  it("renders a rate comparison in percentage points", () => {
    renderWithProviders(
      <StatisticsKpiGrid
        isLowerBound={false}
        kpis={{
          ...kpis,
          activeDays: {
            countComparison: null,
            rate: 0.416,
            rateComparison: { percentagePointDelta: 6.4, previousRate: 0.352 },
            value: 96,
          },
        }}
      />,
    );

    expect(screen.getByText("6,4 в.п.")).toBeInTheDocument();
    expect(screen.getByText("41,6% днів періоду")).toBeInTheDocument();
  });
});

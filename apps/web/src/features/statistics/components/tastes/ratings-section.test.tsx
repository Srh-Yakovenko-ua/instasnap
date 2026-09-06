import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { completedReadFixture, overviewFixture } from "../../model/statistics.fixtures";
import { RatingsSection } from "./ratings-section";

const { ratings } = overviewFixture();

describe("RatingsSection", () => {
  it("keeps the canonical ten-point scale", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getByText("8,6 / 10")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("shows partial coverage next to the value it qualifies", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getByText("28 із 37 читань оцінено")).toBeInTheDocument();
    expect(screen.getByText("28 із 37")).toBeInTheDocument();
  });

  it("renders an unavailable section instead of a zero average", () => {
    renderWithProviders(
      <RatingsSection
        ratings={{
          ...ratings,
          availability: "unavailable",
          averageRating: null,
          coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
          distribution: [],
          highRatedReadsCount: 0,
          highRatedShare: null,
          ratedReadsCount: 0,
          reason: "NO_RATINGS",
          topRated: [],
        }}
      />,
    );

    expect(screen.getByText("Оцінок ще немає")).toBeInTheDocument();
    expect(
      screen.getByText("Жодне завершене читання цього періоду не має оцінки."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0,0 / 10")).not.toBeInTheDocument();
  });

  it("keeps a reread as its own top-rated row rather than collapsing it by book", () => {
    const first = completedReadFixture();
    const reread = completedReadFixture({
      drilldown: {
        bookId: first.book.bookId,
        kind: "reading_cycle",
        readingCycleId: "99999999-9999-4999-8999-999999999999",
      },
      finishedAt: "2026-02-01",
      readingCycleId: "99999999-9999-4999-8999-999999999999",
    });

    renderWithProviders(<RatingsSection ratings={{ ...ratings, topRated: [first, reread] }} />);

    expect(screen.getAllByText("Чарівник Земномор'я")).toHaveLength(2);
  });
});

import type { ReadingStatisticsInsight } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { statisticsIds } from "../../model/statistics.fixtures";
import { StatisticsInsights } from "./statistics-insights";

function render(items: ReadingStatisticsInsight[]) {
  return renderWithProviders(<StatisticsInsights insights={{ items }} />);
}

describe("StatisticsInsights", () => {
  it("localizes a weekday insight from its typed params", () => {
    render([
      {
        category: "activity",
        code: "most_active_weekday",
        params: { activeDays: 12, pagesRead: 1840, weekday: 1 },
        tone: "positive",
      },
    ]);

    expect(
      screen.getByText("Найактивніший день тижня — понеділок: 12 активних днів і 1840 сторінок."),
    ).toBeInTheDocument();
  });

  it("localizes a share as a percentage rather than a raw ratio", () => {
    render([
      {
        category: "genres",
        code: "top_genre_share",
        params: { completedReadCount: 14, genreKey: "fantasy", shareOfCompletedReads: 0.667 },
        tone: "neutral",
      },
    ]);

    expect(
      screen.getByText(
        "Найчастіший жанр періоду — fantasy: 14 читань, це 66,7% завершених читань.",
      ),
    ).toBeInTheDocument();
  });

  it("localizes the canonical language enum instead of showing it raw", () => {
    render([
      {
        category: "languages",
        code: "dominant_language",
        params: { completedReadCount: 21, language: "ukrainian", shareOfKnown: 0.84 },
        tone: "neutral",
      },
    ]);

    expect(screen.getByText(/Українська/)).toBeInTheDocument();
    expect(screen.queryByText(/ukrainian/)).not.toBeInTheDocument();
  });

  it("renders the backend order without reranking", () => {
    render([
      {
        category: "authors",
        code: "top_author_reads",
        params: { authorId: statisticsIds.authorId, authorName: "Ле Ґуїн", completedReadCount: 5 },
        tone: "neutral",
      },
      {
        category: "activity",
        code: "most_active_weekday",
        params: { activeDays: 3, pagesRead: 120, weekday: 3 },
        tone: "neutral",
      },
    ]);

    const rendered = screen.getAllByText(/Ле Ґуїн|Найактивніший день тижня/);

    expect(rendered[0]?.textContent).toContain("Ле Ґуїн");
    expect(rendered[1]?.textContent).toContain("Найактивніший день тижня");
  });

  it("never exposes a raw insight code as copy", () => {
    render([
      {
        category: "reading",
        code: "completed_reads_vs_comparison",
        params: {
          absoluteDelta: -4,
          comparisonValue: 12,
          currentValue: 8,
          percentDelta: -33.3,
        },
        tone: "negative",
      },
    ]);

    expect(screen.queryByText("completed_reads_vs_comparison")).not.toBeInTheDocument();
    expect(screen.getByText(/8 читань — на 4 менше/)).toBeInTheDocument();
  });

  it("shows an honest empty state when the backend selected nothing", () => {
    render([]);

    expect(
      screen.getByText("Для цього періоду ще немає надійних спостережень."),
    ).toBeInTheDocument();
  });
});

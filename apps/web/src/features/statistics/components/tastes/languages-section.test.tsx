import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { LanguagesSection } from "./languages-section";

const { languages } = overviewFixture();

describe("LanguagesSection", () => {
  it("localizes the canonical enum instead of showing the api value", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText("Українська")).toBeInTheDocument();
    expect(screen.queryByText("ukrainian")).not.toBeInTheDocument();
    expect(screen.queryByText("uk")).not.toBeInTheDocument();
  });

  it("says where the language came from", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(
      screen.getByText("Мова видання, зафіксована в BookNest на момент завершення читання."),
    ).toBeInTheDocument();
  });

  it("shows coverage rather than an unknown ranking row", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          availability: "partial",
          coverage: { eligibleCount: 37, knownCount: 20, percent: 0.54 },
        }}
      />,
    );

    expect(
      screen.getByText("20 із 37 історичних читань мають надійно збережену мову видання"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Не вказано")).not.toBeInTheDocument();
  });

  it("says the metric could not be measured rather than showing an empty ranking", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          availability: "unavailable",
          coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
          items: [],
        }}
      />,
    );

    expect(screen.getByText("Мов виміряти не вдалося")).toBeInTheDocument();
    expect(
      screen.queryByText("У завершених читаннях періоду немає збереженої мови."),
    ).not.toBeInTheDocument();
  });

  it("keeps the backend ranking order", () => {
    const [first] = languages.items;
    if (first === undefined) throw new Error("fixture must expose one language row");

    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: [
            { ...first, completedReadCount: 2, language: "ukrainian" },
            { ...first, completedReadCount: 2, language: "english" },
          ],
        }}
      />,
    );

    const rows = screen.getAllByText(/Українська|Англійська/);

    expect(rows[0]?.textContent).toBe("Українська");
    expect(rows[1]?.textContent).toBe("Англійська");
  });
});

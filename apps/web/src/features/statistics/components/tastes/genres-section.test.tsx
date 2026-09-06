import type { ReadingStatisticsGenresSection } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { GenresSection } from "./genres-section";

const { genres } = overviewFixture();

function genreRow(genreKey: string) {
  const [row] = genres.frequency;
  if (row === undefined) throw new Error("fixture must expose one genre row");
  return { ...row, genreKey };
}

function withFrequency(
  frequency: ReadingStatisticsGenresSection["frequency"],
): ReadingStatisticsGenresSection {
  return { ...genres, frequency };
}

describe("GenresSection", () => {
  it("labels the cycle count as reads, not books", () => {
    renderWithProviders(<GenresSection genres={genres} />);

    expect(screen.getByText("2 читання")).toBeInTheDocument();
    expect(screen.queryByText("2 книги")).not.toBeInTheDocument();
  });

  it("keeps the backend ranking order without re-sorting by label", () => {
    renderWithProviders(
      <GenresSection
        genres={withFrequency([genreRow("фентезі"), genreRow("детектив"), genreRow("аніме")])}
      />,
    );

    const rows = screen.getAllByText(/фентезі|детектив|аніме/);

    expect(rows.map((row) => row.textContent)).toEqual(["фентезі", "детектив", "аніме"]);
  });

  it("leaves a row non-interactive while the exact subset has no destination", () => {
    renderWithProviders(<GenresSection genres={genres} />);

    const list = screen.getByRole("list");

    expect(within(list).queryAllByRole("button")).toHaveLength(0);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the typed insufficient-sample reason instead of an empty ranking", async () => {
    renderWithProviders(<GenresSection genres={genres} />);

    await userEvent.click(screen.getByRole("radio", { name: "Найвище оцінюю" }));

    expect(screen.getByText("Замало оцінок")).toBeInTheDocument();
    expect(
      screen.getByText("Для рейтингу потрібно щонайменше 3 оцінені читання жанру."),
    ).toBeInTheDocument();
  });

  it("shows an honest empty ranking for a period with no genres", () => {
    renderWithProviders(<GenresSection genres={withFrequency([])} />);

    expect(screen.getByText("У завершених читаннях періоду немає жанрів.")).toBeInTheDocument();
  });
});

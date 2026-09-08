import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { QuotesToolbar } from "./quotes-toolbar";

const VISIBLE_SORT_LABELS = [
  "За датою додавання: спочатку нові",
  "За датою додавання: спочатку старі",
  "За назвою книги: А–Я",
  "За автором: А–Я",
  "За сторінкою: від меншої",
];

const SORT_LABEL = "Сортування цитат";

afterEach(() => {
  vi.unstubAllGlobals();
});

function desktopSort(): HTMLElement {
  return screen.getByRole("combobox", { name: SORT_LABEL });
}

function mobileSort(): HTMLElement {
  return screen.getByRole("button", { name: SORT_LABEL });
}

async function openDesktopSort(): Promise<string[]> {
  await userEvent.click(desktopSort());
  const options = await screen.findAllByRole("option");
  return options.map((option) => option.textContent ?? "");
}

async function openMobileSheet(): Promise<HTMLElement> {
  await userEvent.click(mobileSort());
  return screen.findByRole("dialog");
}

function renderToolbar(overrides: Partial<ComponentProps<typeof QuotesToolbar>> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      ),
    ),
  );

  const onSortChange = vi.fn();

  renderWithProviders(
    <QuotesToolbar
      book={null}
      filter="all"
      onBookChange={vi.fn()}
      onFilterChange={vi.fn()}
      onSearch={vi.fn()}
      onSortChange={onSortChange}
      onViewChange={vi.fn()}
      search=""
      sort="newest"
      view="grid"
      {...overrides}
    />,
  );

  return { onSortChange };
}

describe("QuotesToolbar desktop sorting", () => {
  it("offers the five descriptive orders and nothing else", async () => {
    renderToolbar();

    expect(await openDesktopSort()).toEqual(VISIBLE_SORT_LABELS);
  });

  it("leaves favorites and spoilers to the filter chips", async () => {
    renderToolbar();

    expect(screen.getByRole("radio", { name: "Улюблені" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Без спойлерів" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Зі спойлерами" })).toBeInTheDocument();

    const options = await openDesktopSort();

    expect(options).not.toContain("Спочатку улюблені");
    expect(options).not.toContain("Спочатку без спойлерів");
    expect(options).not.toContain("Спочатку зі спойлерами");
  });

  it("spells out the criterion and the direction on the trigger", () => {
    renderToolbar({ sort: "book_author" });

    expect(desktopSort()).toHaveTextContent("За автором: А–Я");
  });

  it("asks for the picked order", async () => {
    const { onSortChange } = renderToolbar();

    await userEvent.click(desktopSort());
    await userEvent.click(await screen.findByRole("option", { name: "За сторінкою: від меншої" }));

    expect(onSortChange).toHaveBeenCalledWith("page");
  });
});

describe("QuotesToolbar mobile sorting", () => {
  it("shortens the order down to a directional chip on the trigger", () => {
    renderToolbar({ sort: "book_title" });

    expect(mobileSort()).toHaveTextContent("Книга А–Я");
  });

  it.each([
    { expected: "Нові", sort: "newest" as const },
    { expected: "Старі", sort: "oldest" as const },
    { expected: "Книга А–Я", sort: "book_title" as const },
    { expected: "Автор А–Я", sort: "book_author" as const },
    { expected: "Сторінка ↑", sort: "page" as const },
  ])("keeps the direction readable on the $sort trigger", ({ expected, sort }) => {
    renderToolbar({ sort });

    expect(mobileSort()).toHaveTextContent(expected);
  });

  it("groups the orders by criterion inside the drawer", async () => {
    renderToolbar();

    const sheet = await openMobileSheet();

    expect(within(sheet).getByText("Дата додавання")).toBeInTheDocument();
    expect(within(sheet).getByText("Книга")).toBeInTheDocument();
    expect(within(sheet).getByText("Сторінка")).toBeInTheDocument();
    expect(within(sheet).getAllByRole("radio")).toHaveLength(5);
    expect(within(sheet).getByText("Спочатку нові")).toBeInTheDocument();
    expect(within(sheet).getByText("Спочатку старі")).toBeInTheDocument();
    expect(within(sheet).getByText("Назва: А–Я")).toBeInTheDocument();
    expect(within(sheet).getByText("Автор: А–Я")).toBeInTheDocument();
    expect(within(sheet).getByText("Від меншої")).toBeInTheDocument();
  });

  it("leaves favorites and spoilers out of the drawer", async () => {
    renderToolbar();

    const sheet = await openMobileSheet();

    expect(within(sheet).queryByText("Спочатку улюблені")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Спочатку без спойлерів")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Спочатку зі спойлерами")).not.toBeInTheDocument();
  });

  it("asks for the picked order and closes the drawer", async () => {
    const { onSortChange } = renderToolbar();

    const sheet = await openMobileSheet();
    await userEvent.click(within(sheet).getByText("Автор: А–Я"));

    expect(onSortChange).toHaveBeenCalledWith("book_author");
    await waitFor(() => expect(sheet).toHaveAttribute("data-state", "closed"));
  });
});

describe("QuotesToolbar legacy sorting from an old link", () => {
  it("keeps naming the order the link asked for", async () => {
    renderToolbar({ sort: "favorites_first" });

    expect(desktopSort()).toHaveTextContent("Спочатку улюблені");
    expect(await openDesktopSort()).toEqual([...VISIBLE_SORT_LABELS, "Спочатку улюблені"]);
  });

  it("keeps the drawer showing which order is on", async () => {
    renderToolbar({ sort: "no_spoiler_first" });

    expect(mobileSort()).toHaveTextContent("Без спойлерів");

    const sheet = await openMobileSheet();

    expect(within(sheet).getByText("Поточне сортування")).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { checked: true })).toBeInTheDocument();
    expect(within(sheet).getByText("Спочатку без спойлерів")).toBeInTheDocument();
  });

  it("drops the legacy order once another one is picked", async () => {
    const { onSortChange } = renderToolbar({ sort: "with_spoiler_first" });

    await userEvent.click(desktopSort());
    await userEvent.click(
      await screen.findByRole("option", { name: "За датою додавання: спочатку старі" }),
    );

    expect(onSortChange).toHaveBeenCalledWith("oldest");
  });
});

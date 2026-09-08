import "@testing-library/jest-dom/vitest";

import type { QuotesFacetsView, QuotesSummaryView, QuoteView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { QUOTES_PAGE_SIZE } from "../model/quotes-query";
import { QuotesView } from "./quotes-view";

const SORT_LABEL = "Сортування цитат";

const requestedUrls: string[] = [];

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const FACETS: QuotesFacetsView = {
  authors: [
    { count: 8, id: "author-1", name: "Френк Герберт" },
    { count: 5, id: "author-2", name: "Марісса Маєр" },
  ],
  books: [
    { count: 8, id: "book-1", title: "Дюна" },
    { count: 5, id: "book-2", title: "Месія Дюни" },
  ],
  favoritesCount: 2,
  spoilerCount: 1,
  totalCount: 13,
  withCommentCount: 3,
  withoutCommentCount: 10,
  withoutSpoilerCount: 12,
};

const SUMMARY: QuotesSummaryView = {
  favoritesCount: 2,
  spoilerCount: 1,
  topAuthor: null,
  topBook: null,
  totalCount: 13,
  withCommentCount: 3,
  withoutSpoilerCount: 12,
};

afterEach(() => {
  vi.unstubAllGlobals();
  requestedUrls.length = 0;
});

describe("QuotesView sorting", () => {
  it("starts the list over at the first page when the order changes", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    expect(await screen.findByText("Цитата 13")).toBeInTheDocument();
    expect(listUrls().some((url) => url.includes("pageNumber=2"))).toBe(true);

    requestedUrls.length = 0;
    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    await userEvent.click(
      await screen.findByRole("option", { name: "За датою додавання: спочатку старі" }),
    );

    await waitFor(() => expect(events.at(-1)?.searchParams.get("sort")).toBe("oldest"));
    await waitFor(() => expect(listUrls().some((url) => url.includes("sort=oldest"))).toBe(true));
    expect(listUrls().every((url) => url.includes("pageNumber=1"))).toBe(true);
    await waitFor(() => expect(screen.queryByText("Цитата 13")).not.toBeInTheDocument());
  });
});

describe("QuotesView legacy sort links", () => {
  it("still asks the API for the order an old link pinned", async () => {
    mockQuotes(quotes(3));

    renderQuotes("?sort=favorites_first");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("sort=favorites_first");
    expect(screen.getByRole("combobox", { name: SORT_LABEL })).toHaveTextContent(
      "Спочатку улюблені",
    );
    expect(screen.getByRole("button", { name: SORT_LABEL })).toHaveTextContent("Улюблені");
  });

  it("hands the link back to a visible order once one is picked", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(3));

    renderQuotes("?sort=with_spoiler_first", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    await userEvent.click(await screen.findByRole("option", { name: "За автором: А–Я" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("sort")).toBe("book_author"));
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: SORT_LABEL })).toHaveTextContent(
        "За автором: А–Я",
      );
    });

    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).not.toContain("Спочатку зі спойлерами");
  });
});

describe("QuotesView quick filters", () => {
  it("offers the five presets with their counts and says how many are shown", async () => {
    mockQuotes(quotes(13));

    renderQuotes();

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((chip) => chip.textContent),
    ).toEqual(["Усі13", "Улюблені2", "З коментарем3", "Без спойлерів12", "Зі спойлерами1"]);
    expect(screen.getByText("Показано 13 із 13 цитат")).toBeInTheDocument();
  });

  it("counts the active preset against the dataset behind it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?filter=favorites");

    expect(await screen.findByText("Показано 2 із 13 цитат")).toBeInTheDocument();
  });

  it("keeps a retired preset usable when an old link pinned it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?filter=without_comment");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("filter=without_comment");
    const group = screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent(
      "Без коментаря10",
    );
    expect(screen.getByText("Показано 10 із 13 цитат")).toBeInTheDocument();
  });
});

describe("QuotesView advanced filters", () => {
  it("reads an old book deep link as a book filter and names it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?bookId=book-1");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("book=book-1");
    expect(listUrl()).not.toContain("bookId=");
    expect(screen.getByRole("button", { name: /Фільтри/ })).toHaveTextContent("1");
    expect(
      within(screen.getByRole("group", { name: "Активні фільтри" })).getByText("Книга: Дюна"),
    ).toBeInTheDocument();
  });

  it("opens with the book of the deep link already picked", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?bookId=book-1");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Книги" })).toHaveTextContent(
      "Обрано книг: 1",
    );
  });

  it("asks for both books when two are picked", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: "Книги" }));
    await userEvent.click(await screen.findByRole("option", { name: /Дюна 8/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Месія Дюни 5/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(sheet).getByRole("button", { name: "Застосувати" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBe("book-1,book-2"));
    await waitFor(() => expect(listUrls().some((url) => url.includes("book=book-1"))).toBe(true));
  });

  it("does not commit a draft that was never applied", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: "Автори" }));
    await userEvent.click(await screen.findByRole("option", { name: /Френк Герберт 8/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(events.some((event) => event.searchParams.has("author"))).toBe(false);
  });

  it("drops one filter at a time from the active row", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("?author=author-1&book=book-1", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const active = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(active).getByText("Автор: Френк Герберт")).toBeInTheDocument();

    await userEvent.click(
      within(active).getByRole("button", { name: "Прибрати фільтр Книга: Дюна" }),
    );

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBeNull());
    expect(events.at(-1)?.searchParams.get("author")).toBe("author-1");
  });

  it("recounts the quick filters over the narrowed dataset", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?author=author-1&book=book-1&createdFrom=2026-01-01&createdTo=2026-08-31");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const facetsUrl = requestedUrls.find((url) => url.includes("/api/quotes/facets"));
    expect(facetsUrl).toContain("book=book-1");
    expect(facetsUrl).toContain("author=author-1");
    expect(facetsUrl).toContain("createdFrom=2026-01-01");
    expect(facetsUrl).toContain("createdTo=2026-08-31");
    expect(facetsUrl).not.toContain("filter=");
    expect(facetsUrl).not.toContain("pageNumber=");
  });

  it("names the date range in the active row", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?createdFrom=2026-01-01&createdTo=2026-08-31");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const active = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(active).getByText(/Додано/)).toBeInTheDocument();
    expect(listUrl()).toContain("createdFrom=2026-01-01");
  });

  it("clears every filter but leaves the order alone", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("?sort=oldest&book=book-1&filter=favorites&q=дюна", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Очистити все" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBeNull());
    const last = events.at(-1)?.searchParams;
    expect(last?.get("filter")).toBeNull();
    expect(last?.get("q")).toBeNull();
    expect(last?.get("sort")).toBe("oldest");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function listUrl(): string {
  const [found] = listUrls();
  if (found === undefined) throw new Error("the quotes list was never requested");
  return found;
}

function listUrls(): string[] {
  return requestedUrls.filter(
    (url) =>
      url.includes("/api/quotes") &&
      !url.includes("/api/quotes/summary") &&
      !url.includes("/api/quotes/facets"),
  );
}

function mockQuotes(items: QuoteView[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/api/quotes/summary")) return Promise.resolve(jsonResponse(SUMMARY));
      if (url.includes("/api/quotes/facets")) return Promise.resolve(jsonResponse(FACETS));
      if (url.includes("/api/quotes")) return Promise.resolve(jsonResponse(quotesPage(items, url)));
      if (url.includes("/api/books")) {
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function quoteItem(index: number): QuoteView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Дж. Р. Р. Толкін",
      id: `book-${index}`,
      title: `Книга ${index}`,
    },
    bookId: `book-${index}`,
    chapter: null,
    comment: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    id: `quote-${index}`,
    isFavorite: false,
    isSpoiler: false,
    page: index,
    text: `Цитата ${index}`,
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

function quotes(count: number): QuoteView[] {
  return Array.from({ length: count }, (_, index) => quoteItem(index + 1));
}

function quotesPage(items: QuoteView[], url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  const pageSize = Number(params.get("pageSize") ?? QUOTES_PAGE_SIZE);
  const page = Number(params.get("pageNumber") ?? 1);

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pagesCount: Math.ceil(items.length / pageSize),
    pageSize,
    totalCount: items.length,
  };
}

function renderQuotes(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <QuotesView />
    </NuqsTestingAdapter>,
  );
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

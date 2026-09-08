import "@testing-library/jest-dom/vitest";

import type { QuotesSummaryView, QuoteView } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

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
    (url) => url.includes("/api/quotes") && !url.includes("/api/quotes/summary"),
  );
}

function mockQuotes(items: QuoteView[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/api/quotes/summary")) return Promise.resolve(jsonResponse(SUMMARY));
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

import type { QuoteAuthorFacet, QuoteBookFacet, QuotesFacetsView } from "@app/shared";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import {
  type QuoteAuthorLink,
  type QuoteFilterCounts,
} from "../infrastructure/quotes.repository.js";
import { type QuoteBookCount } from "./quotes-summary.js";

export function buildQuotesFacets({
  authors,
  books,
  counts,
}: {
  authors: QuoteAuthorFacet[];
  books: QuoteBookFacet[];
  counts: QuoteFilterCounts;
}): QuotesFacetsView {
  return {
    authors,
    books,
    favoritesCount: counts.favorites,
    spoilerCount: counts.with_spoiler,
    totalCount: counts.all,
    withCommentCount: counts.with_comment,
    withoutCommentCount: counts.without_comment,
    withoutSpoilerCount: counts.no_spoiler,
  };
}

export function toAuthorFacets({
  bookCounts,
  links,
}: {
  bookCounts: QuoteBookCount[];
  links: QuoteAuthorLink[];
}): QuoteAuthorFacet[] {
  const countByBook = new Map(bookCounts.map((entry) => [entry.bookId, entry.count]));
  const facetById = new Map<string, QuoteAuthorFacet>();

  for (const link of links) {
    const count = countByBook.get(link.bookId);
    if (count === undefined) {
      continue;
    }
    const existing = facetById.get(link.author.id);
    if (existing === undefined) {
      facetById.set(link.author.id, { count, id: link.author.id, name: link.author.name });
      continue;
    }
    existing.count += count;
  }

  return sortFacets([...facetById.values()], (facet) => facet.name);
}

export function toBookFacets(bookCounts: QuoteBookCount[]): QuoteBookFacet[] {
  return sortFacets(
    bookCounts.map((entry) => ({ count: entry.count, id: entry.bookId, title: entry.title })),
    (facet) => facet.title,
  );
}

function sortFacets<TFacet extends { count: number }>(
  facets: TFacet[],
  label: (facet: TFacet) => string,
): TFacet[] {
  return facets
    .filter((facet) => facet.count > 0)
    .sort((left, right) =>
      left.count === right.count
        ? UKRAINIAN_COLLATION.compare(label(left), label(right))
        : right.count - left.count,
    );
}

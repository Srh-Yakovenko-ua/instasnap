"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { readingStatuses } from "@/lib/book-status";
import { cn } from "@/lib/utils";

export const BOOK_PICKER_SCROLL_AREA =
  "rounded-lg border border-border [&>[data-slot=scroll-area-viewport]>div]:block!";

type BookPickerResultsProps = {
  emptyLabel: ReactNode;
  isPending: boolean;
  loadingLabel: string;
  onToggle: (book: BookView) => void;
  readingLabel: (status: BookView["readingStatus"]) => string;
  results: BookView[];
  selectedIds: ReadonlySet<string>;
};

type BookPickerSelectedProps = {
  books: BookView[];
  emptyLabel: string;
  onRemove: (book: BookView) => void;
  removeLabel: string;
};

export function BookPickerResults({
  emptyLabel,
  isPending,
  loadingLabel,
  onToggle,
  readingLabel,
  results,
  selectedIds,
}: BookPickerResultsProps) {
  if (isPending) return <BookPickerNotice>{loadingLabel}</BookPickerNotice>;
  if (results.length === 0) return <BookPickerNotice>{emptyLabel}</BookPickerNotice>;

  return (
    <ul className="flex flex-col gap-1 p-2">
      {results.map((book) => {
        const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
        return (
          <li key={book.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-accent-border hover:bg-secondary/50">
              <Checkbox
                aria-label={book.title}
                checked={selectedIds.has(book.id)}
                onCheckedChange={() => onToggle(book)}
              />
              <BookThumb book={book} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <BookPickerCaption book={book} />
                {readingBase === undefined ? null : (
                  <StatusBadge
                    className="self-start max-sm:h-5 max-sm:gap-1 max-sm:px-2 max-sm:text-[0.6875rem] max-sm:[&>svg]:size-3"
                    entry={{ ...readingBase, label: readingLabel(book.readingStatus) }}
                  />
                )}
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function BookPickerSelected({
  books,
  emptyLabel,
  onRemove,
  removeLabel,
}: BookPickerSelectedProps) {
  if (books.length === 0) {
    return <BookPickerNotice className="text-center">{emptyLabel}</BookPickerNotice>;
  }

  return (
    <ul className="flex flex-col gap-1 p-2">
      {books.map((book) => (
        <li
          className="flex items-center gap-3 rounded-lg border border-transparent p-2"
          key={book.id}
        >
          <BookThumb book={book} />
          <BookPickerCaption book={book} />
          <button
            aria-label={removeLabel}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => onRemove(book)}
            type="button"
          >
            <UiIcon name="x" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BookThumb({ book }: { book: BookView }) {
  if (book.cover === null || book.cover === undefined) {
    return (
      <span className="grid h-12 w-9 shrink-0 place-items-center rounded-sm bg-accent text-icon">
        <UiIcon name="book" size={16} />
      </span>
    );
  }

  return (
    <Image
      alt={book.title}
      className="h-12 w-9 shrink-0 rounded-sm object-cover"
      height={48}
      src={book.cover.urls.thumb}
      unoptimized
      width={36}
    />
  );
}

function BookPickerCaption({ book }: { book: BookView }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-medium break-words text-ink sm:truncate">{book.title}</span>
      <span className="truncate text-xs text-muted-foreground">
        {book.authors.map((author) => author.name).join(", ")}
      </span>
    </div>
  );
}

function BookPickerNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn("grid h-full place-items-center p-4 text-sm text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}

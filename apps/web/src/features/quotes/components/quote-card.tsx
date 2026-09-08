"use client";

import type { Nullable, QuoteBookPreview, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { copyText } from "@/lib/copy-text";

import { useDeleteQuote, useUpdateQuote } from "../api/use-quote-mutations";
import { DeleteQuoteDialog } from "./delete-quote-dialog";
import { QuoteDialog } from "./quote-dialog";

const QUOTE_PREVIEW_LENGTH = 280;

type QuoteCardProps = {
  maxPage?: number;
  quote: QuoteView;
  variant?: "archive" | "preview";
};

export function QuoteCard({ maxPage, quote, variant = "preview" }: QuoteCardProps) {
  const t = useTranslations("quotes.card");
  const tActions = useTranslations("quotes.actions");
  const tCopy = useTranslations("quotes.copy");
  const tDelete = useTranslations("quotes.delete");
  const tFavorite = useTranslations("quotes.favorite");
  const tSpoiler = useTranslations("quotes.spoiler");

  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  const isArchive = variant === "archive";
  const isTextHidden = quote.isSpoiler && !spoilerRevealed;
  const metaParts = [
    quote.chapter?.trim(),
    quote.page === null ? undefined : t("pageLabel", { page: quote.page }),
  ].filter((part): part is string => part !== undefined && part.length > 0);

  function toggleFavorite() {
    updateQuote.mutate(
      { bookId: quote.bookId, input: { isFavorite: !quote.isFavorite }, quoteId: quote.id },
      {
        onError: () => toast.error(tFavorite("error")),
        onSuccess: (updated) =>
          toast.success(updated.isFavorite ? tFavorite("added") : tFavorite("removed")),
      },
    );
  }

  async function copyQuote() {
    const copied = await copyText(quote.text);
    if (copied) {
      toast.success(tCopy("success"));
      return;
    }
    toast.error(tCopy("error"));
  }

  function removeQuote() {
    deleteQuote.mutate(
      { bookId: quote.bookId, quoteId: quote.id },
      {
        onError: () => toast.error(tDelete("error")),
        onSuccess: () => {
          setDeleteOpen(false);
          toast.success(tDelete("success"));
        },
      },
    );
  }

  return (
    <article className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-accent-border bg-accent/25 p-4">
      <div className="flex items-center gap-2">
        {isArchive ? <QuoteBookHeader book={quote.book} /> : <SpoilerBadge quote={quote} />}

        <Button
          aria-label={quote.isFavorite ? tFavorite("remove") : tFavorite("add")}
          aria-pressed={quote.isFavorite}
          className="ml-auto"
          disabled={updateQuote.isPending}
          onClick={toggleFavorite}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon
            className={quote.isFavorite ? "text-primary" : "text-muted-foreground"}
            name={quote.isFavorite ? "heart-fill" : "heart"}
            size={16}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={tActions("menuLabel")} size="icon-sm" variant="ghost">
              <UiIcon className="text-muted-foreground" name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <UiIcon name="edit" size={14} />
              {tActions("edit")}
            </DropdownMenuItem>
            {isArchive ? (
              <DropdownMenuItem asChild>
                <Link href={`/books/${quote.bookId}`}>
                  <UiIcon name="book" size={14} />
                  {tActions("openBook")}
                </Link>
              </DropdownMenuItem>
            ) : null}
            {isTextHidden ? null : (
              <DropdownMenuItem onSelect={() => void copyQuote()}>
                <UiIcon name="copy" size={14} />
                {tActions("copy")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
              <UiIcon name="trash" size={14} />
              {tActions("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isTextHidden ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-accent-border bg-card/60 px-4 py-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UiIcon className="shrink-0" name="eye-off" size={16} />
            {tSpoiler("hiddenText")}
          </p>
          <Button
            className="h-11 sm:h-8"
            onClick={() => setSpoilerRevealed(true)}
            size="sm"
            variant="secondary"
          >
            <UiIcon name="eye" size={14} />
            {tSpoiler("show")}
          </Button>
        </div>
      ) : (
        <QuoteText previewLength={isArchive ? QUOTE_PREVIEW_LENGTH : null} text={quote.text} />
      )}

      {isArchive ? (
        <div className="flex flex-wrap items-center gap-2">
          {metaParts.length === 0 ? null : (
            <p className="text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
          )}
          <SpoilerBadge className="ml-auto" quote={quote} />
        </div>
      ) : metaParts.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
      )}

      {quote.comment === null ? null : (
        <p className="flex items-start gap-2 rounded-lg bg-card/70 px-3 py-2 text-sm text-muted-foreground">
          <UiIcon className="mt-0.5 shrink-0 text-icon" name="note" size={14} />
          <span className="min-w-0 whitespace-pre-line">{quote.comment}</span>
        </p>
      )}

      {quote.isSpoiler && spoilerRevealed ? (
        <Button
          className="h-11 self-start sm:h-8"
          onClick={() => setSpoilerRevealed(false)}
          size="sm"
          variant="ghost"
        >
          <UiIcon name="eye-off" size={14} />
          {tSpoiler("hide")}
        </Button>
      ) : null}

      {isArchive ? (
        <Link
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary no-underline hover:underline"
          href={`/books/${quote.bookId}`}
        >
          {t("openBook")}
          <UiIcon name="arrow-right" size={14} />
        </Link>
      ) : null}

      <QuoteDialog
        book={{
          authorName: quote.book.firstAuthorName,
          cover: quote.book.cover,
          id: quote.book.id,
          title: quote.book.title,
        }}
        maxPage={maxPage}
        mode="edit"
        onOpenChange={setEditOpen}
        open={editOpen}
        quote={quote}
      />

      <DeleteQuoteDialog
        isPending={deleteQuote.isPending}
        onConfirm={removeQuote}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </article>
  );
}

function QuoteBookHeader({ book }: { book: QuoteBookPreview }) {
  const coverSrc = book.cover?.urls.thumb;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {coverSrc === undefined ? (
        <div className="grid aspect-[3/4] w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
          <UiIcon name="book" size={16} />
        </div>
      ) : (
        <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md bg-accent">
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="40px"
            src={coverSrc}
            unoptimized
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-heading text-sm font-semibold text-ink">{book.title}</p>
        {book.firstAuthorName.length === 0 ? null : (
          <p className="truncate text-xs text-muted-foreground">{book.firstAuthorName}</p>
        )}
      </div>
    </div>
  );
}

function QuoteText({ previewLength, text }: { previewLength: Nullable<number>; text: string }) {
  const t = useTranslations("quotes.card");
  const [expanded, setExpanded] = useState(false);

  const truncated =
    previewLength !== null && text.length > previewLength
      ? `${text.slice(0, previewLength).trimEnd()}…`
      : null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <blockquote className="font-heading text-base leading-relaxed whitespace-pre-line text-ink">
        {truncated === null || expanded ? text : truncated}
      </blockquote>
      {truncated === null ? null : (
        <Button
          className="h-auto p-0"
          onClick={() => setExpanded(!expanded)}
          size="sm"
          variant="link"
        >
          {expanded ? t("showLess") : t("showMore")}
        </Button>
      )}
    </div>
  );
}

function SpoilerBadge({ className, quote }: { className?: string; quote: QuoteView }) {
  const t = useTranslations("quotes.spoiler");

  return quote.isSpoiler ? (
    <Badge className={className} variant="warning">
      {t("badge")}
    </Badge>
  ) : (
    <Badge className={className} variant="success">
      {t("noSpoilerBadge")}
    </Badge>
  );
}

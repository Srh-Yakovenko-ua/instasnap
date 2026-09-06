"use client";

import type { BookView, LoanDirection } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";

import { LOAN_CANDIDATE_OWNERSHIP } from "../model/loan-candidate-books";
import { BookMultiSelectPicker } from "./book-multi-select-picker";

type LoanBooksStepProps = {
  direction: LoanDirection;
  onCancel: () => void;
  onNext: () => void;
  onSelectedChange: (books: BookView[]) => void;
  personName: string;
  selected: BookView[];
};

export function LoanBooksStep({
  direction,
  onCancel,
  onNext,
  onSelectedChange,
  personName,
  selected,
}: LoanBooksStepProps) {
  const t = useTranslations("books.details.loan.bookStep");
  const tPicker = useTranslations("books.details.loan.booksPicker");
  const tActions = useTranslations("books.actions");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(`${direction}.multiTitle`)}</DialogTitle>
        <DialogDescription>
          {t(`${direction}.multiDescription`, { name: personName })}
        </DialogDescription>
      </DialogHeader>

      <BookMultiSelectPicker
        baseParams={{ owner: [...LOAN_CANDIDATE_OWNERSHIP[direction]] }}
        labels={{
          clear: tPicker("clear"),
          empty: t("notFound"),
          emptySelected: tPicker("emptySelected"),
          library: tPicker("library"),
          loadMore: tPicker("loadMore"),
          removeSelected: tPicker("removeSelected"),
          search: tPicker("search"),
          selected: (count) => tPicker("selected", { count }),
        }}
        onSelectedChange={onSelectedChange}
        renderEmpty={(searched) =>
          searched ? (
            t("notFound")
          ) : (
            <span className="flex flex-col items-center gap-3 text-center">
              <span className="text-sm font-medium text-ink">{t(`${direction}.emptyTitle`)}</span>
              <span className="text-xs text-muted-foreground">{t(`${direction}.emptyHint`)}</span>
              <Button asChild size="sm" variant="secondary">
                <Link href="/books/new" onClick={onCancel}>
                  <UiIcon name="plus" size={16} />
                  {t("createBook")}
                </Link>
              </Button>
            </span>
          )
        }
        selected={selected}
      />

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={selected.length === 0} onClick={onNext} type="button">
          {t("next")}
          <UiIcon name="arrow-right" size={16} />
        </Button>
      </DialogFooter>
    </>
  );
}

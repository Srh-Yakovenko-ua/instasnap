"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { restoreFocusTo } from "../model/loan-focus";

type LoanNoteButtonProps = {
  bookTitle: string;
  note: string;
  onEdit: () => void;
};

export function LoanNoteButton({ bookTitle, note, onEdit }: LoanNoteButtonProps) {
  const tRow = useTranslations("loans.row");
  const [open, setOpen] = useState(false);
  const opensEditRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <TooltipHint label={tRow("viewNote")}>
        <Button
          className="mt-1 w-fit text-muted-foreground"
          onClick={() => setOpen(true)}
          ref={triggerRef}
          size="xs"
          variant="secondary"
        >
          <UiIcon name="note" size={14} />
          {tRow("hasNote")}
        </Button>
      </TooltipHint>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          className="sm:max-w-md"
          onCloseAutoFocus={(event) => {
            if (opensEditRef.current) {
              event.preventDefault();
              opensEditRef.current = false;
              return;
            }
            restoreFocusTo(event, triggerRef.current);
          }}
          onOpenAutoFocus={(event) => {
            if (!(event.currentTarget instanceof HTMLElement)) return;
            event.preventDefault();
            event.currentTarget.focus();
          }}
          tabIndex={-1}
        >
          <DialogHeader>
            <DialogTitle>{tRow("note")}</DialogTitle>
            <DialogDescription>{bookTitle}</DialogDescription>
          </DialogHeader>

          <p className="text-sm break-words whitespace-pre-line text-foreground">{note}</p>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              {tRow("closeNote")}
            </Button>
            <Button
              onClick={() => {
                opensEditRef.current = true;
                setOpen(false);
                onEdit();
              }}
              type="button"
            >
              <UiIcon name="edit" size={16} />
              {tRow("editNote")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

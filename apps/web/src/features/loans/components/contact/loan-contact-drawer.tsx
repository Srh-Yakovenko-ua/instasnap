"use client";

import type { LoanDirection, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LoanDialog } from "@/features/books/components/loan-dialog";

import { useLoanContact } from "../../api/use-loan-contact";
import { useRestoreLoanContact } from "../../api/use-restore-loan-contact";
import { ArchiveLoanContactDialog } from "./archive-loan-contact-dialog";
import { EditLoanContactDialog } from "./edit-loan-contact-dialog";
import { LoanContactHistoryBlock } from "./loan-contact-history-block";
import { LoanContactLoansBlock } from "./loan-contact-loans-block";

type LoanContactDialog = "archive" | "edit";

type LoanContactDrawerProps = {
  contactId: Nullable<string>;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function LoanContactDrawer({
  contactId,
  onCloseAutoFocus,
  onOpenChange,
  open,
}: LoanContactDrawerProps) {
  const t = useTranslations("loans.contactDrawer");
  const tActions = useTranslations("loans.contactDrawer.actions");
  const tRestore = useTranslations("loans.contactDrawer.restore");

  const contactQuery = useLoanContact(contactId);
  const restoreContact = useRestoreLoanContact();
  const [dialog, setDialog] = useState<Nullable<LoanContactDialog>>(null);
  const [loanDirection, setLoanDirection] = useState<Nullable<LoanDirection>>(null);

  const contact = contactQuery.data;
  const isArchived = contact !== undefined && contact.archivedAt !== null;

  function restore(id: string) {
    restoreContact.mutate(id, {
      onError: () => toast.error(tRestore("error")),
      onSuccess: () => toast.success(tRestore("success")),
    });
  }

  return (
    <>
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          aria-describedby={undefined}
          className="w-full gap-0 p-0 data-[side=right]:w-full sm:max-w-lg"
          onCloseAutoFocus={onCloseAutoFocus}
          side="right"
        >
          <SheetHeader className="gap-3">
            <div className="flex min-w-0 flex-col gap-1.5 pr-8">
              <SheetTitle className="truncate">{contact?.name ?? t("title")}</SheetTitle>
              {contact === undefined ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <>
                  <p className="truncate text-sm text-muted-foreground">
                    {contact.contact ?? t("contactEmpty")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("totalLoans", { count: contact.loanCount })}
                    </span>
                    {isArchived ? <Badge variant="secondary">{t("archivedBadge")}</Badge> : null}
                  </div>
                </>
              )}
            </div>

            {contact === undefined ? null : (
              <div className="flex flex-wrap gap-2">
                {isArchived ? null : (
                  <>
                    <Button onClick={() => setLoanDirection("lent")} size="sm">
                      <UiIcon name="arrow-up-right" size={16} />
                      {tActions("lend")}
                    </Button>
                    <Button
                      onClick={() => setLoanDirection("borrowed")}
                      size="sm"
                      variant="secondary"
                    >
                      <UiIcon name="arrow-down-circle" size={16} />
                      {tActions("borrow")}
                    </Button>
                  </>
                )}
                <Button onClick={() => setDialog("edit")} size="sm" variant="secondary">
                  <UiIcon name="edit" size={16} />
                  {tActions("edit")}
                </Button>
                {isArchived ? (
                  <Button
                    disabled={restoreContact.isPending}
                    loading={restoreContact.isPending}
                    onClick={() => restore(contact.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <UiIcon name="refresh" size={16} />
                    {tActions("restore")}
                  </Button>
                ) : (
                  <Button onClick={() => setDialog("archive")} size="sm" variant="ghost">
                    <UiIcon name="inbox" size={16} />
                    {tActions("archive")}
                  </Button>
                )}
              </div>
            )}
          </SheetHeader>

          {contactQuery.isError ? (
            <div className="flex flex-col items-start gap-3 px-5 py-5" role="alert">
              <p className="text-sm text-muted-foreground">{t("error")}</p>
              <Button onClick={() => void contactQuery.refetch()} size="sm" variant="secondary">
                <UiIcon name="refresh" size={16} />
                {t("retry")}
              </Button>
            </div>
          ) : null}

          {contactQuery.isLoading ? (
            <div aria-busy className="flex flex-col gap-4 px-5 py-5" role="status">
              <span className="sr-only">{t("loading")}</span>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : null}

          {contact === undefined ? null : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              <LoanContactLoansBlock
                contactId={contact.id}
                onNavigate={() => onOpenChange(false)}
                type="lent_to_someone"
              />
              <LoanContactLoansBlock
                contactId={contact.id}
                onNavigate={() => onOpenChange(false)}
                type="borrowed_from_someone"
              />
              <LoanContactHistoryBlock
                contactId={contact.id}
                onNavigate={() => onOpenChange(false)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {contact === undefined ? null : (
        <>
          <EditLoanContactDialog
            contact={contact}
            onOpenChange={(next) => setDialog(next ? "edit" : null)}
            open={dialog === "edit"}
          />
          <ArchiveLoanContactDialog
            contact={contact}
            onOpenChange={(next) => setDialog(next ? "archive" : null)}
            open={dialog === "archive"}
          />
          {loanDirection === null ? null : (
            <LoanDialog
              context={{ contact, kind: "contact" }}
              direction={loanDirection}
              onOpenChange={(next) => {
                if (!next) setLoanDirection(null);
              }}
              open
            />
          )}
        </>
      )}
    </>
  );
}

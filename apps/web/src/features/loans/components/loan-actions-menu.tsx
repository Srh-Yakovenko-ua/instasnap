"use client";

import type { ExtendLoanInput, LoanListItemView, Nullable } from "@app/shared";

import { LOAN_QUICK_ACTIONS } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateLong } from "@/lib/format";

import { useExtendLoan, useSetLoanReminder } from "../api/use-loan-actions";

type LoanActionsMenuProps = {
  loan: LoanListItemView;
  onEdit: () => void;
  onReturn: () => void;
};

export function LoanActionsMenu({ loan, onEdit, onReturn }: LoanActionsMenuProps) {
  const t = useTranslations("loans.actions");
  const locale = useLocale();
  const extendLoan = useExtendLoan();
  const setReminder = useSetLoanReminder();
  const opensDialogRef = useRef(false);

  const hasReturnDate = loan.expectedReturnDate !== null;
  const isOverdue = loan.loanUiStatus === "overdue";
  const canRemind = hasReturnDate && !isOverdue;
  const isBusy = extendLoan.isPending || setReminder.isPending;

  function extend(days: ExtendLoanInput["days"]) {
    extendLoan.mutate(
      { id: loan.book.id, payload: { days } },
      {
        onError: () => toast.error(t("extendError")),
        onSuccess: (book) => {
          const nextDate = book.loanInfo?.expectedReturnDate ?? null;
          toast.success(
            nextDate === null
              ? t("extendSuccessPlain")
              : t("extendSuccess", { date: formatDateLong(nextDate, locale) }),
          );
        },
      },
    );
  }

  function saveReminder(remindBeforeDays: Nullable<number>) {
    setReminder.mutate(
      { id: loan.book.id, payload: { remindBeforeDays } },
      {
        onError: () => toast.error(t("reminderError")),
        onSuccess: () =>
          toast.success(remindBeforeDays === null ? t("reminderOffDone") : t("reminderOnDone")),
      },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("menu")} data-loan-trigger={loan.id} size="icon" variant="ghost">
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onCloseAutoFocus={(event) => {
          if (opensDialogRef.current) event.preventDefault();
          opensDialogRef.current = false;
        }}
      >
        <DropdownMenuItem
          onClick={() => {
            opensDialogRef.current = true;
            onEdit();
          }}
        >
          <UiIcon name="calendar" size={16} />
          {hasReturnDate ? t("changeReturnDate") : t("setReturnDate")}
        </DropdownMenuItem>

        {hasReturnDate
          ? LOAN_QUICK_ACTIONS.extendDays.map((days) => (
              <DropdownMenuItem disabled={isBusy} key={days} onClick={() => extend(days)}>
                <UiIcon name={isOverdue ? "clock" : "plus"} size={16} />
                {isOverdue ? t("extendOverdue", { days }) : t("extend", { days })}
              </DropdownMenuItem>
            ))
          : null}

        {canRemind ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UiIcon name={loan.remindToReturn ? "bell" : "bell-off"} size={16} />
              {loan.remindToReturn && loan.remindBeforeDays !== null
                ? t("reminderCurrent", { days: loan.remindBeforeDays })
                : t("reminderSetup")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {LOAN_QUICK_ACTIONS.reminderBeforeDays.map((days) => (
                <DropdownMenuCheckboxItem
                  checked={loan.remindToReturn && loan.remindBeforeDays === days}
                  disabled={isBusy}
                  key={days}
                  onCheckedChange={() => saveReminder(days)}
                >
                  {t("reminderOption", { days })}
                </DropdownMenuCheckboxItem>
              ))}
              {loan.remindToReturn ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={isBusy} onClick={() => saveReminder(null)}>
                    <UiIcon name="bell-off" size={16} />
                    {t("reminderOff")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            opensDialogRef.current = true;
            onEdit();
          }}
        >
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            opensDialogRef.current = true;
            onReturn();
          }}
        >
          <UiIcon name="check-circle" size={16} />
          {t("markReturned")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

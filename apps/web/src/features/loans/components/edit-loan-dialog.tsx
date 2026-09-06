"use client";

import type { LoanListItemView, UpdateLoanInput } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, type UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BookDateField } from "@/features/books/components/book-date-field";
import { toLoanErrorKey } from "@/features/books/model/loan-error";
import { ISO_DATE_PATTERN, todayIso } from "@/features/books/model/reading-progress";

import type { LoanContactSelection } from "../model/loan-contact-selection";

import { useEditLoan } from "../api/use-loan-actions";
import { restoreLoanTriggerFocus } from "../model/loan-focus";
import { CreateLoanContactStep } from "./contact/create-loan-contact-step";
import { LoanContactPicker } from "./loan-contact-picker";

const NOTE_MAX = 300;

type EditLoanDialogProps = {
  loan: LoanListItemView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type EditLoanStep = "create-contact" | "edit";

type LoanMessages = {
  contactRequired: string;
  dateInvalid: string;
  loanDateFuture: string;
  noteMax: string;
  reminderNeedsDate: string;
  returnBeforeLoan: string;
};

type LoanValues = {
  expectedReturnDate: string;
  loanContactId: string;
  loanContactName: string;
  loanDate: string;
  note: string;
  remindToReturn: boolean;
};

export function EditLoanDialog({ loan, onOpenChange, open }: EditLoanDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => restoreLoanTriggerFocus(event, loan.id)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            document.getElementById("edit-loan-contact-picker")?.focus();
          });
        }}
      >
        {open ? <EditLoanBody loan={loan} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(values: LoanValues): UpdateLoanInput {
  const note = values.note.trim();

  return {
    expectedReturnDate: values.expectedReturnDate.length > 0 ? values.expectedReturnDate : null,
    loanContactId: values.loanContactId,
    loanDate: values.loanDate.length > 0 ? values.loanDate : null,
    note: note.length > 0 ? note : null,
    remindToReturn: values.remindToReturn,
  };
}

function buildSchema(messages: LoanMessages) {
  return z
    .object({
      expectedReturnDate: z
        .string()
        .refine(
          (value) => value.length === 0 || ISO_DATE_PATTERN.test(value),
          messages.dateInvalid,
        ),
      loanContactId: z.string().min(1, messages.contactRequired),
      loanContactName: z.string(),
      loanDate: z
        .string()
        .refine((value) => value.length === 0 || ISO_DATE_PATTERN.test(value), messages.dateInvalid)
        .refine((value) => value.length === 0 || value <= todayIso(), messages.loanDateFuture),
      note: z.string().max(NOTE_MAX, messages.noteMax),
      remindToReturn: z.boolean(),
    })
    .refine(
      (value) =>
        value.expectedReturnDate.length === 0 ||
        value.expectedReturnDate >= (value.loanDate.length > 0 ? value.loanDate : todayIso()),
      { message: messages.returnBeforeLoan, path: ["expectedReturnDate"] },
    )
    .refine((value) => !value.remindToReturn || value.expectedReturnDate.length > 0, {
      message: messages.reminderNeedsDate,
      path: ["expectedReturnDate"],
    });
}

function EditLoanBody({ loan, onDone }: { loan: LoanListItemView; onDone: () => void }) {
  const tErrors = useTranslations("books.details.loan.errors");
  const tContact = useTranslations("loans.contactPicker");
  const [createName, setCreateName] = useState("");
  const [step, setStep] = useState<EditLoanStep>("edit");

  const form = useForm<LoanValues>({
    defaultValues: {
      expectedReturnDate: loan.expectedReturnDate ?? "",
      loanContactId: loan.loanContactId,
      loanContactName: loan.personName,
      loanDate: loan.loanDate ?? "",
      note: loan.note ?? "",
      remindToReturn: loan.remindToReturn,
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        contactRequired: tContact("required"),
        dateInvalid: tErrors("dateInvalid"),
        loanDateFuture: tErrors("loanDateFuture"),
        noteMax: tErrors("noteMax", { max: NOTE_MAX }),
        reminderNeedsDate: tErrors("reminderNeedsDate"),
        returnBeforeLoan: tErrors("returnBeforeLoan"),
      }),
    ),
  });

  if (step === "create-contact") {
    return (
      <CreateLoanContactStep
        initialName={createName}
        onBack={() => setStep("edit")}
        onCancel={onDone}
        onResolved={({ contact }) => {
          form.setValue("loanContactId", contact.id, { shouldValidate: true });
          form.setValue("loanContactName", contact.name);
          setStep("edit");
        }}
      />
    );
  }

  return (
    <EditLoanForm
      form={form}
      loan={loan}
      onDone={onDone}
      onRequestCreate={(name) => {
        setCreateName(name);
        setStep("create-contact");
      }}
    />
  );
}

function EditLoanForm({
  form,
  loan,
  onDone,
  onRequestCreate,
}: {
  form: UseFormReturn<LoanValues>;
  loan: LoanListItemView;
  onDone: () => void;
  onRequestCreate: (name: string) => void;
}) {
  const t = useTranslations("books.details.loan");
  const tErrors = useTranslations("books.details.loan.errors");
  const tActions = useTranslations("books.actions");
  const tEdit = useTranslations("loans.edit");
  const editLoan = useEditLoan();
  const [serverError, setServerError] = useState<null | string>(null);

  const variant = loan.type === "lent_to_someone" ? "lent" : "borrowed";

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = form;

  const loanContactId = useWatch({ control, name: "loanContactId" });
  const loanContactName = useWatch({ control, name: "loanContactName" });
  const contactSelection: LoanContactSelection | null =
    loanContactId.length > 0
      ? { contactId: loanContactId, kind: "picked", name: loanContactName }
      : null;

  function handleContactChange(selection: LoanContactSelection | null) {
    setValue("loanContactId", selection?.kind === "picked" ? selection.contactId : "", {
      shouldValidate: true,
    });
    setValue("loanContactName", selection?.name ?? "");
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    editLoan.mutate(
      { id: loan.book.id, payload: buildPayload(values) },
      {
        onError: (error) => setServerError(tErrors(toLoanErrorKey(error))),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{tEdit("title")}</DialogTitle>
        <DialogDescription>{tEdit("description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-loan-contact-picker">{t(`${variant}.personName`)}</Label>
        <LoanContactPicker
          describedBy={errors.loanContactId ? "edit-loan-contact-picker-error" : undefined}
          direction={variant}
          id="edit-loan-contact-picker"
          invalid={errors.loanContactId !== undefined}
          label={t(`${variant}.personName`)}
          onChange={handleContactChange}
          onRequestCreate={onRequestCreate}
          placeholder={t(`${variant}.personNamePlaceholder`)}
          value={contactSelection}
        />
        <FieldError error={errors.loanContactId} id="edit-loan-contact-picker-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-loan-date">{t(`${variant}.loanDate`)}</Label>
          <Controller
            control={control}
            name="loanDate"
            render={({ field }) => (
              <BookDateField
                ariaLabel={t(`${variant}.loanDate`)}
                describedBy={errors.loanDate ? "edit-loan-date-error" : undefined}
                id="edit-loan-date"
                invalid={errors.loanDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.loanDate} id="edit-loan-date-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="edit-loan-return-date">{t("fields.returnDate")}</Label>
          <Controller
            control={control}
            name="expectedReturnDate"
            render={({ field }) => (
              <BookDateField
                allowFuture
                ariaLabel={t("fields.returnDate")}
                describedBy={errors.expectedReturnDate ? "edit-loan-return-date-error" : undefined}
                id="edit-loan-return-date"
                invalid={errors.expectedReturnDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.expectedReturnDate} id="edit-loan-return-date-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-loan-note">{t("fields.note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note
                    ? "edit-loan-note-error edit-loan-note-counter"
                    : "edit-loan-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="edit-loan-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("fields.notePlaceholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="edit-loan-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="edit-loan-note-counter"
                >
                  {field.value.length}/{NOTE_MAX}
                </span>
              </div>
            </>
          )}
        />
      </div>

      <Controller
        control={control}
        name="remindToReturn"
        render={({ field }) => (
          <label
            className="flex cursor-pointer items-center justify-between gap-3"
            htmlFor="edit-loan-remind"
          >
            <span className="text-sm text-foreground">{t("fields.remindToReturn")}</span>
            <Switch checked={field.value} id="edit-loan-remind" onCheckedChange={field.onChange} />
          </label>
        )}
      />

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={editLoan.isPending} loading={editLoan.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

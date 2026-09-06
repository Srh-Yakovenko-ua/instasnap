"use client";

import type {
  BookView,
  CreateLoanInput,
  CreateLoansBatchInput,
  LoanContactView,
  LoanDirection,
} from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, type UseFormReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

import { UiIcon } from "@/components/icons";
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
import { CreateLoanContactStep } from "@/features/loans/components/contact/create-loan-contact-step";
import { LoanContactPicker } from "@/features/loans/components/loan-contact-picker";

import { useCreateLoansBatch } from "../api/use-create-loans-batch";
import { useCreateLoan } from "../api/use-loan";
import { toLoanBatchConflicts } from "../model/loan-batch-error";
import { toLoanErrorKey } from "../model/loan-error";
import { ISO_DATE_PATTERN, todayIso } from "../model/reading-progress";
import { BookDateField } from "./book-date-field";
import { BookThumb } from "./book-picker";
import { LoanBooksStep } from "./loan-books-step";

const NOTE_MAX = 300;

export type LoanDialogContext =
  { book: BookView; kind: "book" } | { contact: LoanContactView; kind: "contact" };

type LoanDialogProps = {
  context: LoanDialogContext;
  direction: LoanDirection;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type LoanFormTarget =
  | { book: BookView; kind: "book" }
  | { books: BookView[]; contact: LoanContactView; kind: "contactBooks"; onBack: () => void };

type LoanMessages = {
  contactRequired: string;
  dateInvalid: string;
  loanDateFuture: string;
  noteMax: string;
  reminderNeedsDate: string;
  returnBeforeLoan: string;
};

type LoanStep = "books" | "create-contact" | "form";

type LoanValues = {
  expectedReturnDate: string;
  loanContactId: string;
  loanContactName: string;
  loanDate: string;
  note: string;
  remindToReturn: boolean;
};

export function LoanDialog({ context, direction, onOpenChange, open }: LoanDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={
          context.kind === "contact" ? "max-h-[92vh] overflow-y-auto sm:max-w-3xl" : "sm:max-w-md"
        }
      >
        {open ? (
          <LoanDialogBody
            context={context}
            direction={direction}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildBatchPayload(
  direction: LoanDirection,
  books: BookView[],
  values: LoanValues,
): CreateLoansBatchInput {
  const payload: CreateLoansBatchInput = {
    bookIds: books.map((book) => book.id),
    direction,
    loanContactId: values.loanContactId,
    loanDate: values.loanDate,
  };
  const note = values.note.trim();

  if (values.expectedReturnDate.length > 0) payload.expectedReturnDate = values.expectedReturnDate;
  if (note.length > 0) payload.note = note;
  if (values.remindToReturn) payload.remindToReturn = true;

  return payload;
}

function buildPayload(direction: LoanDirection, values: LoanValues): CreateLoanInput {
  const payload: CreateLoanInput = {
    direction,
    loanContactId: values.loanContactId,
    loanDate: values.loanDate,
  };
  const note = values.note.trim();

  if (values.expectedReturnDate.length > 0) payload.expectedReturnDate = values.expectedReturnDate;
  if (note.length > 0) payload.note = note;
  if (values.remindToReturn) payload.remindToReturn = true;

  return payload;
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
        .refine((value) => ISO_DATE_PATTERN.test(value), messages.dateInvalid)
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

function LoanDialogBody({
  context,
  direction,
  onDone,
}: {
  context: LoanDialogContext;
  direction: LoanDirection;
  onDone: () => void;
}) {
  const tErrors = useTranslations("books.details.loan.errors");
  const tContact = useTranslations("loans.contactPicker");
  const fixedContact = context.kind === "contact" ? context.contact : null;
  const [selected, setSelected] = useState<BookView[]>([]);
  const [createName, setCreateName] = useState("");
  const [step, setStep] = useState<LoanStep>(fixedContact === null ? "form" : "books");

  const form = useForm<LoanValues>({
    defaultValues: {
      expectedReturnDate: "",
      loanContactId: fixedContact?.id ?? "",
      loanContactName: fixedContact?.name ?? "",
      loanDate: todayIso(),
      note: "",
      remindToReturn: false,
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
        onBack={() => setStep("form")}
        onCancel={onDone}
        onResolved={({ contact }) => {
          form.setValue("loanContactId", contact.id, { shouldValidate: true });
          form.setValue("loanContactName", contact.name);
          setStep("form");
        }}
      />
    );
  }

  if (context.kind === "contact" && (step === "books" || selected.length === 0)) {
    return (
      <LoanBooksStep
        direction={direction}
        onCancel={onDone}
        onNext={() => setStep("form")}
        onSelectedChange={setSelected}
        personName={context.contact.name}
        selected={selected}
      />
    );
  }

  return (
    <LoanForm
      direction={direction}
      form={form}
      onDone={onDone}
      onRequestCreate={(name) => {
        setCreateName(name);
        setStep("create-contact");
      }}
      target={
        context.kind === "contact"
          ? {
              books: selected,
              contact: context.contact,
              kind: "contactBooks",
              onBack: () => setStep("books"),
            }
          : { book: context.book, kind: "book" }
      }
    />
  );
}

function LoanForm({
  direction,
  form,
  onDone,
  onRequestCreate,
  target,
}: {
  direction: LoanDirection;
  form: UseFormReturn<LoanValues>;
  onDone: () => void;
  onRequestCreate: (name: string) => void;
  target: LoanFormTarget;
}) {
  const t = useTranslations("books.details.loan");
  const tErrors = useTranslations("books.details.loan.errors");
  const tActions = useTranslations("books.actions");
  const tBatch = useTranslations("books.details.loan.batch");
  const createLoan = useCreateLoan();
  const createLoansBatch = useCreateLoansBatch();
  const [serverError, setServerError] = useState<null | string>(null);
  const [blockedBooks, setBlockedBooks] = useState<BookView[]>([]);

  const variant = direction === "lent" ? "lent" : "borrowed";
  const isPending = createLoan.isPending || createLoansBatch.isPending;

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

  function handleError(error: unknown, books: BookView[]) {
    const conflicts = toLoanBatchConflicts(error);
    const blockedIds = new Set(conflicts.map((conflict) => conflict.bookId));
    setBlockedBooks(books.filter((entry) => blockedIds.has(entry.id)));
    setServerError(conflicts.length > 0 ? tBatch("conflictIntro") : tErrors(toLoanErrorKey(error)));
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setBlockedBooks([]);

    if (target.kind === "book") {
      createLoan.mutate(
        { id: target.book.id, payload: buildPayload(direction, values) },
        {
          onError: (error) => handleError(error, [target.book]),
          onSuccess: onDone,
        },
      );
      return;
    }

    createLoansBatch.mutate(buildBatchPayload(direction, target.books, values), {
      onError: (error) => handleError(error, target.books),
      onSuccess: (result) => {
        toast.success(tBatch(`${variant}.success`, { count: result.createdBookIds.length }));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        {target.kind === "contactBooks" ? (
          <button
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={target.onBack}
            type="button"
          >
            <UiIcon aria-hidden name="arrow-left" size={16} />
            {t("back")}
          </button>
        ) : null}
        <DialogTitle>{t(`${variant}.title`)}</DialogTitle>
        <DialogDescription>
          {target.kind === "book" ? t(`${variant}.description`) : tBatch(`${variant}.description`)}
        </DialogDescription>
      </DialogHeader>

      {target.kind === "book" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="loan-contact-picker">{t(`${variant}.personName`)}</Label>
          <LoanContactPicker
            describedBy={errors.loanContactId ? "loan-contact-picker-error" : undefined}
            direction={direction}
            id="loan-contact-picker"
            invalid={errors.loanContactId !== undefined}
            label={t(`${variant}.personName`)}
            onChange={handleContactChange}
            onRequestCreate={onRequestCreate}
            placeholder={t(`${variant}.personNamePlaceholder`)}
            value={contactSelection}
          />
          <FieldError error={errors.loanContactId} id="loan-contact-picker-error" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t(`${variant}.personName`)}</span>
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <UiIcon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                name="user"
                size={16}
              />
              <span className="truncate">{target.contact.name}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {tBatch("appliesTo", { count: target.books.length })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {target.books.map((entry) => (
              <li
                className="flex max-w-full min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                key={entry.id}
              >
                <BookThumb book={entry} />
                <span className="truncate text-xs font-medium text-ink">{entry.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="loan-date">{t(`${variant}.loanDate`)}</Label>
          <Controller
            control={control}
            name="loanDate"
            render={({ field }) => (
              <BookDateField
                ariaLabel={t(`${variant}.loanDate`)}
                describedBy={errors.loanDate ? "loan-date-error" : undefined}
                id="loan-date"
                invalid={errors.loanDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.loanDate} id="loan-date-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="loan-return-date">{t("fields.returnDate")}</Label>
          <Controller
            control={control}
            name="expectedReturnDate"
            render={({ field }) => (
              <BookDateField
                allowFuture
                ariaLabel={t("fields.returnDate")}
                describedBy={errors.expectedReturnDate ? "loan-return-date-error" : undefined}
                id="loan-return-date"
                invalid={errors.expectedReturnDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.expectedReturnDate} id="loan-return-date-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-note">{t("fields.note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note ? "loan-note-error loan-note-counter" : "loan-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="loan-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("fields.notePlaceholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="loan-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="loan-note-counter"
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
            htmlFor="loan-remind"
          >
            <span className="text-sm text-foreground">{t("fields.remindToReturn")}</span>
            <Switch checked={field.value} id="loan-remind" onCheckedChange={field.onChange} />
          </label>
        )}
      />

      {serverError === null ? null : (
        <div
          className="flex flex-col gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p>{serverError}</p>
          {blockedBooks.length === 0 ? null : (
            <ul className="list-inside list-disc">
              {blockedBooks.map((entry) => (
                <li className="truncate" key={entry.id}>
                  {entry.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

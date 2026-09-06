"use client";

import type { LoanContactView, Nullable } from "@app/shared";

import { LOAN_CONTACT_ERROR_CODES } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyFieldErrors } from "@/lib/api-errors";
import { ApiError } from "@/lib/http-client";

import type { LoanContactFormValues } from "../../model/loan-contact-form";

import { findLoanContactByName } from "../../api/find-loan-contact-by-name";
import { useCreateLoanContact } from "../../api/use-create-loan-contact";
import { useRestoreLoanContact } from "../../api/use-restore-loan-contact";
import { buildLoanContactFormSchema, toLoanContactPayload } from "../../model/loan-contact-form";

export type LoanContactConflictAction = "open" | "select";

export type LoanContactResolution = {
  contact: LoanContactView;
  kind: "created" | "existing" | "restored";
};

type LoanContactConflict = {
  contact: LoanContactView;
  kind: "archived" | "duplicate";
};

export function CreateLoanContactForm({
  conflictAction,
  initialName,
  onCancel,
  onResolved,
}: {
  conflictAction: LoanContactConflictAction;
  initialName: string;
  onCancel: () => void;
  onResolved: (resolution: LoanContactResolution) => void;
}) {
  const t = useTranslations("loans.contactCreate");
  const createContact = useCreateLoanContact();
  const restoreContact = useRestoreLoanContact();
  const [serverError, setServerError] = useState<Nullable<string>>(null);
  const [conflict, setConflict] = useState<Nullable<LoanContactConflict>>(null);

  const form = useForm<LoanContactFormValues>({
    defaultValues: { contact: "", name: initialName },
    mode: "onTouched",
    resolver: zodResolver(
      buildLoanContactFormSchema({
        contactInvalid: t("errors.contactInvalid"),
        nameInvalid: t("errors.nameInvalid"),
      }),
    ),
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = form;

  async function handleConflict(name: string, code: string): Promise<void> {
    const existing = await findLoanContactByName(name).catch(() => null);
    if (existing === null) {
      setError("name", { message: t(`errors.${conflictCodeKey(code)}`) });
      return;
    }

    setConflict({
      contact: existing,
      kind: existing.archivedAt === null ? "duplicate" : "archived",
    });
  }

  async function handleError(name: string, error: unknown): Promise<void> {
    if (error instanceof ApiError && isNameConflict(error.code)) {
      await handleConflict(name, error.code ?? "");
      return;
    }
    if (applyFieldErrors(form, error)) return;
    setServerError(t("errors.generic"));
  }

  function restore(contact: LoanContactView) {
    restoreContact.mutate(contact.id, {
      onError: () => toast.error(t("errors.restoreFailed")),
      onSuccess: (restored) => onResolved({ contact: restored, kind: "restored" }),
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setConflict(null);
    const payload = toLoanContactPayload(values);

    try {
      onResolved({ contact: await createContact.mutateAsync(payload), kind: "created" });
    } catch (error) {
      await handleError(payload.name, error);
    }
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="create-loan-contact-name">{t("name")}</Label>
        <Input
          aria-describedby={errors.name ? "create-loan-contact-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="create-loan-contact-name"
          placeholder={t("namePlaceholder")}
          {...register("name", { onChange: () => setConflict(null) })}
        />
        <FieldError error={errors.name} id="create-loan-contact-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="create-loan-contact-contact">
          {t("contact")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.contact ? "create-loan-contact-contact-error" : undefined}
          aria-invalid={errors.contact !== undefined}
          autoComplete="off"
          className="h-10"
          id="create-loan-contact-contact"
          placeholder={t("contactPlaceholder")}
          {...register("contact")}
        />
        <FieldError error={errors.contact} id="create-loan-contact-contact-error" />
      </div>

      {conflict === null ? null : (
        <ConflictPanel
          action={conflictAction}
          conflict={conflict}
          isRestoring={restoreContact.isPending}
          onOpen={() => onResolved({ contact: conflict.contact, kind: "existing" })}
          onRestore={() => restore(conflict.contact)}
          onSelect={() => onResolved({ contact: conflict.contact, kind: "existing" })}
        />
      )}

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={createContact.isPending} loading={createContact.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function conflictCodeKey(code: string): "archivedName" | "duplicateName" {
  return code === LOAN_CONTACT_ERROR_CODES.archivedName ? "archivedName" : "duplicateName";
}

function ConflictPanel({
  action,
  conflict,
  isRestoring,
  onOpen,
  onRestore,
  onSelect,
}: {
  action: LoanContactConflictAction;
  conflict: LoanContactConflict;
  isRestoring: boolean;
  onOpen: () => void;
  onRestore: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations("loans.contactCreate.conflict");
  const name = conflict.contact.name;

  return (
    <div
      className="flex flex-col items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2.5"
      role="alert"
    >
      <p className="text-sm text-foreground">
        {conflict.kind === "archived" ? t("archived", { name }) : t("duplicate", { name })}
      </p>
      {conflict.kind === "archived" ? (
        <Button
          disabled={isRestoring}
          loading={isRestoring}
          onClick={onRestore}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UiIcon name="refresh" size={16} />
          {t("restore", { name })}
        </Button>
      ) : (
        <Button
          onClick={action === "select" ? onSelect : onOpen}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UiIcon name={action === "select" ? "check" : "arrow-right"} size={16} />
          {action === "select" ? t("select", { name }) : t("open")}
        </Button>
      )}
    </div>
  );
}

function isNameConflict(code: string | undefined): boolean {
  return (
    code === LOAN_CONTACT_ERROR_CODES.archivedName ||
    code === LOAN_CONTACT_ERROR_CODES.duplicateName
  );
}

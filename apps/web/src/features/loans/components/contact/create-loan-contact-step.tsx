"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { LoanContactResolution } from "./create-loan-contact-form";

import { CreateLoanContactForm } from "./create-loan-contact-form";

type CreateLoanContactStepProps = {
  initialName: string;
  onBack: () => void;
  onCancel: () => void;
  onResolved: (resolution: LoanContactResolution) => void;
};

export function CreateLoanContactStep({
  initialName,
  onBack,
  onCancel,
  onResolved,
}: CreateLoanContactStepProps) {
  const t = useTranslations("loans.contactCreate");

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <button
          className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <UiIcon aria-hidden name="arrow-left" size={16} />
          {t("back")}
        </button>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <CreateLoanContactForm
        conflictAction="select"
        initialName={initialName}
        onCancel={onCancel}
        onResolved={onResolved}
      />
    </div>
  );
}

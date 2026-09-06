"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { cn } from "@/lib/utils";

type LoanContactNameButtonProps = {
  className?: string;
  contact: Nullable<string>;
  name: string;
  onOpen: () => void;
};

export function LoanContactNameButton({
  className,
  contact,
  name,
  onOpen,
}: LoanContactNameButtonProps) {
  const t = useTranslations("loans.contactDrawer");
  const contactId = useId();

  return (
    <TooltipHint label={t("openPersonCard")}>
      <button
        aria-describedby={contact === null ? undefined : contactId}
        aria-label={t("openContact", { name })}
        className={cn(
          "group/contact -mx-1.5 flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        onClick={onOpen}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <UiIcon
            className="shrink-0 text-icon transition-colors group-hover/contact:text-primary"
            name="user"
            size={14}
          />
          <span className="truncate text-xs font-medium text-foreground/90 transition-colors group-hover/contact:text-primary">
            {name}
          </span>
          <UiIcon
            className="shrink-0 text-muted-foreground transition-colors group-hover/contact:text-primary"
            name="chevron-right"
            size={12}
          />
        </span>
        {contact === null ? null : (
          <span className="truncate text-xs text-muted-foreground" id={contactId}>
            {contact}
          </span>
        )}
      </button>
    </TooltipHint>
  );
}

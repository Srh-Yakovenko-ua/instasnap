"use client";

import type { OwnershipStatus } from "@app/shared";

import { LOAN_PERSON_REQUIRED_MESSAGE } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldError as RhfFieldError,
  type UseFormRegister,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreateLoanContactDialog } from "@/features/loans/components/contact/create-loan-contact-dialog";
import { LoanContactPicker } from "@/features/loans/components/loan-contact-picker";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ownershipStatuses } from "@/lib/book-status";

import type { BookFormMode } from "../model/book-form-mode";
import type { CreateBookFormValues } from "../model/create-book-form";

import {
  EDIT_DELIVERY_STATUS_OPTIONS,
  OWNERSHIP_STATUS_OPTIONS,
  ownershipLoanDirection,
  ownershipUsesDelivery,
  ownershipUsesLoan,
} from "../model/book-status-fields";
import { OWNERSHIP_FIELDS } from "../model/section-completeness";
import { BookDateField } from "./book-date-field";
import { DeliveryServiceAutocomplete } from "./delivery-service-autocomplete";
import { FormSection } from "./form-section";
import { StatusChipGroup } from "./status-chip-group";
import { StoreAutocomplete } from "./store-autocomplete";
import { useSectionCompletion } from "./use-section-completion";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const;
const PRICE_MAX = 1000000;

type OwnershipNoteFieldProps = {
  error?: { message?: string };
  id: string;
  label: string;
  name: OwnershipNoteName;
  placeholder: string;
  register: UseFormRegister<CreateBookFormValues>;
};

type OwnershipNoteName = "deliveryInfo.note" | "loanInfo.note";

type OwnershipStatusSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  loanContact: LoanContactSelection | null;
  mode: BookFormMode;
  onLoanContactChange: (selection: LoanContactSelection | null) => void;
  onRequestChange?: (next: OwnershipStatus, apply: () => void) => void;
  register: UseFormRegister<CreateBookFormValues>;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function OwnershipStatusSection({
  control,
  errors,
  loanContact,
  mode,
  onLoanContactChange,
  onRequestChange,
  register,
  setValue,
}: OwnershipStatusSectionProps) {
  const t = useTranslations("books");
  const tContactPicker = useTranslations("loans.contactPicker");
  const status = useWatch({ control, name: "ownershipStatus" }) ?? "none";
  const isShipped = useWatch({ control, name: "deliveryInfo.isShipped" }) === true;
  const [additionalDeliveryOpen, setAdditionalDeliveryOpen] = useState(false);
  const [creatingContactName, setCreatingContactName] = useState<null | string>(null);
  const complete = useSectionCompletion(control, OWNERSHIP_FIELDS);
  const loanContactError = toPersonPickerError(
    errors.loanInfo?.loanContactId ?? errors.loanInfo?.personName,
    tContactPicker("required"),
  );

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("ownershipStatus.description")}
      icon="package"
      title={t("ownershipStatus.title")}
    >
      <Controller
        control={control}
        name="ownershipStatus"
        render={({ field }) => (
          <StatusChipGroup
            label={t("ownershipStatus.title")}
            onValueChange={(next) => {
              const apply = () => field.onChange(next);
              if (onRequestChange) onRequestChange(next as OwnershipStatus, apply);
              else apply();
            }}
            options={OWNERSHIP_STATUS_OPTIONS.map((value) => {
              const entry = ownershipStatuses.find((item) => item.value === value);
              return {
                icon: entry ? <UiIcon name={entry.icon} /> : undefined,
                label: t(`ownershipStatus.options.${value}`),
                value,
              };
            })}
            value={field.value ?? "none"}
          />
        )}
      />

      {ownershipUsesDelivery(status) ? (
        <div
          className={
            mode === "create"
              ? "flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1 sm:grid sm:grid-cols-12"
              : "flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1"
          }
        >
          <p className="text-sm font-medium text-foreground sm:col-span-12">
            {mode === "create" ? t("deliveryInfo.orderDetails") : t("deliveryInfo.title")}
          </p>

          <div
            className={
              mode === "create" ? "flex flex-col gap-2 sm:col-span-7" : "flex flex-col gap-2"
            }
          >
            <Label htmlFor="delivery-store-name">{t("deliveryInfo.fields.storeName")}</Label>
            <Controller
              control={control}
              name="deliveryInfo.storeName"
              render={({ field }) => (
                <StoreAutocomplete
                  describedBy={
                    errors.deliveryInfo?.storeName ? "delivery-store-name-error" : undefined
                  }
                  id="delivery-store-name"
                  invalid={errors.deliveryInfo?.storeName !== undefined}
                  label={t("deliveryInfo.fields.storeName")}
                  onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                  placeholder={t("purchaseInfo.fields.storeNamePlaceholder")}
                  value={typeof field.value === "string" ? field.value : ""}
                />
              )}
            />
            <FieldError error={errors.deliveryInfo?.storeName} id="delivery-store-name-error" />
          </div>

          {mode === "edit" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-service">{t("deliveryInfo.fields.deliveryService")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.deliveryService"
                render={({ field }) => (
                  <DeliveryServiceAutocomplete
                    describedBy={
                      errors.deliveryInfo?.deliveryService ? "delivery-service-error" : undefined
                    }
                    id="delivery-service"
                    invalid={errors.deliveryInfo?.deliveryService !== undefined}
                    label={t("deliveryInfo.fields.deliveryService")}
                    onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                    placeholder={t("deliveryInfo.fields.deliveryServicePlaceholder")}
                    value={typeof field.value === "string" ? field.value : ""}
                  />
                )}
              />
              <FieldError
                error={errors.deliveryInfo?.deliveryService}
                id="delivery-service-error"
              />
            </div>
          ) : null}

          <div
            className={
              mode === "create"
                ? "flex flex-col gap-3 sm:col-span-5 sm:flex-row"
                : "flex flex-col gap-3 sm:flex-row"
            }
          >
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-order-number">{t("deliveryInfo.fields.orderNumber")}</Label>
              <Input
                aria-invalid={errors.deliveryInfo?.orderNumber !== undefined}
                autoComplete="off"
                className="h-10"
                id="delivery-order-number"
                placeholder={t("deliveryInfo.fields.orderNumberPlaceholder")}
                {...register("deliveryInfo.orderNumber", { setValueAs: emptyToUndefined })}
              />
              <FieldError
                error={errors.deliveryInfo?.orderNumber}
                id="delivery-order-number-error"
              />
            </div>

            {mode === "edit" ? (
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="delivery-tracking-number">
                  {t("deliveryInfo.fields.trackingNumber")}
                </Label>
                <Input
                  aria-invalid={errors.deliveryInfo?.trackingNumber !== undefined}
                  autoComplete="off"
                  className="h-10"
                  id="delivery-tracking-number"
                  placeholder={t("deliveryInfo.fields.trackingNumberPlaceholder")}
                  {...register("deliveryInfo.trackingNumber", { setValueAs: emptyToUndefined })}
                />
                <FieldError
                  error={errors.deliveryInfo?.trackingNumber}
                  id="delivery-tracking-number-error"
                />
              </div>
            ) : null}
          </div>

          <div
            className={
              mode === "create"
                ? "flex flex-col gap-3 sm:col-span-5 sm:flex-row"
                : "flex flex-col gap-3 sm:flex-row"
            }
          >
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-order-date">{t("deliveryInfo.fields.orderDate")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.orderDate"
                render={({ field }) => (
                  <BookDateField
                    ariaLabel={t("deliveryInfo.fields.orderDate")}
                    className={mode === "create" ? "h-10" : undefined}
                    describedBy={
                      errors.deliveryInfo?.orderDate ? "delivery-order-date-error" : undefined
                    }
                    id="delivery-order-date"
                    invalid={errors.deliveryInfo?.orderDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.deliveryInfo?.orderDate} id="delivery-order-date-error" />
            </div>

            {mode === "edit" ? (
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="delivery-expected-date">
                  {t("deliveryInfo.fields.expectedDeliveryDate")}
                </Label>
                <Controller
                  control={control}
                  name="deliveryInfo.expectedDeliveryDate"
                  render={({ field }) => (
                    <BookDateField
                      allowFuture
                      ariaLabel={t("deliveryInfo.fields.expectedDeliveryDate")}
                      describedBy={
                        errors.deliveryInfo?.expectedDeliveryDate
                          ? "delivery-expected-date-error"
                          : undefined
                      }
                      id="delivery-expected-date"
                      invalid={errors.deliveryInfo?.expectedDeliveryDate !== undefined}
                      onChange={field.onChange}
                      placeholder={t("ownershipStatus.fields.datePlaceholder")}
                      value={field.value}
                    />
                  )}
                />
                <FieldError
                  error={errors.deliveryInfo?.expectedDeliveryDate}
                  id="delivery-expected-date-error"
                />
              </div>
            ) : null}
          </div>

          <div
            className={
              mode === "create"
                ? "flex flex-col gap-3 sm:col-span-7 sm:grid sm:grid-cols-2"
                : "flex flex-col gap-3 sm:flex-row"
            }
          >
            <div
              className={mode === "create" ? "flex flex-col gap-2" : "flex flex-1 flex-col gap-2"}
            >
              <Label htmlFor="delivery-price">{t("deliveryInfo.fields.price")}</Label>
              <Input
                aria-invalid={errors.deliveryInfo?.price !== undefined}
                className="h-10"
                id="delivery-price"
                inputMode="decimal"
                min={0}
                onKeyDown={blockNegativeNumberKeys}
                onPaste={blockNegativeNumberPaste}
                placeholder="0"
                step="0.01"
                type="number"
                {...register("deliveryInfo.price", {
                  setValueAs: (value) => {
                    if (typeof value !== "string" || value.trim().length === 0) return undefined;
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? Math.min(parsed, PRICE_MAX) : undefined;
                  },
                })}
              />
              <FieldError error={errors.deliveryInfo?.price} id="delivery-price-error" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-currency">{t("deliveryInfo.fields.currency")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.currency"
                render={({ field }) => (
                  <div className={mode === "create" ? "w-full" : "w-full sm:w-28"}>
                    <Select
                      onValueChange={field.onChange}
                      value={typeof field.value === "string" ? field.value : undefined}
                    >
                      <SelectTrigger
                        className="h-10 w-full data-[size=default]:h-10"
                        id="delivery-currency"
                        isClearable={typeof field.value === "string"}
                        onClear={() => field.onChange(undefined)}
                      >
                        <SelectValue placeholder={t("deliveryInfo.fields.currencyPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>
          </div>

          {mode === "create" ? (
            <div className="flex flex-col gap-4 border-t border-border pt-4 sm:col-span-12">
              <p className="text-sm font-medium text-foreground">{t("deliveryInfo.delivery")}</p>
              <div className="flex flex-col gap-2">
                <Label>{t("deliveryInfo.shippedQuestion")}</Label>
                <Controller
                  control={control}
                  name="deliveryInfo.isShipped"
                  render={({ field }) => (
                    <Segmented
                      block
                      label={t("deliveryInfo.shippedQuestion")}
                      onValueChange={(value) => {
                        const shipped = value === "yes";
                        field.onChange(shipped);
                        setValue(
                          "deliveryInfo.deliveryStatus",
                          shipped ? "in_transit" : "ordered",
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                        if (!shipped) {
                          setAdditionalDeliveryOpen(false);
                          setValue("deliveryInfo.deliveryService", undefined);
                          setValue("deliveryInfo.expectedDeliveryDate", undefined);
                          setValue("deliveryInfo.note", undefined);
                          setValue("deliveryInfo.trackingNumber", undefined);
                          setValue("deliveryInfo.trackingUrl", undefined);
                        }
                      }}
                      options={(["no", "yes"] as const).map((value) => ({
                        label: t(`deliveryInfo.shippedOptions.${value}`),
                        value,
                      }))}
                      value={field.value === true ? "yes" : "no"}
                    />
                  )}
                />
              </div>

              {isShipped ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="delivery-service">
                      {t("deliveryInfo.fields.deliveryService")}
                    </Label>
                    <Controller
                      control={control}
                      name="deliveryInfo.deliveryService"
                      render={({ field }) => (
                        <DeliveryServiceAutocomplete
                          describedBy={
                            errors.deliveryInfo?.deliveryService
                              ? "delivery-service-error"
                              : undefined
                          }
                          id="delivery-service"
                          invalid={errors.deliveryInfo?.deliveryService !== undefined}
                          label={t("deliveryInfo.fields.deliveryService")}
                          onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                          placeholder={t("deliveryInfo.fields.deliveryServicePlaceholder")}
                          value={typeof field.value === "string" ? field.value : ""}
                        />
                      )}
                    />
                    <FieldError
                      error={errors.deliveryInfo?.deliveryService}
                      id="delivery-service-error"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor="delivery-tracking-number">
                        {t("deliveryInfo.fields.trackingNumber")}
                      </Label>
                      <Input
                        aria-invalid={errors.deliveryInfo?.trackingNumber !== undefined}
                        autoComplete="off"
                        className="h-10"
                        id="delivery-tracking-number"
                        placeholder={t("deliveryInfo.fields.trackingNumberPlaceholder")}
                        {...register("deliveryInfo.trackingNumber", {
                          setValueAs: emptyToUndefined,
                        })}
                      />
                      <FieldError
                        error={errors.deliveryInfo?.trackingNumber}
                        id="delivery-tracking-number-error"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor="delivery-expected-date">
                        {t("deliveryInfo.fields.expectedDeliveryDate")}
                      </Label>
                      <Controller
                        control={control}
                        name="deliveryInfo.expectedDeliveryDate"
                        render={({ field }) => (
                          <BookDateField
                            allowFuture
                            ariaLabel={t("deliveryInfo.fields.expectedDeliveryDate")}
                            className="h-10"
                            describedBy={
                              errors.deliveryInfo?.expectedDeliveryDate
                                ? "delivery-expected-date-error"
                                : undefined
                            }
                            id="delivery-expected-date"
                            invalid={errors.deliveryInfo?.expectedDeliveryDate !== undefined}
                            onChange={field.onChange}
                            placeholder={t("ownershipStatus.fields.datePlaceholder")}
                            value={field.value}
                          />
                        )}
                      />
                      <FieldError
                        error={errors.deliveryInfo?.expectedDeliveryDate}
                        id="delivery-expected-date-error"
                      />
                    </div>
                  </div>

                  <Collapsible
                    className="flex flex-col gap-3"
                    onOpenChange={setAdditionalDeliveryOpen}
                    open={additionalDeliveryOpen}
                  >
                    <CollapsibleTrigger className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                      {t("deliveryInfo.additional")}
                      <UiIcon
                        className="transition-transform group-data-[state=open]:rotate-180"
                        name="chevron-down"
                        size={16}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="delivery-tracking-url">
                          {t("deliveryInfo.fields.trackingUrl")}
                        </Label>
                        <Input
                          aria-describedby={
                            errors.deliveryInfo?.trackingUrl
                              ? "delivery-tracking-url-error"
                              : undefined
                          }
                          aria-invalid={errors.deliveryInfo?.trackingUrl !== undefined}
                          autoComplete="off"
                          className="h-10"
                          id="delivery-tracking-url"
                          inputMode="url"
                          placeholder={t("deliveryInfo.fields.trackingUrlPlaceholder")}
                          {...register("deliveryInfo.trackingUrl", {
                            setValueAs: emptyToUndefined,
                          })}
                        />
                        <FieldError
                          error={errors.deliveryInfo?.trackingUrl}
                          id="delivery-tracking-url-error"
                        />
                      </div>
                      <OwnershipNoteField
                        error={errors.deliveryInfo?.note}
                        id="delivery-note"
                        label={t("ownershipStatus.fields.note")}
                        name="deliveryInfo.note"
                        placeholder={t("ownershipStatus.fields.notePlaceholder")}
                        register={register}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-tracking-url">{t("deliveryInfo.fields.trackingUrl")}</Label>
              <Input
                aria-describedby={
                  errors.deliveryInfo?.trackingUrl ? "delivery-tracking-url-error" : undefined
                }
                aria-invalid={errors.deliveryInfo?.trackingUrl !== undefined}
                autoComplete="off"
                className="h-10"
                id="delivery-tracking-url"
                inputMode="url"
                placeholder={t("deliveryInfo.fields.trackingUrlPlaceholder")}
                {...register("deliveryInfo.trackingUrl", { setValueAs: emptyToUndefined })}
              />
              <FieldError
                error={errors.deliveryInfo?.trackingUrl}
                id="delivery-tracking-url-error"
              />
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-status">{t("deliveryInfo.fields.deliveryStatus")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.deliveryStatus"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={typeof field.value === "string" ? field.value : undefined}
                  >
                    <SelectTrigger
                      className="h-10 w-full data-[size=default]:h-10"
                      id="delivery-status"
                      isClearable={typeof field.value === "string"}
                      onClear={() => field.onChange(undefined)}
                    >
                      <SelectValue
                        placeholder={t("deliveryInfo.fields.deliveryStatusPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {EDIT_DELIVERY_STATUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`deliveryStatus.labels.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          {mode === "edit" ? (
            <OwnershipNoteField
              error={errors.deliveryInfo?.note}
              id="delivery-note"
              label={t("ownershipStatus.fields.note")}
              name="deliveryInfo.note"
              placeholder={t("ownershipStatus.fields.notePlaceholder")}
              register={register}
            />
          ) : null}

          {mode === "edit" ? (
            <Button
              className="self-start"
              onClick={() =>
                setValue("ownershipStatus", "owned", { shouldDirty: true, shouldValidate: true })
              }
              type="button"
              variant="secondary"
            >
              <UiIcon name="check" size={16} />
              {t("deliveryInfo.markReceived")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {ownershipUsesLoan(status) ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
          <p className="text-sm font-medium text-foreground">{t("loanInfo.title")}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-contact-picker">{t("loanInfo.fields.personName")}</Label>
            <LoanContactPicker
              describedBy={loanContactError ? "loan-contact-picker-error" : undefined}
              direction={ownershipLoanDirection(status)}
              id="loan-contact-picker"
              invalid={loanContactError !== undefined}
              label={t("loanInfo.fields.personName")}
              onChange={onLoanContactChange}
              onRequestCreate={setCreatingContactName}
              placeholder={t("loanInfo.fields.personNamePlaceholder")}
              value={loanContact}
            />
            <FieldError error={loanContactError} id="loan-contact-picker-error" />
            <CreateLoanContactDialog
              conflictAction="select"
              initialName={creatingContactName ?? ""}
              onOpenChange={(next) => {
                if (!next) setCreatingContactName(null);
              }}
              onResolved={({ contact }) => {
                setCreatingContactName(null);
                onLoanContactChange({ contactId: contact.id, kind: "picked", name: contact.name });
              }}
              open={creatingContactName !== null}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="loan-date">{t("loanInfo.fields.loanDate")}</Label>
              <Controller
                control={control}
                name="loanInfo.loanDate"
                render={({ field }) => (
                  <BookDateField
                    ariaLabel={t("loanInfo.fields.loanDate")}
                    describedBy={errors.loanInfo?.loanDate ? "loan-date-error" : undefined}
                    id="loan-date"
                    invalid={errors.loanInfo?.loanDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.loanInfo?.loanDate} id="loan-date-error" />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="loan-return-date">{t("loanInfo.fields.expectedReturnDate")}</Label>
              <Controller
                control={control}
                name="loanInfo.expectedReturnDate"
                render={({ field }) => (
                  <BookDateField
                    allowFuture
                    ariaLabel={t("loanInfo.fields.expectedReturnDate")}
                    describedBy={
                      errors.loanInfo?.expectedReturnDate ? "loan-return-date-error" : undefined
                    }
                    id="loan-return-date"
                    invalid={errors.loanInfo?.expectedReturnDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.loanInfo?.expectedReturnDate} id="loan-return-date-error" />
            </div>
          </div>

          <OwnershipNoteField
            error={errors.loanInfo?.note}
            id="loan-note"
            label={t("ownershipStatus.fields.note")}
            name="loanInfo.note"
            placeholder={t("ownershipStatus.fields.notePlaceholder")}
            register={register}
          />
        </div>
      ) : null}
    </FormSection>
  );
}

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function OwnershipNoteField({
  error,
  id,
  label,
  name,
  placeholder,
  register,
}: OwnershipNoteFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        aria-invalid={error !== undefined}
        id={id}
        maxLength={300}
        placeholder={placeholder}
        {...register(name, { setValueAs: emptyToUndefined })}
      />
      {error?.message ? (
        <p className="text-xs text-destructive" id={`${id}-error`} role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function toPersonPickerError(
  error: RhfFieldError | undefined,
  requiredMessage: string,
): RhfFieldError | undefined {
  if (error === undefined || error.message !== LOAN_PERSON_REQUIRED_MESSAGE) return error;
  return { ...error, message: requiredMessage };
}

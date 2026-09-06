import type {
  BookFormat,
  LoanDirection,
  OwnershipStatus,
  ReadingStatus,
  ShipmentStatus,
} from "@app/shared";

type StatusPayload = {
  deliveryInfo?: unknown;
  loanInfo?: unknown;
  ownershipStatus: OwnershipStatus;
  purchaseInfo?: unknown;
  readingProgress?: Partial<Record<ReadingProgressField, unknown>>;
  readingStatus: ReadingStatus;
};

export const READING_STATUS_OPTIONS = [
  "not_started",
  "want_to_read",
  "reading",
  "paused",
  "finished",
  "dnf",
  "rereading",
] as const satisfies readonly ReadingStatus[];

export const OWNERSHIP_STATUS_OPTIONS = [
  "none",
  "want_to_buy",
  "in_transit",
  "owned",
  "borrowed_from_someone",
  "lent_to_someone",
] as const satisfies readonly OwnershipStatus[];

export const FORMAT_OPTIONS = [
  "paper",
  "ebook",
  "audiobook",
] as const satisfies readonly BookFormat[];

export const EDIT_DELIVERY_STATUS_OPTIONS = [
  "ordered",
  "in_transit",
  "ready_for_pickup",
] as const satisfies readonly ShipmentStatus[];

type ReadingProgressField =
  | "abandonedAt"
  | "currentPage"
  | "finishedAt"
  | "impression"
  | "note"
  | "pausedAt"
  | "rating"
  | "startedAt";

const READING_PROGRESS_FIELDS: Record<ReadingStatus, readonly ReadingProgressField[]> = {
  dnf: ["currentPage", "abandonedAt", "note"],
  finished: ["rating", "finishedAt", "impression"],
  not_started: [],
  paused: ["currentPage", "pausedAt", "note"],
  reading: ["currentPage", "startedAt", "note"],
  rereading: ["currentPage", "startedAt", "note"],
  want_to_read: [],
};

export function ownershipBlockHasData(
  status: OwnershipStatus,
  block: Record<string, unknown> | undefined,
): boolean {
  if (block === undefined) return false;
  const keys = activeOwnershipKeys(status);
  return keys.some((key) => hasMeaningfulValue(block[key]));
}

export function ownershipLoanDirection(status: OwnershipStatus): LoanDirection {
  return status === "lent_to_someone" ? "lent" : "borrowed";
}

export function ownershipUsesDelivery(status: OwnershipStatus): boolean {
  return status === "in_transit";
}

export function ownershipUsesLoan(status: OwnershipStatus): boolean {
  return status === "borrowed_from_someone" || status === "lent_to_someone";
}

export function pruneStatusPayload<T extends StatusPayload>(values: T): T {
  const { ownershipStatus } = values;
  return {
    ...values,
    deliveryInfo: ownershipUsesDelivery(ownershipStatus) ? values.deliveryInfo : {},
    loanInfo: ownershipUsesLoan(ownershipStatus) ? values.loanInfo : {},
    purchaseInfo: ownershipUsesPurchase(ownershipStatus) ? values.purchaseInfo : {},
    readingProgress: pickReadingProgress(values),
  };
}

export function readingProgressFieldsFor(status: ReadingStatus): readonly ReadingProgressField[] {
  return READING_PROGRESS_FIELDS[status];
}

export function readingProgressHasData(
  status: ReadingStatus,
  progress: Partial<Record<ReadingProgressField, unknown>> | undefined,
): boolean {
  const fields = readingProgressFieldsFor(status);
  if (fields.length === 0 || progress === undefined) return false;
  return fields.some((field) => hasMeaningfulValue(progress[field]));
}

function activeOwnershipKeys(status: OwnershipStatus): readonly string[] {
  if (ownershipUsesPurchase(status)) return ["storeName", "storeUrl", "expectedPrice", "currency"];
  if (ownershipUsesDelivery(status))
    return [
      "storeName",
      "orderNumber",
      "orderDate",
      "expectedDeliveryDate",
      "deliveryStatus",
      "note",
    ];
  if (ownershipUsesLoan(status)) return ["loanContactId", "loanDate", "expectedReturnDate", "note"];
  return [];
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  return Boolean(value);
}

function ownershipUsesPurchase(status: OwnershipStatus): boolean {
  return status === "want_to_buy";
}

function pickReadingProgress(values: StatusPayload): Record<string, unknown> {
  const fields = readingProgressFieldsFor(values.readingStatus);
  if (fields.length === 0) return {};
  const source = values.readingProgress ?? {};
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = source[field];
    if (value !== undefined && value !== null) result[field] = value;
  }
  return result;
}

import type {
  BookOrderDerivedStatus,
  Currency,
  CurrencyAverage,
  CurrencyTotal,
  Nullable,
  OrderFinancialSummary,
  OrderTotalSource,
  ShipmentStatus,
} from "@app/shared";

import {
  BookOrderDerivedStatusSchema,
  CurrencySchema,
  DEFAULT_CURRENCY,
  isActiveShipmentStatus,
  OrderTotalSourceSchema,
  resolveOrderFinancials,
} from "@app/shared";

import { fromMinorUnits, toMinorUnits } from "./money-minor-units.js";
import { computeBookOrderDerivedStatus } from "./order-derived-status.js";

export const ORDER_ENUMS = Object.freeze({
  derivedStatus: BookOrderDerivedStatusSchema.enum,
  totalSource: OrderTotalSourceSchema.enum,
});

const CURRENCY_ORDER: readonly Currency[] = CurrencySchema.options;

export type AmountAccumulator = Map<Currency, { count: number; sum: number }>;

export type ClassifiedOrder = {
  amount: Nullable<number>;
  componentSubtotal: Nullable<number>;
  countedItems: OrderStatisticsItemRecord[];
  currency: Currency;
  derivedStatus: BookOrderDerivedStatus;
  isIncluded: boolean;
  reconciliationAdjustment: Nullable<number>;
  record: OrderStatisticsRecord;
  totalSource: OrderTotalSource;
};

export type CoverageAccumulator = Map<Currency, { covered: number; total: number }>;

export type OrderStatisticsItemRecord = {
  bookId: string;
  bookTitle: string;
  cancelledAt: Nullable<Date>;
  id: string;
  price: Nullable<number>;
  receivedAt: Nullable<Date>;
  shipmentId: Nullable<string>;
};

export type OrderStatisticsRecord = {
  currency: Nullable<Currency>;
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  id: string;
  isFree: boolean;
  items: OrderStatisticsItemRecord[];
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  shipments: OrderStatisticsShipmentRecord[];
  storeName: string;
  totalAmount: Nullable<number>;
};

export type OrderStatisticsShipmentRecord = {
  cancelledAt: Nullable<Date>;
  id: string;
  receivedAt: Nullable<Date>;
  status: ShipmentStatus;
};

type ResolvedOrderTotal = {
  amount: Nullable<number>;
  componentSubtotal: Nullable<number>;
  reconciliationAdjustment: Nullable<number>;
  source: OrderTotalSource;
};

export function addAmount({
  accumulator,
  amount,
  currency,
}: {
  accumulator: AmountAccumulator;
  amount: number;
  currency: Currency;
}): void {
  const current = accumulator.get(currency) ?? { count: 0, sum: 0 };
  accumulator.set(currency, { count: current.count + 1, sum: current.sum + amount });
}

export function addCoverage({
  accumulator,
  currency,
  isCovered,
}: {
  accumulator: CoverageAccumulator;
  currency: Currency;
  isCovered: boolean;
}): void {
  const current = accumulator.get(currency) ?? { covered: 0, total: 0 };
  accumulator.set(currency, {
    covered: current.covered + (isCovered ? 1 : 0),
    total: current.total + 1,
  });
}

export function addItemPrices({
  accumulator,
  order,
}: {
  accumulator: AmountAccumulator;
  order: ClassifiedOrder;
}): void {
  for (const item of order.countedItems) {
    if (item.price === null) {
      continue;
    }
    addAmount({ accumulator, amount: item.price, currency: order.currency });
  }
}

export function addOrderAmount({
  accumulator,
  order,
}: {
  accumulator: AmountAccumulator;
  order: ClassifiedOrder;
}): void {
  if (order.amount === null) {
    return;
  }
  addAmount({ accumulator, amount: order.amount, currency: order.currency });
}

export function averagesFromAmounts(accumulator: AmountAccumulator): CurrencyAverage[] {
  const result: CurrencyAverage[] = [];
  for (const currency of CURRENCY_ORDER) {
    const amounts = accumulator.get(currency);
    if (amounts === undefined) {
      continue;
    }
    result.push({ average: amounts.sum / amounts.count, currency });
  }
  return result;
}

export function carriesActiveItem({
  order,
  shipment,
}: {
  order: ClassifiedOrder;
  shipment: OrderStatisticsShipmentRecord;
}): boolean {
  return order.record.items.some((item) => item.shipmentId === shipment.id && isActiveItem(item));
}

export function classifyOrder({
  includeCancelled,
  record,
}: {
  includeCancelled: boolean;
  record: OrderStatisticsRecord;
}): ClassifiedOrder {
  const derivedStatus = computeBookOrderDerivedStatus({
    items: record.items,
    shipments: record.shipments,
  });
  const countedItems = includeCancelled
    ? record.items
    : record.items.filter((item) => item.cancelledAt === null);
  const { amount, componentSubtotal, reconciliationAdjustment, source } = resolveOrderTotal({
    countedItems,
    record,
  });

  return {
    amount,
    componentSubtotal,
    countedItems,
    currency: effectiveCurrency(record.currency),
    derivedStatus,
    isIncluded: includeCancelled || derivedStatus !== ORDER_ENUMS.derivedStatus.cancelled,
    reconciliationAdjustment,
    record,
    totalSource: source,
  };
}

export function countActiveShipments(orders: ClassifiedOrder[]): number {
  return orders.reduce(
    (count, order) =>
      count +
      order.record.shipments.filter(
        (shipment) =>
          isActiveShipmentStatus(shipment.status) && carriesActiveItem({ order, shipment }),
      ).length,
    0,
  );
}

export function countItems({
  orders,
  predicate,
}: {
  orders: ClassifiedOrder[];
  predicate: (item: OrderStatisticsItemRecord) => boolean;
}): number {
  return orders.reduce((count, order) => count + order.countedItems.filter(predicate).length, 0);
}

export function coverageRows(accumulator: CoverageAccumulator): {
  covered: number;
  currency: Currency;
  total: number;
}[] {
  return CURRENCY_ORDER.flatMap((currency) => {
    const counts = accumulator.get(currency);
    return counts === undefined ? [] : [{ covered: counts.covered, currency, total: counts.total }];
  });
}

export function isActiveItem(item: OrderStatisticsItemRecord): boolean {
  return item.cancelledAt === null && item.receivedAt === null;
}

export function isReceivedItem(item: OrderStatisticsItemRecord): boolean {
  return item.receivedAt !== null;
}

export function totalsFromAmounts(accumulator: AmountAccumulator): CurrencyTotal[] {
  const result: CurrencyTotal[] = [];
  for (const currency of CURRENCY_ORDER) {
    const amounts = accumulator.get(currency);
    if (amounts === undefined) {
      continue;
    }
    result.push({ currency, total: amounts.sum });
  }
  return result;
}

function effectiveCurrency(currency: Nullable<Currency>): Currency {
  return currency ?? DEFAULT_CURRENCY;
}

function reconciliationAdjustment({
  componentSubtotal,
  summary,
}: {
  componentSubtotal: Nullable<number>;
  summary: OrderFinancialSummary;
}): Nullable<number> {
  if (componentSubtotal === null || summary.effectiveTotalAmount === null) {
    return null;
  }
  const componentTotalMinorUnits =
    toMinorUnits(componentSubtotal) +
    toMinorUnits(summary.deliveryPrice) -
    toMinorUnits(summary.discount);

  return fromMinorUnits(toMinorUnits(summary.effectiveTotalAmount) - componentTotalMinorUnits);
}

function resolveOrderTotal({
  countedItems,
  record,
}: {
  countedItems: OrderStatisticsItemRecord[];
  record: OrderStatisticsRecord;
}): ResolvedOrderTotal {
  if (countedItems.length === 0 && record.totalAmount === null) {
    return {
      amount: null,
      componentSubtotal: null,
      reconciliationAdjustment: null,
      source: ORDER_ENUMS.totalSource.unknown,
    };
  }

  const summary = resolveOrderFinancials({
    deliveryPrice: record.deliveryPrice,
    discount: record.discount,
    isFree: record.isFree,
    itemPrices: record.items.map((item) => item.price),
    totalAmount: record.totalAmount,
  });
  const componentSubtotal = summary.isItemBreakdownComplete ? summary.itemsSubtotal : null;

  return {
    amount: summary.effectiveTotalAmount,
    componentSubtotal,
    reconciliationAdjustment: reconciliationAdjustment({ componentSubtotal, summary }),
    source: summary.totalSource,
  };
}

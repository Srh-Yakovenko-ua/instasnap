import { describe, expect, it } from "vitest";

import type { DeliveryAdvancedState, DeliveryQueryState } from "./in-transit-params";

import {
  countActiveDeliveryDimensions,
  DELIVERY_ADVANCED_EMPTY,
  DELIVERY_FILTER_DEFAULT,
  DELIVERY_PAGE_SIZE,
  DELIVERY_SORT_DEFAULT,
  hasActiveDeliveryFilters,
  hasInvalidDeliveryRange,
  resolveDeliveryPriceCurrency,
  toDeliveryListParams,
} from "./in-transit-params";

function advanced(overrides: Partial<DeliveryAdvancedState> = {}): DeliveryAdvancedState {
  return { ...DELIVERY_ADVANCED_EMPTY, ...overrides };
}

function state(overrides: Partial<DeliveryQueryState> = {}): DeliveryQueryState {
  return {
    ...DELIVERY_ADVANCED_EMPTY,
    filter: DELIVERY_FILTER_DEFAULT,
    q: "",
    sort: DELIVERY_SORT_DEFAULT,
    ...overrides,
  };
}

describe("counting the active advanced dimensions", () => {
  it("counts nothing on an untouched panel", () => {
    expect(countActiveDeliveryDimensions(advanced())).toBe(0);
  });

  it("counts a multiselect once however many values it holds", () => {
    expect(countActiveDeliveryDimensions(advanced({ store: ["Yakaboo"] }))).toBe(1);
    expect(
      countActiveDeliveryDimensions(advanced({ store: ["Yakaboo", "Book24", "Amazon"] })),
    ).toBe(1);
  });

  it("counts a range once whether one bound is filled or both", () => {
    expect(countActiveDeliveryDimensions(advanced({ booksMin: 2 }))).toBe(1);
    expect(countActiveDeliveryDimensions(advanced({ booksMax: 5, booksMin: 2 }))).toBe(1);
  });

  it("counts currency and the order total as two separate dimensions", () => {
    expect(countActiveDeliveryDimensions(advanced({ currency: ["UAH"], priceMin: 100 }))).toBe(2);
  });

  it("counts the order total once whether it carries one bound or both", () => {
    expect(countActiveDeliveryDimensions(advanced({ currency: ["UAH"], priceMin: 100 }))).toBe(2);
    expect(
      countActiveDeliveryDimensions(advanced({ currency: ["UAH"], priceMax: 500, priceMin: 100 })),
    ).toBe(2);
  });

  it("leaves the total range uncounted while it cannot apply", () => {
    expect(
      countActiveDeliveryDimensions(advanced({ currency: ["UAH", "EUR"], priceMin: 100 })),
    ).toBe(1);
  });

  it("treats an advanced dimension as an active filter of the page", () => {
    expect(hasActiveDeliveryFilters(state())).toBe(false);
    expect(hasActiveDeliveryFilters(state({ structure: ["no_shipment"] }))).toBe(true);
  });
});

describe("gating the order total range on a single currency", () => {
  it("names the currency when exactly one is chosen and a bound is set", () => {
    expect(resolveDeliveryPriceCurrency(advanced({ currency: ["EUR"], priceMax: 90 }))).toBe("EUR");
  });

  it("names nothing when no currency, several currencies or no bound", () => {
    expect(resolveDeliveryPriceCurrency(advanced({ priceMin: 100 }))).toBeNull();
    expect(
      resolveDeliveryPriceCurrency(advanced({ currency: ["UAH", "USD"], priceMin: 100 })),
    ).toBeNull();
    expect(resolveDeliveryPriceCurrency(advanced({ currency: ["UAH"] }))).toBeNull();
  });

  it("names nothing when the range reads backwards", () => {
    expect(
      resolveDeliveryPriceCurrency(advanced({ currency: ["UAH"], priceMax: 10, priceMin: 100 })),
    ).toBeNull();
  });
});

describe("spotting a backwards range", () => {
  it("accepts a half-open range", () => {
    expect(hasInvalidDeliveryRange(advanced({ orderedFrom: "2026-08-01" }))).toBe(false);
    expect(hasInvalidDeliveryRange(advanced({ booksMax: 4 }))).toBe(false);
  });

  it("rejects a start that sits past its end", () => {
    expect(
      hasInvalidDeliveryRange(advanced({ orderedFrom: "2026-08-10", orderedTo: "2026-08-01" })),
    ).toBe(true);
    expect(hasInvalidDeliveryRange(advanced({ booksMax: 1, booksMin: 4 }))).toBe(true);
  });
});

describe("turning the page state into request params", () => {
  it("sends the quick filter, sort and page size on an untouched page", () => {
    expect(toDeliveryListParams(state())).toEqual({
      currency: [],
      filter: DELIVERY_FILTER_DEFAULT,
      pageSize: DELIVERY_PAGE_SIZE,
      service: [],
      sort: DELIVERY_SORT_DEFAULT,
      store: [],
      structure: [],
    });
  });

  it("carries every advanced dimension alongside the quick filter and the search", () => {
    const params = toDeliveryListParams(
      state({
        booksMax: 5,
        booksMin: 2,
        currency: ["UAH"],
        expectedFrom: "2026-08-01",
        expectedTo: "2026-08-31",
        filter: "delayed",
        orderedFrom: "2026-07-01",
        priceMin: 250,
        q: "  dune  ",
        service: ["Nova Poshta"],
        store: ["Yakaboo", "Book24"],
        structure: ["multiple_shipments"],
      }),
    );

    expect(params).toMatchObject({
      booksMax: 5,
      booksMin: 2,
      currency: ["UAH"],
      expectedFrom: "2026-08-01",
      expectedTo: "2026-08-31",
      filter: "delayed",
      orderedFrom: "2026-07-01",
      priceCurrency: "UAH",
      priceMin: 250,
      search: "dune",
      service: ["Nova Poshta"],
      store: ["Yakaboo", "Book24"],
      structure: ["multiple_shipments"],
    });
  });

  it("holds back a backwards range instead of asking the server for nothing", () => {
    const params = toDeliveryListParams(
      state({ booksMax: 1, booksMin: 9, orderedFrom: "2026-08-10", orderedTo: "2026-08-01" }),
    );

    expect(params.booksMin).toBeUndefined();
    expect(params.booksMax).toBeUndefined();
    expect(params.orderedFrom).toBeUndefined();
    expect(params.orderedTo).toBeUndefined();
  });

  it("holds back the total range until one currency gates it", () => {
    const params = toDeliveryListParams(state({ currency: ["UAH", "EUR"], priceMin: 100 }));

    expect(params.priceCurrency).toBeUndefined();
    expect(params.priceMin).toBeUndefined();
    expect(params.currency).toEqual(["UAH", "EUR"]);
  });
});

describe("the age bucket arriving from the statistics page", () => {
  it("counts as one active dimension", () => {
    expect(countActiveDeliveryDimensions(advanced({ ageBucket: "31_plus" }))).toBe(1);
    expect(hasActiveDeliveryFilters(state({ ageBucket: "31_plus" }))).toBe(true);
  });

  it("reaches the server as it was written in the URL", () => {
    expect(toDeliveryListParams(state({ ageBucket: "0_7" })).ageBucket).toBe("0_7");
  });

  it("stays out of the request while no bucket is chosen", () => {
    expect(toDeliveryListParams(state()).ageBucket).toBeUndefined();
  });

  it("never turns into the delayed filter", () => {
    expect(toDeliveryListParams(state({ ageBucket: "31_plus" })).filter).toBe(
      DELIVERY_FILTER_DEFAULT,
    );
  });

  it("keeps the oldest-first sort the statistics page asked for", () => {
    expect(toDeliveryListParams(state({ ageBucket: "31_plus", sort: "oldest_orders" })).sort).toBe(
      "oldest_orders",
    );
  });

  it("travels alongside the store and currency filters", () => {
    const params = toDeliveryListParams(
      state({ ageBucket: "15_30", currency: ["UAH"], store: ["Yakaboo"] }),
    );

    expect(params).toMatchObject({
      ageBucket: "15_30",
      currency: ["UAH"],
      store: ["Yakaboo"],
    });
  });

  it("clears together with the other advanced filters", () => {
    expect(DELIVERY_ADVANCED_EMPTY.ageBucket).toBeNull();
  });
});

describe("the exact order filters arriving from the statistics page", () => {
  const ORDER_ID = "3f1a6b1c-2f3d-4a5b-8c9d-0e1f2a3b4c5d";

  it("reaches the server as the identity it is, not as a search term", () => {
    const params = toDeliveryListParams(state({ orderId: ORDER_ID }));

    expect(params.orderId).toBe(ORDER_ID);
    expect(params.search).toBeUndefined();
  });

  it("refuses a URL value that cannot be an order identity", () => {
    expect(toDeliveryListParams(state({ orderId: "ST-20260811-50" })).orderId).toBeUndefined();
  });

  it("carries the derived state a chart drilled down on", () => {
    expect(toDeliveryListParams(state({ orderState: "partially_shipped" })).orderState).toBe(
      "partially_shipped",
    );
  });

  it("stays out of the request while nothing pinned the list", () => {
    const params = toDeliveryListParams(state());

    expect(params.orderId).toBeUndefined();
    expect(params.orderState).toBeUndefined();
  });

  it("each counts as one dimension the reader can see and clear", () => {
    expect(countActiveDeliveryDimensions(advanced({ orderId: ORDER_ID }))).toBe(1);
    expect(countActiveDeliveryDimensions(advanced({ orderState: "shipped" }))).toBe(1);
    expect(hasActiveDeliveryFilters(state({ orderId: ORDER_ID }))).toBe(true);
  });

  it("clears together with the other advanced filters", () => {
    expect(DELIVERY_ADVANCED_EMPTY.orderId).toBeNull();
    expect(DELIVERY_ADVANCED_EMPTY.orderState).toBeNull();
  });
});

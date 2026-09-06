import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { DeliveryHistoryAdvancedState, DeliveryHistoryQueryState } from "./history-params";

import {
  countActiveHistoryDimensions,
  DELIVERY_HISTORY_ADVANCED_EMPTY,
  DELIVERY_HISTORY_PAGE_SIZE,
  DELIVERY_HISTORY_SORT_DEFAULT,
  DELIVERY_HISTORY_TAB_DEFAULT,
  deliveryHistoryParsers,
  hasActiveHistoryFilters,
  hasInvalidHistoryRange,
  resolveHistoryPriceCurrency,
  resolveHistorySort,
  toDeliveryHistoryListParams,
} from "./history-params";

const loadHistoryParams = createLoader(deliveryHistoryParsers);

function advanced(
  overrides: Partial<DeliveryHistoryAdvancedState> = {},
): DeliveryHistoryAdvancedState {
  return { ...DELIVERY_HISTORY_ADVANCED_EMPTY, ...overrides };
}

function fromUrl(search: string): DeliveryHistoryQueryState {
  return loadHistoryParams(new URLSearchParams(search));
}

function state(overrides: Partial<DeliveryHistoryQueryState> = {}): DeliveryHistoryQueryState {
  return {
    ...DELIVERY_HISTORY_ADVANCED_EMPTY,
    q: "",
    sort: DELIVERY_HISTORY_SORT_DEFAULT,
    tab: DELIVERY_HISTORY_TAB_DEFAULT,
    ...overrides,
  };
}

describe("reading a saved history URL", () => {
  it("still reads a single store, service and currency written before the multiselects", () => {
    const parsed = fromUrl("?store=Yakaboo&service=Nova%20Poshta&currency=UAH");

    expect(parsed.store).toEqual(["Yakaboo"]);
    expect(parsed.service).toEqual(["Nova Poshta"]);
    expect(parsed.currency).toEqual(["UAH"]);
  });

  it("reads several values of one dimension", () => {
    expect(fromUrl("?currency=UAH,EUR").currency).toEqual(["UAH", "EUR"]);
  });

  it("still reads the order date bounds under their old names", () => {
    const parsed = fromUrl("?from=2026-07-01&to=2026-07-31");

    expect(parsed.from).toBe("2026-07-01");
    expect(parsed.to).toBe("2026-07-31");
  });

  it("drops a currency the API no longer offers", () => {
    expect(fromUrl("?currency=GBP").currency).toEqual([]);
  });
});

describe("counting the active advanced dimensions", () => {
  it("counts nothing on an untouched panel", () => {
    expect(countActiveHistoryDimensions({ state: advanced(), tab: "received" })).toBe(0);
  });

  it("counts a multiselect once however many values it holds", () => {
    expect(
      countActiveHistoryDimensions({ state: advanced({ store: ["Yakaboo"] }), tab: "received" }),
    ).toBe(1);
    expect(
      countActiveHistoryDimensions({
        state: advanced({ store: ["Yakaboo", "Book24", "Amazon"] }),
        tab: "received",
      }),
    ).toBe(1);
  });

  it("counts a range once, whichever end is filled", () => {
    expect(
      countActiveHistoryDimensions({ state: advanced({ booksMin: 3 }), tab: "received" }),
    ).toBe(1);
    expect(
      countActiveHistoryDimensions({
        state: advanced({ booksMax: 10, booksMin: 3 }),
        tab: "received",
      }),
    ).toBe(1);
  });

  it("counts only the terminal range that belongs to the open tab", () => {
    const both = advanced({ cancelledFrom: "2026-08-01", receivedFrom: "2026-08-01" });

    expect(countActiveHistoryDimensions({ state: both, tab: "received" })).toBe(1);
    expect(countActiveHistoryDimensions({ state: both, tab: "cancelled" })).toBe(1);
  });

  it("leaves an ungated total out of the count", () => {
    expect(
      countActiveHistoryDimensions({ state: advanced({ priceMin: 100 }), tab: "received" }),
    ).toBe(0);
    expect(
      countActiveHistoryDimensions({
        state: advanced({ currency: ["UAH"], priceMin: 100 }),
        tab: "received",
      }),
    ).toBe(2);
  });

  it("reports an active panel from the same count", () => {
    expect(hasActiveHistoryFilters({ state: advanced(), tab: "received" })).toBe(false);
    expect(
      hasActiveHistoryFilters({ state: advanced({ store: ["Yakaboo"] }), tab: "received" }),
    ).toBe(true);
  });
});

describe("gating the order total by a single currency", () => {
  it("names no currency while none or several are picked", () => {
    expect(resolveHistoryPriceCurrency(advanced({ priceMin: 100 }))).toBeNull();
    expect(
      resolveHistoryPriceCurrency(advanced({ currency: ["UAH", "EUR"], priceMin: 100 })),
    ).toBeNull();
  });

  it("names the only picked currency once a bound is filled", () => {
    expect(resolveHistoryPriceCurrency(advanced({ currency: ["EUR"], priceMax: 50 }))).toBe("EUR");
  });

  it("names no currency while the range runs backwards", () => {
    expect(
      resolveHistoryPriceCurrency(advanced({ currency: ["UAH"], priceMax: 10, priceMin: 100 })),
    ).toBeNull();
  });
});

describe("catching a range that runs backwards", () => {
  it("accepts a half-open range", () => {
    expect(hasInvalidHistoryRange(advanced({ receivedFrom: "2026-08-01" }))).toBe(false);
  });

  it("catches every dimension", () => {
    expect(hasInvalidHistoryRange(advanced({ booksMax: 2, booksMin: 9 }))).toBe(true);
    expect(hasInvalidHistoryRange(advanced({ from: "2026-08-10", to: "2026-08-01" }))).toBe(true);
    expect(
      hasInvalidHistoryRange(advanced({ receivedFrom: "2026-08-10", receivedTo: "2026-08-01" })),
    ).toBe(true);
    expect(
      hasInvalidHistoryRange(advanced({ cancelledFrom: "2026-08-10", cancelledTo: "2026-08-01" })),
    ).toBe(true);
  });
});

describe("resolving the sort", () => {
  it("keeps a price sort gated by exactly one currency", () => {
    expect(resolveHistorySort(state({ currency: ["UAH"], sort: "price_asc" }))).toBe("price_asc");
  });

  it("falls back to the default when the currency does not gate it", () => {
    expect(resolveHistorySort(state({ sort: "price_asc" }))).toBe(DELIVERY_HISTORY_SORT_DEFAULT);
    expect(resolveHistorySort(state({ currency: ["UAH", "EUR"], sort: "price_desc" }))).toBe(
      DELIVERY_HISTORY_SORT_DEFAULT,
    );
  });

  it("leaves every other sort alone", () => {
    expect(resolveHistorySort(state({ sort: "store" }))).toBe("store");
  });
});

describe("building the request", () => {
  it("asks for the tab, the page size and nothing it was not given", () => {
    expect(toDeliveryHistoryListParams(state())).toEqual({
      currency: [],
      pageSize: DELIVERY_HISTORY_PAGE_SIZE,
      service: [],
      sort: DELIVERY_HISTORY_SORT_DEFAULT,
      store: [],
      tab: "received",
    });
  });

  it("sends the receipt range only on the received tab", () => {
    const params = toDeliveryHistoryListParams(
      state({ cancelledFrom: "2026-07-01", receivedFrom: "2026-08-01", tab: "received" }),
    );

    expect(params.receivedFrom).toBe("2026-08-01");
    expect(params).not.toHaveProperty("cancelledFrom");
  });

  it("sends the cancellation range only on the cancelled tab", () => {
    const params = toDeliveryHistoryListParams(
      state({ cancelledFrom: "2026-07-01", receivedFrom: "2026-08-01", tab: "cancelled" }),
    );

    expect(params.cancelledFrom).toBe("2026-07-01");
    expect(params).not.toHaveProperty("receivedFrom");
  });

  it("holds a range back while it runs backwards", () => {
    const params = toDeliveryHistoryListParams(
      state({ booksMax: 2, booksMin: 9, from: "2026-08-10", to: "2026-08-01" }),
    );

    expect(params).not.toHaveProperty("booksMin");
    expect(params).not.toHaveProperty("from");
  });

  it("holds the total back until one currency gates it", () => {
    const ungated = toDeliveryHistoryListParams(state({ priceMin: 100 }));
    const gated = toDeliveryHistoryListParams(state({ currency: ["UAH"], priceMin: 100 }));

    expect(ungated).not.toHaveProperty("priceMin");
    expect(ungated).not.toHaveProperty("priceCurrency");
    expect(gated.priceCurrency).toBe("UAH");
    expect(gated.priceMin).toBe(100);
  });

  it("trims the search and leaves an empty one out", () => {
    expect(toDeliveryHistoryListParams(state({ q: "  dune  " })).search).toBe("dune");
    expect(toDeliveryHistoryListParams(state({ q: "   " }))).not.toHaveProperty("search");
  });

  it("refuses to send a day that is not a real date", () => {
    expect(toDeliveryHistoryListParams(state({ from: "not-a-day" }))).not.toHaveProperty("from");
  });
});

describe("the exact order filters arriving from the statistics page", () => {
  const ORDER_ID = "3f1a6b1c-2f3d-4a5b-8c9d-0e1f2a3b4c5d";

  it("reads them off a drill-down URL", () => {
    const parsed = fromUrl(`?tab=received&orderId=${ORDER_ID}&orderState=received`);

    expect(parsed.orderId).toBe(ORDER_ID);
    expect(parsed.orderState).toBe("received");
  });

  it("drops an order state the lifecycle never names", () => {
    expect(fromUrl("?orderState=teleported").orderState).toBeNull();
  });

  it("reaches the server as the identity it is, not as a search term", () => {
    const params = toDeliveryHistoryListParams(state({ orderId: ORDER_ID }));

    expect(params.orderId).toBe(ORDER_ID);
    expect(params.search).toBeUndefined();
  });

  it("refuses a URL value that cannot be an order identity", () => {
    expect(toDeliveryHistoryListParams(state({ orderId: "ORD-20260206" })).orderId).toBeUndefined();
  });

  it("stays out of the request while nothing pinned the list", () => {
    const params = toDeliveryHistoryListParams(state());

    expect(params.orderId).toBeUndefined();
    expect(params.orderState).toBeUndefined();
  });

  it("each counts as one dimension the reader can see and clear", () => {
    expect(
      countActiveHistoryDimensions({ state: advanced({ orderId: ORDER_ID }), tab: "received" }),
    ).toBe(1);
    expect(
      countActiveHistoryDimensions({
        state: advanced({ orderState: "cancelled" }),
        tab: "received",
      }),
    ).toBe(1);
    expect(
      hasActiveHistoryFilters({ state: advanced({ orderId: ORDER_ID }), tab: "received" }),
    ).toBe(true);
  });

  it("clears together with the other advanced filters", () => {
    expect(DELIVERY_HISTORY_ADVANCED_EMPTY.orderId).toBeNull();
    expect(DELIVERY_HISTORY_ADVANCED_EMPTY.orderState).toBeNull();
  });
});

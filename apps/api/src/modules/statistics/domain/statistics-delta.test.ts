import { describe, expect, it } from "vitest";

import { toNumericComparison, toRateComparison, toScoreComparison } from "./statistics-delta.js";

describe("toNumericComparison", () => {
  it("reports growth against a positive baseline", () => {
    expect(toNumericComparison({ current: 10, previous: 8 })).toEqual({
      absoluteDelta: 2,
      percentDelta: 25,
      previous: 8,
    });
  });

  it("reports a full drop to zero", () => {
    expect(toNumericComparison({ current: 0, previous: 8 })).toEqual({
      absoluteDelta: -8,
      percentDelta: -100,
      previous: 8,
    });
  });

  it("leaves the percentage unknown when the baseline was zero", () => {
    expect(toNumericComparison({ current: 5, previous: 0 })).toEqual({
      absoluteDelta: 5,
      percentDelta: null,
      previous: 0,
    });
  });

  it("reports no change between two zeroes without a percentage", () => {
    expect(toNumericComparison({ current: 0, previous: 0 })).toEqual({
      absoluteDelta: 0,
      percentDelta: null,
      previous: 0,
    });
  });
});

describe("toRateComparison", () => {
  it("expresses a rate change in percentage points", () => {
    const comparison = toRateComparison({ currentRate: 0.416, previousRate: 0.352 });
    expect(comparison.percentagePointDelta).toBeCloseTo(6.4, 5);
    expect(comparison.previousRate).toBe(0.352);
  });
});

describe("toScoreComparison", () => {
  it("compares two known scores by absolute change", () => {
    expect(toScoreComparison({ current: 8.5, previous: 7.5 })).toEqual({
      absoluteDelta: 1,
      previous: 7.5,
    });
  });

  it("stays unknown when either side has no rating", () => {
    expect(toScoreComparison({ current: 8.5, previous: null })).toBeNull();
    expect(toScoreComparison({ current: null, previous: 7.5 })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  resolveActivityHistoryQuality,
  resolveDayHistoryQuality,
} from "./activity-history-quality.js";
import { resolveCoverageAvailability, toCoverage } from "./statistics-availability.js";

describe("toCoverage", () => {
  it("leaves the percentage unknown when nothing was eligible", () => {
    expect(toCoverage({ eligibleCount: 0, knownCount: 0 })).toEqual({
      eligibleCount: 0,
      knownCount: 0,
      percent: null,
    });
  });

  it("reports the known share of the eligible population", () => {
    expect(toCoverage({ eligibleCount: 37, knownCount: 28 }).percent).toBeCloseTo(0.7568, 4);
  });
});

describe("resolveCoverageAvailability", () => {
  it("treats an empty population as available", () => {
    expect(resolveCoverageAvailability(toCoverage({ eligibleCount: 0, knownCount: 0 }))).toBe(
      "available",
    );
  });

  it("treats a fully known population as available", () => {
    expect(resolveCoverageAvailability(toCoverage({ eligibleCount: 5, knownCount: 5 }))).toBe(
      "available",
    );
  });

  it("treats a partly known population as partial", () => {
    expect(resolveCoverageAvailability(toCoverage({ eligibleCount: 5, knownCount: 2 }))).toBe(
      "partial",
    );
  });

  it("treats a completely unknown population as unavailable", () => {
    expect(resolveCoverageAvailability(toCoverage({ eligibleCount: 5, knownCount: 0 }))).toBe(
      "unavailable",
    );
  });
});

describe("resolveActivityHistoryQuality", () => {
  it("calls a period that starts after the boundary exact", () => {
    expect(
      resolveActivityHistoryQuality({ periodFrom: "2026-02-01", reliableFrom: "2026-01-01" }),
    ).toEqual({ reliableFrom: "2026-01-01", selectedPeriodQuality: "exact" });
  });

  it("calls a period reaching before the boundary a lower bound", () => {
    expect(
      resolveActivityHistoryQuality({ periodFrom: "2025-02-01", reliableFrom: "2026-01-01" }),
    ).toMatchObject({ selectedPeriodQuality: "legacy_lower_bound" });
  });

  it("calls all time a lower bound because it has no lower edge", () => {
    expect(
      resolveActivityHistoryQuality({ periodFrom: null, reliableFrom: "2026-01-01" }),
    ).toMatchObject({ selectedPeriodQuality: "legacy_lower_bound" });
  });
});

describe("resolveDayHistoryQuality", () => {
  it("marks a day before the boundary as observed only", () => {
    expect(resolveDayHistoryQuality({ date: "2025-12-31", reliableFrom: "2026-01-01" })).toBe(
      "legacy_observed_only",
    );
  });

  it("marks the boundary day itself as exact", () => {
    expect(resolveDayHistoryQuality({ date: "2026-01-01", reliableFrom: "2026-01-01" })).toBe(
      "exact",
    );
  });
});

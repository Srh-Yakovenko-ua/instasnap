import { describe, expect, it } from "vitest";

import { statisticsEmptyKind } from "./statistics-empty";

describe("statisticsEmptyKind", () => {
  it("blames the filters first, whatever the period is", () => {
    expect(statisticsEmptyKind({ hasActiveFilters: true, preset: "all_time" })).toBe("filters");
    expect(statisticsEmptyKind({ hasActiveFilters: true, preset: "this_year" })).toBe("filters");
  });

  it("calls an unfiltered all-time miss a truly empty library", () => {
    expect(statisticsEmptyKind({ hasActiveFilters: false, preset: "all_time" })).toBe("all_time");
  });

  it("never concludes an empty library from a bounded period", () => {
    expect(statisticsEmptyKind({ hasActiveFilters: false, preset: "this_year" })).toBe("period");
    expect(statisticsEmptyKind({ hasActiveFilters: false, preset: "this_month" })).toBe("period");
    expect(statisticsEmptyKind({ hasActiveFilters: false, preset: "custom" })).toBe("period");
  });
});

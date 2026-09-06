import { describe, expect, it } from "vitest";

import { computeBudgetProgress, resolveBudgetMonthWindow } from "./budget-forecast.js";

const AUGUST_FIRST = new Date("2026-08-01T10:00:00.000Z");
const AUGUST_SECOND = new Date("2026-08-02T10:00:00.000Z");
const AUGUST_THIRD = new Date("2026-08-03T10:00:00.000Z");
const AUGUST_TWENTIETH = new Date("2026-08-20T10:00:00.000Z");
const AUGUST_LAST = new Date("2026-08-31T23:00:00.000Z");

function progressAt({
  now,
  spentToDate,
}: {
  now: Date;
  spentToDate: number;
}): ReturnType<typeof computeBudgetProgress> {
  return computeBudgetProgress({
    budget: 8000,
    deliverySpentToDate: 0,
    isSpendComplete: true,
    now,
    spentToDate,
  });
}

describe("resolveBudgetMonthWindow", () => {
  it("counts the first day of a month as one elapsed day, not zero", () => {
    expect(resolveBudgetMonthWindow(AUGUST_FIRST)).toEqual({
      daysInMonth: 31,
      elapsedDays: 1,
      lastDay: "2026-08-31",
      month: "2026-08-01",
    });
  });

  it("counts every day of the month once the month is over", () => {
    expect(resolveBudgetMonthWindow(AUGUST_LAST).elapsedDays).toBe(31);
  });

  it("knows a shorter month has fewer days to spread the spend over", () => {
    expect(resolveBudgetMonthWindow(new Date("2026-02-10T10:00:00.000Z")).daysInMonth).toBe(28);
  });
});

describe("computeBudgetProgress forecast guardrails", () => {
  it.each([
    { elapsed: "day 1", now: AUGUST_FIRST },
    { elapsed: "day 2", now: AUGUST_SECOND },
  ])("refuses to forecast a whole month from $elapsed of data", ({ now }) => {
    const progress = progressAt({ now, spentToDate: 500 });

    expect({ forecast: progress.forecast, projectedOverage: progress.projectedOverage }).toEqual({
      forecast: null,
      projectedOverage: null,
    });
  });

  it("starts forecasting on the third day", () => {
    expect(progressAt({ now: AUGUST_THIRD, spentToDate: 300 }).forecast).toBe(3100);
  });

  it("projects the run rate across the remaining days", () => {
    expect(progressAt({ now: AUGUST_TWENTIETH, spentToDate: 820 }).forecast).toBe(1271);
  });

  it("forecasts nothing spent as nothing spent rather than as missing data", () => {
    expect(progressAt({ now: AUGUST_TWENTIETH, spentToDate: 0 }).forecast).toBe(0);
  });
});

describe("computeBudgetProgress arithmetic", () => {
  it("reports the share used and what is left", () => {
    const progress = progressAt({ now: AUGUST_TWENTIETH, spentToDate: 820 });

    expect({
      remaining: progress.remaining,
      remainingSigned: progress.remainingSigned,
      usedPercent: progress.usedPercent,
    }).toEqual({ remaining: 7180, remainingSigned: 7180, usedPercent: 10.25 });
  });

  it("floors the remaining balance at zero while still exposing the overspend", () => {
    const progress = progressAt({ now: AUGUST_TWENTIETH, spentToDate: 9000 });

    expect({ remaining: progress.remaining, remainingSigned: progress.remainingSigned }).toEqual({
      remaining: 0,
      remainingSigned: -1000,
    });
  });

  it("projects an overage only once the run rate outruns the budget", () => {
    expect(progressAt({ now: AUGUST_TWENTIETH, spentToDate: 6000 }).projectedOverage).toBe(1300);
    expect(progressAt({ now: AUGUST_TWENTIETH, spentToDate: 820 }).projectedOverage).toBe(0);
  });

  it("measures the delivery bite out of the budget rather than out of the spend", () => {
    const progress = computeBudgetProgress({
      budget: 8000,
      deliverySpentToDate: 100,
      isSpendComplete: true,
      now: AUGUST_TWENTIETH,
      spentToDate: 820,
    });

    expect(progress.deliveryShareOfBudgetPercent).toBe(1.25);
  });

  it("declines to divide by a budget of zero", () => {
    const progress = computeBudgetProgress({
      budget: 0,
      deliverySpentToDate: 10,
      isSpendComplete: true,
      now: AUGUST_TWENTIETH,
      spentToDate: 500,
    });

    expect({
      deliveryShareOfBudgetPercent: progress.deliveryShareOfBudgetPercent,
      usedPercent: progress.usedPercent,
    }).toEqual({ deliveryShareOfBudgetPercent: null, usedPercent: 100 });
  });
});

describe("computeBudgetProgress outlook", () => {
  function outlookOf({ budget, spentToDate }: { budget: number; spentToDate: number }) {
    return computeBudgetProgress({
      budget,
      deliverySpentToDate: 0,
      isSpendComplete: true,
      now: AUGUST_TWENTIETH,
      spentToDate,
    });
  }

  it("calls a month on track while both the spend and the pace stay inside the budget", () => {
    expect(outlookOf({ budget: 8000, spentToDate: 3000 }).outlook).toBe("on_track");
  });

  it("calls a month at risk once the pace points past the budget", () => {
    expect(outlookOf({ budget: 8000, spentToDate: 7000 }).outlook).toBe("at_risk");
  });

  it("calls a month exceeded on what was really spent, never on the forecast", () => {
    expect(outlookOf({ budget: 8000, spentToDate: 9000 }).outlook).toBe("exceeded");
  });

  it("leaves the outlook pending while too few days have elapsed to project anything", () => {
    const progress = computeBudgetProgress({
      budget: 8000,
      deliverySpentToDate: 0,
      isSpendComplete: true,
      now: AUGUST_FIRST,
      spentToDate: 500,
    });

    expect({ forecast: progress.forecast, outlook: progress.outlook }).toEqual({
      forecast: null,
      outlook: "forecast_pending",
    });
  });

  it("reports the room the pace leaves and the overage it points to as one pair", () => {
    const onTrack = outlookOf({ budget: 8000, spentToDate: 3000 });
    const atRisk = outlookOf({ budget: 8000, spentToDate: 7000 });

    expect({
      atRiskOverage: atRisk.projectedOverage,
      atRiskRemaining: atRisk.projectedRemaining,
      onTrackOverage: onTrack.projectedOverage,
    }).toEqual({ atRiskOverage: 2850, atRiskRemaining: 0, onTrackOverage: 0 });
  });

  it("marks the forecast incomplete when the spend behind it was partial", () => {
    const progress = computeBudgetProgress({
      budget: 8000,
      deliverySpentToDate: 0,
      isSpendComplete: false,
      now: AUGUST_TWENTIETH,
      spentToDate: 500,
    });

    expect(progress.isForecastComplete).toBe(false);
  });
});

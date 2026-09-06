import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { LibrarySnapshot } from "../infrastructure/statistics-library.repository.js";

const MIN_FORECAST_SAMPLE = 3;

const MONTHS_PER_YEAR = 12;

@Injectable()
export class StatisticsLibraryComposer {
  compose({
    firstCompletionsLastYear,
    provenFirstCoverageComplete,
    snapshot,
  }: {
    firstCompletionsLastYear: number;
    provenFirstCoverageComplete: boolean;
    snapshot: LibrarySnapshot;
  }): ReadingStatisticsLibraryBalanceSection {
    return {
      currentOwnedTotal: snapshot.ownedTotal,
      currentTbrCount: snapshot.tbrCount,
      flow: { availability: "unavailable", data: null, reason: "HISTORY_NOT_TRACKED" },
      forecast: this.buildForecast({
        firstCompletionsLastYear,
        provenFirstCoverageComplete,
        snapshot,
      }),
      readRatio: snapshot.ownedTotal === 0 ? null : snapshot.finishedCount / snapshot.ownedTotal,
    };
  }

  private buildForecast({
    firstCompletionsLastYear,
    provenFirstCoverageComplete,
    snapshot,
  }: {
    firstCompletionsLastYear: number;
    provenFirstCoverageComplete: boolean;
    snapshot: LibrarySnapshot;
  }): ReadingStatisticsLibraryBalanceSection["forecast"] {
    if (!provenFirstCoverageComplete) {
      return { availability: "unavailable", data: null, reason: "LEGACY_HISTORY_INCOMPLETE" };
    }
    if (firstCompletionsLastYear < MIN_FORECAST_SAMPLE) {
      return { availability: "unavailable", data: null, reason: "INSUFFICIENT_SAMPLE" };
    }

    const readsPerMonth = firstCompletionsLastYear / MONTHS_PER_YEAR;
    return {
      availability: "available",
      data: { monthsRemaining: snapshot.tbrCount / readsPerMonth, readsPerMonth },
    };
  }
}

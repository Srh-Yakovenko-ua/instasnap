import type { Nullable, ReadingStatisticsSeriesSection } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { CompletedRead } from "../domain/completed-read.js";
import type { SeriesMarathon } from "../domain/reading-series.js";
import type { StatisticsPeriodScope } from "../domain/statistics-drilldown.js";

import {
  collectSeriesActivity,
  collectSeriesProgress,
  compareSeriesActivity,
  compareSeriesProgress,
  countSeriesReads,
  findLongestMarathon,
  resolveSeriesLifecycle,
  SERIES_PROGRESS_LIMIT,
  SERIES_RANKING_LIMIT,
} from "../domain/reading-series.js";
import { toCompletedReadsDrilldown } from "../domain/statistics-drilldown.js";

export type SeriesComposition = {
  marathon: Nullable<SeriesMarathon>;
  section: ReadingStatisticsSeriesSection;
};

@Injectable()
export class StatisticsSeriesComposer {
  compose({
    firstCompletionsBeforePeriod,
    pagesByBookId,
    periodScope,
    provenFirstCoverageComplete,
    reads,
  }: {
    firstCompletionsBeforePeriod: ReadonlyMap<string, number>;
    pagesByBookId: ReadonlyMap<string, number>;
    periodScope: StatisticsPeriodScope;
    provenFirstCoverageComplete: boolean;
    reads: CompletedRead[];
  }): SeriesComposition {
    const marathon = findLongestMarathon(reads);
    const seriesReads = countSeriesReads(reads);

    return {
      marathon,
      section: {
        availability: "available",
        completedReadsCount: reads.length,
        lifecycle: provenFirstCoverageComplete
          ? {
              availability: "available",
              data: resolveSeriesLifecycle({
                firstCompletionsBeforePeriod,
                periodReads: reads,
              }),
            }
          : { availability: "unavailable", data: null, reason: "LEGACY_HISTORY_INCOMPLETE" },
        marathon:
          marathon === null
            ? { availability: "unavailable", data: null, reason: "INSUFFICIENT_SAMPLE" }
            : {
                availability: "available",
                data: {
                  endFinishedAt: marathon.endFinishedAt,
                  length: marathon.length,
                  name: marathon.name,
                  seriesId: marathon.seriesId,
                },
              },
        mostActive: [...collectSeriesActivity({ pagesByBookId, reads })]
          .sort(compareSeriesActivity)
          .slice(0, SERIES_RANKING_LIMIT)
          .map((entry) => ({
            attributablePagesRead: entry.attributablePagesRead,
            completedReadCycles: entry.completedReadCycles,
            contextActions: [{ kind: "open_series" as const, seriesId: entry.seriesId }],
            drilldown: toCompletedReadsDrilldown({
              filters: { seriesId: entry.seriesId },
              period: periodScope,
            }),
            latestFinishedAt: entry.latestFinishedAt,
            name: entry.name,
            seriesId: entry.seriesId,
          })),
        seriesCompletedReadsCount: seriesReads,
        seriesShare: reads.length === 0 ? null : seriesReads / reads.length,
        topProgress: [...collectSeriesProgress(reads)]
          .sort(compareSeriesProgress)
          .slice(0, SERIES_PROGRESS_LIMIT),
      },
    };
  }
}

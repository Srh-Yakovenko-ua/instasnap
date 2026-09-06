import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { ProfileModule } from "../profile/index.js";
import { ReadingGoalsModule } from "../reading-goals/index.js";
import { StatisticsController } from "./api/statistics.controller.js";
import { CompletedReadMapper } from "./application/completed-read.mapper.js";
import { ReadingCoreComposer } from "./application/reading-core.composer.js";
import { ReadingDayDetailsService } from "./application/reading-day-details.service.js";
import { StatisticsCalendarComposer } from "./application/statistics-calendar.composer.js";
import { StatisticsGoalComposer } from "./application/statistics-goal.composer.js";
import { StatisticsLibraryComposer } from "./application/statistics-library.composer.js";
import { StatisticsOverviewService } from "./application/statistics-overview.service.js";
import { StatisticsSeriesComposer } from "./application/statistics-series.composer.js";
import { StatisticsTastesComposer } from "./application/statistics-tastes.composer.js";
import { StatisticsActivityRepository } from "./infrastructure/statistics-activity.repository.js";
import { StatisticsCompletionRepository } from "./infrastructure/statistics-completion.repository.js";
import { StatisticsLibraryRepository } from "./infrastructure/statistics-library.repository.js";

@Module({
  controllers: [StatisticsController],
  imports: [AuthModule, BooksModule, MediaModule, ProfileModule, ReadingGoalsModule],
  providers: [
    StatisticsOverviewService,
    ReadingDayDetailsService,
    CompletedReadMapper,
    ReadingCoreComposer,
    StatisticsCalendarComposer,
    StatisticsGoalComposer,
    StatisticsLibraryComposer,
    StatisticsSeriesComposer,
    StatisticsTastesComposer,
    StatisticsActivityRepository,
    StatisticsCompletionRepository,
    StatisticsLibraryRepository,
  ],
})
export class StatisticsModule {}

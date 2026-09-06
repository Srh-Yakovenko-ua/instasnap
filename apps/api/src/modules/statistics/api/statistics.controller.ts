import type { ReadingDayDetails, ReadingStatisticsOverview } from "@app/shared";

import { isoDay, ReadingStatisticsOverviewQuerySchema } from "@app/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodParamPipe } from "../../../core/pipes/zod-param.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ReadingDayDetailsService } from "../application/reading-day-details.service.js";
import { StatisticsOverviewService } from "../application/statistics-overview.service.js";
import { ReadingStatisticsOverviewQueryDto } from "./input-dto/reading-statistics-overview.query.input-dto.js";
import { ReadingDayDetailsDto } from "./view-dto/reading-day-details.view-dto.js";
import { ReadingStatisticsOverviewDto } from "./view-dto/reading-statistics-overview.view-dto.js";

@ApiTags("statistics")
@Controller("api/statistics")
export class StatisticsController {
  constructor(
    private readonly readingDayDetailsService: ReadingDayDetailsService,
    private readonly statisticsOverviewService: StatisticsOverviewService,
  ) {}

  @ApiBadRequestResponse({ description: "Invalid period or comparison combination" })
  @ApiOkResponse({
    description: "Every reading statistics section for the selected period",
    type: ReadingStatisticsOverviewDto,
  })
  @ApiOperation({ summary: "Get the reading statistics overview for a period" })
  @ApiQuery({ name: "period", required: false })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "compare", required: false })
  @Get("overview")
  @JwtProtected()
  @Throttle(HEAVY_READ_THROTTLE)
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsOverviewQuerySchema))
    query: ReadingStatisticsOverviewQueryDto,
  ): Promise<ReadingStatisticsOverview> {
    return this.statisticsOverviewService.getOverview({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid date" })
  @ApiOkResponse({
    description: "Every book read on one calendar day",
    type: ReadingDayDetailsDto,
  })
  @ApiOperation({ summary: "Get the full reading details of one day" })
  @Get("reading-days/:date")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getReadingDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param("date", new ZodParamPipe(isoDay())) date: string,
  ): Promise<ReadingDayDetails> {
    return this.readingDayDetailsService.getDayDetails({ date, userId: user.id });
  }
}

import type { BookBudgetOverview, Currency } from "@app/shared";

import {
  CurrencySchema,
  SaveBookBudgetsInputSchema,
  StopBookBudgetInputSchema,
  UpsertBookBudgetInputSchema,
} from "@app/shared";
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodParamPipe } from "../../../core/pipes/zod-param.pipe.js";
import { HEAVY_READ_THROTTLE, MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookBudgetService } from "../application/book-budget.service.js";
import { SaveBookBudgetsInputDto } from "./input-dto/save-book-budgets.input-dto.js";
import { StopBookBudgetInputDto } from "./input-dto/stop-book-budget.input-dto.js";
import { UpsertBookBudgetInputDto } from "./input-dto/upsert-book-budget.input-dto.js";
import { BookBudgetOverviewViewDto } from "./view-dto/book-budget.view-dto.js";

@ApiTags("book-budgets")
@Controller("api/delivery/budgets")
@JwtProtected()
export class BookBudgetsController {
  constructor(private readonly bookBudgetService: BookBudgetService) {}

  @ApiNotFoundResponse({ description: "This currency has no scheduled future version" })
  @ApiOkResponse({
    description: "The budgets of the current user after the scheduled version was dropped",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({
    summary: "Cancel the scheduled future budget version of one currency",
  })
  @ApiParam({ enum: CurrencySchema.options, name: "currency" })
  @Delete(":currency/scheduled")
  @Throttle(MUTATION_THROTTLE)
  cancelScheduled(
    @CurrentUser() user: AuthenticatedUser,
    @Param("currency", new ZodParamPipe(CurrencySchema)) currency: Currency,
  ): Promise<BookBudgetOverview> {
    return this.bookBudgetService.cancelScheduled({ currency, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "This currency has no scheduled stop to cancel" })
  @ApiOkResponse({
    description: "The budgets of the current user after the scheduled stop was lifted",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({ summary: "Cancel a scheduled stop and let the budget keep running" })
  @ApiParam({ enum: CurrencySchema.options, name: "currency" })
  @Delete(":currency/scheduled-stop")
  @Throttle(MUTATION_THROTTLE)
  cancelScheduledStop(
    @CurrentUser() user: AuthenticatedUser,
    @Param("currency", new ZodParamPipe(CurrencySchema)) currency: Currency,
  ): Promise<BookBudgetOverview> {
    return this.bookBudgetService.cancelScheduledStop({ currency, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "The current user's configured monthly book budgets with this month's progress and any scheduled version",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({ summary: "Read the monthly book budgets of the current user" })
  @Get()
  @Throttle(HEAVY_READ_THROTTLE)
  overview(@CurrentUser() user: AuthenticatedUser): Promise<BookBudgetOverview> {
    return this.bookBudgetService.overview({ userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed, or the month is already behind" })
  @ApiBody({ type: SaveBookBudgetsInputDto })
  @ApiConflictResponse({ description: "A budget was changed concurrently" })
  @ApiNotFoundResponse({
    description: "A currency asked to stop has no budget covering that month",
  })
  @ApiOkResponse({
    description: "The budgets of the current user after every change of this save was written",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({
    summary: "Save every currency the budget dialog changed as one atomic write",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post("save")
  @Throttle(MUTATION_THROTTLE)
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(SaveBookBudgetsInputSchema)) body: SaveBookBudgetsInputDto,
  ): Promise<BookBudgetOverview> {
    return this.bookBudgetService.saveAll({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed, or the month is already behind" })
  @ApiBody({ type: StopBookBudgetInputDto })
  @ApiNotFoundResponse({ description: "This currency has no budget covering that month" })
  @ApiOkResponse({
    description: "The budgets of the current user after this currency was stopped",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({
    summary: "Stop the budget of one currency from a given month",
  })
  @ApiParam({ enum: CurrencySchema.options, name: "currency" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":currency/stop")
  @Throttle(MUTATION_THROTTLE)
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param("currency", new ZodParamPipe(CurrencySchema)) currency: Currency,
    @Body(new ZodBodyPipe(StopBookBudgetInputSchema)) body: StopBookBudgetInputDto,
  ): Promise<BookBudgetOverview> {
    return this.bookBudgetService.stop({ currency, input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed, or the month is already behind" })
  @ApiBody({ type: UpsertBookBudgetInputDto })
  @ApiConflictResponse({ description: "The budget was changed concurrently" })
  @ApiOkResponse({
    description: "The budgets of the current user after the new version was written",
    type: BookBudgetOverviewViewDto,
  })
  @ApiOperation({
    summary: "Set or schedule the monthly book budget of one currency from a given month",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post()
  @Throttle(MUTATION_THROTTLE)
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(UpsertBookBudgetInputSchema)) body: UpsertBookBudgetInputDto,
  ): Promise<BookBudgetOverview> {
    return this.bookBudgetService.upsert({ input: body, userId: user.id });
  }
}

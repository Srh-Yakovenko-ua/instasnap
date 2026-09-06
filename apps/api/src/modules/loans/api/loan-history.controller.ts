import type {
  LoanHistoryDetailView,
  LoanHistoryOverviewView,
  LoanHistoryPeopleView,
  PaginatedLoanHistory,
} from "@app/shared";

import {
  LoanHistoryOverviewQuerySchema,
  LoanHistoryPeopleQuerySchema,
  LoanHistoryQuerySchema,
  UpdateLoanHistoryInputSchema,
} from "@app/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { LoanHistoryService } from "../application/loan-history.service.js";
import { LoanHistoryOverviewQueryDto } from "./input-dto/loan-history-overview-query.input-dto.js";
import { LoanHistoryPeopleQueryDto } from "./input-dto/loan-history-people-query.input-dto.js";
import { LoanHistoryQueryDto } from "./input-dto/loan-history-query.input-dto.js";
import { UpdateLoanHistoryInputDto } from "./input-dto/update-loan-history.input-dto.js";
import { LoanHistoryDetailViewDto } from "./view-dto/loan-history-detail.view-dto.js";
import { LoanHistoryOverviewViewDto } from "./view-dto/loan-history-overview.view-dto.js";
import { LoanHistoryPeopleViewDto } from "./view-dto/loan-history-people.view-dto.js";
import { PaginatedLoanHistoryDto } from "./view-dto/paginated-loan-history.view-dto.js";

@ApiTags("loans")
@Controller("api/loans/history")
@JwtProtected()
export class LoanHistoryController {
  constructor(private readonly loanHistoryService: LoanHistoryService) {}

  @ApiOkResponse({
    description: "A page of the current user's completed loans",
    type: PaginatedLoanHistoryDto,
  })
  @ApiOperation({ summary: "List the current user's completed loans" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "result", required: false })
  @ApiQuery({ name: "contactId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "returnedFrom", required: false })
  @ApiQuery({ name: "returnedTo", required: false })
  @ApiQuery({ name: "loanDateFrom", required: false })
  @ApiQuery({ name: "loanDateTo", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LoanHistoryQuerySchema)) query: LoanHistoryQueryDto,
  ): Promise<PaginatedLoanHistory> {
    return this.loanHistoryService.list({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Analytics over the current user's completed loans",
    type: LoanHistoryOverviewViewDto,
  })
  @ApiOperation({ summary: "Get analytics for the current user's completed loans" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "contactId", required: false })
  @ApiQuery({ name: "returnedFrom", required: false })
  @ApiQuery({ name: "returnedTo", required: false })
  @ApiQuery({ name: "loanDateFrom", required: false })
  @ApiQuery({ name: "loanDateTo", required: false })
  @Get("overview")
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LoanHistoryOverviewQuerySchema)) query: LoanHistoryOverviewQueryDto,
  ): Promise<LoanHistoryOverviewView> {
    return this.loanHistoryService.overview({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "People the current user completed loans with",
    type: LoanHistoryPeopleViewDto,
  })
  @ApiOperation({ summary: "List the people available for the loan history person filter" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "returnedFrom", required: false })
  @ApiQuery({ name: "returnedTo", required: false })
  @ApiQuery({ name: "loanDateFrom", required: false })
  @ApiQuery({ name: "loanDateTo", required: false })
  @Get("people")
  people(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LoanHistoryPeopleQuerySchema)) query: LoanHistoryPeopleQueryDto,
  ): Promise<LoanHistoryPeopleView> {
    return this.loanHistoryService.people({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Completed loan not found" })
  @ApiOkResponse({
    description: "A completed loan of the current user",
    type: LoanHistoryDetailViewDto,
  })
  @ApiOperation({ summary: "Get one completed loan of the current user" })
  @ApiParam({ name: "loanId" })
  @Get(":loanId")
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("loanId", ParseUUIDPipe) loanId: string,
  ): Promise<LoanHistoryDetailView> {
    return this.loanHistoryService.detail({ loanId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateLoanHistoryInputDto })
  @ApiNotFoundResponse({ description: "Completed loan not found" })
  @ApiOkResponse({ description: "The corrected completed loan", type: LoanHistoryDetailViewDto })
  @ApiOperation({ summary: "Correct the returned date or the note of a completed loan" })
  @ApiParam({ name: "loanId" })
  @Patch(":loanId")
  @Throttle(MUTATION_THROTTLE)
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("loanId", ParseUUIDPipe) loanId: string,
    @Body(new ZodBodyPipe(UpdateLoanHistoryInputSchema)) body: UpdateLoanHistoryInputDto,
  ): Promise<LoanHistoryDetailView> {
    return this.loanHistoryService.correct({ input: body, loanId, userId: user.id });
  }
}

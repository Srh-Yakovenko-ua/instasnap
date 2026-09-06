import type { LoanListItemView, LoansSummaryView, Paginator } from "@app/shared";

import { LoansQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { LoansService } from "../application/loans.service.js";
import { LoansQueryDto } from "./input-dto/loans-query.input-dto.js";
import { LoansSummaryViewDto } from "./view-dto/loans-summary.view-dto.js";
import { PaginatedLoansDto } from "./view-dto/paginated-loans.view-dto.js";

@ApiTags("loans")
@Controller("api/loans")
@JwtProtected()
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @ApiOkResponse({
    description: "Counts of the current user's active loans",
    type: LoansSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary counts for the current user's active loans" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<LoansSummaryView> {
    return this.loansService.summary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of the current user's active loans",
    type: PaginatedLoansDto,
  })
  @ApiOperation({ summary: "List the current user's active loans" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "contactId", required: false })
  @ApiQuery({ name: "reminder", required: false })
  @ApiQuery({ name: "hasNote", required: false })
  @ApiQuery({ name: "loanDateFrom", required: false })
  @ApiQuery({ name: "loanDateTo", required: false })
  @ApiQuery({ name: "expectedReturnDateFrom", required: false })
  @ApiQuery({ name: "expectedReturnDateTo", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LoansQuerySchema)) query: LoansQueryDto,
  ): Promise<Paginator<LoanListItemView>> {
    return this.loansService.list({ query, userId: user.id });
  }
}

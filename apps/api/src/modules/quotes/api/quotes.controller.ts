import type {
  PaginatedTrashedQuotes,
  Paginator,
  QuotesFacetsView,
  QuotesSummaryView,
  QuoteView,
} from "@app/shared";

import { QuotesFacetsQuerySchema, QuotesQuerySchema, TrashedQuotesQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { QuoteLifecycleService } from "../application/quote-lifecycle.service.js";
import { QuotesService } from "../application/quotes.service.js";
import { QuotesFacetsQueryDto } from "./input-dto/quotes-facets-query.input-dto.js";
import { QuotesQueryDto } from "./input-dto/quotes-query.input-dto.js";
import { TrashedQuotesQueryDto } from "./input-dto/trashed-quotes-query.input-dto.js";
import { PaginatedQuotesDto } from "./view-dto/paginated-quotes.view-dto.js";
import { PaginatedTrashedQuotesDto } from "./view-dto/paginated-trashed-quotes.view-dto.js";
import { QuotesFacetsViewDto } from "./view-dto/quotes-facets.view-dto.js";
import { QuotesSummaryViewDto } from "./view-dto/quotes-summary.view-dto.js";

@ApiTags("quotes")
@Controller("api/quotes")
@JwtProtected()
@Throttle(READ_THROTTLE)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly lifecycleService: QuoteLifecycleService,
  ) {}

  @ApiOkResponse({
    description: "A page of the current user trashed quotes",
    type: PaginatedTrashedQuotesDto,
  })
  @ApiOperation({ summary: "List quotes waiting in the trash before their scheduled purge" })
  @Get("trash")
  @Throttle(READ_THROTTLE)
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedQuotesQuerySchema)) query: TrashedQuotesQueryDto,
  ): Promise<PaginatedTrashedQuotes> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Aggregate statistics over the current user's quotes",
    type: QuotesSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary statistics for the current user's quotes" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<QuotesSummaryView> {
    return this.quotesService.summary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "How many quotes each quick filter would keep in the current search scope",
    type: QuotesFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the book, author and quick-filter facets of the current user's quotes over the filtered dataset",
  })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "createdFrom", required: false })
  @ApiQuery({ name: "createdTo", required: false })
  @ApiQuery({ name: "q", required: false })
  @Get("facets")
  facets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(QuotesFacetsQuerySchema)) query: QuotesFacetsQueryDto,
  ): Promise<QuotesFacetsView> {
    return this.quotesService.facets({ query, userId: user.id });
  }

  @ApiOkResponse({ description: "A page of the current user's quotes", type: PaginatedQuotesDto })
  @ApiOperation({ summary: "List all quotes across the current user's books" })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "createdFrom", required: false })
  @ApiQuery({ name: "createdTo", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(QuotesQuerySchema)) query: QuotesQueryDto,
  ): Promise<Paginator<QuoteView>> {
    return this.quotesService.list({ query, userId: user.id });
  }
}

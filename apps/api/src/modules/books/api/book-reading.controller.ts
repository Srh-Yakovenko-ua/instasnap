import type { BookView, ReadingHistoryView } from "@app/shared";

import {
  ChangeReadingStatusInputSchema,
  ReadingHistoryQuerySchema,
  UpdateReadingProgressInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookReadingService } from "../application/book-reading.service.js";
import { ReadingHistoryCorrectionService } from "../application/reading-history-correction.service.js";
import { ChangeReadingStatusInputDto } from "./input-dto/change-reading-status.input-dto.js";
import { ReadingHistoryQueryDto } from "./input-dto/reading-history-query.input-dto.js";
import { UpdateReadingProgressInputDto } from "./input-dto/update-reading-progress.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";
import { ReadingHistoryViewDto } from "./view-dto/reading-history.view-dto.js";

@ApiTags("books")
@Controller("api/books")
export class BookReadingController {
  constructor(
    private readonly bookReadingService: BookReadingService,
    private readonly readingHistoryCorrectionService: ReadingHistoryCorrectionService,
  ) {}

  @ApiNoContentResponse({ description: "The reading event was removed from history" })
  @ApiNotFoundResponse({ description: "Book or reading event not found" })
  @ApiOperation({
    summary: "Delete one mistaken reading activity event from the reading history",
  })
  @Delete(":id/reading-events/:eventId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  deleteReadingEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    return this.readingHistoryCorrectionService.deleteReadingEvent({
      bookId: id,
      eventId,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "Reading progress summary, activity graph and grouped history",
    type: ReadingHistoryViewDto,
  })
  @ApiOperation({ summary: "Get the reading progress history of a book" })
  @ApiQuery({ name: "activityRange", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "sort", required: false })
  @Get(":id/reading-history")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getReadingHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new ZodQueryPipe(ReadingHistoryQuerySchema)) query: ReadingHistoryQueryDto,
  ): Promise<ReadingHistoryView> {
    return this.bookReadingService.getReadingHistory(user.id, id, query);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: ChangeReadingStatusInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the applied reading status", type: BookViewDto })
  @ApiOperation({
    summary: "Change the reading status of a book with server-enforced side effects",
  })
  @ApiUnprocessableEntityResponse({ description: "Current page exceeds the page count" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":id/reading-status")
  @Throttle(MUTATION_THROTTLE)
  changeReadingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(ChangeReadingStatusInputSchema)) body: ChangeReadingStatusInputDto,
  ): Promise<BookView> {
    return this.bookReadingService.changeReadingStatus(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateReadingProgressInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the updated reading progress", type: BookViewDto })
  @ApiOperation({ summary: "Update the reading progress of a book with auto status transitions" })
  @ApiUnprocessableEntityResponse({
    description: "Current page exceeds the page count or is lower than the saved progress",
  })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":id/reading-progress")
  @Throttle(MUTATION_THROTTLE)
  updateReadingProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateReadingProgressInputSchema)) body: UpdateReadingProgressInputDto,
  ): Promise<BookView> {
    return this.bookReadingService.updateReadingProgress(user.id, id, body);
  }
}

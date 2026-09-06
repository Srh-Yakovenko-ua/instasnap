import type { CreateLoansBatchResult } from "@app/shared";

import { CreateLoansBatchInputSchema } from "@app/shared";
import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookLoanBatchService } from "../application/book-loan-batch.service.js";
import { CreateLoansBatchInputDto } from "./input-dto/create-loans-batch.input-dto.js";
import { CreateLoansBatchResultDto } from "./view-dto/create-loans-batch-result.view-dto.js";

@ApiTags("books")
@Controller("api/books/loans")
export class BookLoanBatchController {
  constructor(private readonly bookLoanBatchService: BookLoanBatchService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateLoansBatchInputDto })
  @ApiConflictResponse({
    description: "At least one book cannot take the loan; no loan was created",
  })
  @ApiNotFoundResponse({ description: "Loan contact not found" })
  @ApiOkResponse({
    description: "The books that received a loan",
    type: CreateLoansBatchResultDto,
  })
  @ApiOperation({ summary: "Record the same loan terms for several books at once" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post("batch")
  @Throttle(MUTATION_THROTTLE)
  createLoans(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateLoansBatchInputSchema)) body: CreateLoansBatchInputDto,
  ): Promise<CreateLoansBatchResult> {
    return this.bookLoanBatchService.createLoans(user.id, body);
  }
}

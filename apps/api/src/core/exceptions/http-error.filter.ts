import type { ApiError, ApiErrorResult } from "@app/shared";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

import { MEDIA_MAX_UPLOAD_MB } from "@app/shared";
import { Catch, HttpException } from "@nestjs/common";
import { ZodError } from "zod";

import { env } from "../../config/env.js";
import { SemaphoreUnavailableError } from "../bounded-semaphore.js";
import { HTTP_STATUS, isHttpStatus } from "../http-status.js";
import { createLogger } from "../logger.js";
import { ZOD_ERROR_REPORTING } from "../zod-error.js";
import {
  BadRequestError,
  HttpError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "./errors.js";

const isProduction = env.nodeEnv === "production";

export type ErrorLogger = {
  error(record: object, message: string): void;
  warn(record: object, message: string): void;
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  constructor(private readonly log: ErrorLogger = createLogger("error-handler")) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const httpError = toHttpError(exception);
    const expectedBackpressure = isExpectedBackpressure(httpError);

    this.log[
      !expectedBackpressure && httpError.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? "error"
        : "warn"
    ](
      {
        err: {
          message: httpError.message,
          name: httpError.name,
          stack:
            expectedBackpressure || !(exception instanceof Error) ? undefined : exception.stack,
        },
        requestId: request.requestId,
        status: httpError.status,
      },
      httpError.message,
    );

    if (httpError instanceof ServiceUnavailableError) {
      response.setHeader("Retry-After", String(httpError.retryAfterSeconds));
    }

    if (httpError instanceof BadRequestError && httpError.fields && httpError.fields.length > 0) {
      const fieldBody: ApiErrorResult = { errorsMessages: httpError.fields };
      response.status(httpError.status).json(fieldBody);
      return;
    }

    if (httpError.bodyless && httpError.code === undefined) {
      response.status(httpError.status).end();
      return;
    }

    const body: ApiError = {
      message: hidesInternals(httpError) ? "Internal server error" : httpError.message,
      ...(httpError.code !== undefined && { code: httpError.code }),
      ...(httpError.details !== undefined && { details: httpError.details }),
      ...(request.requestId !== undefined && { requestId: request.requestId }),
    };

    response.status(httpError.status).json(body);
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .slice(0, ZOD_ERROR_REPORTING.maxReportedIssues)
    .map((issue) => `${issue.path.join(".") || "_"}: ${issue.message}`)
    .join("; ");
}

function fromBodyParserError(
  err: Error & { message: string; status: number; type: string },
): HttpError {
  if (err.type === "entity.parse.failed") return new BadRequestError("Invalid JSON body");
  if (err.type === "entity.too.large")
    return new HttpError(HTTP_STATUS.PAYLOAD_TOO_LARGE, "Payload too large");
  return new BadRequestError(err.message);
}

function fromMulterError(err: Error & { code: string }): HttpError {
  if (err.code === "LIMIT_FILE_SIZE") {
    return new HttpError(
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      `File size must not exceed ${MEDIA_MAX_UPLOAD_MB} MB`,
      { code: "FILE_TOO_LARGE" },
    );
  }
  return new BadRequestError("File upload failed", { code: err.code });
}

function hidesInternals(httpError: HttpError): boolean {
  if (httpError instanceof ServiceUnavailableError) return false;
  return isProduction && httpError.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

function isBodyParserError(
  err: unknown,
): err is Error & { message: string; status: number; type: string } {
  return (
    err instanceof Error && "type" in err && typeof (err as { type: unknown }).type === "string"
  );
}

function isExpectedBackpressure(httpError: HttpError): boolean {
  return httpError instanceof ServiceUnavailableError;
}

function isMulterError(err: unknown): err is Error & { code: string } {
  return (
    err instanceof Error &&
    err.name === "MulterError" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof SemaphoreUnavailableError)
    return new ServiceUnavailableError({ code: "SERVER_BUSY" });
  if (err instanceof ZodError) return new ValidationError(formatZodError(err));
  if (isMulterError(err)) return fromMulterError(err);
  if (isBodyParserError(err)) return fromBodyParserError(err);
  if (err instanceof HttpException) {
    const status = err.getStatus();
    if (status === HTTP_STATUS.NOT_FOUND) return new NotFoundError(err.message);
    return new HttpError(
      isHttpStatus(status) ? status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
      err.message,
    );
  }
  if (err instanceof Error) return new HttpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message);
  return new HttpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Unknown error");
}

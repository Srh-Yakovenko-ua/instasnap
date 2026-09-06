import type { FieldError } from "@app/shared";

import { HTTP_STATUS, type HttpStatus } from "../http-status.js";

const SERVICE_UNAVAILABLE = {
  message: "Server is busy, please retry",
  retryAfterSeconds: 15,
} as const;

export class HttpError extends Error {
  readonly bodyless: boolean;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly status: HttpStatus;

  constructor(
    status: HttpStatus,
    message: string,
    options?: { bodyless?: boolean; code?: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.bodyless = options?.bodyless ?? false;
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = "Bad gateway", options?: { code?: string }) {
    super(HTTP_STATUS.BAD_GATEWAY, message, { code: options?.code });
    this.name = "BadGatewayError";
  }
}

export class BadRequestError extends HttpError {
  readonly fields?: FieldError[];

  constructor(message: string, options?: { code?: string; fields?: FieldError[] }) {
    super(HTTP_STATUS.BAD_REQUEST, message, { code: options?.code });
    this.name = "BadRequestError";
    this.fields = options?.fields;
  }
}

export class ConflictError extends HttpError {
  constructor(
    message = "Conflict",
    options?: { code?: string; details?: Record<string, unknown> },
  ) {
    super(HTTP_STATUS.CONFLICT, message, { code: options?.code, details: options?.details });
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", options?: { code?: string }) {
    super(HTTP_STATUS.FORBIDDEN, message, { bodyless: true, code: options?.code });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found", options?: { bodyless?: boolean; code?: string }) {
    super(HTTP_STATUS.NOT_FOUND, message, options);
    this.name = "NotFoundError";
  }
}

export class ServiceUnavailableError extends HttpError {
  readonly retryAfterSeconds = SERVICE_UNAVAILABLE.retryAfterSeconds;

  constructor(options?: { code?: string }) {
    super(HTTP_STATUS.SERVICE_UNAVAILABLE, SERVICE_UNAVAILABLE.message, { code: options?.code });
    this.name = "ServiceUnavailableError";
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = "Too many requests", options?: { code?: string }) {
    super(HTTP_STATUS.TOO_MANY_REQUESTS, message, { code: options?.code });
    this.name = "TooManyRequestsError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", options?: { code?: string }) {
    super(HTTP_STATUS.UNAUTHORIZED, message, { bodyless: true, code: options?.code });
    this.name = "UnauthorizedError";
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, options?: { code?: string }) {
    super(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, { code: options?.code });
    this.name = "ValidationError";
  }
}

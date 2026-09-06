import { z } from "zod";

import { reportMaintenance } from "@/features/maintenance/model/maintenance-store";
import { getAuthBridge } from "@/lib/auth-bridge";
import { env } from "@/lib/env";

const MAINTENANCE = {
  header: "x-maintenance",
  status: 503,
} as const;

const fieldErrorSchema = z.object({
  code: z.string().optional(),
  field: z.string(),
  message: z.string(),
  meta: z.record(z.string(), z.string()).optional(),
});

const apiErrorBodySchema = z.object({
  errorsMessages: z.array(fieldErrorSchema),
});

const generalErrorBodySchema = z.object({
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  message: z.string(),
  requestId: z.string().optional(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

export type RequestOptions = RequestInit;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: FieldError[],
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const isServer = typeof window === "undefined";

const NON_REFRESHABLE_PATHS = [
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/registration",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/nickname-available",
];

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const res = await send(path, init);

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  if (isMaintenanceResponse(res)) {
    reportMaintenance();
    throw await toApiError(res);
  }

  if (canAttemptRefresh(res.status, path)) {
    const retried = await refreshAndRetry<T>(path, init);
    if (retried.handled) return retried.value;
  }

  throw await toApiError(res);
}

async function buildRequest(
  path: string,
  init?: RequestOptions,
): Promise<{ init: RequestInit; url: string }> {
  const jsonContentType: Record<string, string> =
    init?.body instanceof FormData ? {} : { "Content-Type": "application/json" };

  if (isServer) {
    const base = process.env.API_BASE_URL ?? "http://localhost:4000";
    const { cookies } = await import("next/headers");
    const cookieHeader = (await cookies()).toString();
    return {
      init: {
        ...init,
        headers: {
          ...jsonContentType,
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...init?.headers,
        },
      },
      url: `${base}${path}`,
    };
  }

  const accessToken = getAuthBridge()?.getAccessToken() ?? null;

  return {
    init: {
      ...init,
      credentials: "include",
      headers: {
        ...jsonContentType,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    },
    url: `${env.NEXT_PUBLIC_API_BASE_URL}${path}`,
  };
}

function canAttemptRefresh(status: number, path: string): boolean {
  if (isServer) return false;
  if (status !== 401) return false;
  if (NON_REFRESHABLE_PATHS.some((p) => path.startsWith(p))) return false;
  return getAuthBridge() !== null;
}

function isMaintenanceResponse(res: Response): boolean {
  if (isServer) return false;
  if (res.status !== MAINTENANCE.status) return false;
  return res.headers.get(MAINTENANCE.header) !== null;
}

async function refreshAndRetry<T>(
  path: string,
  init?: RequestOptions,
): Promise<{ handled: false } | { handled: true; value: T }> {
  const bridge = getAuthBridge();
  if (!bridge) return { handled: false };

  try {
    await bridge.refresh();
  } catch {
    bridge.onRefreshFailed();
    return { handled: false };
  }

  const res = await send(path, init);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return { handled: true, value: undefined as T };
  return { handled: true, value: (await res.json()) as T };
}

async function send(path: string, init?: RequestOptions): Promise<Response> {
  const { init: requestInit, url } = await buildRequest(path, init);
  return fetch(url, requestInit);
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => res.statusText);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new ApiError(res.status, text || `HTTP ${res.status}`);
  }

  const fieldErrors = apiErrorBodySchema.safeParse(body);
  if (fieldErrors.success) {
    return new ApiError(res.status, `HTTP ${res.status}`, fieldErrors.data.errorsMessages);
  }

  const general = generalErrorBodySchema.safeParse(body);
  if (general.success) {
    return new ApiError(
      res.status,
      general.data.message,
      undefined,
      general.data.code,
      general.data.details,
    );
  }

  return new ApiError(res.status, text || `HTTP ${res.status}`);
}

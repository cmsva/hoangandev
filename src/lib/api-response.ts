/**
 * JSON envelope cho REST API agency.
 *
 * Format response:
 *   Success:  { error: 0, data?: ..., message?: "..." }
 *   Failure:  { error: <code>, message: "...", details?: ... }
 *
 * Compat với xvps.vn-style "error: 0 = ok".
 *
 * Mã lỗi (errorCode):
 *   - 0     = success
 *   - 400   = bad_request (validation)
 *   - 401   = unauthorized (thiếu/invalid api-key hoặc auth-token)
 *   - 403   = forbidden (IP whitelist, scope thiếu, key disabled)
 *   - 404   = not_found
 *   - 409   = conflict (duplicate, balance race)
 *   - 422   = unprocessable (business logic)
 *   - 429   = rate_limit
 *   - 500   = internal
 *   - 502   = upstream (aaPanel/Cloudflare/Spaceship lỗi)
 */
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

export interface ApiSuccessBody<T = unknown> {
  error: 0
  data?: T
  message?: string
  meta: {
    requestId: string
    timestamp: string
  }
}

export interface ApiErrorBody {
  error: number
  message: string
  details?: unknown
  meta: {
    requestId: string
    timestamp: string
  }
}

export type ApiBody<T = unknown> = ApiSuccessBody<T> | ApiErrorBody

export function makeRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 24)}`
}

export function apiSuccess<T>(
  data: T,
  opts: { message?: string; status?: number; requestId?: string } = {}
): NextResponse<ApiSuccessBody<T>> {
  const requestId = opts.requestId ?? makeRequestId()
  const body: ApiSuccessBody<T> = {
    error: 0,
    data,
    ...(opts.message ? { message: opts.message } : {}),
    meta: { requestId, timestamp: new Date().toISOString() },
  }
  return NextResponse.json(body, { status: opts.status ?? 200 })
}

export function apiError(
  code: number,
  message: string,
  opts: { status?: number; details?: unknown; requestId?: string; headers?: Record<string, string> } = {}
): NextResponse<ApiErrorBody> {
  const requestId = opts.requestId ?? makeRequestId()
  const body: ApiErrorBody = {
    error: code,
    message,
    ...(opts.details !== undefined ? { details: opts.details } : {}),
    meta: { requestId, timestamp: new Date().toISOString() },
  }
  return NextResponse.json(body, {
    status: opts.status ?? code,
    ...(opts.headers ? { headers: opts.headers } : {}),
  })
}

/** Map TRPCError code → HTTP status + envelope error code. */
export function mapTrpcCode(code: string): { http: number; error: number } {
  switch (code) {
    case "BAD_REQUEST":
      return { http: 400, error: 400 }
    case "UNAUTHORIZED":
      return { http: 401, error: 401 }
    case "FORBIDDEN":
      return { http: 403, error: 403 }
    case "NOT_FOUND":
      return { http: 404, error: 404 }
    case "CONFLICT":
      return { http: 409, error: 409 }
    case "UNPROCESSABLE_CONTENT":
    case "PRECONDITION_FAILED":
      return { http: 422, error: 422 }
    case "TOO_MANY_REQUESTS":
      return { http: 429, error: 429 }
    case "BAD_GATEWAY":
      return { http: 502, error: 502 }
    case "SERVICE_UNAVAILABLE":
      return { http: 503, error: 503 }
    case "INTERNAL_SERVER_ERROR":
    default:
      return { http: 500, error: 500 }
  }
}

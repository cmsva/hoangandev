/**
 * `withApiAuth` — wrap mọi REST handler `/api/agency/...` với đầy đủ bảo mật:
 *
 *   1. Lấy `api-key` + `auth-token` từ header
 *   2. Verify JWT + key match (qua resolveJwt)
 *   3. Check IP whitelist (CIDR matching)
 *   4. Check scope nếu handler yêu cầu
 *   5. Rate-limit per-key (sliding window)
 *   6. Gọi handler với `(req, ctx)` — ctx có userId/scopes
 *   7. Audit log mọi outcome (success + error)
 *
 * Handler được gọi trong try/catch — TRPCError tự map sang HTTP status đúng.
 *
 * Usage:
 *   export const GET = withApiAuth(async (req, ctx) => {
 *     // ctx.userId, ctx.scopes, ctx.requestId
 *     return apiSuccess({ ... })
 *   }, { scope: "websites:read" })
 */
import type { NextRequest, NextResponse } from "next/server"
import { TRPCError } from "@trpc/server"
import { connectDB } from "@/lib/db"
import { ipMatchesAny } from "@/lib/ip-cidr"
import {
  resolveJwt,
  recordAuditLog,
  touchKeyUsage,
  type ApiKeyContext,
} from "@/services/api-key.service"
import { consumeApiKeyLimit } from "@/lib/api-rate-limit"
import { apiError, makeRequestId, mapTrpcCode, type ApiBody } from "@/lib/api-response"
import { logger } from "@/lib/logger"
import type { Types } from "mongoose"

export interface AuthedApiContext {
  apiKeyId: Types.ObjectId
  userId: Types.ObjectId
  scopes: string[]
  ip: string
  ua: string | null
  requestId: string
}

export type AuthedHandler = (
  req: NextRequest,
  ctx: AuthedApiContext
) => Promise<NextResponse<ApiBody>>

export interface WithApiAuthOptions {
  /**
   * Scope yêu cầu cho endpoint. `*` hoặc `read:*` đều khớp.
   * Bỏ qua = chỉ cần auth, không cần scope cụ thể.
   */
  scope?: string
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  return req.headers.get("x-real-ip") || "unknown"
}

function hasScope(userScopes: string[], required: string): boolean {
  if (!required) return true
  if (userScopes.includes("*")) return true
  if (userScopes.includes(required)) return true
  // Wildcard read: "websites:*" matches "websites:read"
  const [domain] = required.split(":")
  if (userScopes.includes(`${domain}:*`)) return true
  return false
}

function extractApiHeaders(req: NextRequest): { apiKey: string; authToken: string } {
  const apiKey = req.headers.get("api-key") || req.headers.get("x-api-key") || ""
  const authToken = req.headers.get("auth-token") || req.headers.get("x-auth-token") || ""
  return { apiKey: apiKey.trim(), authToken: authToken.trim() }
}

/**
 * HOC bao 1 route handler để áp dụng full auth + rate-limit + audit.
 */
export function withApiAuth(
  handler: AuthedHandler,
  options: WithApiAuthOptions = {}
): (req: NextRequest, ...args: any[]) => Promise<NextResponse<ApiBody>> {
  return async (req: NextRequest) => {
    const startedAt = Date.now()
    const requestId = makeRequestId()
    const ip = getClientIp(req)
    const ua = req.headers.get("user-agent")
    const path = new URL(req.url).pathname
    const method = req.method

    let ctx: ApiKeyContext | null = null
    let httpStatus = 200
    let errorCode: string | null = null
    let response: NextResponse<ApiBody>

    try {
      const { apiKey, authToken } = extractApiHeaders(req)
      if (!apiKey || !authToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Thiếu header api-key hoặc auth-token",
        })
      }

      await connectDB()
      ctx = await resolveJwt({ apiKey, jwt: authToken })

      // Maintenance gate — chặn mọi REST agency request
      const { assertNotMaintenance } = await import("@/lib/maintenance-guard")
      await assertNotMaintenance() // agency ≡ non-admin

      // IP whitelist
      if (ctx.ipWhitelist.length > 0 && !ipMatchesAny(ip, ctx.ipWhitelist)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `IP ${ip} không nằm trong whitelist`,
        })
      }

      // Scope
      if (options.scope && !hasScope(ctx.scopes, options.scope)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Thiếu scope: ${options.scope}`,
        })
      }

      // Rate limit per-key
      await consumeApiKeyLimit(String(ctx.apiKeyId), ctx.rateLimitPerMin)

      // Touch key usage (best-effort)
      touchKeyUsage(ctx.apiKeyId, ip).catch(() => {})

      response = await handler(req, {
        apiKeyId: ctx.apiKeyId,
        userId: ctx.userId,
        scopes: ctx.scopes,
        ip,
        ua,
        requestId,
      })
      httpStatus = response.status
    } catch (err) {
      if (err instanceof TRPCError) {
        const map = mapTrpcCode(err.code)
        errorCode = err.code
        httpStatus = map.http
        response = apiError(map.error, err.message, {
          status: map.http,
          requestId,
          ...(err.code === "TOO_MANY_REQUESTS"
            ? {
                headers: {
                  "Retry-After": String(
                    (err.cause as any)?.retryAfter ?? 60
                  ),
                },
              }
            : {}),
        })
      } else {
        logger.error("api handler crashed", err as Error, {
          module: "withApiAuth",
          path,
        })
        errorCode = "INTERNAL"
        httpStatus = 500
        response = apiError(500, "Lỗi hệ thống", { status: 500, requestId })
      }
    }

    // Audit log
    recordAuditLog({
      apiKeyId: ctx?.apiKeyId ?? null,
      userId: ctx?.userId ?? null,
      ip,
      method,
      path,
      status: httpStatus,
      latencyMs: Date.now() - startedAt,
      errorCode,
      ua,
    })
    return response
  }
}

/**
 * Wrap handler không cần auth (chỉ cho `/get-token`). Vẫn audit + rate-limit IP.
 */
export function withApiPublic(
  handler: (req: NextRequest, requestId: string) => Promise<NextResponse<ApiBody>>
) {
  return async (req: NextRequest) => {
    const startedAt = Date.now()
    const requestId = makeRequestId()
    const ip = getClientIp(req)
    const ua = req.headers.get("user-agent")
    const path = new URL(req.url).pathname
    const method = req.method
    let httpStatus = 200
    let errorCode: string | null = null
    let response: NextResponse<ApiBody>

    try {
      await connectDB()
      // Maintenance gate — chặn cả endpoint public (vd /get-token)
      const { assertNotMaintenance } = await import("@/lib/maintenance-guard")
      await assertNotMaintenance()
      response = await handler(req, requestId)
      httpStatus = response.status
    } catch (err) {
      if (err instanceof TRPCError) {
        const map = mapTrpcCode(err.code)
        errorCode = err.code
        httpStatus = map.http
        response = apiError(map.error, err.message, {
          status: map.http,
          requestId,
          ...(err.code === "TOO_MANY_REQUESTS"
            ? {
                headers: {
                  "Retry-After": String((err.cause as any)?.retryAfter ?? 60),
                },
              }
            : {}),
        })
      } else {
        logger.error("api public handler crashed", err as Error, {
          module: "withApiPublic",
          path,
        })
        errorCode = "INTERNAL"
        httpStatus = 500
        response = apiError(500, "Lỗi hệ thống", { status: 500, requestId })
      }
    }

    recordAuditLog({
      apiKeyId: null,
      userId: null,
      ip,
      method,
      path,
      status: httpStatus,
      latencyMs: Date.now() - startedAt,
      errorCode,
      ua,
    })
    return response
  }
}

/**
 * API rate limiter — per-key + per-IP cho `/api/agency/...`.
 *
 * Dùng `rate-limiter-flexible` in-memory như rest of codebase.
 * Mỗi instance Node giữ state riêng — đủ tốt cho 1 process/PM2 cluster nhỏ.
 * Nâng cấp Redis sau khi cần scale.
 */
import { RateLimiterMemory } from "rate-limiter-flexible"
import { TRPCError } from "@trpc/server"

/** Per-IP cho endpoint `/get-token` — chống brute-force key. 10 req / phút. */
export const apiTokenLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  blockDuration: 300, // block 5 phút
  keyPrefix: "api:token",
})

/**
 * Per-key cho mọi endpoint khác. Default 60 req/min — config được override
 * theo `apiKey.rateLimitPerMin`.
 *
 * Cấu hình động: tạo limiter riêng cho mỗi mức rate khi cần.
 */
const limiterCache = new Map<number, RateLimiterMemory>()

function getKeyLimiter(perMin: number): RateLimiterMemory {
  const points = Math.max(1, Math.min(1000, Math.floor(perMin)))
  let limiter = limiterCache.get(points)
  if (!limiter) {
    limiter = new RateLimiterMemory({
      points,
      duration: 60,
      blockDuration: 60,
      keyPrefix: `api:key:${points}`,
    })
    limiterCache.set(points, limiter)
  }
  return limiter
}

export async function consumeApiKeyLimit(
  apiKeyId: string,
  perMin: number
): Promise<void> {
  const limiter = getKeyLimiter(perMin)
  try {
    await limiter.consume(apiKeyId)
  } catch (rejRes: any) {
    const retry = Math.ceil((rejRes?.msBeforeNext ?? 60_000) / 1000)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Vượt quá rate limit. Thử lại sau ${retry}s`,
      cause: { retryAfter: retry },
    })
  }
}

export async function consumeApiTokenLimit(ip: string): Promise<void> {
  try {
    await apiTokenLimiter.consume(ip || "anon")
  } catch (rejRes: any) {
    const retry = Math.ceil((rejRes?.msBeforeNext ?? 60_000) / 1000)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Quá nhiều request get-token. Thử lại sau ${retry}s`,
      cause: { retryAfter: retry },
    })
  }
}

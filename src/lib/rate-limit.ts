import { RateLimiterMemory } from "rate-limiter-flexible"
import { TRPCError } from "@trpc/server"

/**
 * Rate limiters using `rate-limiter-flexible` (in-memory, no Redis dependency).
 * Each limiter is a singleton — Node module cache ensures one instance per process.
 *
 * Why `rate-limiter-flexible`?
 * - Battle-tested (>10M weekly downloads), used by Upstash, Trigger.dev, etc.
 * - Sliding window with atomic consumption.
 * - Block-after-exceed support (auto-block IP for X seconds).
 * - Easy upgrade path to Redis/Mongo backend later (drop-in compat).
 *
 * Usage:
 *   await consumeRateLimit(authLimiter, ctx.ip, "login")
 *   // throws TRPCError("TOO_MANY_REQUESTS") nếu vượt
 */

// ─── Auth limiter — chống brute-force login/register ──────────────────────────
// 10 requests / 60s / IP, block 5 phút sau khi vượt
export const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  blockDuration: 300,
  keyPrefix: "auth",
})

// ─── Mutation limiter — purchase, validate coupon, download ───────────────────
// 20 requests / 60s / user, block 60s
export const mutationLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
  blockDuration: 60,
  keyPrefix: "mut",
})

// ─── Read limiter — chống spam GET endpoints ──────────────────────────────────
// 120 requests / 60s / IP (2 req/s trung bình)
export const readLimiter = new RateLimiterMemory({
  points: 120,
  duration: 60,
  blockDuration: 30,
  keyPrefix: "read",
})

// ─── Strict limiter — purchase / coupon / download (sensitive financial) ──────
// 5 requests / 10s / user (tránh double-click race)
export const strictLimiter = new RateLimiterMemory({
  points: 5,
  duration: 10,
  blockDuration: 30,
  keyPrefix: "strict",
})

/**
 * Consume 1 point from limiter. Throws TRPCError if over limit.
 * @param limiter - Rate limiter instance
 * @param key - Identifier (userId, IP, fingerprint)
 * @param action - Optional action name for logging context
 */
export async function consumeRateLimit(
  limiter: RateLimiterMemory,
  key: string,
  action: string = "request"
): Promise<void> {
  if (!key) {
    // No key → don't rate-limit (or use anonymous bucket)
    key = "anonymous"
  }

  try {
    await limiter.consume(key)
  } catch (rejRes: any) {
    // rejRes = RateLimiterRes (msBeforeNext, remainingPoints, ...)
    const retryAfterSec = Math.ceil((rejRes?.msBeforeNext ?? 60_000) / 1000)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Quá nhiều yêu cầu. Thử lại sau ${retryAfterSec}s.`,
      cause: { action, retryAfter: retryAfterSec },
    })
  }
}

/**
 * Compose key from multiple parts (IP + userId + action) — defense in depth.
 * Helps when a logged-in user changes IP, or shared IP behind NAT.
 */
export function composeKey(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(":")
}

/**
 * Dynamic Auth Rate Limit — đọc giá trị từ security-config DB và xây limiter
 * theo từng action (login/register/forgot). Cache instance theo cấu hình signature
 * để tránh tạo lại mỗi request.
 *
 * Window:
 *  - login: rateLimitLogin lần / 15 phút / IP, ban loginBanDuration
 *  - register: rateLimitRegister lần / 60 phút / IP
 *  - forgot: rateLimitForgot lần / 15 phút / IP
 */
import { RateLimiterMemory } from "rate-limiter-flexible"
import { TRPCError } from "@trpc/server"
import { getSecurityConfig } from "@/lib/security-config"

type AuthAction = "login" | "register" | "forgot"

interface CacheEntry {
  signature: string
  limiter: RateLimiterMemory
}

const cache = new Map<AuthAction, CacheEntry>()

function buildLimiter(action: AuthAction, points: number, durationSec: number, blockSec: number) {
  return new RateLimiterMemory({
    points: Math.max(1, points),
    duration: durationSec,
    blockDuration: Math.max(1, Math.floor(blockSec)),
    keyPrefix: `auth.${action}`,
  })
}

async function getLimiter(action: AuthAction): Promise<RateLimiterMemory> {
  const cfg = await getSecurityConfig()
  const banSec = Math.max(1, Math.floor(cfg.loginBanDuration / 1000))

  const spec =
    action === "login"
      ? { points: cfg.rateLimitLogin, durationSec: 900, blockSec: banSec }
      : action === "register"
      ? { points: cfg.rateLimitRegister, durationSec: 3600, blockSec: banSec }
      : { points: cfg.rateLimitForgot, durationSec: 900, blockSec: banSec }

  const sig = `${spec.points}:${spec.durationSec}:${spec.blockSec}`
  const cached = cache.get(action)
  if (cached && cached.signature === sig) return cached.limiter

  const limiter = buildLimiter(action, spec.points, spec.durationSec, spec.blockSec)
  cache.set(action, { signature: sig, limiter })
  return limiter
}

/** Consume 1 point cho action. Throws TRPCError nếu vượt. */
export async function consumeAuthLimit(action: AuthAction, key: string): Promise<void> {
  if (!key) key = "anonymous"
  const limiter = await getLimiter(action)
  try {
    await limiter.consume(key)
  } catch (rejRes: any) {
    const retryAfterSec = Math.ceil((rejRes?.msBeforeNext ?? 60_000) / 1000)
    // Persist auto-block (best-effort) — chỉ ở production + chỉ khi key có dạng IP.
    // Local dev: vẫn throttle nhưng KHÔNG ghi block vào DB (tránh tự khóa khi test).
    const ip = process.env.NODE_ENV === "production" ? extractIPFromKey(key) : null
    if (ip) {
      const cfg = await getSecurityConfig().catch(() => null)
      const ttlMs = cfg?.loginBanDuration ?? 900_000
      const { addBlock } = await import("@/services/blocked-ip.service")
      addBlock({
        ip,
        source: "auto",
        ttlMs,
        reason: `Vượt giới hạn ${action} (${retryAfterSec}s ban)`,
      }).catch(() => {})
    }
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Quá nhiều yêu cầu. Thử lại sau ${retryAfterSec}s.`,
      cause: { action, retryAfter: retryAfterSec },
    })
  }
}

/**
 * Key composeKey thường có format "action:ip" hoặc "action:identifier".
 * Tách phần sau cùng và chỉ giữ nếu là IPv4/IPv6 hợp lệ.
 */
function extractIPFromKey(key: string): string | null {
  const parts = key.split(":")
  // IPv6 có thể chứa nhiều ":"; thử cả last segment lẫn từ vị trí 1 trở đi
  const candidates = [parts[parts.length - 1], parts.slice(1).join(":")]
  for (const c of candidates) {
    if (!c) continue
    const trimmed = c.replace(/^::ffff:/, "").trim()
    if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(trimmed)) {
      return trimmed
    }
    if (/^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(trimmed) || trimmed.includes("::")) {
      return trimmed
    }
  }
  return null
}

/** Reset cache khi admin save security settings — gọi từ service save. */
export function resetAuthLimitCache(): void {
  cache.clear()
}

/**
 * Cache helper — wrap getter function với Redis (TTL ngắn, JSON serialize).
 *
 * `cached("key", 30, () => fetchFromDB())`:
 *   1. Try Redis GET (timeout 200ms từ ioredis) → có thì parse trả về.
 *   2. Không/lỗi → gọi loader, set Redis với TTL, trả về.
 *   3. Mọi lỗi Redis → fallback gọi loader trực tiếp. Không bao giờ throw.
 *
 * Stats: counter hits/misses/errors track in-memory để admin page hiển thị.
 *
 * Pub/sub invalidation: `invalidate("key")` publish trên channel
 * `cache:invalidate` → tất cả instance subscribe nhận và xóa key local.
 *
 * KHÔNG dùng cho:
 *   - Data critical (balance, order, payment) — restart Redis = mất data.
 *   - Data > 100KB / entry.
 *   - List có thay đổi nhanh (dùng inflight de-dupe trong service).
 */
import { getRedis, getRedisSubscriber } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { toPhysicalKey, REDIS_NAMESPACE } from "@/lib/redis-namespace"

const INVALIDATE_CHANNEL = `${REDIS_NAMESPACE}:cache:invalidate`

// ─── Stats (in-memory, reset khi restart) ────────────────────────────────
interface CacheStats {
  hits: number
  misses: number
  errors: number
  totalLatencyMsHits: number
  totalLatencyMsMisses: number
  startedAt: number
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  totalLatencyMsHits: 0,
  totalLatencyMsMisses: 0,
  startedAt: Date.now(),
}

export function getCacheStats() {
  const total = stats.hits + stats.misses
  const avgHitMs = stats.hits > 0 ? stats.totalLatencyMsHits / stats.hits : 0
  const avgMissMs = stats.misses > 0 ? stats.totalLatencyMsMisses / stats.misses : 0
  return {
    hits: stats.hits,
    misses: stats.misses,
    errors: stats.errors,
    total,
    hitRate: total > 0 ? stats.hits / total : 0,
    avgHitMs,
    avgMissMs,
    speedupPercent: avgMissMs > 0 ? Math.max(0, ((avgMissMs - avgHitMs) / avgMissMs) * 100) : 0,
    startedAt: stats.startedAt,
    uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
  }
}

export function resetCacheStats(): void {
  stats.hits = 0
  stats.misses = 0
  stats.errors = 0
  stats.totalLatencyMsHits = 0
  stats.totalLatencyMsMisses = 0
  stats.startedAt = Date.now()
}

// ─── Pub/sub subscriber (lazy) ───────────────────────────────────────────
let subscribed = false
function ensureSubscriber(): void {
  if (subscribed) return
  const sub = getRedisSubscriber()
  if (!sub) return
  subscribed = true
  sub
    .subscribe(INVALIDATE_CHANNEL)
    .then(() => {
      sub.on("message", (channel, _message) => {
        if (channel !== INVALIDATE_CHANNEL) return
        // Slot cho L1 LRU layer trong tương lai. Hiện chưa dùng.
      })
    })
    .catch(() => {
      subscribed = false
    })
}

/**
 * Cache wrapper. Mọi đường lỗi đều fallback loader → app không crash.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>
): Promise<T> {
  ensureSubscriber()
  const redis = getRedis()

  // No Redis → straight DB. Không tăng counter (Redis không bật).
  if (!redis) return await loader()

  const physKey = toPhysicalKey(key)
  const start = Date.now()
  try {
    const raw = await redis.get(physKey)
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as T
        stats.hits++
        stats.totalLatencyMsHits += Date.now() - start
        return parsed
      } catch {
        redis.del(physKey).catch(() => {})
      }
    }
  } catch {
    stats.errors++
    return await loader()
  }

  // Miss → load + set.
  const loadStart = Date.now()
  const data = await loader()
  stats.misses++
  stats.totalLatencyMsMisses += Date.now() - loadStart

  try {
    const serialized = JSON.stringify(data)
    redis.set(physKey, serialized, "EX", ttlSec).catch(() => {})
  } catch (err) {
    logger.warn("cache serialize failed", { module: "cache", key, error: (err as Error).message })
  }
  return data
}

/** Xóa 1 key + broadcast invalidate cho mọi instance khác (cùng namespace). */
export async function invalidate(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const physKey = toPhysicalKey(key)
  try {
    await redis.del(physKey)
    redis.publish(INVALIDATE_CHANNEL, key).catch(() => {})
  } catch {
    /* fail-soft */
  }
}

/** Xóa tất cả key match prefix (chỉ trong namespace của site này). */
export async function invalidatePrefix(prefix: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const physPrefix = toPhysicalKey(prefix)
  try {
    let cursor = "0"
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${physPrefix}*`, "COUNT", 500)
      cursor = next
      if (keys.length > 0) await redis.del(...keys)
    } while (cursor !== "0")
    redis.publish(INVALIDATE_CHANNEL, prefix).catch(() => {})
  } catch {
    /* fail-soft */
  }
}

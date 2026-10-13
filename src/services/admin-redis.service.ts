/**
 * Admin Redis service — observability + key management cho admin page.
 *
 * Scope per-site: mọi op chỉ thấy/sửa key trong namespace của site này
 * (`{REDIS_NAMESPACE}:*`). Site khác dùng chung Redis sẽ không bị đụng.
 *
 * Mọi op fail-soft: Redis chết → trả default state, không throw.
 */
import { TRPCError } from "@trpc/server"
import { getRedis, isRedisHealthy, isRedisConfigured, getRedisHealthChangedAt } from "@/lib/redis"
import { getCacheStats, resetCacheStats, invalidate, invalidatePrefix } from "@/lib/cache"
import { REDIS_NAMESPACE, toPhysicalKey, fromPhysicalKey, buildScanPattern } from "@/lib/redis-namespace"

// ─── Status overview ──────────────────────────────────────────────────────

export interface RedisStatus {
  configured: boolean
  healthy: boolean
  url: string | null // masked
  namespace: string
  serverInfo: {
    version?: string
    mode?: string
    uptimeSec?: number
    role?: string
    connectedClients?: number
    usedMemoryHuman?: string
    usedMemoryBytes?: number
    maxMemoryHuman?: string
    totalConnectionsReceived?: number
    totalCommandsProcessed?: number
    instantaneousOpsPerSec?: number
    keyspaceHits?: number
    keyspaceMisses?: number
    keyHitRate?: number
    dbSize?: number // total keys (whole Redis)
    siteKeys?: number // keys trong namespace của site này
  }
  cacheStats: ReturnType<typeof getCacheStats>
  healthChangedAt: number
}

function maskUrl(url: string | undefined): string | null {
  if (!url) return null
  return url.replace(/:\/\/[^@]+@/, "://***@")
}

function parseRedisInfo(raw: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf(":")
    if (idx === -1) continue
    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return map
}

/**
 * Đếm số key trong namespace của site này. Dùng SCAN, dừng sớm nếu > maxScan
 * để không block Redis quá lâu khi site có nhiều key.
 */
async function countSiteKeys(redis: NonNullable<ReturnType<typeof getRedis>>): Promise<number> {
  const maxScan = 50_000
  let total = 0
  let cursor = "0"
  try {
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${REDIS_NAMESPACE}:*`, "COUNT", 500)
      cursor = next
      total += keys.length
      if (total >= maxScan) break
    } while (cursor !== "0")
  } catch {
    /* fail-soft */
  }
  return total
}

export async function getRedisStatus(): Promise<RedisStatus> {
  const cacheStats = getCacheStats()
  const status: RedisStatus = {
    configured: isRedisConfigured(),
    healthy: isRedisHealthy(),
    url: maskUrl(process.env.REDIS_URL),
    namespace: REDIS_NAMESPACE,
    serverInfo: {},
    cacheStats,
    healthChangedAt: getRedisHealthChangedAt(),
  }

  const redis = getRedis()
  if (!redis || !isRedisHealthy()) return status

  try {
    const [infoRaw, dbSize, siteKeys] = await Promise.all([
      redis.info(),
      redis.dbsize(),
      countSiteKeys(redis),
    ])
    const info = parseRedisInfo(infoRaw)
    const hits = parseInt(info.keyspace_hits || "0", 10)
    const misses = parseInt(info.keyspace_misses || "0", 10)
    const total = hits + misses

    status.serverInfo = {
      version: info.redis_version,
      mode: info.redis_mode,
      role: info.role,
      uptimeSec: parseInt(info.uptime_in_seconds || "0", 10),
      connectedClients: parseInt(info.connected_clients || "0", 10),
      usedMemoryHuman: info.used_memory_human,
      usedMemoryBytes: parseInt(info.used_memory || "0", 10),
      maxMemoryHuman: info.maxmemory_human,
      totalConnectionsReceived: parseInt(info.total_connections_received || "0", 10),
      totalCommandsProcessed: parseInt(info.total_commands_processed || "0", 10),
      instantaneousOpsPerSec: parseInt(info.instantaneous_ops_per_sec || "0", 10),
      keyspaceHits: hits,
      keyspaceMisses: misses,
      keyHitRate: total > 0 ? hits / total : 0,
      dbSize,
      siteKeys,
    }
  } catch {
    /* fail-soft */
  }
  return status
}

// ─── Key management (scoped to namespace) ────────────────────────────────

export interface RedisKeyEntry {
  key: string // logical (đã strip namespace prefix)
  type: string
  ttl: number
  sizeBytes: number
}

export interface KeyListInput {
  pattern?: string
  cursor?: string
  count?: number
}

export interface KeyListResult {
  items: RedisKeyEntry[]
  nextCursor: string
  done: boolean
}

export async function listRedisKeys(input: KeyListInput): Promise<KeyListResult> {
  const redis = getRedis()
  if (!redis || !isRedisHealthy()) {
    return { items: [], nextCursor: "0", done: true }
  }

  // Pattern user nhập áp dụng trong namespace.
  const userPattern = input.pattern?.trim() || "*"
  const physPattern = buildScanPattern(userPattern)
  const cursor = input.cursor || "0"
  const count = Math.min(500, Math.max(20, input.count || 100))

  try {
    const [next, physKeys] = await redis.scan(cursor, "MATCH", physPattern, "COUNT", count)
    if (physKeys.length === 0) {
      return { items: [], nextCursor: next, done: next === "0" }
    }

    const pipeline = redis.pipeline()
    for (const k of physKeys) {
      pipeline.type(k)
      pipeline.pttl(k)
      pipeline.memory("USAGE", k)
    }
    const results = await pipeline.exec()
    const items: RedisKeyEntry[] = []
    if (results) {
      for (let i = 0; i < physKeys.length; i++) {
        const typeRes = results[i * 3]
        const ttlRes = results[i * 3 + 1]
        const memRes = results[i * 3 + 2]
        const type = (typeRes?.[1] as string) || "unknown"
        const pttl = (ttlRes?.[1] as number) ?? -1
        const ttl = pttl > 0 ? Math.ceil(pttl / 1000) : pttl
        const sizeBytes = Number(memRes?.[1] ?? 0) || 0
        items.push({
          key: fromPhysicalKey(physKeys[i]!),
          type,
          ttl,
          sizeBytes,
        })
      }
    }
    return { items, nextCursor: next, done: next === "0" }
  } catch {
    return { items: [], nextCursor: "0", done: true }
  }
}

export interface RedisKeyDetail {
  key: string
  type: string
  ttl: number
  sizeBytes: number
  preview: string | null
}

export async function getRedisKeyDetail(logicalKey: string): Promise<RedisKeyDetail | null> {
  const redis = getRedis()
  if (!redis || !isRedisHealthy()) return null

  const physKey = toPhysicalKey(logicalKey)
  try {
    const [type, pttl, sizeRaw] = await Promise.all([
      redis.type(physKey),
      redis.pttl(physKey),
      redis.memory("USAGE", physKey).catch(() => 0),
    ])
    if (type === "none") return null

    let preview: string | null = null
    if (type === "string") {
      const raw = await redis.get(physKey)
      if (raw) preview = raw.length > 4_000 ? raw.slice(0, 4_000) + "…" : raw
    } else if (type === "hash") {
      const obj = await redis.hgetall(physKey)
      preview = JSON.stringify(obj, null, 2).slice(0, 4_000)
    } else if (type === "list") {
      const arr = await redis.lrange(physKey, 0, 50)
      preview = JSON.stringify(arr, null, 2).slice(0, 4_000)
    } else if (type === "set") {
      const arr = await redis.smembers(physKey)
      preview = JSON.stringify(arr, null, 2).slice(0, 4_000)
    } else if (type === "zset") {
      const arr = await redis.zrange(physKey, 0, 50, "WITHSCORES")
      preview = JSON.stringify(arr, null, 2).slice(0, 4_000)
    }

    return {
      key: logicalKey,
      type,
      ttl: pttl > 0 ? Math.ceil(pttl / 1000) : pttl,
      sizeBytes: Number(sizeRaw) || 0,
      preview,
    }
  } catch {
    return null
  }
}

export async function deleteRedisKey(logicalKey: string): Promise<{ deleted: boolean }> {
  if (!logicalKey.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Key không hợp lệ" })
  }
  const redis = getRedis()
  if (!redis || !isRedisHealthy()) return { deleted: false }
  try {
    const physKey = toPhysicalKey(logicalKey)
    const n = await redis.del(physKey)
    if (n > 0) await invalidate(logicalKey)
    return { deleted: n > 0 }
  } catch {
    return { deleted: false }
  }
}

export async function deleteRedisKeysByPrefix(logicalPrefix: string): Promise<{ deleted: number }> {
  if (!logicalPrefix.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Prefix không hợp lệ" })
  }
  const redis = getRedis()
  if (!redis || !isRedisHealthy()) return { deleted: 0 }

  const physPattern = `${toPhysicalKey(logicalPrefix)}*`
  let total = 0
  try {
    let cursor = "0"
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", physPattern, "COUNT", 500)
      cursor = next
      if (keys.length > 0) total += await redis.del(...keys)
    } while (cursor !== "0")
    if (total > 0) await invalidatePrefix(logicalPrefix)
    return { deleted: total }
  } catch {
    return { deleted: total }
  }
}

/**
 * Flush — chỉ xoá keys trong namespace của site này. KHÔNG dùng FLUSHDB
 * (sẽ xoá data của các site khác đang dùng chung Redis).
 */
export async function flushAllCache(): Promise<{ flushed: boolean; deletedCount: number }> {
  const redis = getRedis()
  if (!redis || !isRedisHealthy()) return { flushed: false, deletedCount: 0 }
  let total = 0
  try {
    let cursor = "0"
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${REDIS_NAMESPACE}:*`, "COUNT", 500)
      cursor = next
      if (keys.length > 0) total += await redis.del(...keys)
    } while (cursor !== "0")
    resetCacheStats()
    return { flushed: true, deletedCount: total }
  } catch {
    return { flushed: false, deletedCount: total }
  }
}

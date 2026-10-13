/**
 * Redis singleton — fail-soft 100%.
 *
 * Mọi op (`getRedis()`, `getRedisSubscriber()`) trả null khi:
 *   - REDIS_URL không set
 *   - Connect thất bại
 *   - Bị disconnect
 *
 * Caller (cache.ts) phải fallback DB khi nhận null. KHÔNG bao giờ throw → app
 * không crash dù Redis có chết hoàn toàn.
 *
 * Restart server = mất RAM cache → app tự fill lại từ DB sau vài request.
 * Đó là lý do KHÔNG lưu data critical (balance, order, session) ở Redis.
 */
import Redis from "ioredis"
import { logger } from "@/lib/logger"

let client: Redis | null = null
let subscriber: Redis | null = null
let mainAttempted = false
let subAttempted = false
let healthy = false
let lastHealthChange = 0

const REDIS_URL = process.env.REDIS_URL?.trim() || ""

function makeClient(label: "main" | "sub"): Redis | null {
  if (!REDIS_URL) return null
  try {
    const c = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      commandTimeout: 200,
      retryStrategy(times) {
        if (times > 5) return null
        return Math.min(times * 500, 3000)
      },
      reconnectOnError(err) {
        const target = err.message.includes("READONLY") || err.message.includes("ECONNRESET")
        return target
      },
    })
    c.on("error", (err) => {
      if (healthy) {
        healthy = false
        lastHealthChange = Date.now()
        logger.warn(`redis ${label} disconnected`, { module: "redis", error: err.message })
      }
    })
    c.on("ready", () => {
      if (!healthy) {
        healthy = true
        lastHealthChange = Date.now()
        logger.info(`redis ${label} ready`, { module: "redis" })
      }
    })
    c.on("end", () => {
      if (healthy) {
        healthy = false
        lastHealthChange = Date.now()
      }
    })
    return c
  } catch (err) {
    logger.warn(`redis ${label} init failed`, { module: "redis", error: (err as Error).message })
    return null
  }
}

export function getRedis(): Redis | null {
  if (!REDIS_URL) return null
  if (client) return client
  if (mainAttempted) return null
  mainAttempted = true

  client = makeClient("main")
  if (!client) return null
  client.connect().catch((err) => {
    logger.warn("redis main connect failed", { module: "redis", error: err.message })
  })
  return client
}

export function getRedisSubscriber(): Redis | null {
  if (!REDIS_URL) return null
  if (subscriber) return subscriber
  if (subAttempted) return null
  subAttempted = true

  subscriber = makeClient("sub")
  if (!subscriber) return null
  subscriber.connect().catch((err) => {
    logger.warn("redis sub connect failed", { module: "redis", error: err.message })
  })
  return subscriber
}

export function isRedisHealthy(): boolean {
  return healthy
}

export function getRedisHealthChangedAt(): number {
  return lastHealthChange
}

export function isRedisConfigured(): boolean {
  return !!REDIS_URL
}

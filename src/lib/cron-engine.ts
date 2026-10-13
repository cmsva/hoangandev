/**
 * Production-grade cronjob engine.
 *
 * Đặc điểm:
 * - Atomic claim qua MongoDB findOneAndUpdate (race-safe khi multi-instance).
 *   Mỗi tick lấy ra `nextRunAt <= now`, set ngay `nextRunAt = now + interval`
 *   để instance khác không pickup lại.
 * - **Auto-tune theo load**: tickMs / claimBatch / concurrency tự thay đổi
 *   theo số job active. Idle (≤50 jobs) → tiết kiệm RAM. Cao (≥2000) →
 *   tick nhanh + concurrency cao. Không cần admin tinh chỉnh.
 * - Concurrency cap (semaphore) — giới hạn N HTTP request song song.
 * - Bulk write logs (Cronjob.bulkWrite) thay vì updateOne từng job.
 * - Heartbeat metric ghi vào `cron_engine_metrics` collection → admin xem
 *   load real-time qua MongoDB, không cần API tool ngoài.
 * - Bật/tắt qua env CRON_ENGINE=true|false (mặc định true).
 * - Sweep expired jobs định kỳ + decrement server slot.
 *
 * Performance budget:
 * - 1000 jobs interval 60s ≈ 16 ping/s → well under tier 3 cap (50)
 * - Memory: O(inFlight) chỉ giữ ID — RAM ổn định ngàn jobs.
 */
import os from "os"
import { Cronjob, ServerCronjob } from "@/models/cronjob.model"
import { CronEngineMetric } from "@/models/cron-engine-metric.model"
import { connectDB } from "@/lib/db"
import { logger } from "@/lib/logger"
import { validateCronUrl, parseHeadersJson } from "@/services/cronjob.service"

// ─── Auto-tune tiers theo số job active ───────────────────────────────────────
// Engine tự nới lỏng config khi load tăng — không cần admin can thiệp.
// Mỗi tier là { upTo: maxJobs, tickMs, claimBatch, concurrency }.
// Khi activeJobsCount tăng vượt tier → engine reload config tự động.
const TUNING_TIERS = [
  // Idle / nhỏ — tiết kiệm RAM/CPU, tick chậm
  { upTo: 50, tickMs: 2_000, claimBatch: 25, concurrency: 10 },
  // Tầm trung
  { upTo: 200, tickMs: 1_500, claimBatch: 50, concurrency: 25 },
  // Cao
  { upTo: 500, tickMs: 1_000, claimBatch: 100, concurrency: 50 },
  // Rất cao
  { upTo: 2_000, tickMs: 750, claimBatch: 200, concurrency: 100 },
  // Max — chấp nhận engine ăn nhiều resource hơn
  { upTo: Infinity, tickMs: 500, claimBatch: 400, concurrency: 200 },
] as const

const FETCH_TIMEOUT_MS = 15_000 // hard cap — không nới theo load (an toàn)
const MAX_RESPONSE_BYTES = 1024
const METRIC_INTERVAL_MS = 5_000
const SWEEP_INTERVAL_MS = 60_000
const RETUNE_CHECK_EVERY_TICKS = 30 // check tier mỗi 30 tick để tránh flap

function pickTier(activeJobs: number) {
  for (const tier of TUNING_TIERS) {
    if (activeJobs <= tier.upTo) return tier
  }
  return TUNING_TIERS[TUNING_TIERS.length - 1]
}

// ─── Internal state ───────────────────────────────────────────────────────────
let started = false
let tickHandle: NodeJS.Timeout | null = null
let metricHandle: NodeJS.Timeout | null = null
let sweepHandle: NodeJS.Timeout | null = null

const instanceId = `${os.hostname()}#${process.pid}`
const startedAt = new Date()

let inFlight = 0
let totalPinged = 0
let totalSuccess = 0
let totalFailed = 0
const durationSamples: number[] = [] // rolling, max 200 samples
let tickCount = 0

// Tier hiện tại — default tier thấp nhất khi chưa biết load
let currentTier: (typeof TUNING_TIERS)[number] = TUNING_TIERS[0]
let lastKnownActiveCount = 0

// ─── Semaphore — limit concurrent requests ────────────────────────────────────
const waitQueue: Array<() => void> = []

function acquire(): Promise<void> {
  if (inFlight < currentTier.concurrency) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => waitQueue.push(resolve))
}

function release() {
  inFlight = Math.max(0, inFlight - 1)
  const next = waitQueue.shift()
  if (next) {
    inFlight++
    next()
  }
}

// ─── Fetch with timeout, no-redirect ──────────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "manual" })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Per-job ping ─────────────────────────────────────────────────────────────
async function pingJob(job: any) {
  await acquire()
  const start = Date.now()
  let statusCode = 0
  let responseSnippet = ""
  let lastError: string | null = null

  try {
    // Re-validate URL ngay trước ping (chống user đổi sang internal sau lần claim)
    const urlCheck = validateCronUrl(job.url)
    if (!urlCheck.ok) {
      lastError = `SSRF blocked: ${urlCheck.reason}`
      return { jobId: job._id, statusCode: 0, responseSnippet: "", lastError, durationMs: 0 }
    }

    let headers: Record<string, string> = { "User-Agent": "VanKhanh-Cronjob/1.0" }
    try {
      const parsed = parseHeadersJson(job.headers)
      if (parsed) headers = { ...headers, ...parsed }
    } catch {
      // ignore — đã validate khi tạo
    }

    const init: RequestInit = { method: job.method || "GET", headers }
    if (init.method === "POST" && job.body) {
      init.body = job.body
      const h = init.headers as Record<string, string>
      if (!h["Content-Type"] && !h["content-type"]) {
        h["Content-Type"] = "application/json"
      }
    }

    try {
      const res = await fetchWithTimeout(urlCheck.url.toString(), init, FETCH_TIMEOUT_MS)
      statusCode = res.status
      try {
        const text = await res.text()
        responseSnippet = text.slice(0, MAX_RESPONSE_BYTES)
      } catch {}
    } catch (err: any) {
      statusCode = err?.name === "AbortError" ? 408 : 0
      lastError = err?.message?.slice(0, 512) || "Request failed"
    }
  } finally {
    release()
  }

  const durationMs = Date.now() - start
  return { jobId: job._id, statusCode, responseSnippet, lastError, durationMs }
}

// ─── One tick — claim + ping + bulk write ─────────────────────────────────────
async function tick() {
  tickCount++
  const now = new Date()

  // Claim batch jobs đến hạn — atomic per-job để race-safe khi multi-instance
  // Strategy: query 1 batch (limit), với mỗi job dùng findOneAndUpdate set
  // nextRunAt mới — instance khác sẽ không pickup vì điều kiện nextRunAt <= now.
  let candidates: any[] = []
  try {
    candidates = (await Cronjob.find({
      status: "active",
      $or: [{ nextRunAt: null }, { nextRunAt: { $lte: now } }],
    })
      .select("url method headers body intervalSeconds nextRunAt")
      .sort({ nextRunAt: 1 }) // oldest first → fairness
      .limit(currentTier.claimBatch)
      .lean()) as any[]
  } catch (err: any) {
    logger.error("cron tick: query failed", err, { module: "cron.engine" })
    return
  }

  if (!candidates.length) return

  // Atomic claim từng job — chỉ claim nếu nextRunAt vẫn match (CAS pattern)
  const claimed: any[] = []
  for (const c of candidates) {
    const intervalMs = (c.intervalSeconds || 30) * 1000
    const newNextRun = new Date(now.getTime() + intervalMs)
    const condition: Record<string, any> = { _id: c._id, status: "active" }
    if (c.nextRunAt) {
      condition.nextRunAt = c.nextRunAt
    } else {
      condition.nextRunAt = null
    }

    const updated = await Cronjob.findOneAndUpdate(
      condition,
      { $set: { nextRunAt: newNextRun } },
      { projection: { url: 1, method: 1, headers: 1, body: 1, intervalSeconds: 1 } }
    )
    if (updated) claimed.push(updated)
  }

  if (!claimed.length) return

  // Ping song song (semaphore tự throttle)
  const results = await Promise.all(claimed.map((j) => pingJob(j)))

  // Bulk write — 1 round-trip thay vì N updateOne
  const ops = results.map((r) => {
    const isSuccess = r.statusCode >= 200 && r.statusCode < 300
    if (isSuccess) totalSuccess++
    else totalFailed++
    totalPinged++
    if (r.durationMs > 0) {
      durationSamples.push(r.durationMs)
      if (durationSamples.length > 200) durationSamples.shift()
    }
    return {
      updateOne: {
        filter: { _id: r.jobId },
        update: {
          $set: {
            lastRun: now,
            statusCode: r.statusCode,
            lastResponse: r.responseSnippet || null,
            lastError: r.lastError,
            lastDurationMs: r.durationMs,
          },
        },
      },
    }
  })

  if (ops.length) {
    Cronjob.bulkWrite(ops, { ordered: false }).catch((err) =>
      logger.error("cron tick: bulkWrite failed", err, { module: "cron.engine" })
    )
  }

  // Auto re-tune mỗi N tick dựa vào lần mới nhất đếm activeJobs (ghi bởi writeMetric)
  if (tickCount % RETUNE_CHECK_EVERY_TICKS === 0) {
    maybeRetune()
  }
}

// ─── Auto-retune theo load ────────────────────────────────────────────────────
function maybeRetune() {
  const next = pickTier(lastKnownActiveCount)
  if (next === currentTier) return
  const prev = currentTier
  currentTier = next
  logger.info("cron engine retuned", {
    module: "cron.engine",
    activeJobs: lastKnownActiveCount,
    from: { tickMs: prev.tickMs, claimBatch: prev.claimBatch, concurrency: prev.concurrency },
    to: { tickMs: next.tickMs, claimBatch: next.claimBatch, concurrency: next.concurrency },
  })
  // Restart tick interval để áp tickMs mới (claimBatch/concurrency áp ngay lập tức)
  if (tickHandle && next.tickMs !== prev.tickMs) {
    clearInterval(tickHandle)
    tickHandle = setInterval(() => {
      tick().catch((err) =>
        logger.error("cron tick crashed", err, { module: "cron.engine" })
      )
    }, currentTier.tickMs)
  }
}

// ─── Sweep expired jobs ───────────────────────────────────────────────────────
async function sweepExpired() {
  const now = new Date()
  const expired = (await Cronjob.find({
    status: { $in: ["active", "paused"] },
    expiresAt: { $lt: now },
  })
    .select("_id serverId status")
    .limit(500)
    .lean()) as any[]

  if (!expired.length) return

  // Bulk update sang expired
  const ids = expired.map((j) => j._id)
  await Cronjob.updateMany(
    { _id: { $in: ids }, status: { $in: ["active", "paused"] } },
    { $set: { status: "expired", nextRunAt: null } }
  )

  // Decrement server slots — group by serverId để bulk
  const serverCounts = new Map<string, number>()
  for (const j of expired) {
    if (!j.serverId) continue
    const k = j.serverId.toString()
    serverCounts.set(k, (serverCounts.get(k) || 0) + 1)
  }
  const serverOps = Array.from(serverCounts.entries()).map(([sid, count]) => ({
    updateOne: {
      filter: { _id: sid, currentUsage: { $gte: count } },
      update: { $inc: { currentUsage: -count } },
    },
  }))
  if (serverOps.length) {
    ServerCronjob.bulkWrite(serverOps, { ordered: false }).catch((err) =>
      logger.warn("sweep: server slot decrement failed", {
        module: "cron.engine",
        error: (err as Error).message,
      })
    )
  }

  logger.info("cron sweep expired", {
    module: "cron.engine",
    count: expired.length,
  })
}

// ─── Heartbeat metric ─────────────────────────────────────────────────────────
async function writeMetric() {
  try {
    const activeCount = await Cronjob.countDocuments({ status: "active" })
    lastKnownActiveCount = activeCount // feed vào auto-tune
    const avg =
      durationSamples.length > 0
        ? Math.round(durationSamples.reduce((s, n) => s + n, 0) / durationSamples.length)
        : 0
    await CronEngineMetric.updateOne(
      { key: "default" },
      {
        $set: {
          instanceId,
          alive: true,
          inFlight,
          activeJobsCount: activeCount,
          totalPinged,
          totalSuccess,
          totalFailed,
          avgDurationMs: avg,
          startedAt,
          lastTickAt: new Date(),
          tickCount,
          tier: {
            tickMs: currentTier.tickMs,
            claimBatch: currentTier.claimBatch,
            concurrency: currentTier.concurrency,
          },
        },
      },
      { upsert: true }
    )
  } catch (err: any) {
    logger.warn("cron metric write failed", {
      module: "cron.engine",
      error: err?.message,
    })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function isCronEngineEnabled(): boolean {
  // Mặc định bật. Tắt nếu CRON_ENGINE=false
  const flag = (process.env.CRON_ENGINE || "true").toLowerCase()
  return flag !== "false" && flag !== "0"
}

export async function startCronEngine() {
  if (started) return
  if (!isCronEngineEnabled()) {
    logger.info("cron engine disabled by env CRON_ENGINE=false", { module: "cron.engine" })
    return
  }

  started = true

  // Đảm bảo DB connected trước
  await connectDB().catch((err) =>
    logger.error("cron engine: connectDB failed", err, { module: "cron.engine" })
  )

  // Pick tier ban đầu theo activeJobsCount hiện tại
  try {
    lastKnownActiveCount = await Cronjob.countDocuments({ status: "active" })
    currentTier = pickTier(lastKnownActiveCount)
  } catch {
    currentTier = TUNING_TIERS[0]
  }

  logger.info("cron engine starting", {
    module: "cron.engine",
    instanceId,
    activeJobs: lastKnownActiveCount,
    tier: {
      tickMs: currentTier.tickMs,
      claimBatch: currentTier.claimBatch,
      concurrency: currentTier.concurrency,
    },
  })

  // Tick
  tickHandle = setInterval(() => {
    tick().catch((err) =>
      logger.error("cron tick crashed", err, { module: "cron.engine" })
    )
  }, currentTier.tickMs)

  // Heartbeat metric
  writeMetric().catch(() => {})
  metricHandle = setInterval(() => {
    writeMetric().catch(() => {})
  }, METRIC_INTERVAL_MS)

  // Sweep expired
  sweepHandle = setInterval(() => {
    sweepExpired().catch((err) =>
      logger.error("sweep crashed", err, { module: "cron.engine" })
    )
  }, SWEEP_INTERVAL_MS)

  // Graceful shutdown — đánh dấu alive=false
  const onExit = () => {
    stopCronEngine().catch(() => {})
  }
  process.once("SIGTERM", onExit)
  process.once("SIGINT", onExit)
}

export async function stopCronEngine() {
  if (tickHandle) clearInterval(tickHandle)
  if (metricHandle) clearInterval(metricHandle)
  if (sweepHandle) clearInterval(sweepHandle)
  tickHandle = metricHandle = sweepHandle = null
  started = false
  // Mark alive=false để admin biết engine đã stop
  try {
    await CronEngineMetric.updateOne(
      { key: "default" },
      { $set: { alive: false, lastTickAt: new Date() } }
    )
  } catch {}
  logger.info("cron engine stopped", { module: "cron.engine" })
}

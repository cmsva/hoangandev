/**
 * Cronjob controller — business logic + validators.
 *
 * Validators (pure):
 *  - validateCronUrl (anti-SSRF)
 *  - parseHeadersJson (security)
 *  - validateInterval
 *
 * Repository + atomic ops:
 *  - findActiveServer
 *  - reserveServerSlot / releaseServerSlot
 *  - createCronjobOrThrow / deleteCronjobSafe
 *  - listMyCronjobs / listActiveServers
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import {
  Cronjob,
  ServerCronjob,
  type ICronjob,
  type IServerCronjob,
} from "@/models/cronjob.model"
import { logger } from "@/lib/logger"
import { escapeRegex } from "@/lib/sanitize"
import { deductBalanceAtomic, ensureUserHasBalance, logBalanceChange, refundBalance } from "@/services/balance.service"

// ─── Constants ────────────────────────────────────────────────────────────────────────
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

// No DB cache — luôn fresh. Chỉ giữ inflight de-dupe.
let activeServersInflight: Promise<Awaited<ReturnType<typeof queryActiveServers>>> | null = null

export function invalidateCronjobCatalogCache(): void {
  // No-op: không cache nữa.
  activeServersInflight = null
}

const URL_MAX = 2048
const PRIVATE_IP_REGEX =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|169\.254\.|::1$|fe80:|fc00:|fd00:|localhost$)/i

const HEADER_KEY_REGEX = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,128}$/
const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "upgrade",
  "expect",
  "cookie",
])

// ─── Validators (pure) ──────────────────────────────────────────────────────

export function validateCronUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  if (!raw || raw.length > URL_MAX) {
    return { ok: false, reason: "URL không hợp lệ hoặc quá dài" }
  }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { ok: false, reason: "URL không hợp lệ" }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Chỉ chấp nhận http hoặc https" }
  }
  const host = u.hostname.toLowerCase()
  if (PRIVATE_IP_REGEX.test(host)) {
    return { ok: false, reason: "Không cho phép URL nội bộ" }
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Không cho phép URL nội bộ" }
  }
  return { ok: true, url: u }
}

export function parseHeadersJson(raw: string | null | undefined): Record<string, string> | null {
  if (raw == null || raw.trim() === "") return null
  if (raw.length > 8192) throw new Error("Headers quá dài")

  let obj: any
  try {
    obj = JSON.parse(raw)
  } catch {
    throw new Error("Headers phải là JSON object hợp lệ")
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Headers phải là JSON object")
  }

  const out: Record<string, string> = {}
  let count = 0
  for (const [k, v] of Object.entries(obj)) {
    if (++count > 32) throw new Error("Tối đa 32 header")
    if (!HEADER_KEY_REGEX.test(k)) throw new Error(`Tên header không hợp lệ: ${k}`)
    const lowerKey = k.toLowerCase()
    if (FORBIDDEN_HEADERS.has(lowerKey)) {
      throw new Error(`Header không được phép: ${k}`)
    }
    if (typeof v !== "string" || v.length > 1024) {
      throw new Error(`Giá trị header không hợp lệ: ${k}`)
    }
    if (/[\r\n]/.test(v)) throw new Error("Header chứa ký tự không hợp lệ")
    out[k] = v
  }
  return out
}

export function validateInterval(seconds: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(seconds)) return { ok: false, reason: "Số giây phải là số nguyên" }
  if (seconds < 1) return { ok: false, reason: "Số giây phải lớn hơn 0" }
  if (seconds > 31_536_000) return { ok: false, reason: "Tối đa 1 năm" }
  return { ok: true }
}

// ─── Pricing (pure) ─────────────────────────────────────────────────────────

/**
 * Tính unit price của 1 server, áp dụng discount nếu còn hạn.
 */
export function calcServerUnitPrice(server: {
  price: number
  discountPercent: number
  discountValidUntil: Date | null
}): { unitPrice: number; discountActive: boolean } {
  const now = new Date()
  const discountActive =
    server.discountPercent > 0 &&
    (!server.discountValidUntil || new Date(server.discountValidUntil) > now)
  const unitPrice = discountActive
    ? Math.round(server.price * (1 - server.discountPercent / 100))
    : server.price
  return { unitPrice, discountActive }
}

// ─── Repository ─────────────────────────────────────────────────────────────

async function queryActiveServers() {
  const servers = (await ServerCronjob.find({ isActive: true })
    .select(
      "name price usageLimit currentUsage timeloop discountPercent discountValidUntil"
    )
    .sort({ price: 1 })
    .lean()) as any[]

  return servers.map((s) => {
    const { unitPrice, discountActive } = calcServerUnitPrice(s)
    const remaining = Math.max(0, s.usageLimit - s.currentUsage)
    return {
      id: s._id.toString(),
      name: s.name,
      price: unitPrice,
      originalPrice: s.price,
      discountPercent: discountActive ? s.discountPercent : 0,
      usageLimit: s.usageLimit,
      currentUsage: s.currentUsage,
      timeloop: s.timeloop || 30,
      remaining,
      full: remaining <= 0,
    }
  })
}

export async function listActiveServers() {
  if (activeServersInflight) return activeServersInflight

  activeServersInflight = queryActiveServers()
    .finally(() => {
      activeServersInflight = null
    })
  return activeServersInflight
}

export async function findActiveServer(serverId: string | Types.ObjectId) {
  const server = (await ServerCronjob.findById(serverId)
    .select(
      "name price usageLimit currentUsage discountPercent discountValidUntil isActive timeloop"
    )
    .lean()) as any
  if (!server || !server.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Máy chủ không khả dụng" })
  }
  if (server.currentUsage >= server.usageLimit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Máy chủ đã đầy",
    })
  }
  return server
}

export async function findUserCronjob(
  userId: Types.ObjectId | string,
  jobId: string
) {
  const job = (await Cronjob.findOne({ _id: jobId, userId })
    .select("_id status serverId expiresAt month")
    .lean()) as any
  if (!job) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
  }
  return job
}

export async function findRenewableCronjob(
  userId: Types.ObjectId | string,
  jobId: string
) {
  const job = (await Cronjob.findOne({ _id: jobId, userId })
    .select("_id serverId expiresAt status month")
    .lean()) as any
  if (!job) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
  }
  return job
}

// ─── Atomic ops ─────────────────────────────────────────────────────────────

/**
 * CAS reserve slot trên server. Trả về true nếu OK.
 */
export async function reserveServerSlot(serverId: Types.ObjectId | string): Promise<boolean> {
  const locked = await ServerCronjob.findOneAndUpdate(
    { _id: serverId, isActive: true, $expr: { $lt: ["$currentUsage", "$usageLimit"] } },
    { $inc: { currentUsage: 1 } },
    { new: true, projection: { _id: 1 } }
  )
  return !!locked
}

export async function releaseServerSlot(serverId: Types.ObjectId | string) {
  await ServerCronjob.updateOne(
    { _id: serverId, currentUsage: { $gt: 0 } },
    { $inc: { currentUsage: -1 } }
  ).catch((err) =>
    logger.warn("releaseServerSlot failed", {
      module: "cron.releaseServerSlot",
      error: (err as Error).message,
    })
  )
}

export interface CreateCronjobInput {
  userId: Types.ObjectId | string
  server: {
    _id: any
    name: string
  }
  url: string
  method: string
  intervalSeconds: number
  headers: string | null
  body: string | null
  month: number
  payment: number
  expiresAt: Date
}

export async function createCronjob(input: CreateCronjobInput) {
  try {
    return await Cronjob.create({
      userId: input.userId,
      serverId: input.server._id,
      serverName: input.server.name,
      url: input.url.trim(),
      method: input.method,
      intervalSeconds: input.intervalSeconds,
      headers: input.headers,
      body: input.body,
      month: input.month,
      payment: input.payment,
      status: "active",
      expiresAt: input.expiresAt,
      nextRunAt: new Date(),
    })
  } catch (err: any) {
    logger.error("Cronjob.create failed", err, {
      module: "cron.createCronjob",
      userId: String(input.userId),
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Tạo cronjob thất bại",
    })
  }
}

export async function deleteCronjobSafe(jobId: Types.ObjectId | string) {
  await Cronjob.deleteOne({ _id: jobId }).catch((err) =>
    logger.error("Cronjob rollback failed", err, {
      module: "cron.deleteCronjobSafe",
      jobId: String(jobId),
    })
  )
}

// ─── Aggregations ───────────────────────────────────────────────────────────

export interface ListMyCronjobsInput {
  userId: Types.ObjectId | string
  page: number
  limit: number
  search?: string
  status?: string
  sortField: "url" | "payment" | "createdAt" | "expiresAt" | "lastRun"
  sortDir: "asc" | "desc"
}

export async function listMyCronjobs(input: ListMyCronjobsInput) {
  const { page, limit, search, status, sortField, sortDir } = input
  const skip = (page - 1) * limit
  const sortMul = sortDir === "asc" ? 1 : -1

  const filter: Record<string, any> = { userId: input.userId }
  if (status) filter.status = status
  if (search) filter.url = { $regex: escapeRegex(search), $options: "i" }

  const sortKey: Record<string, 1 | -1> = { [sortField]: sortMul }

  const [items, total] = await Promise.all([
    Cronjob.find(filter)
      .sort(sortKey)
      .skip(skip)
      .limit(limit)
      .select(
        "url method intervalSeconds status month payment lastRun expiresAt statusCode lastResponse lastError lastDurationMs serverId serverName headers body createdAt"
      )
      .lean(),
    Cronjob.countDocuments(filter),
  ])

  return {
    items: (items as any[]).map((c) => ({
      id: c._id.toString(),
      url: c.url,
      method: c.method,
      intervalSeconds: c.intervalSeconds,
      status: c.status,
      month: c.month,
      payment: c.payment,
      lastRun: c.lastRun,
      expiresAt: c.expiresAt,
      statusCode: c.statusCode,
      lastResponse: c.lastResponse || null,
      lastError: c.lastError || null,
      lastDurationMs: c.lastDurationMs || null,
      serverId: c.serverId?.toString() || null,
      serverName: c.serverName,
      headers: c.headers || null,
      body: c.body || null,
      createdAt: c.createdAt,
    })),
    total,
  }
}

// ─── Status transitions ─────────────────────────────────────────────────────

/**
 * Toggle pending/active. Throw nếu đã expired.
 */
export async function toggleCronjobStatus(
  userId: Types.ObjectId | string,
  jobId: string
): Promise<"active" | "paused"> {
  const job = (await Cronjob.findOne({ _id: jobId, userId })
    .select("status")
    .lean()) as any
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
  if (job.status === "expired") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cronjob đã hết hạn" })
  }

  const next = job.status === "active" ? "paused" : "active"
  const setOps: Record<string, any> = { status: next }
  setOps.nextRunAt = next === "active" ? new Date() : null

  await Cronjob.updateOne({ _id: jobId, userId }, { $set: setOps })
  return next
}

export async function deleteCronjobByOwner(
  userId: Types.ObjectId | string,
  jobId: string
) {
  const job = (await Cronjob.findOne({
    _id: jobId,
    userId,
    status: { $in: ["paused", "expired"] },
  })
    .select("_id serverId status")
    .lean()) as any
  if (!job) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chỉ xóa được cron đang tạm dừng/hết hạn",
    })
  }

  await Cronjob.deleteOne({ _id: jobId })
  if (job.status === "paused") {
    await releaseServerSlot(job.serverId)
  }
  return job
}

export async function editCronjobConfig(
  userId: Types.ObjectId | string,
  jobId: string,
  config: {
    url: string
    method: string
    intervalSeconds: number
    headers: string | null
    body: string | null
  }
) {
  await Cronjob.updateOne(
    { _id: jobId, userId },
    {
      $set: {
        url: config.url.trim(),
        method: config.method,
        intervalSeconds: config.intervalSeconds,
        headers: config.headers,
        body: config.method === "POST" ? config.body : null,
        nextRunAt: new Date(),
      },
    }
  )
}

export async function extendCronjobExpiry(
  userId: Types.ObjectId | string,
  jobId: string,
  additionalMonths: number,
  finalAmount: number,
  currentExpiresAt: Date | null
) {
  const now = new Date()
  const baseTs =
    currentExpiresAt && new Date(currentExpiresAt) > now ? new Date(currentExpiresAt) : now
  const newExpiresAt = new Date(baseTs.getTime() + additionalMonths * ONE_MONTH_MS)

  await Cronjob.updateOne(
    { _id: jobId, userId },
    {
      $set: { expiresAt: newExpiresAt, status: "active", nextRunAt: new Date() },
      $inc: { month: additionalMonths, payment: finalAmount },
    }
  )

  return newExpiresAt
}
export interface CreateCronjobPurchaseInput {
  userId: Types.ObjectId | string
  serverId: string
  url: string
  method: "GET" | "POST"
  intervalSeconds: number
  month: number
  headers?: string | null
  body?: string | null
}

export interface CreateCronjobPurchaseResult {
  jobId: string
  url: string
  payment: number
}

export async function purchaseCronjob(input: CreateCronjobPurchaseInput): Promise<CreateCronjobPurchaseResult> {
  const urlCheck = validateCronUrl(input.url)
  if (!urlCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: urlCheck.reason })

  try {
    parseHeadersJson(input.headers ?? null)
  } catch (err: any) {
    throw new TRPCError({ code: "BAD_REQUEST", message: err.message })
  }

  const intervalCheck = validateInterval(input.intervalSeconds)
  if (!intervalCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: intervalCheck.reason })

  const server = await findActiveServer(input.serverId)

  // Server.timeloop là vòng lặp tối thiểu admin set cho từng server.
  const minInterval = server.timeloop || 30
  if (input.intervalSeconds < minInterval) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Vòng lặp tối thiểu ${minInterval} giây`,
    })
  }

  const { unitPrice } = calcServerUnitPrice(server)
  const payment = unitPrice * input.month
  await ensureUserHasBalance(input.userId, payment)

  const reserved = await reserveServerSlot(server._id)
  if (!reserved) throw new TRPCError({ code: "BAD_REQUEST", message: "Máy chủ vừa hết slot" })

  let newJob: any
  try {
    newJob = await createCronjob({
      userId: input.userId,
      server,
      url: input.url,
      method: input.method,
      intervalSeconds: input.intervalSeconds,
      headers: input.headers || null,
      body: input.body || null,
      month: input.month,
      payment,
      expiresAt: new Date(Date.now() + input.month * ONE_MONTH_MS),
    })
  } catch (err) {
    await releaseServerSlot(server._id)
    throw err
  }

  const balance = await deductBalanceAtomic(input.userId, payment)
  if (!balance) {
    await Promise.all([deleteCronjobSafe(newJob._id), releaseServerSlot(server._id)])
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư đã thay đổi" })
  }

  logBalanceChange({
    userId: input.userId,
    moneyBefore: balance.moneyBefore,
    moneyAfter: balance.moneyAfter,
    moneyChange: -payment,
    content: `Tạo cronjob: ${input.url.slice(0, 80)}`,
    module: "cron.create",
    orderId: String(newJob._id),
  })
  void import("@/services/rewards.service").then((m) =>
    m.awardRewardForPurchase({
      userId: input.userId,
      vndAmount: payment,
      context: `cronjob ${input.url.slice(0, 60)}`,
      refOrderId: newJob._id as any,
      refOrderType: "cronjob",
    })
  )
  invalidateCronjobCatalogCache()

  return { jobId: String(newJob._id), url: input.url, payment }
}

export interface ExtendCronjobPurchaseInput {
  userId: Types.ObjectId | string
  jobId: string
  additionalMonths: number
}

export interface ExtendCronjobPurchaseResult {
  jobId: string
  payment: number
  newExpiresAt: Date
}

export async function purchaseCronjobExtension(input: ExtendCronjobPurchaseInput): Promise<ExtendCronjobPurchaseResult> {
  const job = await findRenewableCronjob(input.userId, input.jobId)
  const server = (await ServerCronjob.findById(job.serverId)
    .select("price discountPercent discountValidUntil isActive")
    .lean()) as any
  if (!server || !server.isActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Server đã ngưng" })
  }

  const { unitPrice } = calcServerUnitPrice(server)
  const payment = unitPrice * input.additionalMonths
  await ensureUserHasBalance(input.userId, payment)

  const balance = await deductBalanceAtomic(input.userId, payment)
  if (!balance) throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư đã thay đổi" })

  try {
    const newExpiresAt = await extendCronjobExpiry(
      input.userId,
      input.jobId,
      input.additionalMonths,
      payment,
      job.expiresAt
    )

    logBalanceChange({
      userId: input.userId,
      moneyBefore: balance.moneyBefore,
      moneyAfter: balance.moneyAfter,
      moneyChange: -payment,
      content: `Gia hạn cronjob ${input.additionalMonths} tháng`,
      module: "cron.extend",
      orderId: input.jobId,
    })
    void import("@/services/rewards.service").then((m) =>
      m.awardRewardForPurchase({
        userId: input.userId,
        vndAmount: payment,
        context: `gia hạn cronjob`,
        refOrderId: input.jobId as any,
        refOrderType: "cronjob.extend",
      })
    )

    return { jobId: input.jobId, payment, newExpiresAt }
  } catch (err) {
    const refund = await refundBalance(input.userId, payment)
    if (refund) {
      logBalanceChange({
        userId: input.userId,
        moneyBefore: refund.moneyBefore,
        moneyAfter: refund.moneyAfter,
        moneyChange: payment,
        content: "Hoàn tiền lỗi gia hạn cronjob",
        module: "cron.extend.rollback",
        orderId: input.jobId,
      })
    }
    throw err
  }
}

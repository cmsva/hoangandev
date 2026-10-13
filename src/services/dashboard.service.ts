/**
 * Dashboard controller — aggregations cho overview / stats / charts.
 *
 * Gom 4 module (service, domain, cronjob, logo) thành 1 stats query.
 */
import type { Types } from "mongoose"
import { OrderService } from "@/models/service.model"
import { OrderDomain } from "@/models/domain.model"
import { Cronjob } from "@/models/cronjob.model"
import { LogoOrder } from "@/models/logo.model"
import { Log, LogBalance } from "@/models/log.model"

const DAY_SECONDS = 24 * 60 * 60
const DASHBOARD_STATS_TTL_MS = 30_000

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const dashboardStatsCache = new Map<string, CacheEntry<DashboardStats>>()

interface DashboardStats {
  activeWebsites: number
  expiringSoon: number
  activeDomains: number
  domainExpiringSoon: number
  activeCronjobs: number
  cronjobExpiringSoon: number
  totalLogoOrders: number
  pendingLogoOrders: number
}

// ─── Stats (overview) ──────────────────────────────────────────────────────

export async function getDashboardStats(userId: Types.ObjectId | string) {
  const cacheKey = String(userId)
  const cacheNow = Date.now()
  const cached = dashboardStatsCache.get(cacheKey)
  if (cached && cached.expiresAt > cacheNow) return cached.data

  const now = Math.floor(cacheNow / 1000)
  const thirtyDaysFromNow = now + 30 * DAY_SECONDS
  const thirtyDaysFromNowDate = new Date(thirtyDaysFromNow * 1000)

  const [
    activeWebsites,
    expiringSoon,
    activeDomains,
    domainExpiringSoon,
    activeCronjobs,
    cronjobExpiringSoon,
    totalLogoOrders,
    pendingLogoOrders,
  ] = await Promise.all([
    OrderService.countDocuments({ userId, status: "active", expired: { $gt: now } }),
    OrderService.countDocuments({
      userId,
      status: "active",
      expired: { $gt: now, $lte: thirtyDaysFromNow },
    }),
    OrderDomain.countDocuments({
      userId,
      status: { $in: ["pending", "completed", "renew_pending"] },
    }),
    OrderDomain.countDocuments({
      userId,
      status: { $in: ["pending", "completed"] },
      expiredAt: { $gt: new Date(), $lte: thirtyDaysFromNowDate },
    }),
    Cronjob.countDocuments({ userId, status: "active" }),
    Cronjob.countDocuments({
      userId,
      status: "active",
      expiresAt: { $gt: new Date(), $lte: thirtyDaysFromNowDate },
    }),
    LogoOrder.countDocuments({
      userId,
      status: { $nin: ["cancelled", "cancelled_refund", "error_refund"] },
    }),
    LogoOrder.countDocuments({ userId, status: "pending" }),
  ])

  const result = {
    activeWebsites,
    expiringSoon,
    activeDomains,
    domainExpiringSoon,
    activeCronjobs,
    cronjobExpiringSoon,
    totalLogoOrders,
    pendingLogoOrders,
  }
  dashboardStatsCache.set(cacheKey, { data: result, expiresAt: cacheNow + DASHBOARD_STATS_TTL_MS })
  return result
}

// ─── Recent transactions ────────────────────────────────────────────────────

export async function getRecentTransactions(userId: Types.ObjectId | string, limit = 8) {
  const logs = await LogBalance.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("content moneyChange moneyAfter createdAt")
    .lean()

  return (logs as any[]).map((log) => ({
    id: log._id.toString(),
    content: log.content,
    moneyChange: log.moneyChange,
    moneyAfter: log.moneyAfter,
    createdAt: log.createdAt,
  }))
}

// ─── Recent activity ────────────────────────────────────────────────────────

export async function getRecentActivity(userId: Types.ObjectId | string, limit = 5) {
  const logs = await Log.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("action ip device createdAt")
    .lean()

  return (logs as any[]).map((log) => ({
    id: log._id.toString(),
    action: log.action,
    ip: log.ip,
    device: log.device,
    createdAt: log.createdAt,
  }))
}

// ─── Chart data: 30-day balance flow ───────────────────────────────────────

export async function getBalanceChartData(userId: Types.ObjectId | string) {
  const DAYS = 30
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - (DAYS - 1))
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const grouped = await LogBalance.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        deposit: {
          $sum: { $cond: [{ $gt: ["$moneyChange", 0] }, "$moneyChange", 0] },
        },
        spending: {
          $sum: { $cond: [{ $lt: ["$moneyChange", 0] }, { $abs: "$moneyChange" }, 0] },
        },
      },
    },
  ])

  const map = new Map<string, { deposit: number; spending: number }>()
  for (const g of grouped as any[]) {
    map.set(g._id, { deposit: g.deposit, spending: g.spending })
  }

  const result: { label: string; deposit: number; spending: number }[] = []
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(d.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = map.get(key) ?? { deposit: 0, spending: 0 }
    result.push({ label, deposit: entry.deposit, spending: entry.spending })
  }

  return result
}

// ─── Paginated activity logs ────────────────────────────────────────────────

export async function getActivityLogsPaginated(
  userId: Types.ObjectId | string,
  opts: { page: number; limit: number; search?: string }
) {
  const filter: any = { userId }
  if (opts.search) {
    filter.action = { $regex: opts.search, $options: "i" }
  }
  const [total, logs] = await Promise.all([
    Log.countDocuments(filter),
    Log.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .select("action ip device createdAt")
      .lean(),
  ])
  return {
    items: (logs as any[]).map((l) => ({
      id: l._id.toString(),
      action: l.action,
      ip: l.ip,
      device: l.device,
      createdAt: l.createdAt,
    })),
    pagination: { total, page: opts.page, totalPages: Math.ceil(total / opts.limit) || 1 },
  }
}

// ─── Paginated transactions ─────────────────────────────────────────────────

export async function getTransactionsPaginated(
  userId: Types.ObjectId | string,
  opts: { page: number; limit: number; search?: string }
) {
  const filter: any = { userId }
  if (opts.search) {
    filter.content = { $regex: opts.search, $options: "i" }
  }
  const [total, logs] = await Promise.all([
    LogBalance.countDocuments(filter),
    LogBalance.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .select("content moneyBefore moneyChange moneyAfter createdAt")
      .lean(),
  ])
  return {
    items: (logs as any[]).map((l) => ({
      id: l._id.toString(),
      content: l.content,
      moneyBefore: l.moneyBefore,
      moneyChange: l.moneyChange,
      moneyAfter: l.moneyAfter,
      createdAt: l.createdAt,
    })),
    pagination: { total, page: opts.page, totalPages: Math.ceil(total / opts.limit) || 1 },
  }
}

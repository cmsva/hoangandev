/**
 * Admin service — aggregate stats cho dashboard admin.
 *
 * Pure logic, không phụ thuộc tRPC ctx. Tái sử dụng được ở mọi entry point.
 */
import os from "node:os"
import process from "node:process"
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { Invoice } from "@/models/invoice.model"
import { Card } from "@/models/card.model"
import { Order } from "@/models/order-product.model"
import { OrderDomain } from "@/models/domain.model"
import { LogoOrder } from "@/models/logo.model"
import { OrderService } from "@/models/service.model"
import { Cronjob } from "@/models/cronjob.model"
import { Log, LogBalance } from "@/models/log.model"
import { Types } from "mongoose"
import { escapeRegex } from "@/lib/sanitize"

// No DB cache — luôn fresh. Chỉ giữ inflight de-dupe để chống thundering herd.
const adminStatsInflight = new Map<TimeRangeKey, Promise<AdminStats>>()

// ─── Types ─────────────────────────────────────────────────────────────────

export type TimeRangeKey = "today" | "week" | "month" | "year" | "all"

export interface ServiceStats {
  count: number
  revenue: number
}

export interface AdminStats {
  range: { key: TimeRangeKey; label: string; start: string; end: string }
  users: number
  revenue: number
  services: {
    sourceCode: ServiceStats
    domains: ServiceStats
    logos: ServiceStats
    cronjobs: ServiceStats
    websites: ServiceStats
  }
  pending: {
    invoices: number
    cards: number
    domains: number
    logos: number
    websites: number
    cronjobsExpired: number
    sourceCodeLifetime: number
  }
  /** Doanh thu tách theo kên (trong range) */
  revenueByChannel: {
    invoice: number
    card: number
  }
  chartDays: Array<{
    label: string
    revenue: number
    members: number
  }>
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function resolveTimeRange(key: TimeRangeKey) {
  const now = new Date()
  const start = new Date()
  const end = new Date()

  switch (key) {
    case "today":
      start.setHours(0, 0, 0, 0)
      return { key, label: "Hôm nay", start, end }
    case "week":
      start.setDate(now.getDate() - 7)
      return { key, label: "7 ngày qua", start, end }
    case "month":
      start.setMonth(now.getMonth() - 1)
      return { key, label: "30 ngày qua", start, end }
    case "year":
      start.setFullYear(now.getFullYear() - 1)
      return { key, label: "1 năm qua", start, end }
    default:
      return { key, label: "Tất cả", start: new Date(0), end }
  }
}

function dayLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}`
}

async function aggregateService(
  Model: any,
  options: {
    start: Date
    end: Date
    priceField?: string
    dateField?: string
  }
): Promise<ServiceStats> {
  const { start, end, priceField = "price", dateField = "createdAt" } = options

  const result = await Model.aggregate([
    { $match: { [dateField]: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: `$${priceField}` },
      },
    },
  ])

  return {
    count: result[0]?.count ?? 0,
    revenue: result[0]?.revenue ?? 0,
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

async function computeAdminStats(
  rangeKey: TimeRangeKey = "today"
): Promise<AdminStats> {
  await connectDB()

  const range = resolveTimeRange(rangeKey)
  const dateMatch = { $gte: range.start, $lte: range.end }

  // ─── Users + Revenue + Pending + Services (parallel) ─────────────
  const [
    usersCount,
    invSum,
    cardSum,
    pendingInvoices,
    pendingCards,
    pendingDomains,
    pendingLogos,
    pendingWebsites,
    cronjobsExpired,
    sourceCodeLifetime,
    sourceCode,
    domains,
    logos,
    cronjobs,
    websites,
  ] = await Promise.all([
    User.countDocuments({ createdAt: dateMatch }),
    Invoice.aggregate([
      { $match: { status: 1, createdAt: dateMatch } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]),
    Card.aggregate([
      { $match: { status: 1, createdAt: dateMatch } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]),
    Invoice.countDocuments({ status: 0 }),
    Card.countDocuments({ status: 0 }),
    OrderDomain.countDocuments({ status: "pending" }),
    LogoOrder.countDocuments({ status: "pending" }),
    OrderService.countDocuments({ status: "pending" }),
    Cronjob.countDocuments({ status: "expired" }),
    Order.countDocuments({}),
    aggregateService(Order, { start: range.start, end: range.end, priceField: "totalPrice", dateField: "orderDate" }),
    aggregateService(OrderDomain, { start: range.start, end: range.end, priceField: "totalAmount" }),
    aggregateService(LogoOrder, { start: range.start, end: range.end, priceField: "price" }),
    aggregateService(Cronjob, { start: range.start, end: range.end, priceField: "payment" }),
    aggregateService(OrderService, { start: range.start, end: range.end, priceField: "total" }),
  ])

  const invoiceSum = invSum[0]?.sum ?? 0
  const cardRevenue = cardSum[0]?.sum ?? 0
  const revenue = invoiceSum + cardRevenue

  // ─── Chart 7 ngày gần nhất (independent of range — always 7d) ──────
  const today = startOfDay()
  const days: Date[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d)
  }
  const sevenAgo = days[0]

  const [revenueByDay, membersByDay] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 1, createdAt: { $gte: sevenAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sum: { $sum: "$amount" },
        },
      },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: sevenAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const revMap = new Map(revenueByDay.map((r: any) => [r._id, r.sum]))
  const memMap = new Map(membersByDay.map((r: any) => [r._id, r.count]))

  const chartDays = days.map((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return {
      label: dayLabel(d),
      revenue: revMap.get(key) ?? 0,
      members: memMap.get(key) ?? 0,
    }
  })

  return {
    range: {
      key: rangeKey,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    users: usersCount,
    revenue,
    services: { sourceCode, domains, logos, cronjobs, websites },
    pending: {
      invoices: pendingInvoices,
      cards: pendingCards,
      domains: pendingDomains,
      logos: pendingLogos,
      websites: pendingWebsites,
      cronjobsExpired,
      sourceCodeLifetime,
    },
    revenueByChannel: {
      invoice: invoiceSum,
      card: cardRevenue,
    },
    chartDays,
  }
}

export async function getAdminStats(
  rangeKey: TimeRangeKey = "today"
): Promise<AdminStats> {
  const inflight = adminStatsInflight.get(rangeKey)
  if (inflight) return inflight

  const pending = computeAdminStats(rangeKey)
    .finally(() => {
      adminStatsInflight.delete(rangeKey)
    })

  adminStatsInflight.set(rangeKey, pending)
  return pending
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export interface LogListParams {
  page: number
  limit: number
  userId?: string
  keyword?: string
}

export interface LogListResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Convert ObjectId/Date raw aggregation result to plain JSON serializable object.
 * Required when prefetching ở RSC + HydrateClient — React refuses to dehydrate
 * objects with `toJSON` methods (ObjectId.toJSON returns Buffer).
 */
function serializeLogItem(raw: any): any {
  if (!raw) return raw
  return {
    ...raw,
    _id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    userId: raw.userId?.toString?.() ?? (raw.userId ? String(raw.userId) : null),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    user: raw.user
      ? {
          _id: raw.user._id?.toString?.() ?? String(raw.user._id ?? ""),
          username: raw.user.username,
          fullname: raw.user.fullname,
        }
      : null,
  }
}

/**
 * List Log activity với phân trang và filter username/action keyword.
 * Lookup user để return kèm username.
 */
export async function getActivityLogs(
  params: LogListParams
): Promise<LogListResult<any>> {
  await connectDB()
  const page = Math.max(1, params.page)
  const limit = Math.min(100, Math.max(1, params.limit))
  const skip = (page - 1) * limit

  const match: Record<string, any> = {}
  if (params.userId && Types.ObjectId.isValid(params.userId)) {
    match.userId = new Types.ObjectId(params.userId)
  }
  if (params.keyword?.trim()) {
    match.action = { $regex: escapeRegex(params.keyword.trim()), $options: "i" }
  }

  const [items, total] = await Promise.all([
    Log.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { username: 1, fullname: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
    Log.countDocuments(match),
  ])

  return {
    items: items.map(serializeLogItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * List LogBalance với phân trang. Filter optional theo userId.
 */
export async function getBalanceLogs(
  params: LogListParams
): Promise<LogListResult<any>> {
  await connectDB()
  const page = Math.max(1, params.page)
  const limit = Math.min(100, Math.max(1, params.limit))
  const skip = (page - 1) * limit

  const match: Record<string, any> = {}
  if (params.userId && Types.ObjectId.isValid(params.userId)) {
    match.userId = new Types.ObjectId(params.userId)
  }
  if (params.keyword?.trim()) {
    match.content = { $regex: escapeRegex(params.keyword.trim()), $options: "i" }
  }

  const [items, total] = await Promise.all([
    LogBalance.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { username: 1, fullname: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
    LogBalance.countDocuments(match),
  ])

  return {
    items: items.map(serializeLogItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}


// ─── Server Info ──────────────────────────────────────────────────────────

export interface ServerInfo {
  hostname: string
  platform: string
  arch: string
  release: string
  uptimeSec: number
  uptimeHuman: string
  nodeVersion: string
  endianness: string
  tmpDir: string
  cpu: {
    model: string
    cores: number
    speedMhz: number
    load1: number
    load5: number
    load15: number
    loadPercent: number
  }
  memory: {
    total: number
    free: number
    used: number
    usedPercent: number
  }
  network: {
    primaryIPv4: string
    primaryIPv6: string
    primaryMac: string
    interfaceCount: number
  }
  user: {
    username: string
    shell: string
  }
  time: {
    timezone: string
    nowIso: string
  }
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

/**
 * OS + process metrics. Bao gồm CPU/RAM/uptime/network — display only.
 * Không expose env hoặc PATH (bảo mật).
 */
function computeServerInfo(): ServerInfo {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const loadAvg = os.loadavg()
  const uptimeSec = os.uptime()
  const nets = os.networkInterfaces()

  let primaryIPv4 = "N/A"
  let primaryIPv6 = "N/A"
  let primaryMac = "N/A"
  let ifCount = 0

  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue
    ifCount++
    for (const iface of ifaces) {
      if (iface.internal) continue
      if (iface.family === "IPv4" && primaryIPv4 === "N/A") {
        primaryIPv4 = iface.address
        primaryMac = iface.mac
      }
      if (iface.family === "IPv6" && primaryIPv6 === "N/A") {
        primaryIPv6 = iface.address
      }
    }
  }

  let userInfo: { username: string; shell: string }
  try {
    const u = os.userInfo()
    userInfo = { username: u.username || "N/A", shell: u.shell || "N/A" }
  } catch {
    userInfo = { username: "N/A", shell: "N/A" }
  }

  const cores = cpus.length || 1
  const loadPercent = Math.min(100, Math.round((loadAvg[0] / cores) * 100))

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptimeSec,
    uptimeHuman: formatUptime(uptimeSec),
    nodeVersion: process.version,
    endianness: os.endianness(),
    tmpDir: os.tmpdir(),
    cpu: {
      model: cpus[0]?.model || "N/A",
      cores,
      speedMhz: cpus[0]?.speed || 0,
      load1: loadAvg[0] || 0,
      load5: loadAvg[1] || 0,
      load15: loadAvg[2] || 0,
      loadPercent,
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usedPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
    },
    network: { primaryIPv4, primaryIPv6, primaryMac, interfaceCount: ifCount },
    user: userInfo,
    time: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "N/A",
      nowIso: new Date().toISOString(),
    },
  }
}
export function getServerInfo(): ServerInfo {
  return computeServerInfo()
}

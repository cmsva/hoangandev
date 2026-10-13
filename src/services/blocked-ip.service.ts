/**
 * Blocked IP Service — quản lý danh sách IP bị chặn.
 *
 * Pattern:
 *  - addBlock(ip, reason, source, ttlMs?) — upsert (cộng dồn hits + tăng expiresAt)
 *  - removeBlock(ip) — xoá khỏi DB
 *  - listBlocks(params) — list paginated
 *  - isBlocked(ip) — quick check (cached 30s) cho middleware/limiter
 *
 * MongoDB TTL index tự xoá khi expiresAt < now, nên không cần cron cleanup.
 */
import { TRPCError } from "@trpc/server"
import type { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import {
  BlockedIP,
  type BlockSource,
} from "@/models/blocked-ip.model"

// ─── Validators ────────────────────────────────────────────────────────────

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
// Đơn giản hoá IPv6 — chấp nhận form đầy đủ và compressed có ::
const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}|::)$/

export function normalizeIP(raw: string): string {
  return raw.trim().toLowerCase().replace(/^::ffff:/, "")
}

export function isValidIP(raw: string): boolean {
  const ip = normalizeIP(raw)
  if (!ip) return false
  return IPV4_RE.test(ip) || IPV6_RE.test(ip)
}

// ─── Repository ────────────────────────────────────────────────────────────

export interface BlockedIPItem {
  id: string
  ip: string
  reason: string | null
  source: BlockSource
  hits: number
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

function toItem(d: any): BlockedIPItem {
  return {
    id: String(d._id),
    ip: d.ip,
    reason: d.reason ?? null,
    source: d.source,
    hits: d.hits ?? 0,
    expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    createdBy: d.createdBy ? String(d.createdBy) : null,
  }
}

// ─── Quick check (cached) ──────────────────────────────────────────────────

const CHECK_TTL_MS = 30_000
let blockedSetCache: { value: Set<string>; expiresAt: number } | null = null

async function loadBlockedSet(): Promise<Set<string>> {
  await connectDB()
  const docs = await BlockedIP.find(
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    { ip: 1 }
  ).lean<Array<{ ip: string }>>()
  return new Set(docs.map((d) => d.ip))
}

/** Lấy mảng IP đang bị block (active) — dùng cho middleware refresh. */
export async function getActiveBlockedIPs(): Promise<string[]> {
  await connectDB()
  const docs = await BlockedIP.find(
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    { ip: 1 }
  ).lean<Array<{ ip: string }>>()
  return docs.map((d) => d.ip)
}

/** Kiểm tra IP có đang bị chặn không. Cache 30s. */
export async function isIPBlocked(ip: string): Promise<boolean> {
  if (!ip) return false
  const normalized = normalizeIP(ip)
  if (!normalized) return false
  const now = Date.now()
  if (!blockedSetCache || blockedSetCache.expiresAt <= now) {
    blockedSetCache = { value: await loadBlockedSet(), expiresAt: now + CHECK_TTL_MS }
  }
  return blockedSetCache.value.has(normalized)
}

export function invalidateBlockedIPCache(): void {
  blockedSetCache = null
}

// ─── Operations ────────────────────────────────────────────────────────────

export interface AddBlockInput {
  ip: string
  reason?: string | null
  source: BlockSource
  ttlMs?: number | null // null = vĩnh viễn
  createdBy?: Types.ObjectId | string | null
}

/**
 * Thêm/upsert IP vào blocklist.
 * - Nếu đã tồn tại: tăng hits +1, cập nhật reason mới, mở rộng expiresAt nếu lâu hơn.
 * - Nếu mới: tạo doc mới.
 */
export async function addBlock(input: AddBlockInput): Promise<BlockedIPItem> {
  await connectDB()
  const ip = normalizeIP(input.ip)
  if (!isValidIP(ip)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "IP không hợp lệ" })
  }

  const now = new Date()
  const expiresAt =
    input.ttlMs && input.ttlMs > 0 ? new Date(now.getTime() + input.ttlMs) : null

  const existing = (await BlockedIP.findOne({ ip }).lean()) as any
  if (existing) {
    // Mở rộng expiresAt nếu mới dài hơn (hoặc về null = vĩnh viễn)
    let newExpiresAt = existing.expiresAt
    if (!expiresAt) {
      newExpiresAt = null
    } else if (!existing.expiresAt || expiresAt > new Date(existing.expiresAt)) {
      newExpiresAt = expiresAt
    }

    const updated = await BlockedIP.findOneAndUpdate(
      { ip },
      {
        $inc: { hits: 1 },
        $set: {
          reason: input.reason ?? existing.reason ?? null,
          source: input.source,
          expiresAt: newExpiresAt,
        },
      },
      { new: true }
    )
    invalidateBlockedIPCache()
    return toItem(updated)
  }

  const doc = await BlockedIP.create({
    ip,
    reason: input.reason ?? null,
    source: input.source,
    createdBy: input.createdBy ?? null,
    hits: 1,
    expiresAt,
  })
  invalidateBlockedIPCache()
  return toItem(doc.toObject())
}

/** Xoá IP khỏi blocklist. */
export async function removeBlock(ip: string): Promise<void> {
  await connectDB()
  const normalized = normalizeIP(ip)
  await BlockedIP.deleteOne({ ip: normalized })
  invalidateBlockedIPCache()
}

/** Xoá nhiều IP cùng lúc. */
export async function removeBlocks(ips: string[]): Promise<number> {
  await connectDB()
  const normalized = ips.map(normalizeIP).filter(Boolean)
  if (normalized.length === 0) return 0
  const res = await BlockedIP.deleteMany({ ip: { $in: normalized } })
  invalidateBlockedIPCache()
  return res.deletedCount ?? 0
}

// ─── List ──────────────────────────────────────────────────────────────────

export interface ListBlocksInput {
  page: number
  limit: number
  keyword?: string
  source?: BlockSource | "all"
  status?: "active" | "expired" | "all"
}

export interface ListBlocksResult {
  items: BlockedIPItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats: {
    total: number
    manual: number
    auto: number
    callback: number
    permanent: number
  }
}

export async function listBlocks(input: ListBlocksInput): Promise<ListBlocksResult> {
  await connectDB()
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (input.keyword?.trim()) {
    const kw = input.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = [
      { ip: { $regex: kw, $options: "i" } },
      { reason: { $regex: kw, $options: "i" } },
    ]
  }
  if (input.source && input.source !== "all") {
    filter.source = input.source
  }
  if (input.status === "active") {
    filter.$or = [
      ...(filter.$or || []),
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ]
    if (filter.$or.length > 2 && !input.keyword) {
      // edge case — chỉ active filter, không keyword
    }
  }

  const [items, total, statsAgg] = await Promise.all([
    BlockedIP.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BlockedIP.countDocuments(filter),
    BlockedIP.aggregate([
      {
        $facet: {
          totalAll: [{ $count: "n" }],
          manual: [{ $match: { source: "manual" } }, { $count: "n" }],
          auto: [{ $match: { source: "auto" } }, { $count: "n" }],
          callback: [{ $match: { source: "callback" } }, { $count: "n" }],
          permanent: [{ $match: { expiresAt: null } }, { $count: "n" }],
        },
      },
    ]),
  ])

  const s = statsAgg[0] || {}
  const pickN = (a: any[]) => a?.[0]?.n ?? 0

  return {
    items: items.map(toItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      total: pickN(s.totalAll),
      manual: pickN(s.manual),
      auto: pickN(s.auto),
      callback: pickN(s.callback),
      permanent: pickN(s.permanent),
    },
  }
}

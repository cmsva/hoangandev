/**
 * Notification service — Layer 2 cho thông báo trong app.
 *
 * Public API:
 *   - createForUser(userId, payload)              — system event 1 user
 *   - createForUsers(userIds, payload)            — admin broadcast cho list user
 *   - createForAll(payload)                       — admin broadcast cho mọi user (chunked)
 *   - listForUser(userId, opts)                   — header dropdown + page list
 *   - countUnreadForUser(userId)                  — chip badge
 *   - markRead(userId, ids)                       — đánh dấu đã đọc 1 hoặc nhiều
 *   - markAllRead(userId)
 *   - removeForUser(userId, id)                   — user xoá
 *   - adminList(...)                              — admin page list
 *   - adminDelete(id)                             — admin xoá toàn bộ rows của 1 đợt
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { logger } from "@/lib/logger"
import {
  Notification,
  NOTIFICATION_TYPES,
  type NotificationType,
  type NotificationSource,
} from "@/models/notification.model"
import { User } from "@/models/user.model"
import { emitToUser } from "@/lib/realtime/emit"

// ─── Constants ──────────────────────────────────────────────────────────────

const FANOUT_CHUNK = 1000

export interface NotificationPayload {
  type?: NotificationType
  source?: NotificationSource
  title: string
  content?: string
  link?: string | null
}

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Tạo 1 noti cho 1 user. Best-effort — caller catch nếu cần.
 */
export async function createForUser(
  userId: Types.ObjectId | string,
  payload: NotificationPayload
): Promise<void> {
  if (!payload.title?.trim()) return
  try {
    await Notification.create({
      userId,
      type: payload.type || "general",
      source: payload.source || "system",
      title: payload.title.trim(),
      content: payload.content || "",
      link: payload.link || null,
    })
    // Real-time: báo client làm mới badge + danh sách (best-effort).
    emitToUser(userId, "notification:new", { type: payload.type || "general" })
  } catch (err) {
    logger.warn("createForUser failed", {
      module: "notification.create",
      userId: String(userId),
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Fan-out cho 1 list userIds. Chunked bulkWrite tránh OOM với nhiều người.
 */
export async function createForUsers(
  userIds: Array<Types.ObjectId | string>,
  payload: NotificationPayload
): Promise<{ inserted: number }> {
  if (!payload.title?.trim() || userIds.length === 0) return { inserted: 0 }
  let inserted = 0
  for (let i = 0; i < userIds.length; i += FANOUT_CHUNK) {
    const chunk = userIds.slice(i, i + FANOUT_CHUNK)
    const docs = chunk.map((uid) => ({
      userId: uid,
      type: payload.type || "general",
      source: payload.source || "admin",
      title: payload.title.trim(),
      content: payload.content || "",
      link: payload.link || null,
    }))
    try {
      const res = await Notification.insertMany(docs, { ordered: false })
      inserted += res.length
      // Real-time fan-out (best-effort): báo từng user trong chunk.
      for (const uid of chunk) emitToUser(uid, "notification:new", { type: payload.type || "general" })
    } catch (err) {
      logger.warn("createForUsers chunk failed", {
        module: "notification.fanout",
        chunk: i / FANOUT_CHUNK,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { inserted }
}

/**
 * Broadcast cho mọi user chưa banned. Streaming cursor để không load full
 * userIds vào memory với DB lớn.
 */
export async function createForAll(
  payload: NotificationPayload
): Promise<{ inserted: number }> {
  const cursor = User.find({ banned: { $ne: 1 } }).select("_id").lean().cursor()
  let buffer: Array<Types.ObjectId> = []
  let inserted = 0
  for await (const u of cursor as any) {
    buffer.push(u._id as Types.ObjectId)
    if (buffer.length >= FANOUT_CHUNK) {
      const r = await createForUsers(buffer, payload)
      inserted += r.inserted
      buffer = []
    }
  }
  if (buffer.length) {
    const r = await createForUsers(buffer, payload)
    inserted += r.inserted
  }
  return { inserted }
}

// ─── User reads ─────────────────────────────────────────────────────────────

export async function countUnreadForUser(userId: Types.ObjectId | string): Promise<number> {
  return Notification.countDocuments({ userId, readAt: null })
}

export async function listForUser(
  userId: Types.ObjectId | string,
  opts: {
    page?: number
    limit?: number
    onlyUnread?: boolean
  } = {}
) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const limit = Math.min(50, Math.max(1, Math.floor(opts.limit || 20)))
  const filter: Record<string, unknown> = { userId }
  if (opts.onlyUnread) filter.readAt = null
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, readAt: null }),
  ])
  return {
    items: (items as any[]).map((it) => ({
      id: String(it._id),
      type: it.type as NotificationType,
      source: it.source as NotificationSource,
      title: it.title,
      content: it.content || "",
      link: it.link || null,
      readAt: it.readAt as Date | null,
      createdAt: it.createdAt as Date,
    })),
    total,
    unread,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function markRead(
  userId: Types.ObjectId | string,
  ids: string[]
): Promise<{ modified: number }> {
  if (ids.length === 0) return { modified: 0 }
  const objectIds = ids.map((id) => new Types.ObjectId(id))
  const res = await Notification.updateMany(
    { _id: { $in: objectIds }, userId, readAt: null },
    { $set: { readAt: new Date() } }
  )
  return { modified: res.modifiedCount }
}

export async function markAllRead(
  userId: Types.ObjectId | string
): Promise<{ modified: number }> {
  const res = await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  )
  return { modified: res.modifiedCount }
}

export async function removeForUser(
  userId: Types.ObjectId | string,
  id: string
): Promise<void> {
  await Notification.deleteOne({ _id: new Types.ObjectId(id), userId })
}

// ─── Admin reads ────────────────────────────────────────────────────────────

/**
 * Admin list — hiển thị tổng hợp các "đợt" thông báo gửi đi.
 * Group theo (title, content, source, createdAt floor minute) — đủ để
 * gom 1 broadcast vào 1 hàng.
 */
export async function adminListBroadcasts(opts: {
  page?: number
  limit?: number
  search?: string
}) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit || 20)))
  const match: Record<string, unknown> = { source: "admin" }
  if (opts.search?.trim()) {
    const safe = opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    match.title = { $regex: safe, $options: "i" }
  }

  const pipeline: any[] = [
    { $match: match },
    {
      $group: {
        _id: {
          title: "$title",
          content: "$content",
          link: "$link",
          minute: {
            $dateToString: { format: "%Y-%m-%dT%H:%M", date: "$createdAt" },
          },
        },
        firstId: { $first: "$_id" },
        type: { $first: "$type" },
        recipients: { $sum: 1 },
        readCount: {
          $sum: { $cond: [{ $ne: ["$readAt", null] }, 1, 0] },
        },
        createdAt: { $first: "$createdAt" },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    },
  ]

  const [agg] = (await Notification.aggregate(pipeline)) as any[]
  const items = (agg?.data || []).map((it: any) => ({
    id: String(it.firstId),
    title: it._id.title,
    content: it._id.content,
    link: it._id.link,
    type: it.type,
    recipients: it.recipients,
    readCount: it.readCount,
    createdAt: it.createdAt,
  }))
  const total = agg?.meta?.[0]?.total || 0
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * Admin xoá toàn bộ rows của 1 đợt broadcast — match theo title + content +
 * link + cùng phút.
 */
export async function adminDeleteBroadcast(broadcastId: string) {
  const head = (await Notification.findById(broadcastId).lean()) as any
  if (!head) return { deleted: 0 }
  const created = new Date(head.createdAt)
  const minStart = new Date(Math.floor(created.getTime() / 60_000) * 60_000)
  const minEnd = new Date(minStart.getTime() + 60_000)
  const res = await Notification.deleteMany({
    title: head.title,
    content: head.content,
    link: head.link ?? null,
    source: "admin",
    createdAt: { $gte: minStart, $lt: minEnd },
  })
  return { deleted: res.deletedCount }
}

// Export type list (cho zod enum)
export const ALL_NOTIFICATION_TYPES = NOTIFICATION_TYPES

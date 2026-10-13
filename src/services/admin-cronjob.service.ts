/**
 * Admin cronjob service — quản lý ServerCronjob (catalog) + Cronjob (đơn).
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { ServerCronjob, Cronjob, CRONJOB_STATUSES, type CronjobStatus } from "@/models/cronjob.model"
import { escapeRegex } from "@/lib/sanitize"

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

// ═══ SERVERS (Máy chủ catalog) ══════════════════════════════════════════════

export interface ServerListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminServers(input: ServerListInput) {
  const { page, limit, keyword } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (keyword) {
    filter.name = { $regex: escapeRegex(keyword), $options: "i" }
  }

  // Single-roundtrip: items with active job count + total
  const [result] = await ServerCronjob.aggregate([
    { $match: filter },
    {
      $facet: {
        items: [
          { $sort: { isActive: -1, price: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "cronjobs",
              let: { serverId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$serverId", "$$serverId"] },
                    status: "active",
                  },
                },
                { $count: "n" },
              ],
              as: "_active",
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              price: 1,
              usageLimit: 1,
              currentUsage: 1,
              timeloop: 1,
              discountPercent: 1,
              discountValidUntil: 1,
              isActive: 1,
              createdAt: 1,
              activeJobs: { $ifNull: [{ $arrayElemAt: ["$_active.n", 0] }, 0] },
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    },
  ])

  const items = (result?.items ?? []) as any[]
  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: items.map((s: any) => ({
      id: String(s._id),
      name: s.name,
      price: s.price,
      usageLimit: s.usageLimit,
      currentUsage: s.currentUsage,
      timeloop: s.timeloop,
      discountPercent: s.discountPercent,
      discountValidUntil: s.discountValidUntil,
      isActive: s.isActive,
      activeJobs: s.activeJobs ?? 0,
      remaining: Math.max(0, s.usageLimit - (s.currentUsage ?? 0)),
      createdAt: s.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface ServerUpsertInput {
  name: string
  price: number
  usageLimit: number
  timeloop: number
  discountPercent?: number
  discountValidUntil?: Date | null
  isActive: boolean
}

export async function createServer(input: ServerUpsertInput) {
  const doc = await ServerCronjob.create({
    name: input.name.trim(),
    price: Math.max(0, input.price),
    usageLimit: Math.max(0, Math.floor(input.usageLimit)),
    timeloop: Math.max(1, Math.floor(input.timeloop)),
    discountPercent: Math.max(0, Math.min(100, input.discountPercent ?? 0)),
    discountValidUntil: input.discountValidUntil ?? null,
    isActive: input.isActive,
    currentUsage: 0,
  })
  return { id: String(doc._id) }
}

export async function getServer(id: string) {
  const s = (await ServerCronjob.findById(toObjectId(id)).lean()) as any
  if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy máy chủ" })
  return {
    id: String(s._id),
    name: s.name,
    price: s.price,
    usageLimit: s.usageLimit,
    currentUsage: s.currentUsage,
    timeloop: s.timeloop,
    discountPercent: s.discountPercent,
    discountValidUntil: s.discountValidUntil ? new Date(s.discountValidUntil).toISOString() : null,
    isActive: s.isActive,
  }
}

export async function updateServer(id: string, input: ServerUpsertInput) {
  const _id = toObjectId(id)
  await ServerCronjob.updateOne(
    { _id },
    {
      $set: {
        name: input.name.trim(),
        price: Math.max(0, input.price),
        usageLimit: Math.max(0, Math.floor(input.usageLimit)),
        timeloop: Math.max(1, Math.floor(input.timeloop)),
        discountPercent: Math.max(0, Math.min(100, input.discountPercent ?? 0)),
        discountValidUntil: input.discountValidUntil ?? null,
        isActive: input.isActive,
      },
    }
  )
}

export async function deleteServer(id: string) {
  const _id = toObjectId(id)
  // Guard: máy chủ đang có active jobs → chặn
  const active = await Cronjob.countDocuments({ serverId: _id, status: "active" })
  if (active > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa máy chủ: đang chạy ${active} cronjob. Vui lòng tắt máy chủ (isActive=false) thay vì xóa để bảo lưu lịch sử.`,
    })
  }
  await ServerCronjob.deleteOne({ _id })
}

// ═══ CRONJOBS (Đơn) ═════════════════════════════════════════════════════════

export interface AdminCronjobListInput {
  page: number
  limit: number
  keyword?: string
  status?: CronjobStatus
}

export async function listAdminCronjobs(input: AdminCronjobListInput) {
  const { page, limit, keyword, status } = input
  const skip = (page - 1) * limit

  const matchStage: Record<string, any> = {}
  if (status) matchStage.status = status

  const basePipeline: any[] = [
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
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
  ]

  if (keyword) {
    const re = new RegExp(escapeRegex(keyword), "i")
    basePipeline.push({
      $match: {
        $or: [
          { url: re },
          { serverName: re },
          { "user.username": re },
        ],
      },
    })
  }

  const [result] = await Cronjob.aggregate([
    ...basePipeline,
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    },
  ])

  const items = (result?.items ?? []) as any[]
  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: items.map((c: any) => ({
      id: String(c._id),
      url: c.url,
      method: c.method,
      intervalSeconds: c.intervalSeconds,
      headers: c.headers ?? null,
      body: c.body ?? null,
      month: c.month,
      payment: c.payment,
      status: c.status,
      lastRun: c.lastRun,
      nextRunAt: c.nextRunAt,
      expiresAt: c.expiresAt,
      statusCode: c.statusCode,
      lastDurationMs: c.lastDurationMs,
      lastError: c.lastError,
      serverId: String(c.serverId),
      serverName: c.serverName,
      createdAt: c.createdAt,
      user: c.user
        ? { id: String(c.user._id), username: c.user.username, fullname: c.user.fullname }
        : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface CronjobUpdateInput {
  status: CronjobStatus
  url?: string
  method?: "GET" | "POST"
  intervalSeconds?: number
  headers?: string | null
  body?: string | null
  payment?: number
  expiresAt?: Date
  adminNote?: string | null
}

export async function getAdminCronjob(id: string) {
  const c = (await Cronjob.findById(toObjectId(id))
    .populate("userId", "username fullname")
    .lean()) as any
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
  return {
    id: String(c._id),
    url: c.url,
    method: c.method,
    intervalSeconds: c.intervalSeconds,
    headers: c.headers ?? "",
    body: c.body ?? "",
    month: c.month,
    payment: c.payment,
    status: c.status,
    serverId: String(c.serverId),
    serverName: c.serverName,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    user: c.userId
      ? { id: String(c.userId._id), username: c.userId.username, fullname: c.userId.fullname }
      : null,
  }
}

export async function updateAdminCronjob(id: string, input: CronjobUpdateInput) {
  const _id = toObjectId(id)
  if (!CRONJOB_STATUSES.includes(input.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái không hợp lệ" })
  }

  const update: Record<string, any> = { status: input.status }

  if (typeof input.url === "string") {
    const u = input.url.trim()
    if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "URL phải bắt đầu bằng http:// hoặc https://" })
    }
    update.url = u
  }
  if (input.method) update.method = input.method
  if (typeof input.intervalSeconds === "number") {
    update.intervalSeconds = Math.max(1, Math.floor(input.intervalSeconds))
  }
  if (input.headers !== undefined) update.headers = input.headers || null
  if (input.body !== undefined) update.body = input.body || null
  if (typeof input.payment === "number") update.payment = Math.max(0, input.payment)
  if (input.expiresAt instanceof Date) update.expiresAt = input.expiresAt

  // Re-compute nextRunAt nếu đổi sang active hoặc đổi interval
  if (input.status === "active") {
    update.nextRunAt = new Date(Date.now() + (update.intervalSeconds ?? 60) * 1000)
  } else if (input.status === "paused" || input.status === "expired") {
    update.nextRunAt = null
  }

  await Cronjob.updateOne({ _id }, { $set: update })
}

export async function deleteAdminCronjob(id: string) {
  const _id = toObjectId(id)
  const cron = (await Cronjob.findById(_id).select("serverId status").lean()) as any
  if (!cron) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
  }
  // Atomic: delete + decrement currentUsage nếu active
  const ops: Promise<any>[] = [Cronjob.deleteOne({ _id })]
  if (cron.status === "active") {
    ops.push(
      ServerCronjob.updateOne(
        { _id: cron.serverId, currentUsage: { $gt: 0 } },
        { $inc: { currentUsage: -1 } }
      )
    )
  }
  await Promise.all(ops)
}

// ─── Bulk Delete ───
export async function bulkDeleteCronjobServers(ids: string[]) {
  const result = await ServerCronjob.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteCronjobOrders(ids: string[]) {
  const result = await Cronjob.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

/**
 * Admin domain service — quản lý TLD pricing + Order domains.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { DomainProviderConfig, DomainTld, OrderDomain, ORDER_DOMAIN_STATUSES, type OrderDomainStatus } from "@/models/domain.model"
import { decryptValue, encryptValue, maskCredential } from "@/lib/encryption"
import { escapeRegex } from "@/lib/sanitize"
import { invalidateTldCache } from "@/lib/tld-cache"
import { spaceshipCheckConnection } from "@/services/spaceship.service"
import { emitToUser } from "@/lib/realtime/emit"

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

// ═══ TLDs (Bảng giá tên miền) ═══════════════════════════════════════════════

export interface TldListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminTlds(input: TldListInput) {
  const { page, limit, keyword } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (keyword) {
    filter.tld = { $regex: escapeRegex(keyword.toLowerCase().replace(/^\./, "")), $options: "i" }
  }

  // ─── Single roundtrip: items (with active orders count) + total ───
  const [result] = await DomainTld.aggregate([
    { $match: filter },
    {
      $facet: {
        items: [
          { $sort: { priceSold: 1, tld: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "orderdomains",
              let: { tldId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$tldId", "$$tldId"] },
                    status: { $in: ["pending", "completed", "renew_pending", "suspended"] },
                  },
                },
                { $count: "n" },
              ],
              as: "_orders",
            },
          },
          {
            $project: {
              _id: 1,
              tld: 1,
              priceCost: 1,
              renewCost: 1,
              priceSold: 1,
              renewSold: 1,
              provider: 1,
              providerTld: 1,
              autoRegisterEnabled: 1,
              autoRenewEnabled: 1,
              markupType: 1,
              markupValue: 1,
              isActive: 1,
              createdAt: 1,
              activeOrders: { $ifNull: [{ $arrayElemAt: ["$_orders.n", 0] }, 0] },
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
    items: items.map((t: any) => ({
      id: String(t._id),
      tld: t.tld,
      priceCost: t.priceCost,
      renewCost: t.renewCost,
      priceSold: t.priceSold,
      renewSold: t.renewSold,
      provider: t.provider ?? "manual",
      providerTld: t.providerTld ?? null,
      autoRegisterEnabled: t.autoRegisterEnabled ?? false,
      autoRenewEnabled: t.autoRenewEnabled ?? false,
      markupType: t.markupType ?? null,
      markupValue: t.markupValue ?? 0,
      isActive: t.isActive,
      activeOrders: t.activeOrders ?? 0,
      createdAt: t.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface TldUpsertInput {
  tld: string
  priceCost: number
  renewCost: number
  priceSold: number
  renewSold: number
  provider?: "manual" | "spaceship"
  providerTld?: string | null
  autoRegisterEnabled?: boolean
  autoRenewEnabled?: boolean
  markupType?: "fixed" | "percent" | null
  markupValue?: number
  isActive: boolean
}

export async function createTld(input: TldUpsertInput) {
  const tld = input.tld.toLowerCase().trim().replace(/^\./, "")
  if (!tld) throw new TRPCError({ code: "BAD_REQUEST", message: "TLD không hợp lệ" })

  const exists = await DomainTld.findOne({ tld }).select("_id").lean()
  if (exists) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `TLD .${tld} đã tồn tại` })
  }

  const doc = await DomainTld.create({
    tld,
    priceCost: Math.max(0, input.priceCost),
    renewCost: Math.max(0, input.renewCost),
    priceSold: Math.max(0, input.priceSold),
    renewSold: Math.max(0, input.renewSold),
    provider: input.provider ?? "manual",
    providerTld: input.provider === "spaceship" ? input.providerTld?.toLowerCase().trim().replace(/^\./, "") || tld : null,
    autoRegisterEnabled: input.provider === "spaceship" ? input.autoRegisterEnabled ?? false : false,
    autoRenewEnabled: input.provider === "spaceship" ? input.autoRenewEnabled ?? false : false,
    markupType: input.markupType ?? null,
    markupValue: Math.max(0, input.markupValue ?? 0),
    isActive: input.isActive,
  })
  invalidateTldCache()
  return { id: String(doc._id) }
}

export async function getTld(id: string) {
  const t = (await DomainTld.findById(toObjectId(id)).lean()) as any
  if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy TLD" })
  return {
    id: String(t._id),
    tld: t.tld,
    priceCost: t.priceCost,
    renewCost: t.renewCost,
    priceSold: t.priceSold,
    renewSold: t.renewSold,
    provider: t.provider ?? "manual",
    providerTld: t.providerTld ?? null,
    autoRegisterEnabled: t.autoRegisterEnabled ?? false,
    autoRenewEnabled: t.autoRenewEnabled ?? false,
    markupType: t.markupType ?? null,
    markupValue: t.markupValue ?? 0,
    isActive: t.isActive,
  }
}

export async function updateTld(id: string, input: TldUpsertInput) {
  const _id = toObjectId(id)
  const tld = input.tld.toLowerCase().trim().replace(/^\./, "")

  // Check unique
  const dup = await DomainTld.findOne({ tld, _id: { $ne: _id } }).select("_id").lean()
  if (dup) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `TLD .${tld} đã tồn tại` })
  }

  await DomainTld.updateOne(
    { _id },
    {
      $set: {
        tld,
        priceCost: Math.max(0, input.priceCost),
        renewCost: Math.max(0, input.renewCost),
        priceSold: Math.max(0, input.priceSold),
        renewSold: Math.max(0, input.renewSold),
        provider: input.provider ?? "manual",
        providerTld: input.provider === "spaceship" ? input.providerTld?.toLowerCase().trim().replace(/^\./, "") || tld : null,
        autoRegisterEnabled: input.provider === "spaceship" ? input.autoRegisterEnabled ?? false : false,
        autoRenewEnabled: input.provider === "spaceship" ? input.autoRenewEnabled ?? false : false,
        markupType: input.markupType ?? null,
        markupValue: Math.max(0, input.markupValue ?? 0),
        isActive: input.isActive,
      },
    }
  )
  invalidateTldCache()
}

export async function deleteTld(id: string) {
  const _id = toObjectId(id)
  // Guard: TLD đang được dùng ở order active → chặn
  const active = await OrderDomain.countDocuments({
    tldId: _id,
    status: { $in: ["pending", "completed", "renew_pending", "suspended"] },
  })
  if (active > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa TLD: đang có ${active} domain hoạt động dùng TLD này. Vui lòng chuyển sang trạng thái không kích hoạt thay vì xóa.`,
    })
  }
  await DomainTld.deleteOne({ _id })
  invalidateTldCache()
}

// ═══ Provider config (Spaceship) ════════════════════════════════════════════

export interface DomainProviderConfigInput {
  name: string
  apiKey?: string
  apiSecret?: string
  contactId: string
  autoRegisterEnabled: boolean
  autoRenewEnabled: boolean
  markupType: "fixed" | "percent"
  markupValue: number
  usdToVndRate: number
  syncSlugs: string[]
  status: "active" | "disabled"
  notes?: string | null
}

export async function getSpaceshipConfig() {
  const config = await DomainProviderConfig.findOne({ provider: "spaceship" }).lean() as any
  if (!config) return null
  return {
    id: String(config._id),
    provider: "spaceship" as const,
    name: config.name,
    apiKey: maskCredential(config.apiKeyEnc),
    apiSecret: maskCredential(config.apiSecretEnc),
    contactId: config.contactId,
    autoRegisterEnabled: config.autoRegisterEnabled,
    autoRenewEnabled: config.autoRenewEnabled,
    markupType: config.markupType,
    markupValue: config.markupValue,
    usdToVndRate: config.usdToVndRate ?? 26000,
    syncSlugs: Array.isArray(config.syncSlugs) ? config.syncSlugs : [],
    status: config.status,
    notes: config.notes,
  }
}

export async function upsertSpaceshipConfig(input: DomainProviderConfigInput) {
  const existing = await DomainProviderConfig.findOne({ provider: "spaceship" }).select("_id apiKeyEnc apiSecretEnc").lean() as any
  if (!existing && (!input.apiKey || !input.apiSecret)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API key/secret" })
  }
  const update: Record<string, unknown> = {
    provider: "spaceship",
    name: input.name,
    contactId: input.contactId,
    autoRegisterEnabled: input.autoRegisterEnabled,
    autoRenewEnabled: input.autoRenewEnabled,
    markupType: input.markupType,
    markupValue: Math.max(0, input.markupValue),
    usdToVndRate: Math.max(1, input.usdToVndRate || 26000),
    syncSlugs: (input.syncSlugs || [])
      .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean),
    status: input.status,
    notes: input.notes ?? null,
  }
  if (input.apiKey) update.apiKeyEnc = encryptValue(input.apiKey)
  if (input.apiSecret) update.apiSecretEnc = encryptValue(input.apiSecret)
  await DomainProviderConfig.updateOne({ provider: "spaceship" }, { $set: update }, { upsert: true })
  return { success: true }
}

export async function testSpaceshipConfig() {
  const config = await DomainProviderConfig.findOne({ provider: "spaceship" }).lean() as any
  if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "Chưa cấu hình Spaceship" })
  const apiKey = decryptValue(config.apiKeyEnc)
  const apiSecret = decryptValue(config.apiSecretEnc)
  if (!apiKey || !apiSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API Spaceship" })
  await spaceshipCheckConnection({ apiKey, apiSecret })
  return { success: true, message: "Spaceship API kết nối được" }
}

// ═══ ORDERS (Đơn domain) ════════════════════════════════════════════════════

export interface AdminOrderDomainListInput {
  page: number
  limit: number
  keyword?: string
  status?: OrderDomainStatus
}

export async function listAdminDomainOrders(input: AdminOrderDomainListInput) {
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
    const re = new RegExp(escapeRegex(keyword.toLowerCase()), "i")
    basePipeline.push({
      $match: {
        $or: [
          { domainName: re },
          { "user.username": re },
        ],
      },
    })
  }

  const [result] = await OrderDomain.aggregate([
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
    items: items.map((o: any) => ({
      id: String(o._id),
      domainName: o.domainName,
      tldName: o.tldName,
      ns1: o.ns1 ?? "",
      ns2: o.ns2 ?? "",
      status: o.status,
      provider: o.provider ?? "manual",
      providerStatus: o.providerStatus ?? "manual",
      totalAmount: o.totalAmount,
      renewAmount: o.renewAmount,
      renewCount: o.renewCount ?? 0,
      expiredAt: o.expiredAt,
      adminNote: o.adminNote,
      createdAt: o.createdAt,
      user: o.user
        ? { id: String(o.user._id), username: o.user.username, fullname: o.user.fullname }
        : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface DomainOrderUpdateInput {
  status: OrderDomainStatus
  ns1?: string
  ns2?: string
  totalAmount?: number
  renewAmount?: number | null
  expiredAt?: Date | null
  adminNote?: string | null
}

export async function getDomainOrder(id: string) {
  const o = (await OrderDomain.findById(toObjectId(id))
    .populate("userId", "username fullname")
    .lean()) as any
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  return {
    id: String(o._id),
    domainName: o.domainName,
    tldName: o.tldName,
    ns1: o.ns1 ?? "",
    ns2: o.ns2 ?? "",
    status: o.status,
    provider: o.provider ?? "manual",
    providerStatus: o.providerStatus ?? "manual",
    providerOrderId: o.providerOrderId ?? null,
    providerAsyncOpId: o.providerAsyncOpId ?? null,
    totalAmount: o.totalAmount,
    renewAmount: o.renewAmount,
    renewCount: o.renewCount ?? 0,
    expiredAt: o.expiredAt ? new Date(o.expiredAt).toISOString() : null,
    adminNote: o.adminNote ?? "",
    createdAt: o.createdAt,
    user: o.userId
      ? { id: String(o.userId._id), username: o.userId.username, fullname: o.userId.fullname }
      : null,
  }
}

export async function updateDomainOrder(id: string, input: DomainOrderUpdateInput) {
  const _id = toObjectId(id)

  if (!ORDER_DOMAIN_STATUSES.includes(input.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái không hợp lệ" })
  }

  const update: Record<string, any> = {
    status: input.status,
  }
  if (typeof input.ns1 === "string") update.ns1 = input.ns1.toLowerCase().trim()
  if (typeof input.ns2 === "string") update.ns2 = input.ns2.toLowerCase().trim()
  if (typeof input.totalAmount === "number") update.totalAmount = Math.max(0, input.totalAmount)
  if (input.renewAmount !== undefined) {
    update.renewAmount = input.renewAmount === null ? null : Math.max(0, input.renewAmount)
  }
  if (input.expiredAt !== undefined) update.expiredAt = input.expiredAt
  if (input.adminNote !== undefined) update.adminNote = input.adminNote

  const before = (await OrderDomain.findOneAndUpdate({ _id }, { $set: update })
    .select("userId domainName status")
    .lean()) as any

  // Real-time: báo chủ đơn domain khi admin đổi trạng thái (best-effort).
  if (before?.userId) {
    emitToUser(before.userId, "order:update", { orderId: id, type: "domain", status: input.status })
  }

  return {
    ownerId: before?.userId ? String(before.userId) : null,
    orderName: before?.domainName ?? "",
    statusChanged: !!before && before.status !== input.status,
    status: input.status,
  }
}

export async function deleteDomainOrder(id: string) {
  const _id = toObjectId(id)
  await OrderDomain.deleteOne({ _id })
}

// ─── Bulk Delete ───
export async function bulkDeleteTlds(ids: string[]) {
  const result = await DomainTld.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteDomainOrders(ids: string[]) {
  const result = await OrderDomain.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

/**
 * Admin logo service — CRUD CategoryLogo + Logo + LogoOrder.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { CategoryLogo, Logo, LogoOrder, LOGO_ORDER_STATUSES, type LogoOrderStatus } from "@/models/logo.model"
import { escapeRegex } from "@/lib/sanitize"
import { emitToUser } from "@/lib/realtime/emit"

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

async function ensureUniqueLogoSlug(slug: string, excludeId?: string): Promise<string> {
  const filter: any = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await Logo.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

async function ensureUniqueCatSlug(slug: string, excludeId?: string): Promise<string> {
  const filter: any = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await CategoryLogo.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

// ═══ CATEGORIES ═════════════════════════════════════════════════════════════

export interface CategoryListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminLogoCategories(input: CategoryListInput) {
  const { page, limit, keyword } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (keyword) filter.name = { $regex: escapeRegex(keyword), $options: "i" }

  const [result] = await CategoryLogo.aggregate([
    { $match: filter },
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "logos",
              localField: "_id",
              foreignField: "categoryId",
              as: "_logos",
              pipeline: [{ $count: "n" }],
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              status: 1,
              createdAt: 1,
              logoCount: { $ifNull: [{ $arrayElemAt: ["$_logos.n", 0] }, 0] },
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
    items: items.map((c: any) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      status: c.status,
      logoCount: c.logoCount ?? 0,
      createdAt: c.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface CategoryUpsertInput {
  name: string
  status?: number
}

export async function createLogoCategory(input: CategoryUpsertInput) {
  const slug = await ensureUniqueCatSlug(slugify(input.name))
  const doc = await CategoryLogo.create({
    name: input.name.trim(),
    slug,
    status: input.status ?? 1,
  })
  return { id: String(doc._id) }
}

export async function getLogoCategory(id: string) {
  const c = (await CategoryLogo.findById(toObjectId(id)).lean()) as any
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy danh mục" })
  return { id: String(c._id), name: c.name, slug: c.slug, status: c.status }
}

export async function updateLogoCategory(id: string, input: CategoryUpsertInput) {
  const _id = toObjectId(id)
  await CategoryLogo.updateOne(
    { _id },
    {
      $set: {
        name: input.name.trim(),
        status: input.status ?? 1,
      },
    }
  )
}

export async function deleteLogoCategory(id: string) {
  const _id = toObjectId(id)
  const used = await Logo.countDocuments({ categoryId: _id })
  if (used > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa: đang có ${used} logo trong danh mục. Vui lòng chuyển logo sang danh mục khác hoặc ẩn (status=0) thay vì xóa.`,
    })
  }
  await CategoryLogo.deleteOne({ _id })
}

export async function listAllLogoCategoriesForSelect() {
  const items = await CategoryLogo.find({}).select("_id name").sort({ name: 1 }).lean()
  return items.map((c: any) => ({ id: String(c._id), name: c.name }))
}

// ═══ LOGOS ══════════════════════════════════════════════════════════════════

export interface AdminLogoListInput {
  page: number
  limit: number
  keyword?: string
  categoryId?: string
  status?: number
}

export async function listAdminLogos(input: AdminLogoListInput) {
  const { page, limit, keyword, categoryId, status } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (typeof status === "number") filter.status = status
  if (categoryId) {
    filter.categoryId = Types.ObjectId.isValid(categoryId)
      ? new Types.ObjectId(categoryId)
      : categoryId
  }
  if (keyword) filter.title = { $regex: escapeRegex(keyword), $options: "i" }

  const [items, total] = await Promise.all([
    Logo.find(filter)
      .select("title slug image price stt status salesCount view categoryId createdAt")
      .sort({ stt: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("categoryId", "name")
      .lean(),
    Logo.countDocuments(filter),
  ])

  return {
    items: items.map((l: any) => ({
      id: String(l._id),
      title: l.title,
      slug: l.slug,
      image: l.image,
      price: l.price,
      stt: l.stt,
      status: l.status,
      salesCount: l.salesCount,
      view: l.view,
      category: l.categoryId
        ? { id: String(l.categoryId._id), name: l.categoryId.name }
        : null,
      createdAt: l.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface LogoUpsertInput {
  title: string
  slug?: string
  image?: string | null
  categoryId: string
  content?: string | null
  price: number
  status?: number
  stt?: number
}

export async function createLogo(input: LogoUpsertInput) {
  const slug = await ensureUniqueLogoSlug(slugify(input.slug || input.title))
  const doc = await Logo.create({
    title: input.title.trim(),
    slug,
    image: input.image ?? null,
    categoryId: toObjectId(input.categoryId),
    content: input.content ?? null,
    price: Math.max(0, input.price),
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  })
  return { id: String(doc._id) }
}

export async function getAdminLogo(id: string) {
  const l = (await Logo.findById(toObjectId(id)).lean()) as any
  if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy logo" })
  return {
    id: String(l._id),
    title: l.title,
    slug: l.slug,
    image: l.image,
    categoryId: String(l.categoryId),
    content: l.content ?? "",
    price: l.price,
    status: l.status,
    stt: l.stt,
  }
}

export async function updateLogo(id: string, input: LogoUpsertInput) {
  const _id = toObjectId(id)
  const update: Record<string, any> = {
    title: input.title.trim(),
    image: input.image ?? null,
    categoryId: toObjectId(input.categoryId),
    content: input.content ?? null,
    price: Math.max(0, input.price),
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  }
  if (input.slug) {
    update.slug = await ensureUniqueLogoSlug(slugify(input.slug), id)
  }
  await Logo.updateOne({ _id }, { $set: update })
}

export async function deleteLogo(id: string) {
  const _id = toObjectId(id)

  // Guard 1: đã có đơn → chặn xóa, đề xuất ẩn
  const sold = await LogoOrder.countDocuments({ logoId: _id })
  if (sold > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa logo này vì đã có ${sold} khách thuê. Vui lòng chuyển sang trạng thái Ẩn (status=0) để bảo lưu lịch sử đơn.`,
    })
  }

  // Guard 2: top doanh thu (top 20% theo salesCount)
  const logo = (await Logo.findById(_id).select("salesCount").lean()) as any
  if (logo && logo.salesCount > 0) {
    const totalLogos = await Logo.countDocuments({})
    const betterOrEqual = await Logo.countDocuments({ salesCount: { $gte: logo.salesCount } })
    const percentile = totalLogos > 0 ? betterOrEqual / totalLogos : 1
    if (percentile <= 0.2) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Không thể xóa logo best-seller (top 20%). Vui lòng chuyển sang trạng thái Ẩn (status=0).`,
      })
    }
  }

  await Logo.deleteOne({ _id })
}

// ═══ ORDERS ═════════════════════════════════════════════════════════════════

export interface AdminLogoOrderListInput {
  page: number
  limit: number
  keyword?: string
  status?: LogoOrderStatus
}

export async function listAdminLogoOrders(input: AdminLogoOrderListInput) {
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
          { logoTitle: re },
          { shopName: re },
          { "user.username": re },
        ],
      },
    })
  }

  const [result] = await LogoOrder.aggregate([
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
      logoId: String(o.logoId),
      logoTitle: o.logoTitle,
      logoSlug: o.logoSlug,
      logoImage: o.logoImage,
      shopName: o.shopName,
      customNote: o.customNote,
      price: o.price,
      status: o.status,
      deliveryUrl: o.deliveryUrl ?? null,
      deliveryNote: o.deliveryNote ?? null,
      downloadCount: o.downloadCount ?? 0,
      lastDownloadAt: o.lastDownloadAt,
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

export interface LogoOrderUpdateInput {
  status: LogoOrderStatus
  shopName?: string
  customNote?: string | null
  price?: number
  deliveryUrl?: string | null
  deliveryNote?: string | null
}

export async function getLogoOrder(id: string) {
  const o = (await LogoOrder.findById(toObjectId(id))
    .populate("userId", "username fullname")
    .lean()) as any
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  return {
    id: String(o._id),
    logoId: String(o.logoId),
    logoTitle: o.logoTitle,
    logoSlug: o.logoSlug,
    logoImage: o.logoImage,
    shopName: o.shopName,
    customNote: o.customNote ?? "",
    price: o.price,
    status: o.status,
    deliveryUrl: o.deliveryUrl ?? "",
    deliveryNote: o.deliveryNote ?? "",
    downloadCount: o.downloadCount ?? 0,
    lastDownloadAt: o.lastDownloadAt,
    createdAt: o.createdAt,
    user: o.userId
      ? { id: String(o.userId._id), username: o.userId.username, fullname: o.userId.fullname }
      : null,
  }
}

export async function updateLogoOrder(id: string, input: LogoOrderUpdateInput) {
  const _id = toObjectId(id)
  if (!LOGO_ORDER_STATUSES.includes(input.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái không hợp lệ" })
  }
  const update: Record<string, any> = { status: input.status }
  if (typeof input.shopName === "string") update.shopName = input.shopName.trim()
  if (input.customNote !== undefined) update.customNote = input.customNote || null
  if (typeof input.price === "number") update.price = Math.max(0, input.price)
  if (input.deliveryUrl !== undefined) update.deliveryUrl = (input.deliveryUrl ?? "").trim() || null
  if (input.deliveryNote !== undefined) update.deliveryNote = input.deliveryNote || null

  const before = (await LogoOrder.findOneAndUpdate({ _id }, { $set: update })
    .select("userId logoTitle status")
    .lean()) as any

  // Real-time: báo chủ đơn logo khi admin đổi trạng thái (best-effort).
  if (before?.userId) {
    emitToUser(before.userId, "order:update", { orderId: id, type: "logo", status: input.status })
  }

  return {
    ownerId: before?.userId ? String(before.userId) : null,
    logoTitle: before?.logoTitle ?? "",
    statusChanged: !!before && before.status !== input.status,
    status: input.status,
  }
}

export async function deleteLogoOrder(id: string) {
  const _id = toObjectId(id)
  const order = (await LogoOrder.findById(_id).select("logoId").lean()) as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })

  await Promise.all([
    LogoOrder.deleteOne({ _id }),
    Logo.updateOne(
      { _id: order.logoId, salesCount: { $gt: 0 } },
      { $inc: { salesCount: -1 } }
    ),
  ])
}

// ─── Bulk Delete ───
export async function bulkDeleteLogoCategories(ids: string[]) {
  const result = await CategoryLogo.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteLogos(ids: string[]) {
  const result = await Logo.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteLogoOrders(ids: string[]) {
  const result = await LogoOrder.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

/**
 * Logo controller — business logic cho thuê logo.
 *
 * Theo MVC pattern: router gọi các function này, không inline logic.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import {
  Logo,
  CategoryLogo,
  LogoOrder,
  type ICategoryLogo,
  type ILogoOrder,
} from "@/models/logo.model"
import { logger } from "@/lib/logger"
import { escapeRegex } from "@/lib/sanitize"
import { deductBalanceAtomic, ensureUserHasBalance, logBalanceChange, refundBalance } from "@/services/balance.service"

// ─── In-memory throttle cho view counter (correctness, không phải cache) ───
const viewThrottleMap = new Map<string, number>()
const VIEW_THROTTLE_MS = 30 * 60_000

// No DB cache — luôn fresh. Chỉ giữ inflight de-dupe.
const logoDetailInflight = new Map<string, Promise<any>>()
let logoCategoriesInflight: Promise<Awaited<ReturnType<typeof queryActiveLogoCategories>>> | null = null
const logoListInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryLogoList>>>>()

export function invalidateLogoCache(): void {
  // No-op: không cache nữa. Chỉ clear inflight để an toàn.
  logoDetailInflight.clear()
  logoCategoriesInflight = null
  logoListInflight.clear()
}

export function shouldCountView(key: string): boolean {
  const now = Date.now()
  const last = viewThrottleMap.get(key)
  if (last && now - last < VIEW_THROTTLE_MS) return false
  viewThrottleMap.set(key, now)
  if (viewThrottleMap.size > 5_000) {
    const cutoff = now - VIEW_THROTTLE_MS
    for (const [k, t] of viewThrottleMap) {
      if (t < cutoff) viewThrottleMap.delete(k)
    }
  }
  return true
}

// ─── Repository ─────────────────────────────────────────────────────────────

async function queryActiveLogoCategories() {
  return (await CategoryLogo.find({ status: 1 })
    .select("name slug")
    .sort({ name: 1 })
    .lean()) as unknown as Array<Pick<ICategoryLogo, "_id" | "name" | "slug">>
}

export async function listActiveLogoCategories() {
  if (logoCategoriesInflight) return logoCategoriesInflight

  logoCategoriesInflight = queryActiveLogoCategories()
    .finally(() => {
      logoCategoriesInflight = null
    })
  return logoCategoriesInflight
}

async function fetchLogoBySlug(slug: string) {
  return (await Logo.findOne({ slug, status: 1 })
    .select("title slug image content price salesCount view categoryId createdAt")
    .populate("categoryId", "name slug")
    .lean()) as any
}

export async function findLogoBySlug(slug: string) {
  const key = slug.trim().toLowerCase()
  const inflight = logoDetailInflight.get(key)
  if (inflight) return inflight

  const pending = fetchLogoBySlug(key)
    .finally(() => logoDetailInflight.delete(key))
  logoDetailInflight.set(key, pending)
  return pending
}

export function serializeLogoDetail(logo: any) {
  if (!logo) return null
  return {
    id: logo._id.toString(),
    title: logo.title,
    slug: logo.slug,
    image: logo.image,
    content: logo.content,
    price: logo.price,
    salesCount: logo.salesCount,
    view: logo.view,
    category: logo.categoryId
      ? { id: logo.categoryId._id.toString(), name: logo.categoryId.name, slug: logo.categoryId.slug }
      : null,
    createdAt: logo.createdAt,
  }
}

export async function findActiveLogoById(logoId: string | Types.ObjectId) {
  const logo = (await Logo.findById(logoId)
    .select("title slug image price status")
    .lean()) as any
  if (!logo || logo.status !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Logo không tồn tại hoặc đã ngưng",
    })
  }
  return logo
}

export async function findRelatedLogos(slug: string, categoryId?: string) {
  const filter: Record<string, any> = { status: 1, slug: { $ne: slug } }
  if (categoryId) filter.categoryId = categoryId
  return (await Logo.find(filter)
    .select("title slug image price salesCount categoryId")
    .sort({ salesCount: -1 })
    .limit(4)
    .populate("categoryId", "name slug")
    .lean()) as any[]
}

export async function countMyRentals(
  userId: Types.ObjectId | string,
  logoId: string
) {
  return await LogoOrder.countDocuments({
    userId,
    logoId,
    status: { $nin: ["cancelled", "cancelled_refund", "error_refund"] },
  })
}

// ─── Search filter ──────────────────────────────────────────────────────────

export function buildLogoListFilter(input: {
  search?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
}): Record<string, any> {
  const filter: Record<string, any> = { status: 1 }
  if (input.categoryId && Types.ObjectId.isValid(input.categoryId)) {
    filter.categoryId = new Types.ObjectId(input.categoryId)
  }
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    filter.price = {}
    if (input.minPrice !== undefined) filter.price.$gte = input.minPrice
    if (input.maxPrice !== undefined) filter.price.$lte = input.maxPrice
  }
  if (input.search) {
    if (input.search.length >= 3) {
      filter.$text = { $search: input.search }
    } else {
      filter.title = { $regex: escapeRegex(input.search), $options: "i" }
    }
  }
  return filter
}

// ─── Aggregation pipeline cho list ──────────────────────────────────────────

export interface ListLogosInput {
  page: number
  limit: number
  search?: string
  categoryId?: string
  sortField: "stt" | "salesCount" | "price" | "createdAt"
  sortDir: "asc" | "desc"
  minPrice?: number
  maxPrice?: number
}

function getLogoListCacheKey(input: ListLogosInput): string {
  return JSON.stringify({
    page: input.page,
    limit: input.limit,
    search: input.search ?? "",
    categoryId: input.categoryId ?? "",
    sortField: input.sortField,
    sortDir: input.sortDir,
    minPrice: input.minPrice ?? null,
    maxPrice: input.maxPrice ?? null,
  })
}

async function queryLogoList(input: ListLogosInput) {
  const { page, limit, sortField, sortDir } = input
  const skip = (page - 1) * limit

  const filter = buildLogoListFilter(input)
  const sortMul = sortDir === "asc" ? 1 : -1
  const sortKey: Record<string, 1 | -1> =
    sortField === "stt" ? { stt: sortMul, createdAt: -1 } : { [sortField]: sortMul }

  const pipeline: any[] = [
    { $match: filter },
    { $sort: sortKey },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "categorylogos",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
        pipeline: [{ $project: { name: 1, slug: 1 } }],
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        image: 1,
        price: 1,
        salesCount: 1,
        view: 1,
        stt: 1,
        createdAt: 1,
        "category._id": 1,
        "category.name": 1,
        "category.slug": 1,
      },
    },
  ]

  const [items, total] = await Promise.all([
    Logo.aggregate(pipeline).exec(),
    Logo.countDocuments(filter),
  ])

  return {
    items: items.map((l: any, i: number) => ({
      id: l._id.toString(),
      title: l.title,
      slug: l.slug,
      image: l.image,
      price: l.price,
      salesCount: l.salesCount,
      view: l.view,
      category: l.category
        ? {
            id: l.category._id.toString(),
            name: l.category.name,
            slug: l.category.slug,
          }
        : null,
      rank: skip + i + 1,
    })),
    total,
  }
}

export async function listLogos(input: ListLogosInput) {
  const key = getLogoListCacheKey(input)
  const inflight = logoListInflight.get(key)
  if (inflight) return inflight

  const pending = queryLogoList(input)
    .finally(() => logoListInflight.delete(key))
  logoListInflight.set(key, pending)
  return pending
}

// ─── List my orders ─────────────────────────────────────────────────────────

export interface ListMyLogoOrdersInput {
  userId: Types.ObjectId | string
  page: number
  limit: number
  search?: string
  status?: string
  sortField: "createdAt" | "price" | "logoTitle"
  sortDir: "asc" | "desc"
}

export async function listMyLogoOrders(input: ListMyLogoOrdersInput) {
  const { page, limit, search, status, sortField, sortDir } = input
  const skip = (page - 1) * limit
  const sortMul = sortDir === "asc" ? 1 : -1

  const filter: Record<string, any> = { userId: input.userId }
  if (status) filter.status = status
  if (search) filter.logoTitle = { $regex: escapeRegex(search), $options: "i" }

  const sortKey: Record<string, 1 | -1> = { [sortField]: sortMul }

  const [items, total] = await Promise.all([
    LogoOrder.find(filter)
      .sort(sortKey)
      .skip(skip)
      .limit(limit)
      .select(
        "logoId logoTitle logoSlug logoImage shopName customNote price status downloadCount lastDownloadAt createdAt"
      )
      .lean(),
    LogoOrder.countDocuments(filter),
  ])

  return {
    items: (items as any[]).map((o) => ({
      id: o._id.toString(),
      logoId: o.logoId.toString(),
      logoTitle: o.logoTitle,
      logoSlug: o.logoSlug,
      logoImage: o.logoImage,
      shopName: o.shopName,
      customNote: o.customNote || null,
      price: o.price,
      status: o.status,
      downloadCount: o.downloadCount,
      lastDownloadAt: o.lastDownloadAt,
      createdAt: o.createdAt,
    })),
    total,
  }
}

// ─── Order operations ───────────────────────────────────────────────────────

export interface CreateLogoOrderInput {
  userId: Types.ObjectId | string
  logo: { _id: any; title: string; slug: string; image: string | null; price: number }
  shopName: string
  customNote?: string
}

export async function createLogoOrder(input: CreateLogoOrderInput) {
  try {
    return await LogoOrder.create({
      userId: input.userId,
      logoId: input.logo._id,
      logoTitle: input.logo.title,
      logoSlug: input.logo.slug,
      logoImage: input.logo.image,
      shopName: input.shopName.trim(),
      customNote: input.customNote?.trim() || null,
      price: input.logo.price,
      status: "pending",
    })
  } catch (err) {
    logger.error("LogoOrder.create failed", err as Error, {
      module: "logo.createLogoOrder",
      userId: String(input.userId),
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Tạo đơn thuê thất bại",
    })
  }
}

export async function deleteLogoOrderSafe(orderId: Types.ObjectId | string) {
  await LogoOrder.deleteOne({ _id: orderId }).catch((err) =>
    logger.error("LogoOrder rollback failed", err, {
      module: "logo.deleteLogoOrderSafe",
      orderId: String(orderId),
    })
  )
}

export async function findCompletedLogoOrder(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = (await LogoOrder.findOne({
    _id: orderId,
    userId,
    status: "completed",
  })
    .select("logoId logoTitle deliveryUrl")
    .lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Đơn chưa hoàn thành hoặc không tồn tại" })
  }
  if (!order.deliveryUrl) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Designer chưa giao file. Vui lòng liên hệ admin.",
    })
  }
  return order
}

/**
 * Atomic cancel: pending → cancelled_refund. Trả về order trước khi update.
 */
export async function cancelPendingLogoOrder(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = (await LogoOrder.findOneAndUpdate(
    { _id: orderId, userId, status: "pending" },
    { $set: { status: "cancelled_refund" } },
    { new: false }
  )) as ILogoOrder | null
  if (!order) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Đơn đã được xử lý, không thể hủy",
    })
  }
  return order
}

// ─── Side-effects ───────────────────────────────────────────────────────────

export function incLogoView(logoId: Types.ObjectId | string) {
  Logo.updateOne({ _id: logoId }, { $inc: { view: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("logo view inc failed", {
        module: "logo.incLogoView",
        error: (err as Error).message,
      })
    )
}

export function incLogoSales(logoId: Types.ObjectId | string) {
  Logo.updateOne({ _id: logoId }, { $inc: { salesCount: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("salesCount inc failed", {
        module: "logo.incLogoSales",
        error: (err as Error).message,
      })
    )
}

export function incDownloadCounter(orderId: Types.ObjectId | string) {
  LogoOrder.updateOne(
    { _id: orderId },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } }
  )
    .exec()
    .catch((err) =>
      logger.warn("download counter inc failed", {
        module: "logo.incDownloadCounter",
        error: (err as Error).message,
      })
    )
}
export interface PurchaseLogoInput {
  userId: Types.ObjectId | string
  logoId: string
  shopName: string
  customNote?: string
}

export interface PurchaseLogoResult {
  orderId: string
  logoTitle: string
  shopName: string
  price: number
}

export async function purchaseLogo(input: PurchaseLogoInput): Promise<PurchaseLogoResult> {
  const logo = await findActiveLogoById(input.logoId)
  const price = Number(logo.price) || 0
  await ensureUserHasBalance(input.userId, price)

  const newOrder = await createLogoOrder({
    userId: input.userId,
    logo,
    shopName: input.shopName,
    customNote: input.customNote,
  })

  if (price > 0) {
    const balance = await deductBalanceAtomic(input.userId, price)
    if (!balance) {
      await deleteLogoOrderSafe(newOrder._id as Types.ObjectId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư không đủ" })
    }
    logBalanceChange({
      userId: input.userId,
      moneyBefore: balance.moneyBefore,
      moneyAfter: balance.moneyAfter,
      moneyChange: -price,
      content: `Thuê logo: ${logo.title} — shop ${input.shopName}`,
      module: "logo.purchase",
      orderId: String(newOrder._id),
    })
    void import("@/services/rewards.service").then((m) =>
      m.awardRewardForPurchase({
        userId: input.userId,
        vndAmount: price,
        context: `đơn logo ${logo.title}`,
        refOrderId: newOrder._id as any,
        refOrderType: "logo",
      })
    )
  }

  incLogoSales(logo._id)
  invalidateLogoCache()

  return {
    orderId: String(newOrder._id),
    logoTitle: logo.title,
    shopName: input.shopName,
    price,
  }
}

export async function cancelLogoOrderWithRefund(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = await cancelPendingLogoOrder(userId, orderId)
  const refundAmount = order.price || 0

  if (refundAmount > 0) {
    const balance = await refundBalance(userId, refundAmount)
    if (balance) {
      logBalanceChange({
        userId,
        moneyBefore: balance.moneyBefore,
        moneyAfter: balance.moneyAfter,
        moneyChange: refundAmount,
        content: `Hoàn tiền hủy logo: ${order.logoTitle} — shop ${order.shopName}`,
        module: "logo.cancelOrder",
        orderId: String(order._id),
      })
    }
  }

  return { order, refundAmount }
}

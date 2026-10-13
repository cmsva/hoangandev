/**
 * Service controller — pure business logic cho module website thuê.
 *
 * Tách khỏi router để:
 *  - Router thành thin layer (auth + rate-limit + validate input)
 *  - Logic test được độc lập (không cần mock tRPC context)
 *  - Reuse được giữa router và admin/cron task
 *
 * Convention:
 *  - Mọi function THROW Error/TRPCError với message tiếng Việt
 *  - KHÔNG xử lý rate-limit ở đây (đã làm ở router)
 *  - KHÔNG đụng đến `ctx` của tRPC, nhận parameter rõ ràng
 */
import { Types } from "mongoose"
import { TRPCError } from "@trpc/server"
import { connectDB } from "@/lib/db"
import {
  Service,
  ServicePricing,
  OrderService,
  type IService,
  type IServicePricing,
  type IOrderService,
} from "@/models/service.model"
import { CategoryService, type ICategoryService } from "@/models/category-service.model"
import { DomainTld, type IDomainTld } from "@/models/domain.model"
import { Coupon, CouponUsed } from "@/models/coupon.model"
import { CloudflareAccount } from "@/models/website-provisioning.model"
import { encryptValue, decryptValue } from "@/lib/encryption"
import { logger } from "@/lib/logger"
import { escapeRegex } from "@/lib/sanitize"
import {
  validateCouponForUser,
  commitCouponUsage as sharedCommitCouponUsage,
} from "@/services/coupon.service"
import {
  ensureUserHasBalance as sharedEnsureUserHasBalance,
  deductBalanceAtomic as sharedDeductBalanceAtomic,
  refundBalance as sharedRefundBalance,
  logBalanceChange as sharedLogBalanceChange,
} from "@/services/balance.service"

// Re-export cho service.router (giai đoạn migration, tương lai router import
// trực tiếp từ shared services).
export const ensureUserHasBalance = sharedEnsureUserHasBalance
export const deductBalanceAtomic = sharedDeductBalanceAtomic
export const refundBalance = sharedRefundBalance
export const logBalanceChange = sharedLogBalanceChange
export const commitCouponUsage = sharedCommitCouponUsage

// ─── Constants ──────────────────────────────────────────────────────────────
/**
 * Domain regex: mỗi label 1-63 chars [a-z0-9], không bắt đầu/kết thúc bằng -.
 * Total tối đa 253 chars (kiểm tra ở schema).
 */
const DOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

const VIEW_THROTTLE_MS = 30 * 60_000

// No data cache — luôn fresh từ DB. Chỉ giữ inflight de-dupe để chống thundering herd.

// ─── In-memory throttle map cho view counter (correctness, không phải cache) ───
const viewThrottleMap = new Map<string, number>()
let activeTldsInflight: Promise<Awaited<ReturnType<typeof queryActiveTlds>>> | null = null
let activeCategoriesInflight: Promise<Awaited<ReturnType<typeof queryActiveCategories>>> | null = null
const serviceDetailInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryServiceDetailBySlug>>>>()
const serviceListInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryServices>>>>()

export function invalidateServiceCatalogCache(): void {
  // No-op: không cache nữa. Chỉ clear inflight (an toàn).
  activeTldsInflight = null
  activeCategoriesInflight = null
  serviceDetailInflight.clear()
  serviceListInflight.clear()
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

// ─── Validators ─────────────────────────────────────────────────────────────
/**
 * Validate format domain (FQDN 2+ levels). Throw TRPCError nếu invalid.
 */
export function ensureValidDomainFormat(domainName: string): void {
  if (!DOMAIN_REGEX.test(domainName)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tên miền không hợp lệ" })
  }
}

/**
 * Đảm bảo domain kết thúc bằng `.tld`. Throw nếu không.
 */
export function ensureDomainEndsWithTld(domainName: string, tld: string): void {
  const suffix = `.${tld.toLowerCase()}`
  if (!domainName.toLowerCase().endsWith(suffix)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Tên miền phải kết thúc bằng .${tld}`,
    })
  }
}

// ─── Repository functions ───────────────────────────────────────────────────

async function queryActiveTlds() {
  return (await DomainTld.find({ isActive: true })
    .select("tld priceSold renewSold")
    .sort({ priceSold: 1 })
    .lean()) as unknown as Array<
    Pick<IDomainTld, "_id" | "tld" | "priceSold" | "renewSold">
  >
}

export async function listActiveTlds() {
  if (activeTldsInflight) return activeTldsInflight

  activeTldsInflight = queryActiveTlds()
    .finally(() => {
      activeTldsInflight = null
    })
  return activeTldsInflight
}

async function queryActiveCategories() {
  return (await CategoryService.find({ status: 1 })
    .select("name slug")
    .sort({ name: 1 })
    .lean()) as unknown as Array<Pick<ICategoryService, "_id" | "name" | "slug">>
}

export async function listActiveCategories() {
  if (activeCategoriesInflight) return activeCategoriesInflight

  activeCategoriesInflight = queryActiveCategories()
    .finally(() => {
      activeCategoriesInflight = null
    })
  return activeCategoriesInflight
}

export async function findCategoryById(categoryId: Types.ObjectId | string) {
  return (await CategoryService.findById(categoryId)
    .select("name slug")
    .lean()) as unknown as Pick<ICategoryService, "_id" | "name" | "slug"> | null
}

async function queryServiceDetailBySlug(slug: string) {
  const service = (await Service.findOne({ slug, status: 1 })
    .select(
      "serviceName slug image listImage description demoUrl adminDemoUrl featuresList salesCount view categoryId deployMode createdAt"
    )
    .populate("categoryId", "name slug")
    .lean()) as any
  if (!service) return null

  const pricings = (await ServicePricing.find({ serviceId: service._id })
    .select("durationMonths pricePerMonth priceExtendPerMonth")
    .sort({ durationMonths: 1 })
    .lean()) as unknown as IServicePricing[]

  const fixedNsAccount = (await CloudflareAccount.findOne({ status: "active" })
    .select("defaultNs1 defaultNs2")
    .sort({ createdAt: 1 })
    .lean()) as { defaultNs1?: string | null; defaultNs2?: string | null } | null
  const fixedNameservers = [fixedNsAccount?.defaultNs1, fixedNsAccount?.defaultNs2]
    .map((ns) => String(ns || "").trim())
    .filter(Boolean)

  return { service, pricings, fixedNameservers }
}

export async function findServiceBySlug(slug: string) {
  const key = slug.trim().toLowerCase()
  const inflight = serviceDetailInflight.get(key)
  if (inflight) return inflight

  const pending = queryServiceDetailBySlug(key)
    .finally(() => serviceDetailInflight.delete(key))
  serviceDetailInflight.set(key, pending)
  return pending
}

export function serializeServiceDetail(detail: Awaited<ReturnType<typeof queryServiceDetailBySlug>>) {
  if (!detail) return null
  const { service, pricings, fixedNameservers } = detail
  return {
    id: service._id.toString(),
    serviceName: service.serviceName,
    slug: service.slug,
    image: service.image,
    listImage: service.listImage || [],
    description: service.description,
    demoUrl: service.demoUrl,
    adminDemoUrl: service.adminDemoUrl,
    featuresList: service.featuresList || [],
    salesCount: service.salesCount,
    view: service.view,
    category: service.categoryId
      ? {
          id: service.categoryId._id.toString(),
          name: service.categoryId.name,
          slug: service.categoryId.slug,
        }
      : null,
    deployMode: service.deployMode ?? "manual",
    fixedNameservers: fixedNameservers.length >= 2 ? fixedNameservers : [],
    pricings: pricings.map((p) => ({
      durationMonths: p.durationMonths,
      pricePerMonth: p.pricePerMonth,
      priceExtendPerMonth: p.priceExtendPerMonth,
      totalPrice: p.pricePerMonth * p.durationMonths,
    })),
    createdAt: service.createdAt,
  }
}

export async function findActiveServiceById(serviceId: string | Types.ObjectId) {
  const s = (await Service.findById(serviceId)
    .select("serviceName slug image status deployMode deployDefaultAccount deployDefaultPassword deployPhpVersion deployServerId")
    .lean()) as unknown as Pick<
    IService,
    "_id" | "serviceName" | "slug" | "image" | "status"
  > | null
  if (!s || s.status !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Mẫu website không tồn tại hoặc đã ngưng",
    })
  }
  return s
}

export async function findActiveTldById(tldId: string | Types.ObjectId) {
  const t = (await DomainTld.findById(tldId)
    .select("tld priceSold isActive provider autoRegisterEnabled")
    .lean()) as unknown as Pick<
    IDomainTld,
    "_id" | "tld" | "priceSold" | "isActive" | "provider" | "autoRegisterEnabled"
  > | null
  if (!t || !t.isActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Loại miền không khả dụng" })
  }
  return t
}

export async function findPricingTier(
  serviceId: Types.ObjectId | string,
  durationMonths: number
) {
  const p = (await ServicePricing.findOne({
    serviceId,
    durationMonths,
  }).lean()) as unknown as IServicePricing | null
  if (!p) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Gói thời hạn không khả dụng" })
  }
  return p
}

export async function listPricingTiers(serviceId: Types.ObjectId | string) {
  return (await ServicePricing.find({ serviceId })
    .select("durationMonths pricePerMonth priceExtendPerMonth")
    .sort({ durationMonths: 1 })
    .lean()) as unknown as IServicePricing[]
}

// ─── Coupon logic (delegate to shared) ───────────────────────────────────
// Wrapper giữ tên `validateCoupon` cho backward-compat với router cũ.
export async function validateCoupon(
  userId: Types.ObjectId | string,
  code: string,
  orderAmount: number,
  scope = "website"
) {
  return validateCouponForUser(userId, code, orderAmount, scope)
}

// ─── Pricing calculator (pure) ──────────────────────────────────────────────

export interface QuoteInput {
  websiteAmount: number
  domainTldPrice: number
  couponDiscountPercent: number
}

export interface Quote {
  websiteAmount: number
  domainTldPrice: number
  subtotal: number
  couponDiscountPercent: number
  couponDiscountAmount: number
  finalPrice: number
}

export function quoteOrder(input: QuoteInput): Quote {
  const subtotal = input.websiteAmount + input.domainTldPrice
  const couponDiscountAmount = Math.round((subtotal * input.couponDiscountPercent) / 100)
  const finalPrice = Math.max(0, subtotal - couponDiscountAmount)
  return {
    websiteAmount: input.websiteAmount,
    domainTldPrice: input.domainTldPrice,
    subtotal,
    couponDiscountPercent: input.couponDiscountPercent,
    couponDiscountAmount,
    finalPrice,
  }
}

// ─── User balance ops re-exported above (shared/balance.controller) ─────

// ─── Order operations ───────────────────────────────────────────────────────

export interface CreateOrderInput {
  userId: Types.ObjectId | string
  username: string
  service: Pick<IService, "_id" | "serviceName" | "slug" | "image">
  pricing: Pick<IServicePricing, "pricePerMonth" | "priceExtendPerMonth">
  durationMonths: number
  domainName: string
  domainNew: boolean
  domainTld?: { _id: Types.ObjectId | string; tld: string; priceSold: number } | null
  shopAccount: string
  shopPassword: string
  websiteAmount: number
  couponCode?: string | null
  couponDiscountPercent?: number
  couponDiscountAmount?: number
  finalPrice: number
}

/**
 * Tạo OrderService với credentials đã encrypt.
 * Throw INTERNAL_SERVER_ERROR nếu DB fail.
 */
export async function createServiceOrder(input: CreateOrderInput) {
  try {
    return await OrderService.create({
      userId: input.userId,
      username: input.username,
      serviceId: input.service._id,
      serviceName: input.service.serviceName,
      serviceSlug: input.service.slug,
      serviceImage: input.service.image,
      amount: input.websiteAmount,
      domainTldId: input.domainTld?._id || null,
      domainTldName: input.domainTld?.tld || null,
      domainTldPrice: input.domainTld?.priceSold || 0,
      couponCode: input.couponCode || null,
      couponDiscount: input.couponDiscountPercent || 0,
      couponDiscountAmount: input.couponDiscountAmount || 0,
      priceExtend: input.pricing.priceExtendPerMonth || 0,
      total: input.finalPrice,
      month: input.durationMonths,
      domainName: input.domainName,
      domainNew: input.domainNew,
      shopAccountEnc: encryptValue(input.shopAccount),
      shopPasswordEnc: encryptValue(input.shopPassword),
      status: "pending",
      expired: 0,
    })
  } catch (err: any) {
    logger.error("OrderService.create failed", err, {
      module: "service.createServiceOrder",
      userId: String(input.userId),
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Tạo đơn thuê thất bại",
    })
  }
}

export async function deleteOrderSafe(orderId: Types.ObjectId | string) {
  await OrderService.deleteOne({ _id: orderId }).catch((err) =>
    logger.error("OrderService rollback failed", err, {
      module: "service.deleteOrderSafe",
      orderId: String(orderId),
    })
  )
}

// ─── Side-effects (best-effort) ────────────────────────────────────

export function incServiceView(serviceId: Types.ObjectId | string) {
  Service.updateOne({ _id: serviceId }, { $inc: { view: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("service view inc failed", {
        module: "service.incServiceView",
        error: (err as Error).message,
      })
    )
}

export function incServiceSales(serviceId: Types.ObjectId | string) {
  invalidateServiceCatalogCache()
  Service.updateOne({ _id: serviceId }, { $inc: { salesCount: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("salesCount inc failed", {
        module: "service.incServiceSales",
        error: (err as Error).message,
      })
    )
}

// ─── Search helpers ─────────────────────────────────────────────────────────

/**
 * Build search filter cho list query.
 * Dùng $text khi search ≥3 ký tự, fallback $regex.
 */
export function buildServiceSearchFilter(search: string | undefined): Record<string, any> {
  if (!search) return {}
  if (search.length >= 3) {
    return { $text: { $search: search } }
  }
  return { serviceName: { $regex: escapeRegex(search), $options: "i" } }
}

/**
 * Build search filter cho user's order history.
 */
export function buildOrderSearchFilter(search: string | undefined): Record<string, any> {
  if (!search) return {}
  return {
    $or: [
      { serviceName: { $regex: escapeRegex(search), $options: "i" } },
      { domainName: { $regex: escapeRegex(search), $options: "i" } },
    ],
  }
}

// ─── Cancel order logic ─────────────────────────────────────────────────────

/**
 * Atomic cancel: chuyển status pending → cancelled_refund.
 * Trả về order doc trước khi update (để tính refund).
 * Throw nếu không thể hủy.
 */
export async function cancelPendingOrder(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = (await OrderService.findOneAndUpdate(
    { _id: orderId, userId, status: "pending" },
    { $set: { status: "cancelled_refund" } },
    { new: false }
  )) as IOrderService | null

  if (!order) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Đơn đã được xử lý, không thể hủy",
    })
  }
  return order
}

// ─── Get my order detail (kèm credentials decrypted) ───────────────────
/**
 * Lấy order chi tiết của user — có decrypt shopAccount/shopPassword.
 * Chỉ cho phép user xem của CHÍNH MÌNH (filter bằng userId).
 * Throw NOT_FOUND nếu không sở hữu.
 */
export async function getMyOrderWithCredentials(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = (await OrderService.findOne({
    _id: orderId,
    userId,
  }).lean()) as unknown as IOrderService | null

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn hàng" })
  }

  let shopAccount: string | null = null
  let shopPassword: string | null = null
  try {
    shopAccount = decryptValue(order.shopAccountEnc)
    shopPassword = decryptValue(order.shopPasswordEnc)
  } catch (err) {
    logger.warn("decrypt credentials failed", {
      module: "service.getMyOrderWithCredentials",
      orderId,
      error: (err as Error).message,
    })
  }

  return {
    id: (order._id as any).toString(),
    serviceName: order.serviceName,
    serviceSlug: order.serviceSlug,
    serviceImage: order.serviceImage,
    domainName: order.domainName,
    domainNew: order.domainNew,
    domainTldName: order.domainTldName,
    domainTldPrice: order.domainTldPrice,
    couponCode: order.couponCode,
    couponDiscount: order.couponDiscount,
    couponDiscountAmount: order.couponDiscountAmount,
    month: order.month,
    total: order.total,
    amount: order.amount,
    priceExtend: order.priceExtend,
    status: order.status,
    expired: order.expired,
    adminNote: order.adminNote,
    shopAccount,
    shopPassword,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

// ─── List my orders với credentials decrypted ─────────────────────────
export interface ListMyOrdersInput {
  userId: Types.ObjectId | string
  page: number
  limit: number
  search: string | undefined
  status: string | undefined
  sortDir: "asc" | "desc"
}

/**
 * List đơn website của user — có decrypt shopAccount/shopPassword inline
 * để hiển thị trực tiếp trong data table (không cần modal).
 */
export async function listMyServiceOrders(input: ListMyOrdersInput) {
  const skip = (input.page - 1) * input.limit
  const sortMul = input.sortDir === "asc" ? 1 : -1

  const filter: Record<string, any> = { userId: input.userId }
  if (input.status) filter.status = input.status
  Object.assign(filter, buildOrderSearchFilter(input.search))

  const [items, total] = await Promise.all([
    OrderService.find(filter)
      .sort({ createdAt: sortMul })
      .skip(skip)
      .limit(input.limit)
      .select(
        "serviceId serviceName serviceSlug serviceImage domainName domainNew domainTldName domainTldPrice couponCode couponDiscount couponDiscountAmount month total amount priceExtend status expired adminNote shopAccountEnc shopPasswordEnc provisioning createdAt"
      )
      .lean(),
    OrderService.countDocuments(filter),
  ])

  return {
    items: (items as any[]).map((o) => {
      let shopAccount: string | null = null
      let shopPassword: string | null = null
      try {
        shopAccount = decryptValue(o.shopAccountEnc)
        shopPassword = decryptValue(o.shopPasswordEnc)
      } catch (err) {
        logger.warn("decrypt creds failed in list", {
          module: "service.listMyServiceOrders",
          orderId: o._id.toString(),
          error: (err as Error).message,
        })
      }
      return {
        id: o._id.toString(),
        serviceId: o.serviceId.toString(),
        serviceName: o.serviceName,
        serviceSlug: o.serviceSlug,
        serviceImage: o.serviceImage,
        domainName: o.domainName,
        domainNew: o.domainNew,
        domainTldName: o.domainTldName,
        domainTldPrice: o.domainTldPrice,
        couponCode: o.couponCode,
        couponDiscount: o.couponDiscount,
        couponDiscountAmount: o.couponDiscountAmount,
        month: o.month,
        total: o.total,
        amount: o.amount,
        priceExtend: o.priceExtend,
        status: o.status,
        expired: o.expired,
        adminNote: o.adminNote,
        shopAccount,
        shopPassword,
        nameServers: o.provisioning?.cloudflareNameServers || [],
        deployStartedAt: o.provisioning?.deployStartedAt ?? null,
        deployCompletedAt: o.provisioning?.deployCompletedAt ?? null,
        provisionError: o.provisioning?.lastError ?? null,
        createdAt: o.createdAt,
      }
    }),
    total,
  }
}

// ─── List service catalog ────────────────────────────────────────────────────

export interface ListServicesInput {
  page: number
  limit: number
  search?: string
  categoryId?: string
  sortField: "stt" | "salesCount" | "view" | "createdAt"
  sortDir: "asc" | "desc"
}

function getServiceListCacheKey(input: ListServicesInput): string {
  return JSON.stringify({
    page: input.page,
    limit: input.limit,
    search: input.search ?? "",
    categoryId: input.categoryId ?? "",
    sortField: input.sortField,
    sortDir: input.sortDir,
  })
}

async function queryServices(input: ListServicesInput) {
  const { page, limit, search, categoryId, sortField, sortDir } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = { status: 1 }
  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    filter.categoryId = new Types.ObjectId(categoryId)
  }
  Object.assign(filter, buildServiceSearchFilter(search))

  const sortMul = sortDir === "asc" ? 1 : -1
  const sortKey: Record<string, 1 | -1> =
    sortField === "stt"
      ? { stt: sortMul, createdAt: -1 }
      : { [sortField]: sortMul }

  const pipeline: any[] = [
    { $match: filter },
    { $sort: sortKey },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "servicepricings",
        localField: "_id",
        foreignField: "serviceId",
        as: "pricings",
        pipeline: [{ $project: { durationMonths: 1, pricePerMonth: 1 } }],
      },
    },
    {
      $lookup: {
        from: "categoryservices",
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
        serviceName: 1,
        slug: 1,
        image: 1,
        salesCount: 1,
        view: 1,
        stt: 1,
        createdAt: 1,
        "category._id": 1,
        "category.name": 1,
        "category.slug": 1,
        pricings: 1,
      },
    },
  ]

  const [items, total] = await Promise.all([
    Service.aggregate(pipeline).exec(),
    Service.countDocuments(filter),
  ])

  return {
    items: items.map((s: any, i: number) => {
      const minPrice =
        s.pricings && s.pricings.length > 0
          ? Math.min(...s.pricings.map((p: any) => p.pricePerMonth))
          : 0
      return {
        id: s._id.toString(),
        serviceName: s.serviceName,
        slug: s.slug,
        image: s.image,
        salesCount: s.salesCount,
        view: s.view,
        minPricePerMonth: minPrice,
        durationOptions: (s.pricings || [])
          .map((p: any) => p.durationMonths)
          .sort((a: number, b: number) => a - b),
        category: s.category
          ? {
              id: s.category._id.toString(),
              name: s.category.name,
              slug: s.category.slug,
            }
          : null,
        rank: skip + i + 1,
      }
    }),
    total,
  }
}

export async function listServices(input: ListServicesInput) {
  const key = getServiceListCacheKey(input)
  const inflight = serviceListInflight.get(key)
  if (inflight) return inflight

  const pending = queryServices(input)
    .finally(() => serviceListInflight.delete(key))
  serviceListInflight.set(key, pending)
  return pending
}

export interface PurchaseWebsiteInput {
  userId: Types.ObjectId | string
  username: string
  serviceId: string
  durationMonths: number
  domainName: string
  domainNew: boolean
  domainTldId?: string
  shopAccount: string
  shopPassword: string
  couponCode?: string
}

export interface PurchaseWebsiteResult {
  orderId: string
  serviceName: string
  domainName: string
  domainTldName: string | null
  couponCode: string | null
  total: number
}

export async function purchaseWebsite(input: PurchaseWebsiteInput): Promise<PurchaseWebsiteResult> {
  ensureValidDomainFormat(input.domainName)

  const service = await findActiveServiceById(input.serviceId)
  const pricing = await findPricingTier(service._id, input.durationMonths)
  const websiteAmount = pricing.pricePerMonth * input.durationMonths

  let domainTld: { _id: any; tld: string; priceSold: number; provider: "manual" | "spaceship" } | null = null
  if (input.domainNew) {
    if (!input.domainTldId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng chọn loại miền" })
    }
    const tld = await findActiveTldById(input.domainTldId)
    ensureDomainEndsWithTld(input.domainName, tld.tld)
    domainTld = {
      _id: tld._id,
      tld: tld.tld,
      priceSold: tld.priceSold || 0,
      provider: (tld as any).provider === "spaceship" ? "spaceship" : "manual",
    }
  }

  let couponPercent = 0
  let couponDiscountAmount = 0
  let normalizedCouponCode: string | null = null
  let couponId: string | null = null
  const subtotal = websiteAmount + (domainTld?.priceSold || 0)

  if (input.couponCode) {
    const coupon = await validateCoupon(input.userId, input.couponCode, subtotal, "website")
    couponPercent = coupon.discount
    couponDiscountAmount = coupon.discountAmount
    normalizedCouponCode = coupon.code
    couponId = coupon.couponId
  }

  const quote = quoteOrder({
    websiteAmount,
    domainTldPrice: domainTld?.priceSold || 0,
    couponDiscountPercent: couponPercent,
  })
  const currentUser = await ensureUserHasBalance(input.userId, quote.finalPrice)

  const newOrder = await createServiceOrder({
    userId: input.userId,
    username: currentUser.username || input.username,
    service,
    pricing,
    durationMonths: input.durationMonths,
    domainName: input.domainName,
    domainNew: input.domainNew,
    domainTld,
    shopAccount: input.shopAccount,
    shopPassword: input.shopPassword,
    websiteAmount,
    couponCode: normalizedCouponCode,
    couponDiscountPercent: couponPercent,
    couponDiscountAmount,
    finalPrice: quote.finalPrice,
  })

  const balance = await deductBalanceAtomic(input.userId, quote.finalPrice)
  if (!balance) {
    await deleteOrderSafe(newOrder._id as any)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư đã thay đổi" })
  }

  if (quote.finalPrice > 0) {
    logBalanceChange({
      userId: input.userId,
      moneyBefore: balance.moneyBefore,
      moneyAfter: balance.moneyAfter,
      moneyChange: -quote.finalPrice,
      content: `Thuê website: ${service.serviceName} (${input.durationMonths} tháng) — domain ${input.domainName}`,
      module: "service.purchase",
      orderId: String(newOrder._id),
    })
    void import("@/services/rewards.service").then((m) =>
      m.awardRewardForPurchase({
        userId: input.userId,
        vndAmount: quote.finalPrice,
        context: `đơn website ${service.serviceName}`,
        refOrderId: newOrder._id as any,
        refOrderType: "service",
      })
    )
  }

  if (couponId) commitCouponUsage(couponId, input.userId)
  incServiceSales(service._id)

  // Branching logic (flow mới — user trỏ NS cố định trước, hệ thống không check NS):
  //  - service manual                                    → runWebsiteProvisionWorker (đơn tay)
  //  - service auto + domainNew=false                    → enqueue job pending, cron tạo web
  //  - service auto + domainNew=true + tld=spaceship     → mua domain → set NS cố định → enqueue job
  //  - service auto + domainNew=true + tld=manual        → đưa về queue manual cho admin
  const isAutoMode = (service as any).deployMode === "auto"
  const isManualTldNew = input.domainNew && domainTld?.provider !== "spaceship"

  if (isAutoMode && !isManualTldNew) {
    // Đơn vừa tạo mặc định là pending. Lưu note để history hiển thị đúng flow;
    // khi cron claim job, web-job.service sẽ chuyển sang processing.
    OrderService.updateOne(
      { _id: newOrder._id },
      { $set: { adminNote: "Đã lưu hàng đợi tạo web, cron sẽ xử lý" } }
    ).exec().catch(() => {})

    if (input.domainNew) {
      // Mua domain qua Spaceship trước. Sau khi mua xong sẽ set NS cố định
      // rồi enqueue job pending cho cron tạo website.
      startAutoDomainBuy(String(newOrder._id))
    } else {
      // Domain có sẵn: user đã trỏ NS cố định trước, lưu NS để history hiển thị
      // ngay rồi enqueue job pending cho cron tạo web.
      void import("@/services/website-provision.service").then(async ({ getFixedNameservers }) => {
        const fixedNs = await getFixedNameservers()
        await OrderService.updateOne(
          { _id: newOrder._id },
          { $set: { "provisioning.cloudflareNameServers": fixedNs } }
        ).exec()
      }).catch(() => {})
      void import("@/services/web-job.service").then(({ enqueueWebsiteJobForOrder }) =>
        enqueueWebsiteJobForOrder(String(newOrder._id))
      )
    }
  } else {
    if (isAutoMode && isManualTldNew) {
      // Đánh dấu order để admin biết đây là service auto-deploy
      // nhưng TLD chỉ manual → cần mua domain thủ công trước khi deploy.
      OrderService.updateOne(
        { _id: newOrder._id },
        {
          $set: {
            adminNote: `Service auto-deploy nhưng TLD .${domainTld?.tld ?? ""} chưa hỗ trợ đăng ký tự động. Vui lòng xử lý đơn tay.`,
          },
        }
      )
        .exec()
        .catch((err) =>
          logger.warn("manual TLD note failed", {
            module: "service.purchase",
            orderId: String(newOrder._id),
            error: (err as Error).message,
          })
        )
    }
    runWebsiteProvisionWorker(String(newOrder._id))
  }

  return {
    orderId: String(newOrder._id),
    serviceName: service.serviceName,
    domainName: input.domainName,
    domainTldName: domainTld?.tld ?? null,
    couponCode: normalizedCouponCode,
    total: quote.finalPrice,
  }
}

export async function warmServiceCatalogCache(): Promise<void> {
  // No-op: không cache nữa. Giữ chữ ký để caller (instrumentation) không vỡ.
}

// ─── Gia hạn website (lỗi #2) ────────────────────────────────────────────────
const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60

export interface RenewWebsiteInput {
  userId: Types.ObjectId | string
  orderId: string
  additionalMonths: number
}

export interface RenewWebsiteResult {
  orderId: string
  payment: number
  newExpired: number
  months: number
}

/**
 * Gia hạn 1 đơn website đang active/expired.
 *
 * Giá = `priceExtend` (snapshot phí gia hạn/tháng trên đơn) × số tháng. Pattern
 * theo purchaseCronjobExtension: check balance → deduct atomic → cộng `expired`
 * → log + reward → refund nếu lỗi. Side-effect aaPanel (start lại site nếu hết
 * hạn + set expiry mới) là best-effort, không rollback tiền.
 */
export async function renewWebsiteOrder(input: RenewWebsiteInput): Promise<RenewWebsiteResult> {
  const order = (await OrderService.findOne({
    _id: input.orderId,
    userId: input.userId,
    status: { $in: ["active", "expired"] },
  })
    .select(
      "_id userId serviceName domainName priceExtend expired status panelSiteId deployServerId provisioning"
    )
    .lean()) as any

  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy đơn hoặc đơn không thể gia hạn",
    })
  }

  const pricePerMonth = Number(order.priceExtend) || 0
  if (pricePerMonth <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Đơn này chưa cấu hình phí gia hạn",
    })
  }

  const payment = pricePerMonth * input.additionalMonths
  await ensureUserHasBalance(input.userId, payment)

  const balance = await deductBalanceAtomic(input.userId, payment)
  if (!balance) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư đã thay đổi" })
  }

  try {
    // Cộng dồn từ mốc lớn hơn giữa expired hiện tại và now (nếu đã hết hạn thì
    // tính từ bây giờ, tránh gia hạn vào quá khứ).
    const nowSec = Math.floor(Date.now() / 1000)
    const baseTs = order.expired && order.expired > nowSec ? order.expired : nowSec
    const newExpired = baseTs + input.additionalMonths * ONE_MONTH_SECONDS

    await OrderService.updateOne(
      { _id: order._id, userId: input.userId },
      {
        $set: { status: "active", expired: newExpired },
        $inc: { month: input.additionalMonths },
      }
    )

    logBalanceChange({
      userId: input.userId,
      moneyBefore: balance.moneyBefore,
      moneyAfter: balance.moneyAfter,
      moneyChange: -payment,
      content: `Gia hạn website: ${order.serviceName} (+${input.additionalMonths} tháng) — domain ${order.domainName}`,
      module: "service.renew",
      orderId: String(order._id),
    })
    void import("@/services/rewards.service").then((m) =>
      m.awardRewardForPurchase({
        userId: input.userId,
        vndAmount: payment,
        context: `gia hạn website ${order.serviceName}`,
        refOrderId: order._id as any,
        refOrderType: "service.renew",
      })
    )

    // Side-effect aaPanel (best-effort) — start lại site + set expiry mới.
    void import("@/services/admin-website.service").then((m) =>
      m.applyWebsiteRenewalSideEffects(order, newExpired).catch(() => {})
    )

    return {
      orderId: String(order._id),
      payment,
      newExpired,
      months: input.additionalMonths,
    }
  } catch (err) {
    // Rollback tiền nếu cập nhật đơn lỗi.
    const refund = await refundBalance(input.userId, payment)
    if (refund) {
      logBalanceChange({
        userId: input.userId,
        moneyBefore: refund.moneyBefore,
        moneyAfter: refund.moneyAfter,
        moneyChange: payment,
        content: "Hoàn tiền lỗi gia hạn website",
        module: "service.renew.rollback",
        orderId: String(order._id),
      })
    }
    throw err
  }
}

function runWebsiteProvisionWorker(orderId: string): void {
  setTimeout(() => {
    void import("@/services/admin-website.service")
      .then(({ provisionWebsiteOrder }) => provisionWebsiteOrder(orderId, { phpVersion: "80", proxied: true, requireNsActive: false }))
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Tạo website tự động thất bại"
        await connectDB()
        await OrderService.updateOne(
          { _id: orderId, status: "pending" },
          { $set: { adminNote: `Auto deploy lỗi: ${message}` } }
        )
      })
  }, 0)
}

/**
 * Mua domain mới qua Spaceship (best-effort). Sau khi mua xong, auto-domain
 * service sẽ set NS cố định + gọi worker deploy. Cron là safety-net.
 */
function startAutoDomainBuy(orderId: string): void {
  setTimeout(() => {
    void import("@/services/auto-domain.service")
      .then(({ buyDomainViaSpaceship }) => buyDomainViaSpaceship(orderId))
      .catch(async (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Mua domain Spaceship lỗi"
        await connectDB()
        await OrderService.updateOne(
          { _id: orderId },
          {
            $set: {
              "provisioning.lastError": message.slice(0, 500),
              adminNote: `Mua domain lỗi: ${message.slice(0, 200)}`,
            },
          }
        ).catch(() => {})
      })
  }, 0)
}

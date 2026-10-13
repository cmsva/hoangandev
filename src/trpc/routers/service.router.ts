/**
 * Service router — thin tRPC layer.
 *
 * Trách nhiệm:
 *  - Auth (protectedProcedure)
 *  - Rate-limit
 *  - Validate input (Zod)
 *  - Connect DB
 *  - Delegate business logic → service.controller
 *  - Format response
 *
 * KHÔNG đặt logic ở đây — mọi xử lý DB/tính toán nằm trong controller.
 */
import { z } from "zod"
import { createTRPCRouter, baseProcedure, protectedProcedure } from "../init"
import { ORDER_SERVICE_STATUSES } from "@/models/service.model"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import { insertLog } from "@/services/log.service"
import { getWebsiteDeployInfo } from "@/services/admin-website.service"
import { retryWebsiteDeploy } from "@/services/web-job.service"
import {
  findServiceBySlug,
  incServiceView,
  listActiveCategories,
  listActiveTlds,
  listMyServiceOrders,
  listServices,
  purchaseWebsite,
  renewWebsiteOrder,
  serializeServiceDetail,
  shouldCountView,
  validateCoupon,
  warmServiceCatalogCache,
} from "@/services/website.service"


// ─── Schemas ────────────────────────────────────────────────────────────────
const sortFieldSchema = z.enum(["stt", "salesCount", "view", "createdAt"]).default("stt")
const sortDirSchema = z.enum(["asc", "desc"]).default("asc")
const orderStatusSchema = z.enum(ORDER_SERVICE_STATUSES).optional()

export const serviceRouter = createTRPCRouter({
  // ─── List active TLDs ────────────────────────────────────────────────────
  tlds: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("service.tlds", ctx.ip), "tlds")
    await connectDB()
    const tlds = await listActiveTlds()
    return tlds.map((t) => ({
      id: t._id.toString(),
      tld: t.tld,
      priceSold: t.priceSold,
      renewSold: t.renewSold,
    }))
  }),

  // ─── List categories ─────────────────────────────────────────────────────
  categories: baseProcedure.query(async ({ ctx }) => {
    warmServiceCatalogCache().catch(() => {})
    await consumeRateLimit(readLimiter, composeKey("service.categories", ctx.ip), "categories")
    await connectDB()
    const cats = await listActiveCategories()
    return cats.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
    }))
  }),

  // ─── List services (paginated) ───────────────────────────────────────────
  list: baseProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          categoryId: objectIdSchema.optional(),
          sortField: sortFieldSchema,
          sortDir: sortDirSchema,
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      warmServiceCatalogCache().catch(() => {})
      await consumeRateLimit(readLimiter, composeKey("service.list", ctx.ip), "service.list")
      await connectDB()

      const { page, limit } = input
      const { items, total } = await listServices(input)

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }),

  // ─── Detail by slug ──────────────────────────────────────────────────────
  detail: baseProcedure
    .input(z.object({ slug: z.string().min(1).max(200) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("service.detail", ctx.ip), "detail")
      await connectDB()

      const detail = await findServiceBySlug(input.slug)
      if (!detail) return null

      const viewKey = `${input.slug}:${ctx.userId || ctx.ip}`
      if (shouldCountView(viewKey)) {
        incServiceView(detail.service._id as any)
      }

      return serializeServiceDetail(detail)
    }),

  // ─── Validate coupon (preview, không trừ used) ───────────────────────────
  validateCoupon: protectedProcedure
    .input(
      z
        .object({
          code: z.string().trim().min(1).max(64),
          orderAmount: z.number().int().min(0).max(10_000_000_000),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("service.validateCoupon", String(ctx.user._id)),
        "validateCoupon"
      )
      await connectDB()
      const result = await validateCoupon(ctx.user._id as any, input.code, input.orderAmount, "website")
      return {
        ...result,
        message: `Giảm ${result.discount}% thành công`,
      }
    }),

  // ─── Thuê website ────────────────────────────────────────────────────────
  // Atomic flow:
  //  1. Validate domain format
  //  2. Service active + pricing tier
  //  3. Optional: TLD validation + price
  //  4. Optional: Coupon validation
  //  5. Quote final price
  //  6. Balance check
  //  7. Create order (with encrypted credentials)
  //  8. CAS deduct balance — rollback order nếu fail
  //  9. Side-effects: LogBalance, salesCount, audit, coupon usage
  purchase: protectedProcedure
    .input(
      z
        .object({
          serviceId: objectIdSchema,
          durationMonths: z.number().int().min(1).max(36),
          domainName: z.string().trim().min(3).max(253).toLowerCase(),
          domainNew: z.boolean().default(false),
          domainTldId: objectIdSchema.optional(),
          shopAccount: z.string().trim().max(200).default(""),
          shopPassword: z.string().max(500).default(""),
          couponCode: z.string().trim().min(1).max(64).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("service.purchase", String(ctx.user._id)), "purchase")
      await consumeRateLimit(mutationLimiter, composeKey("service.purchase:ip", ctx.ip), "purchase.ip")
      await connectDB()

      const result = await purchaseWebsite({
        userId: ctx.user._id as any,
        username: ctx.user.username || "",
        ...input,
      })

      insertLog({
        userId: ctx.user._id,
        action: `Thuê website: ${result.serviceName} - ${result.total.toLocaleString()}đ — domain ${result.domainName}${input.domainNew && result.domainTldName ? ` (mua mới .${result.domainTldName})` : ""}${result.couponCode ? ` [coupon ${result.couponCode}]` : ""}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        orderId: result.orderId,
        total: result.total,
        message: "Đã đặt website thành công",
      }
    }),

  // ─── Gia hạn website (lỗi #2) ────────────────────────────────────────────
  renew: protectedProcedure
    .input(
      z
        .object({
          orderId: objectIdSchema,
          additionalMonths: z.number().int().min(1).max(36),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("service.renew", String(ctx.user._id)), "renew")
      await connectDB()

      const result = await renewWebsiteOrder({
        userId: ctx.user._id as any,
        orderId: input.orderId,
        additionalMonths: input.additionalMonths,
      })

      insertLog({
        userId: ctx.user._id,
        action: `Gia hạn website ${input.orderId} +${input.additionalMonths} tháng - ${result.payment.toLocaleString()}đ`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        payment: result.payment,
        newExpired: result.newExpired,
        message: `Gia hạn thành công (+${input.additionalMonths} tháng)`,
      }
    }),

  deployInfo: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("service.deployInfo", String(ctx.user._id)), "deployInfo")
      await connectDB()
      return getWebsiteDeployInfo(input.orderId, ctx.user._id as any)
    }),

  // Thử lại tạo website cho đơn failed/kẹt → re-enqueue hàng đợi (không trừ tiền lại).
  retryDeploy: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("service.retryDeploy", String(ctx.user._id)), "retryDeploy")
      await connectDB()
      return retryWebsiteDeploy(input.orderId, ctx.user._id as any)
    }),

  // ─── My orders (history) ─────────────────────────────────────────────────
  myOrders: protectedProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          status: orderStatusSchema,
          sortDir: z.enum(["asc", "desc"]).default("desc"),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("service.myOrders", String(ctx.user._id)), "myOrders")
      await connectDB()

      const { page, limit, search, status, sortDir } = input
      const { items, total } = await listMyServiceOrders({
        userId: ctx.user._id as any,
        page,
        limit,
        search,
        status,
        sortDir,
      })

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }),
})


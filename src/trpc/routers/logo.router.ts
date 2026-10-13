/**
 * Logo router — thin tRPC layer.
 *
 * Trách nhiệm: auth + rate-limit + validate input + delegate.
 * Mọi logic ở @/services/logo.service + shared (balance, coupon).
 */
import { z } from "zod"
import { createTRPCRouter, baseProcedure, protectedProcedure } from "../init"
import { LOGO_ORDER_STATUSES } from "@/models/logo.model"
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
import {
  cancelLogoOrderWithRefund,
  countMyRentals,
  findCompletedLogoOrder,
  findLogoBySlug,
  findRelatedLogos,
  incDownloadCounter,
  incLogoView,
  listActiveLogoCategories,
  listLogos,
  listMyLogoOrders,
  purchaseLogo,
  serializeLogoDetail,
  shouldCountView,
} from "@/services/logo.service"

const sortFieldSchema = z
  .enum(["stt", "salesCount", "price", "createdAt"])
  .default("stt")
const sortDirSchema = z.enum(["asc", "desc"]).default("asc")
const orderSortFieldSchema = z.enum(["createdAt", "price", "logoTitle"]).default("createdAt")
const orderStatusSchema = z.enum(LOGO_ORDER_STATUSES).optional()

export const logoRouter = createTRPCRouter({
  // ─── List logos ──────────────────────────────────────────────────────────
  list: baseProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          categoryId: objectIdSchema.optional(),
          sortField: sortFieldSchema,
          sortDir: sortDirSchema,
          minPrice: z.number().int().min(0).optional(),
          maxPrice: z.number().int().min(0).optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("logo.list", ctx.ip), "logo.list")
      await connectDB()

      const { page, limit } = input
      const { items, total } = await listLogos(input)

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

  // ─── Categories ──────────────────────────────────────────────────────────
  categories: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("logo.categories", ctx.ip), "categories")
    await connectDB()
    const cats = await listActiveLogoCategories()
    return cats.map((c) => ({ id: c._id.toString(), name: c.name, slug: c.slug }))
  }),

  // ─── Detail by slug ──────────────────────────────────────────────────────
  detail: baseProcedure
    .input(z.object({ slug: z.string().min(1).max(200) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("logo.detail", ctx.ip), "detail")
      await connectDB()

      const logo = await findLogoBySlug(input.slug)
      if (!logo) return null

      const viewKey = `${input.slug}:${ctx.userId || ctx.ip}`
      if (shouldCountView(viewKey)) incLogoView(logo._id)

      return serializeLogoDetail(logo)
    }),

  // ─── Related logos ───────────────────────────────────────────────────────
  related: baseProcedure
    .input(
      z
        .object({
          slug: z.string().min(1).max(200),
          categoryId: objectIdSchema.optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("logo.related", ctx.ip), "related")
      await connectDB()
      const items = await findRelatedLogos(input.slug, input.categoryId)
      return items.map((l, i) => ({
        id: l._id.toString(),
        title: l.title,
        slug: l.slug,
        image: l.image,
        price: l.price,
        salesCount: l.salesCount,
        category: l.categoryId
          ? { name: (l.categoryId as any).name, slug: (l.categoryId as any).slug }
          : null,
        rank: i + 1,
      }))
    }),

  // ─── My rental count cho 1 logo ──────────────────────────────────────────
  myRentalCount: protectedProcedure
    .input(z.object({ logoId: objectIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("logo.myRentalCount", String(ctx.user._id)),
        "myRentalCount"
      )
      await connectDB()
      const count = await countMyRentals(ctx.user._id as any, input.logoId)
      return { count }
    }),

  // ─── Thuê logo ──────────────────────────────────────────────────────────
  purchase: protectedProcedure
    .input(
      z
        .object({
          logoId: objectIdSchema,
          shopName: z.string().trim().min(2).max(200),
          customNote: z.string().trim().max(1000).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("logo.purchase", String(ctx.user._id)), "purchase")
      await consumeRateLimit(mutationLimiter, composeKey("logo.purchase:ip", ctx.ip), "purchase.ip")
      await connectDB()

      const result = await purchaseLogo({ userId: ctx.user._id as any, ...input })

      insertLog({
        userId: ctx.user._id,
        action: `Thuê logo: ${result.logoTitle} - ${result.price.toLocaleString()}đ — shop ${result.shopName}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      // Notify (mail + tele admin + tele user) — best-effort
      void import("@/services/notify.service").then((m) =>
        m.notifyOrderLogo({
          userId: ctx.user._id as any,
          logoName: result.logoTitle,
          shopName: result.shopName,
          total: result.price,
        })
      )

      return {
        success: true,
        orderId: result.orderId,
        price: result.price,
        message: "Đã thuê logo thành công",
      }
    }),

  // ─── My orders ───────────────────────────────────────────────────────────
  myOrders: protectedProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          status: orderStatusSchema,
          sortField: orderSortFieldSchema,
          sortDir: z.enum(["asc", "desc"]).default("desc"),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("logo.myOrders", String(ctx.user._id)), "myOrders")
      await connectDB()

      const { page, limit } = input
      const { items, total } = await listMyLogoOrders({
        userId: ctx.user._id as any,
        ...input,
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

  // ─── Get download URL (lấy từ đơn: deliveryUrl) ─────────────────────────
  getDownloadUrl: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("logo.download", String(ctx.user._id)), "download")
      await connectDB()

      const order = await findCompletedLogoOrder(ctx.user._id as any, input.orderId)

      incDownloadCounter(input.orderId)

      insertLog({
        userId: ctx.user._id,
        action: `Tải logo: ${order.logoTitle}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return { downloadUrl: order.deliveryUrl }
    }),

  // ─── Cancel order (pending → refund) ────────────────────────────────────
  cancelOrder: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("logo.cancelOrder", String(ctx.user._id)),
        "cancelOrder"
      )
      await connectDB()

      const { order, refundAmount } = await cancelLogoOrderWithRefund(ctx.user._id as any, input.orderId)

      insertLog({
        userId: ctx.user._id,
        action: `Hủy logo: ${order.logoTitle} (hoàn ${refundAmount.toLocaleString()}đ)`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        refundAmount,
        message:
          refundAmount > 0
            ? `Đã hủy và hoàn ${refundAmount.toLocaleString()}đ`
            : "Đã hủy đơn",
      }
    }),
})

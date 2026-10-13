/**
 * Order router (mã nguồn) — thin tRPC layer.
 *
 * Trách nhiệm:
 *  - Auth + rate-limit + Zod validate
 *  - Connect DB
 *  - Delegate → services (order, balance, coupon)
 *  - Format response + audit log
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { insertLog } from "@/services/log.service"
import {
  checkUserHasPurchased,
  findProductFile,
  findUserOrderById,
  listMyOrders,
  purchaseSourceCode,
} from "@/services/order.service"
import { validateCouponForUser } from "@/services/coupon.service"

const sortFieldSchema = z.enum(["productTitle", "totalPrice", "orderDate"]).default("orderDate")
const sortDirSchema = z.enum(["asc", "desc"]).default("desc")

export const orderRouter = createTRPCRouter({
  // ─── Lịch sử mua mã nguồn ────────────────────────────────────────────────
  myOrders: protectedProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          sortField: sortFieldSchema,
          sortDir: sortDirSchema,
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("order.myOrders", String(ctx.user._id)), "myOrders")
      await connectDB()

      const { page, limit, search, sortField, sortDir } = input
      const { items, total } = await listMyOrders({
        userId: ctx.user._id as any,
        page,
        limit,
        search,
        sortField,
        sortDir,
      })

      return {
        orders: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }),

  // ─── Lấy link download (chỉ user đã mua) ────────────────────────────────
  getDownloadUrl: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("download", String(ctx.user._id)), "download")
      await connectDB()

      const order = await findUserOrderById(ctx.user._id as any, input.orderId)
      const product = await findProductFile(order.productId)

      insertLog({
        userId: ctx.user._id,
        action: `Tải mã nguồn: ${product.title}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch((err) =>
        logger.warn("audit log failed", { module: "order.download", error: (err as Error).message })
      )

      return { fileUrl: product.fileUrl }
    }),

  // ─── Validate coupon (preview) ───────────────────────────────────────────
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
      await consumeRateLimit(strictLimiter, composeKey("coupon", String(ctx.user._id)), "validateCoupon")
      await connectDB()

      const result = await validateCouponForUser(
        ctx.user._id as any,
        input.code,
        input.orderAmount,
        "source-code"
      )
      return {
        ...result,
        message: `Giảm ${result.discount}% thành công`,
      }
    }),

  // ─── Mua mã nguồn ───────────────────────────────────────────────────────
  purchase: protectedProcedure
    .input(
      z
        .object({
          productId: objectIdSchema,
          couponCode: z.string().trim().min(1).max(64).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("purchase", String(ctx.user._id)), "purchase")
      await consumeRateLimit(mutationLimiter, composeKey("purchase:ip", ctx.ip), "purchase.ip")
      await connectDB()

      const result = await purchaseSourceCode({
        userId: ctx.user._id as any,
        productId: input.productId,
        couponCode: input.couponCode,
      })

      insertLog({
        userId: ctx.user._id,
        action: `Mua mã nguồn: ${result.productTitle} - ${result.totalPrice.toLocaleString()}đ${result.couponCode ? ` [coupon ${result.couponCode}]` : ""}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        orderId: result.orderId,
        totalPrice: result.totalPrice,
        message: "Mua hàng thành công",
      }
    }),

  // ─── Check user đã mua product chưa ──────────────────────────────────────
  checkPurchased: protectedProcedure
    .input(z.object({ productId: objectIdSchema }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("checkPurchased", String(ctx.user._id)), "checkPurchased")
      await connectDB()
      return await checkUserHasPurchased(ctx.user._id as any, input.productId)
    }),
})

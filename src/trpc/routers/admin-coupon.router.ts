import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { composeKey, consumeRateLimit, mutationLimiter, readLimiter } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  COUPON_SCOPES,
  createAdminCoupon,
  deleteAdminCoupon,
  bulkDeleteCoupons,
  listAdminCoupons,
  updateAdminCoupon,
} from "@/services/admin-coupon.service"

const scopeSchema = z.enum(COUPON_SCOPES)

const listInput = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  scope: scopeSchema.optional(),
}).strict()

const couponInput = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/, "Mã chỉ gồm chữ, số, _ hoặc -"),
  amount: z.number().int().min(1).max(1_000_000),
  discount: z.number().min(0).max(100),
  min: z.number().int().min(0).max(10_000_000_000),
  max: z.number().int().min(0).max(10_000_000_000),
  scope: scopeSchema,
}).strict()

const updateInput = couponInput.extend({
  id: zObjectId,
})
export const adminCouponRouter = createTRPCRouter({
  list: adminProcedure.input(listInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.coupon.list", String(ctx.user._id)), "admin.coupon.list")
    await connectDB()
    return await listAdminCoupons(input)
  }),

  create: adminProcedure.input(couponInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.coupon.create", String(ctx.user._id)), "admin.coupon.create")
    await connectDB()
    const result = await createAdminCoupon(input)
    insertLog({ userId: ctx.user._id, action: `Admin tạo mã giảm giá ${result.item.code}`, ip: ctx.ip }).catch(() => {})
    return result
  }),

  update: adminProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.coupon.update", String(ctx.user._id)), "admin.coupon.update")
    await connectDB()
    const result = await updateAdminCoupon(input)
    insertLog({ userId: ctx.user._id, action: `Admin cập nhật mã giảm giá ${result.item.code}`, ip: ctx.ip }).catch(() => {})
    return result
  }),

  delete: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.coupon.delete", String(ctx.user._id)), "admin.coupon.delete")
      await connectDB()
      const result = await deleteAdminCoupon(input.id)
      insertLog({ userId: ctx.user._id, action: `Admin xóa mã giảm giá ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.coupon.bulkDelete", String(ctx.user._id)), "admin.coupon.bulkDelete")
      await connectDB()
      const result = await bulkDeleteCoupons(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} mã giảm giá`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

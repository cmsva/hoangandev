/**
 * Coupon controller — shared logic cho mọi module dùng coupon
 * (order, service, future: domain renew, cronjob...).
 *
 * Tách từ order.router + service.router để DRY.
 */
import { TRPCError } from "@trpc/server"
import type { Types } from "mongoose"
import { Coupon, CouponUsed } from "@/models/coupon.model"
import { logger } from "@/lib/logger"

export interface CouponValidationResult {
  couponId: string
  code: string
  discount: number // percent
  discountAmount: number
  finalAmount: number
}

/**
 * Validate coupon (preview hoặc apply). KHÔNG inc used count —
 * caller phải gọi `commitCouponUsage` sau khi đã trừ tiền thành công.
 *
 * Throw TRPCError với message tiếng Việt nếu invalid.
 */
export async function validateCouponForUser(
  userId: Types.ObjectId | string,
  code: string,
  orderAmount: number,
  scope = "all"
): Promise<CouponValidationResult> {
  const upperCode = code.trim().toUpperCase()
  const coupon = (await Coupon.findOne({ code: upperCode }).lean()) as any

  if (!coupon) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mã giảm giá không tồn tại" })
  }
  if (coupon.amount <= coupon.used) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã đã hết lượt" })
  }
  if (coupon.scope && coupon.scope !== "all" && coupon.scope !== scope) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã không áp dụng cho dịch vụ này" })
  }
  if (orderAmount < coupon.min) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Đơn tối thiểu ${coupon.min.toLocaleString()}đ`,
    })
  }
  if (coupon.max > 0 && orderAmount > coupon.max) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Đơn tối đa ${coupon.max.toLocaleString()}đ`,
    })
  }

  const used = await CouponUsed.findOne({ couponId: coupon._id, userId })
    .select("_id")
    .lean()
  if (used) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Bạn đã dùng mã này rồi" })
  }

  const discountAmount = Math.round((orderAmount * coupon.discount) / 100)
  const finalAmount = Math.max(0, orderAmount - discountAmount)

  return {
    couponId: coupon._id.toString(),
    code: coupon.code,
    discount: coupon.discount,
    discountAmount,
    finalAmount,
  }
}

/**
 * Inc coupon used count + lưu CouponUsed (best-effort, không throw).
 * Gọi sau khi đã trừ tiền user thành công.
 *
 * @param transId - Reference ID (orderId / serviceOrderId) cho audit
 */
export async function commitCouponUsage(
  couponId: string,
  userId: Types.ObjectId | string,
  transId?: string
): Promise<void> {
  let usageCreated = false
  try {
    await CouponUsed.create({
      couponId,
      userId,
      ...(transId ? { transId } : {}),
    })
    usageCreated = true

    const updated = await Coupon.updateOne(
      { _id: couponId, $expr: { $lt: ["$used", "$amount"] } },
      { $inc: { used: 1 } }
    ).exec()

    if (updated.modifiedCount === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Mã đã hết lượt" })
    }
  } catch (err: any) {
    if (usageCreated) {
      await CouponUsed.deleteOne({ couponId, userId }).catch(() => {})
    }
    if (err?.code === 11000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bạn đã dùng mã này rồi" })
    }
    if (err instanceof TRPCError) throw err
    logger.warn("coupon commit failed", {
      module: "coupon.commitCouponUsage",
      error: (err as Error).message,
    })
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể dùng mã giảm giá" })
  }
}

/**
 * Balance controller — shared atomic balance operations cho mọi module
 * có giao dịch tiền (order, service, domain, cronjob, ...).
 *
 * Pattern: CAS (compare-and-set) với { money: { $gte: amount } } để chống race.
 */
import { TRPCError } from "@trpc/server"
import type { Types } from "mongoose"
import { User } from "@/models/user.model"
import { LogBalance } from "@/models/log.model"
import { logger } from "@/lib/logger"
import { invalidateCurrentUser } from "@/services/auth.service"
import { emitToUser } from "@/lib/realtime/emit"

/** Best-effort invalidate user cache sau mỗi balance change. */
function invalidateUserCache(userId: Types.ObjectId | string): void {
  invalidateCurrentUser(String(userId))
}

export interface BalanceUpdate {
  moneyBefore: number
  moneyAfter: number
}

/**
 * Quick check số dư trước khi đụng DB write. Throw nếu thiếu.
 * Trả về user doc tối thiểu (money + username).
 */
export async function ensureUserHasBalance(
  userId: Types.ObjectId | string,
  required: number
) {
  const user = (await User.findById(userId).select("money username").lean()) as any
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Người dùng không tồn tại" })
  }
  if (user.money < required) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Số dư không đủ. Cần ${required.toLocaleString()}đ`,
    })
  }
  return user
}

/**
 * CAS deduct balance — atomic.
 * Trả về `{ moneyBefore, moneyAfter }` nếu OK, null nếu race condition.
 *
 * Caller phải xử lý null (rollback compensating).
 */
export async function deductBalanceAtomic(
  userId: Types.ObjectId | string,
  amount: number
): Promise<BalanceUpdate | null> {
  if (amount <= 0) return { moneyBefore: 0, moneyAfter: 0 }
  const updated = (await User.findOneAndUpdate(
    { _id: userId, money: { $gte: amount } },
    { $inc: { money: -amount } },
    { new: true, projection: { money: 1 } }
  )) as any
  if (!updated) return null
  void invalidateUserCache(userId)
  emitToUser(userId, "balance:update", { money: updated.money })
  return {
    moneyAfter: updated.money,
    moneyBefore: updated.money + amount,
  }
}

/**
 * Refund balance — atomic, không cần CAS.
 * Trả về `{ moneyBefore, moneyAfter }` nếu OK, null nếu user không tồn tại.
 */
export async function refundBalance(
  userId: Types.ObjectId | string,
  amount: number
): Promise<BalanceUpdate | null> {
  if (amount <= 0) return null
  const updated = (await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { money: amount } },
    { new: true, projection: { money: 1 } }
  )) as any
  if (!updated) return null
  void invalidateUserCache(userId)
  emitToUser(userId, "balance:update", { money: updated.money })
  return {
    moneyAfter: updated.money,
    moneyBefore: updated.money - amount,
  }
}

/**
 * Ghi LogBalance (best-effort, không throw).
 * Dùng sau mỗi lần deduct/refund.
 */
export function logBalanceChange(input: {
  userId: Types.ObjectId | string
  moneyBefore: number
  moneyAfter: number
  moneyChange: number // âm khi trừ, dương khi cộng
  content: string
  module: string
  orderId?: string
}) {
  LogBalance.create({
    userId: input.userId,
    moneyBefore: input.moneyBefore,
    moneyChange: input.moneyChange,
    moneyAfter: input.moneyAfter,
    content: input.content,
  }).catch((err) =>
    logger.error("LogBalance failed", err, {
      module: input.module,
      orderId: input.orderId,
    })
  )
}

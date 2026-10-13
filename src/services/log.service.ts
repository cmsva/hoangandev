import mongoose from "mongoose"
import { Log, LogBalance } from "@/models/log.model"
import { User } from "@/models/user.model"

/**
 * Ghi log hoạt động người dùng
 */
export async function insertLog(params: {
  userId: string | mongoose.Types.ObjectId
  action: string
  ip?: string | null
  device?: string | null
}) {
  return Log.create({
    userId: params.userId,
    action: params.action,
    ip: params.ip || null,
    device: params.device || null,
  })
}

/**
 * Cộng tiền + ghi log balance — atomic via findOneAndUpdate(new:true).
 *
 * Race-safe: post-image trả về money sau update, không cần read trước.
 */
export async function plusCredit(params: {
  userId: string | mongoose.Types.ObjectId
  amount: number
  content: string
}) {
  const { userId, amount, content } = params

  if (amount <= 0) throw new Error("Amount must be positive")

  const updated = (await User.findByIdAndUpdate(
    userId,
    { $inc: { money: amount, totalMoney: amount } },
    { new: true, projection: { money: 1 } }
  )) as { money: number } | null

  if (!updated) throw new Error("User not found")

  const moneyAfter = updated.money
  const moneyBefore = moneyAfter - amount

  // Log balance change (best-effort — không block balance op)
  await LogBalance.create({
    userId,
    moneyBefore,
    moneyChange: amount,
    moneyAfter,
    content,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[plusCredit] LogBalance failed", err)
  })

  return { moneyBefore, moneyChange: amount, moneyAfter }
}

/**
 * Trừ tiền + ghi log balance — atomic CAS pattern.
 *
 * Race-safe: filter `money: { $gte: amount }` đảm bảo chỉ deduct khi đủ.
 * 2 request concurrent → chỉ 1 success, request kia fail với "Insufficient balance".
 */
export async function deductCredit(params: {
  userId: string | mongoose.Types.ObjectId
  amount: number
  content: string
}) {
  const { userId, amount, content } = params

  if (amount <= 0) throw new Error("Amount must be positive")

  const updated = (await User.findOneAndUpdate(
    { _id: userId, money: { $gte: amount } },
    { $inc: { money: -amount } },
    { new: true, projection: { money: 1 } }
  )) as { money: number } | null

  if (!updated) {
    // Phân biệt user không tồn tại vs số dư không đủ
    const exists = await User.exists({ _id: userId })
    if (!exists) throw new Error("User not found")
    throw new Error("Insufficient balance")
  }

  const moneyAfter = updated.money
  const moneyBefore = moneyAfter + amount

  await LogBalance.create({
    userId,
    moneyBefore,
    moneyChange: -amount,
    moneyAfter,
    content,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[deductCredit] LogBalance failed", err)
  })

  return { moneyBefore, moneyChange: -amount, moneyAfter }
}

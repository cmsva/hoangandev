/**
 * Reward Service — cộng thưởng ngẫu nhiên cho user khi xác minh email
 * hoặc liên kết Telegram lần đầu. Đặt min=max=0 trong settings để tắt.
 *
 * Idempotent: caller phải gọi 1 lần / hành động (vd sau khi flag emailVerified
 * chuyển từ 0 → 1). Service không track state — đó là việc của caller.
 */
import type { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { getSecurityConfig } from "@/lib/security-config"
import { refundBalance, logBalanceChange } from "@/services/balance.service"
import { logger } from "@/lib/logger"

export type RewardKind = "email" | "telegram"

interface RewardResult {
  rewarded: boolean
  amount: number
}

function randInt(min: number, max: number): number {
  if (max <= min) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Cộng thưởng ngẫu nhiên (min..max từ settings) vào số dư user.
 * - kind=email → reward_email_min..reward_email_max
 * - kind=telegram → reward_telegram_min..reward_telegram_max
 *
 * Trả về { rewarded, amount }. Best-effort: không throw nếu update fail
 * (caller flow tiếp tục, log đã ghi).
 */
export async function grantVerificationReward(
  userId: Types.ObjectId | string,
  kind: RewardKind
): Promise<RewardResult> {
  await connectDB()
  const cfg = await getSecurityConfig()

  const [min, max] =
    kind === "email"
      ? [cfg.rewardEmailMin, cfg.rewardEmailMax]
      : [cfg.rewardTelegramMin, cfg.rewardTelegramMax]

  if (min === 0 && max === 0) {
    return { rewarded: false, amount: 0 }
  }

  const amount = randInt(min, max)
  if (amount <= 0) {
    return { rewarded: false, amount: 0 }
  }

  const update = await refundBalance(userId, amount).catch((err) => {
    logger.error("grantVerificationReward refund failed", err, { module: "reward" })
    return null
  })
  if (!update) {
    return { rewarded: false, amount: 0 }
  }

  logBalanceChange({
    userId,
    moneyBefore: update.moneyBefore,
    moneyAfter: update.moneyAfter,
    moneyChange: amount,
    content:
      kind === "email"
        ? `Thưởng xác minh email +${amount.toLocaleString()}đ`
        : `Thưởng liên kết Telegram +${amount.toLocaleString()}đ`,
    module: `reward.${kind}`,
  })

  return { rewarded: true, amount }
}

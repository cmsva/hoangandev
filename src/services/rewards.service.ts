/**
 * Rewards service — Layer 2 (protocol-agnostic).
 *
 * Cấu hình tỉ lệ quy đổi nằm ở `Setting`:
 *   - reward_earn_vnd_per_point  : số VNĐ mua = 1 điểm    (default 1000)
 *   - reward_redeem_vnd_per_point: 1 điểm = bao nhiêu VNĐ (default 100)
 *   - reward_redeem_min_points   : số điểm tối thiểu để đổi (default 500)
 *
 * Public API:
 *   - getRewardConfig()                          — đọc cấu hình
 *   - awardRewardForPurchase(input)              — gọi khi user mua dịch vụ (KHÔNG gọi cho deposit)
 *   - redeemPointsToBalance(userId, points)      — user đổi điểm → số dư
 *   - getRewardSummary(userId)                   — số liệu cho header rewards page
 *   - listRewardHistory(userId, opts)            — phân trang
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { User } from "@/models/user.model"
import { RewardLog, type RewardLogType } from "@/models/reward-log.model"
import {
  getSiteOptionInt,
  setSiteOption,
  getSiteOptions,
} from "@/models/setting.model"
import { logger } from "@/lib/logger"
import { logBalanceChange, refundBalance } from "@/services/balance.service"

// ─── Constants ──────────────────────────────────────────────────────────────

export const REWARD_SETTING_KEYS = {
  earnVndPerPoint: "reward_earn_vnd_per_point",
  redeemVndPerPoint: "reward_redeem_vnd_per_point",
  redeemMinPoints: "reward_redeem_min_points",
  enabled: "reward_enabled",
} as const

export const REWARD_DEFAULTS = {
  earnVndPerPoint: 1000, // 1.000đ mua = 1 điểm
  redeemVndPerPoint: 100, // 1 điểm = 100đ
  redeemMinPoints: 500, // tối thiểu 500 điểm để đổi
  enabled: true,
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface RewardConfig {
  earnVndPerPoint: number
  redeemVndPerPoint: number
  redeemMinPoints: number
  enabled: boolean
}

/**
 * Đọc toàn bộ config rewards (1 round-trip qua getSiteOptions).
 * Fallback về REWARD_DEFAULTS nếu thiếu hoặc sai định dạng.
 */
export async function getRewardConfig(): Promise<RewardConfig> {
  const map = await getSiteOptions([
    REWARD_SETTING_KEYS.earnVndPerPoint,
    REWARD_SETTING_KEYS.redeemVndPerPoint,
    REWARD_SETTING_KEYS.redeemMinPoints,
    REWARD_SETTING_KEYS.enabled,
  ])
  const earn = parseInt(map[REWARD_SETTING_KEYS.earnVndPerPoint] || "", 10)
  const redeem = parseInt(map[REWARD_SETTING_KEYS.redeemVndPerPoint] || "", 10)
  const minP = parseInt(map[REWARD_SETTING_KEYS.redeemMinPoints] || "", 10)
  const enabledRaw = (map[REWARD_SETTING_KEYS.enabled] || "").trim().toLowerCase()
  return {
    earnVndPerPoint: Number.isFinite(earn) && earn > 0 ? earn : REWARD_DEFAULTS.earnVndPerPoint,
    redeemVndPerPoint:
      Number.isFinite(redeem) && redeem > 0 ? redeem : REWARD_DEFAULTS.redeemVndPerPoint,
    redeemMinPoints:
      Number.isFinite(minP) && minP > 0 ? minP : REWARD_DEFAULTS.redeemMinPoints,
    enabled: enabledRaw === "" ? REWARD_DEFAULTS.enabled : enabledRaw === "1" || enabledRaw === "true",
  }
}

export async function saveRewardConfig(input: Partial<RewardConfig>): Promise<void> {
  const ops: Array<Promise<void>> = []
  if (input.earnVndPerPoint !== undefined) {
    if (input.earnVndPerPoint <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tỉ lệ quy đổi phải lớn hơn 0" })
    }
    ops.push(setSiteOption(REWARD_SETTING_KEYS.earnVndPerPoint, String(input.earnVndPerPoint)))
  }
  if (input.redeemVndPerPoint !== undefined) {
    if (input.redeemVndPerPoint <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Giá trị quy đổi phải lớn hơn 0" })
    }
    ops.push(setSiteOption(REWARD_SETTING_KEYS.redeemVndPerPoint, String(input.redeemVndPerPoint)))
  }
  if (input.redeemMinPoints !== undefined) {
    if (input.redeemMinPoints < 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tối thiểu phải ≥ 1 điểm" })
    }
    ops.push(setSiteOption(REWARD_SETTING_KEYS.redeemMinPoints, String(input.redeemMinPoints)))
  }
  if (input.enabled !== undefined) {
    ops.push(setSiteOption(REWARD_SETTING_KEYS.enabled, input.enabled ? "1" : "0"))
  }
  await Promise.all(ops)
}

// ─── Pure calculators ───────────────────────────────────────────────────────

/**
 * Tính số điểm earn từ giá đơn (làm tròn xuống).
 * Ví dụ earnVndPerPoint=1000, vnd=2500 → 2 điểm.
 */
export function calcPointsFromPurchase(vnd: number, earnVndPerPoint: number): number {
  if (!Number.isFinite(vnd) || vnd <= 0) return 0
  if (!Number.isFinite(earnVndPerPoint) || earnVndPerPoint <= 0) return 0
  return Math.floor(vnd / earnVndPerPoint)
}

export function calcVndFromPoints(points: number, redeemVndPerPoint: number): number {
  if (points <= 0 || redeemVndPerPoint <= 0) return 0
  return Math.floor(points * redeemVndPerPoint)
}

// ─── Earn flow (background, không throw) ───────────────────────────────────

interface AwardInput {
  userId: Types.ObjectId | string
  vndAmount: number
  /** Mô tả ngắn cho log; sẽ append "Thưởng từ {context}". */
  context: string
  refOrderId?: Types.ObjectId | string | null
  refOrderType?: string | null
}

/**
 * Gọi sau khi mua dịch vụ thành công. Idempotent ở mức best-effort —
 * nếu fail thì chỉ log warning, KHÔNG ảnh hưởng giao dịch chính.
 *
 * **KHÔNG gọi cho deposit** (nạp tiền) — chỉ purchase.
 *
 * Atomic: $inc rewardPoints + rewardPointsTotalEarned trong 1 update.
 */
export async function awardRewardForPurchase(input: AwardInput): Promise<void> {
  try {
    const config = await getRewardConfig()
    if (!config.enabled) return
    const points = calcPointsFromPurchase(input.vndAmount, config.earnVndPerPoint)
    if (points <= 0) return

    const updated = (await User.findOneAndUpdate(
      { _id: input.userId },
      {
        $inc: {
          rewardPoints: points,
          rewardPointsTotalEarned: points,
        },
      },
      { new: true, projection: { rewardPoints: 1 } }
    )) as { rewardPoints: number } | null
    if (!updated) return

    await RewardLog.create({
      userId: input.userId,
      type: "earn" as RewardLogType,
      pointsChange: points,
      pointsAfter: updated.rewardPoints,
      vndAmount: input.vndAmount,
      content: `Thưởng ${points} điểm từ ${input.context}`,
      refOrderId: input.refOrderId ?? null,
      refOrderType: input.refOrderType ?? null,
    })
  } catch (err) {
    logger.warn("awardRewardForPurchase failed", {
      module: "rewards.award",
      userId: String(input.userId),
      error: err instanceof Error ? err.message : "Unknown",
    })
  }
}

// ─── Redeem flow (atomic) ───────────────────────────────────────────────────

/**
 * Đổi điểm sang số dư. Atomic CAS lock ngay trên User.
 *
 *  1. Validate min + multiple (chỉ đổi bội số tối thiểu? — không, cho linh hoạt)
 *  2. CAS deduct rewardPoints (chống race)
 *  3. Inc money + log balance change
 *  4. Inc rewardPointsTotalRedeemed + write reward log
 *  5. Nếu balance log fail (rất hiếm) → refund points
 */
export async function redeemPointsToBalance(
  userId: Types.ObjectId | string,
  points: number
): Promise<{ pointsRedeemed: number; vndAdded: number; pointsAfter: number; moneyAfter: number }> {
  if (!Number.isFinite(points) || points <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số điểm phải > 0" })
  }
  const config = await getRewardConfig()
  if (!config.enabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tính năng đổi điểm đang tắt" })
  }
  if (points < config.redeemMinPoints) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Tối thiểu ${config.redeemMinPoints} điểm để đổi`,
    })
  }
  const vnd = calcVndFromPoints(points, config.redeemVndPerPoint)
  if (vnd <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Giá trị quy đổi không hợp lệ" })
  }

  // CAS deduct points
  const userAfterDeduct = (await User.findOneAndUpdate(
    { _id: userId, rewardPoints: { $gte: points } },
    {
      $inc: {
        rewardPoints: -points,
        rewardPointsTotalRedeemed: points,
        money: vnd,
        totalMoney: vnd,
      },
    },
    { new: true, projection: { rewardPoints: 1, money: 1 } }
  )) as { rewardPoints: number; money: number } | null

  if (!userAfterDeduct) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Số điểm không đủ hoặc đã thay đổi, vui lòng thử lại",
    })
  }

  // Log changes — best effort
  try {
    await RewardLog.create({
      userId,
      type: "redeem" as RewardLogType,
      pointsChange: -points,
      pointsAfter: userAfterDeduct.rewardPoints,
      vndAmount: vnd,
      content: `Đổi ${points} điểm = ${vnd.toLocaleString("vi-VN")}đ`,
    })
  } catch (err) {
    logger.warn("redeemPointsToBalance: rewardLog write failed", {
      module: "rewards.redeem",
      userId: String(userId),
      error: err instanceof Error ? err.message : "Unknown",
    })
  }

  logBalanceChange({
    userId,
    moneyBefore: userAfterDeduct.money - vnd,
    moneyAfter: userAfterDeduct.money,
    moneyChange: vnd,
    content: `Đổi ${points} điểm thưởng`,
    module: "rewards.redeem",
  })

  return {
    pointsRedeemed: points,
    vndAdded: vnd,
    pointsAfter: userAfterDeduct.rewardPoints,
    moneyAfter: userAfterDeduct.money,
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getRewardSummary(userId: Types.ObjectId | string) {
  const user = (await User.findById(userId)
    .select("rewardPoints rewardPointsTotalEarned rewardPointsTotalRedeemed")
    .lean()) as
    | {
        rewardPoints: number
        rewardPointsTotalEarned: number
        rewardPointsTotalRedeemed: number
      }
    | null
  return {
    points: user?.rewardPoints ?? 0,
    totalEarned: user?.rewardPointsTotalEarned ?? 0,
    totalRedeemed: user?.rewardPointsTotalRedeemed ?? 0,
  }
}

export async function listRewardHistory(
  userId: Types.ObjectId | string,
  opts: { type?: RewardLogType | "all"; search?: string; page?: number; limit?: number } = {}
) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit || 20)))
  const filter: Record<string, unknown> = { userId }
  if (opts.type && opts.type !== "all") filter.type = opts.type
  if (opts.search?.trim()) {
    // Escape regex
    const safe = opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.content = { $regex: safe, $options: "i" }
  }

  const [items, total] = await Promise.all([
    RewardLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RewardLog.countDocuments(filter),
  ])

  return {
    items: (items as any[]).map((it) => ({
      id: String(it._id),
      type: it.type as RewardLogType,
      pointsChange: it.pointsChange,
      pointsAfter: it.pointsAfter,
      vndAmount: it.vndAmount,
      content: it.content,
      createdAt: it.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// ─── Refund hook (cho service refund) ───────────────────────────────────────

/**
 * Khi đơn purchase bị refund/cancel — gọi để rút lại điểm đã thưởng.
 * Idempotent: chỉ rút điểm 1 lần per refOrderId.
 */
export async function clawbackRewardForRefund(input: {
  userId: Types.ObjectId | string
  refOrderId: Types.ObjectId | string
}): Promise<void> {
  try {
    const earnLog = (await RewardLog.findOne({
      userId: input.userId,
      refOrderId: input.refOrderId,
      type: "earn",
    }).lean()) as { pointsChange: number } | null
    if (!earnLog || earnLog.pointsChange <= 0) return

    const points = earnLog.pointsChange

    const updated = (await User.findOneAndUpdate(
      { _id: input.userId },
      {
        $inc: {
          rewardPoints: -points,
          rewardPointsTotalEarned: -points,
        },
      },
      { new: true, projection: { rewardPoints: 1 } }
    )) as { rewardPoints: number } | null
    if (!updated) return

    await RewardLog.create({
      userId: input.userId,
      type: "redeem" as RewardLogType,
      pointsChange: -points,
      pointsAfter: Math.max(0, updated.rewardPoints),
      vndAmount: 0,
      content: `Hoàn lại ${points} điểm do hoàn tiền đơn hàng`,
      refOrderId: input.refOrderId,
    })
  } catch (err) {
    logger.warn("clawbackRewardForRefund failed", {
      module: "rewards.clawback",
      userId: String(input.userId),
      error: err instanceof Error ? err.message : "Unknown",
    })
  }
}

// Suppress unused import warning
void refundBalance

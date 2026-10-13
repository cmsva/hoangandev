/**
 * Affiliate service — Business logic chương trình giới thiệu (Layer 2).
 *
 * Protocol-agnostic: tái sử dụng được trong tRPC, Server Actions, Cron, ...
 *
 * Public API:
 *  - getAffiliateConfig: cấu hình từ site_options
 *  - getAffiliateStats: thống kê hoa hồng + memberCount
 *  - getCommissionHistory: lịch sử cộng/trừ refMoney (paginate)
 *  - withdrawToBalance: rút về số dư hệ thống (auto-approved)
 *  - withdrawToBank: rút về tài khoản ngân hàng (admin duyệt)
 *  - getWithdrawHistory: lịch sử rút tiền (paginate)
 *  - creditAffiliateCommission: cộng hoa hồng (gọi từ deposit success path)
 *  - trackAffiliateClick: tăng refClick (best-effort, có throttle)
 *  - refundAffiliateCommission: hoàn hoa hồng khi giao dịch gốc bị refund
 *
 * Security:
 *  - CAS deduct refMoney chống race condition
 *  - Anti-spam: limit pending withdraw bank ≤ MAX_PENDING_WITHDRAW
 *  - Validate min/max amount, status_ref enabled
 *  - Idempotent commission credit qua sourceTransId
 *  - Click tracking có throttle theo IP → User
 */
import { TRPCError } from "@trpc/server"
import mongoose, { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { LogBalance } from "@/models/log.model"
import { WithdrawRef } from "@/models/withdraw-ref.model"
import { getSiteOption, getSiteOptions, getSiteOptionInt } from "@/models/setting.model"
import { logger } from "@/lib/logger"

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_PENDING_WITHDRAW = 3
const COMMISSION_LOG_PREFIX = "[Hoa hồng]"
const MIN_WITHDRAW_DEFAULT = 1000
const MAX_WITHDRAW_DEFAULT = 10_000_000

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCash(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Generate unique withdraw transId. Format: WD + 8 alphanum chars. */
async function generateRefTransId(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let attempts = 0
  while (attempts < 100) {
    let result = "WD"
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const exists = await WithdrawRef.findOne({ transId: result }).select({ _id: 1 }).lean()
    if (!exists) return result
    attempts++
  }
  // Theoretical fallback — should never reach
  throw new Error("Cannot generate unique transId")
}

// ─── Validators ────────────────────────────────────────────────────────────

async function getEffectiveLimits(): Promise<{ min: number; max: number; minDeposit: number; maxDeposit: number; enabled: boolean; balanceEnabled: boolean; bankEnabled: boolean }> {
  const opts = await getSiteOptions([
    "status_ref",
    "min_ruttien",
    "max_ruttien",
    "ref_min_deposit",
    "ref_max_deposit",
    "ref_withdraw_balance",
    "ref_withdraw_bank",
  ])
  return {
    min: parseInt(opts.min_ruttien || String(MIN_WITHDRAW_DEFAULT), 10),
    max: parseInt(opts.max_ruttien || String(MAX_WITHDRAW_DEFAULT), 10),
    minDeposit: parseInt(opts.ref_min_deposit || "0", 10),
    maxDeposit: parseInt(opts.ref_max_deposit || "0", 10),
    enabled: (opts.status_ref ?? "1") === "1",
    balanceEnabled: (opts.ref_withdraw_balance ?? "1") === "1",
    bankEnabled: (opts.ref_withdraw_bank ?? "1") === "1",
  }
}

function validateAmount(amount: number, min: number, max: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số tiền không hợp lệ" })
  }
  if (min > 0 && amount < min) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Số tiền tối thiểu là ${formatCash(min)}` })
  }
  if (max > 0 && amount > max) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Số tiền tối đa là ${formatCash(max)}` })
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Cấu hình affiliate cho client (UI render disabled state).
 */
export async function getAffiliateConfig() {
  await connectDB()
  const limits = await getEffectiveLimits()
  return {
    enabled: limits.enabled,
    balanceEnabled: limits.balanceEnabled,
    bankEnabled: limits.bankEnabled,
    minWithdraw: limits.min,
    maxWithdraw: limits.max,
    minDeposit: limits.minDeposit,
    maxDeposit: limits.maxDeposit,
  }
}

/**
 * Tổng hợp stats từ User doc + memberCount (countDocuments với index refId).
 *
 * Performance: 2 queries song song. memberCount dùng index `{ refId: 1 }` đã add.
 */
export async function getAffiliateStats(userId: Types.ObjectId | string) {
  await connectDB()

  const userIdStr = String(userId)
  const [user, memberCount, totalWithdrawn, globalRate] = await Promise.all([
    User.findById(userId)
      .select("refMoney refTotalMoney refClick refAmount refCk")
      .lean<any>(),
    User.countDocuments({ refId: userIdStr }),
    WithdrawRef.aggregate([
      { $match: { userId: new Types.ObjectId(userIdStr), status: { $in: [0, 1] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    getSiteOption("ck_ref"),
  ])

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Người dùng không tồn tại" })
  }

  const refRate = (user.refCk || 0) > 0 ? user.refCk : parseFloat(globalRate || "0") || 0

  return {
    userId: userIdStr,
    refMoney: user.refMoney || 0,
    refTotalMoney: user.refTotalMoney || 0,
    refClick: user.refClick || 0,
    refAmount: user.refAmount || 0,
    refRate,
    memberCount,
    totalWithdrawn: totalWithdrawn[0]?.total || 0,
  }
}

/**
 * Lịch sử hoa hồng — đọc từ LogBalance (filter content `[Hoa hồng]`).
 *
 * Pagination server-side (skip + limit). Search nội dung optional.
 */
export async function getCommissionHistory(
  userId: Types.ObjectId | string,
  opts?: { search?: string; page?: number; limit?: number }
) {
  await connectDB()

  const page = Math.max(1, opts?.page ?? 1)
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20))
  const skip = (page - 1) * limit

  const filter: Record<string, unknown> = {
    userId,
    content: { $regex: escapeRegex(COMMISSION_LOG_PREFIX), $options: "i" },
  }

  if (opts?.search) {
    filter.content = { $regex: escapeRegex(opts.search), $options: "i" }
  }

  const [items, total] = await Promise.all([
    LogBalance.find(filter)
      .select("moneyBefore moneyChange moneyAfter content createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<any[]>(),
    LogBalance.countDocuments(filter),
  ])

  return {
    items: items.map((log, i) => ({
      id: String(log._id),
      stt: skip + i + 1,
      content: (log.content || "").replace(`${COMMISSION_LOG_PREFIX} `, ""),
      moneyBefore: log.moneyBefore || 0,
      moneyChange: log.moneyChange || 0,
      moneyAfter: log.moneyAfter || 0,
      createdAt: log.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * Lịch sử rút tiền hoa hồng (paginate).
 */
export async function getWithdrawHistory(
  userId: Types.ObjectId | string,
  opts?: { search?: string; page?: number; limit?: number }
) {
  await connectDB()

  const page = Math.max(1, opts?.page ?? 1)
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 20))
  const skip = (page - 1) * limit

  const filter: Record<string, unknown> = { userId }

  if (opts?.search) {
    const safe = escapeRegex(opts.search)
    filter.$or = [
      { transId: { $regex: safe, $options: "i" } },
      { bank: { $regex: safe, $options: "i" } },
      { stk: { $regex: safe, $options: "i" } },
      { name: { $regex: safe, $options: "i" } },
    ]
  }

  const [items, total] = await Promise.all([
    WithdrawRef.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<any[]>(),
    WithdrawRef.countDocuments(filter),
  ])

  return {
    items: items.map((r) => ({
      id: String(r._id),
      transId: r.transId,
      bank: r.bank,
      stk: r.stk,
      name: r.name,
      amount: r.amount,
      status: r.status,
      reason: r.reason || "",
      createdAt: r.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// ─── Withdraw operations (atomic) ─────────────────────────────────────────

/**
 * CAS deduct refMoney — atomic.
 *
 * Trả về `{ moneyBefore, moneyAfter }` nếu OK, null nếu race / không đủ.
 * Caller phải xử lý null để rollback / báo lỗi.
 */
async function deductRefMoneyAtomic(
  userId: Types.ObjectId | string,
  amount: number
): Promise<{ moneyBefore: number; moneyAfter: number } | null> {
  if (amount <= 0) return { moneyBefore: 0, moneyAfter: 0 }
  const updated = (await User.findOneAndUpdate(
    { _id: userId, refMoney: { $gte: amount } },
    { $inc: { refMoney: -amount } },
    { new: true, projection: { refMoney: 1 } }
  )) as any
  if (!updated) return null
  return {
    moneyAfter: updated.refMoney,
    moneyBefore: updated.refMoney + amount,
  }
}

/**
 * Refund refMoney khi compensating.
 */
async function refundRefMoney(userId: Types.ObjectId | string, amount: number) {
  if (amount <= 0) return
  await User.updateOne({ _id: userId }, { $inc: { refMoney: amount } })
}

/**
 * Rút hoa hồng về số dư chính (auto-approved instant).
 *
 * Flow:
 *  1. Validate config + amount
 *  2. CAS deduct refMoney (chống race)
 *  3. Cộng money + ghi LogBalance "[Rút hoa hồng]"
 *  4. Tạo WithdrawRef status=1 (completed)
 *  5. Rollback: nếu insert log/withdraw fail, refund refMoney
 */
export async function withdrawToBalance(
  userId: Types.ObjectId | string,
  amount: number
) {
  await connectDB()

  const limits = await getEffectiveLimits()
  if (!limits.enabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Chương trình affiliate đang tạm ngưng" })
  }
  if (!limits.balanceEnabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Phương thức rút về số dư đã bị tắt" })
  }
  validateAmount(amount, limits.min, limits.max)

  // CAS deduct refMoney
  const deduct = await deductRefMoneyAtomic(userId, amount)
  if (!deduct) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư hoa hồng không đủ" })
  }

  // Cộng money + log + WithdrawRef
  try {
    const transId = await generateRefTransId()

    // Cộng money + lấy moneyBefore/After atomic
    const userUpdated = (await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { money: amount, totalMoney: amount } },
      { new: true, projection: { money: 1 } }
    )) as any
    if (!userUpdated) {
      // Edge case: user bị xóa giữa chừng
      throw new Error("User disappeared during withdraw")
    }

    const moneyAfter = userUpdated.money
    const moneyBefore = moneyAfter - amount

    // Log balance + WithdrawRef song song (best effort)
    await Promise.all([
      LogBalance.create({
        userId,
        moneyBefore,
        moneyChange: amount,
        moneyAfter,
        content: `[Rút hoa hồng] +${formatCash(amount)} về số dư chính`,
      }),
      WithdrawRef.create({
        userId,
        transId,
        bank: "BALANCE",
        stk: "",
        name: "",
        amount,
        status: 1, // auto-approved
        reason: null,
      }),
    ])

    return {
      success: true,
      transId,
      message: `Đã rút ${formatCash(amount)} về số dư chính`,
    }
  } catch (err: any) {
    // Rollback refMoney + money (best effort)
    await refundRefMoney(userId, amount).catch(() => {})
    await User.updateOne(
      { _id: userId },
      { $inc: { money: -amount, totalMoney: -amount } }
    ).catch(() => {})
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: err?.message || "Rút tiền thất bại, vui lòng thử lại",
    })
  }
}

/**
 * Rút hoa hồng về tài khoản ngân hàng (chờ admin duyệt).
 *
 * Flow:
 *  1. Validate config + amount + bank info
 *  2. Anti-spam: limit pending withdraw ≤ MAX_PENDING_WITHDRAW
 *  3. CAS deduct refMoney (chống race)
 *  4. Tạo WithdrawRef status=0 (pending)
 *  5. Rollback nếu insert fail
 */
export async function withdrawToBank(
  userId: Types.ObjectId | string,
  payload: { amount: number; bank: string; stk: string; name: string }
) {
  await connectDB()

  const limits = await getEffectiveLimits()
  if (!limits.enabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Chương trình affiliate đang tạm ngưng" })
  }
  if (!limits.bankEnabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Phương thức rút về ngân hàng đã bị tắt" })
  }
  validateAmount(payload.amount, limits.min, limits.max)

  if (!payload.bank || !payload.stk || !payload.name) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng nhập đầy đủ thông tin ngân hàng" })
  }
  if (payload.bank.toUpperCase() === "BALANCE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ngân hàng không hợp lệ" })
  }

  // Anti-spam: pending bank withdraw count
  const pendingCount = await WithdrawRef.countDocuments({
    userId,
    status: 0,
    bank: { $ne: "BALANCE" },
  })
  if (pendingCount >= MAX_PENDING_WITHDRAW) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Bạn có ${pendingCount} yêu cầu rút tiền chờ duyệt. Tối đa ${MAX_PENDING_WITHDRAW}, vui lòng chờ admin xử lý.`,
    })
  }

  // CAS deduct refMoney
  const deduct = await deductRefMoneyAtomic(userId, payload.amount)
  if (!deduct) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số dư hoa hồng không đủ" })
  }

  try {
    const transId = await generateRefTransId()
    await WithdrawRef.create({
      userId,
      transId,
      bank: payload.bank.toUpperCase(),
      stk: payload.stk,
      name: payload.name.toUpperCase(),
      amount: payload.amount,
      status: 0,
      reason: null,
    })

    return {
      success: true,
      transId,
      message: "Yêu cầu rút tiền đã được gửi, chờ admin duyệt",
    }
  } catch (err: any) {
    await refundRefMoney(userId, payload.amount).catch(() => {})
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: err?.message || "Tạo yêu cầu rút tiền thất bại",
    })
  }
}

// ─── Commission credit (entry-point cho deposit success) ──────────────────

const COMMISSION_TRANS_TAG = (transId: string) => `[trans:${transId}]`

/**
 * Tính rate commission hiệu lực cho 1 referrer.
 *
 * Ưu tiên:
 *  1. User.refCk (override per-user, > 0)
 *  2. Site option `ck_ref` (global)
 *  3. 0 (disabled)
 */
async function getEffectiveRefRate(referrerId: Types.ObjectId | string): Promise<number> {
  const [user, globalRate] = await Promise.all([
    User.findById(referrerId).select("refCk").lean<any>(),
    getSiteOption("ck_ref"),
  ])
  if (!user) return 0
  const userRate = Number(user.refCk) || 0
  if (userRate > 0) return userRate
  return parseFloat(globalRate || "0") || 0
}

/**
 * Cộng hoa hồng cho người giới thiệu (gọi sau khi user nạp tiền thành công).
 *
 * Idempotent: dùng `sourceTransId` để chống double-credit nếu callback retry.
 * Error-isolated: KHÔNG throw ra ngoài — gọi best-effort, log error nội bộ.
 *
 * Flow:
 *  1. Load payer.refId. Nếu null → return null (no referrer).
 *  2. Self-ref guard: refId !== payerId.
 *  3. Check status_ref enabled.
 *  4. Check duplicate qua LogBalance content (fast với index userId).
 *  5. Tính commission = amount × rate%. Skip nếu rate = 0 hoặc commission < 1đ.
 *  6. Atomic update referrer: $inc refMoney/refTotalMoney/refAmount.
 *  7. Insert LogBalance "[Hoa hồng] ... [trans:<id>]" để hiển thị + dedupe.
 *  8. Try/catch rollback: refund refMoney nếu LogBalance fail.
 *
 * @returns object commission info (amount, rate, referrerId) hoặc null nếu skip.
 */
export async function creditAffiliateCommission(input: {
  /** ID của user đã nạp/mua hàng */
  payerUserId: Types.ObjectId | string
  /** Số tiền thực tế của giao dịch (VND) */
  amount: number
  /** Mã giao dịch gốc — dùng để dedupe & truy vết */
  sourceTransId: string
  /** Loại giao dịch hiển thị trong log VD: "nạp ngân hàng", "nạp thẻ" */
  sourceLabel?: string
}): Promise<{
  referrerId: string
  commission: number
  rate: number
} | null> {
  const { payerUserId, amount, sourceTransId, sourceLabel = "nạp tiền" } = input

  // Validate input
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!sourceTransId) return null

  try {
    await connectDB()

    // 1. Load payer.refId
    const payer = await User.findById(payerUserId)
      .select("refId")
      .lean<{ refId: string | null } | null>()
    if (!payer?.refId) return null

    // 2. Self-ref guard
    if (String(payer.refId) === String(payerUserId)) return null
    if (!Types.ObjectId.isValid(payer.refId)) return null

    // 3. Check affiliate config + deposit bounds. A value of 0 means unlimited.
    const limits = await getEffectiveLimits()
    if (!limits.enabled) return null
    if (limits.minDeposit > 0 && amount < limits.minDeposit) return null
    if (limits.maxDeposit > 0 && amount > limits.maxDeposit) return null

    const referrerId = new Types.ObjectId(payer.refId)

    // 4. Verify referrer còn tồn tại + chưa banned
    const referrer = await User.findOne({ _id: referrerId, banned: { $ne: 1 } })
      .select("_id")
      .lean<any>()
    if (!referrer) return null

    // 5. Idempotency check qua LogBalance content (regex match tag)
    const tag = COMMISSION_TRANS_TAG(sourceTransId)
    const existed = await LogBalance.findOne({
      userId: referrerId,
      content: { $regex: escapeRegex(tag), $options: "i" },
    })
      .select("_id")
      .lean()
    if (existed) {
      // Đã credit trước đó — không làm gì
      return null
    }

    // 6. Tính commission
    const rate = await getEffectiveRefRate(referrerId)
    if (rate <= 0) return null
    const commission = Math.floor((amount * rate) / 100)
    if (commission < 1) return null

    // 7. Atomic update referrer (3 counters cùng lúc)
    const updated = await User.findOneAndUpdate(
      { _id: referrerId },
      {
        $inc: {
          refMoney: commission,
          refTotalMoney: commission,
          refAmount: amount,
        },
      },
      { new: true, projection: { refMoney: 1 } }
    ).lean<any>()
    if (!updated) return null

    const moneyAfter = updated.refMoney
    const moneyBefore = moneyAfter - commission

    // 8. Insert LogBalance — best effort + rollback nếu fail
    try {
      await LogBalance.create({
        userId: referrerId,
        moneyBefore,
        moneyChange: commission,
        moneyAfter,
        content: `${COMMISSION_LOG_PREFIX} +${formatCash(commission)} từ ${sourceLabel} ${formatCash(amount)} ${tag}`,
      })
    } catch (logErr) {
      // Rollback: refund refMoney/refTotalMoney/refAmount
      await User.updateOne(
        { _id: referrerId },
        {
          $inc: {
            refMoney: -commission,
            refTotalMoney: -commission,
            refAmount: -amount,
          },
        }
      ).catch(() => {})
      logger.error("creditAffiliateCommission: log failed, rolled back", logErr as Error, {
        module: "affiliate.creditCommission",
        referrerId: String(referrerId),
        sourceTransId,
      })
      return null
    }

    return {
      referrerId: String(referrerId),
      commission,
      rate,
    }
  } catch (err) {
    // Bất kỳ lỗi nào ở tầng credit — chỉ log, KHÔNG throw để khỏi phá flow nạp tiền
    logger.error("creditAffiliateCommission failed", err as Error, {
      module: "affiliate.creditCommission",
      sourceTransId,
    })
    return null
  }
}

/**
 * Refund hoa hồng đã cộng — gọi khi giao dịch gốc bị hủy/refund.
 *
 * Tìm log có tag [trans:<id>] để biết commission đã credit là bao nhiêu rồi
 * trừ ngược lại. Ghi log [Hoàn hoa hồng] để minh bạch.
 *
 * Idempotent: nếu chưa từng credit thì return null.
 */
export async function refundAffiliateCommission(input: {
  sourceTransId: string
  reason?: string
}): Promise<{ referrerId: string; refunded: number } | null> {
  const { sourceTransId, reason = "Giao dịch bị hoàn" } = input
  if (!sourceTransId) return null

  try {
    await connectDB()
    const tag = COMMISSION_TRANS_TAG(sourceTransId)

    // Tìm log credit gốc
    const log = await LogBalance.findOne({
      content: { $regex: escapeRegex(tag), $options: "i" },
    })
      .select("userId moneyChange")
      .lean<any>()
    if (!log) return null

    const refundAmount = Math.abs(log.moneyChange || 0)
    if (refundAmount <= 0) return null

    // Idempotency: check chưa refund
    const refundTag = `[refund:${sourceTransId}]`
    const refunded = await LogBalance.findOne({
      userId: log.userId,
      content: { $regex: escapeRegex(refundTag), $options: "i" },
    })
      .select("_id")
      .lean()
    if (refunded) return null

    // Trừ ngược refMoney + refTotalMoney (giữ refAmount để không ảnh hưởng stats nạp)
    const updated = await User.findOneAndUpdate(
      { _id: log.userId, refMoney: { $gte: refundAmount } },
      { $inc: { refMoney: -refundAmount, refTotalMoney: -refundAmount } },
      { new: true, projection: { refMoney: 1 } }
    ).lean<any>()

    // Nếu refMoney không đủ (đã rút) — vẫn trừ refTotalMoney + log warning
    if (!updated) {
      await User.updateOne(
        { _id: log.userId },
        { $inc: { refTotalMoney: -refundAmount } }
      ).catch(() => {})
      logger.warn("refundAffiliateCommission: insufficient refMoney, only refTotalMoney reverted", {
        module: "affiliate.refundCommission",
        userId: String(log.userId),
        sourceTransId,
        refundAmount,
      })
    }

    const moneyAfter = updated?.refMoney ?? 0
    const moneyBefore = moneyAfter + refundAmount

    await LogBalance.create({
      userId: log.userId,
      moneyBefore,
      moneyChange: -refundAmount,
      moneyAfter,
      content: `${COMMISSION_LOG_PREFIX} Hoàn ${formatCash(refundAmount)} (${reason}) ${refundTag}`,
    }).catch(() => {})

    return { referrerId: String(log.userId), refunded: refundAmount }
  } catch (err) {
    logger.error("refundAffiliateCommission failed", err as Error, {
      module: "affiliate.refundCommission",
      sourceTransId,
    })
    return null
  }
}

// ─── Click tracking ────────────────────────────────────────────────────────

import crypto from "node:crypto"

/** In-memory throttle: 1 (IP+UA+refId) chỉ count 1 click / 30 phút */
const clickThrottle = new Map<string, number>()
const CLICK_THROTTLE_MS = 30 * 60 * 1000 // 30 min

/** Bot/crawler User-Agent regex — anti-fraud cốt lõi */
const BOT_UA_REGEX = /(bot|crawler|spider|wget|curl|headless|phantom|puppeteer|playwright|python-requests|httpie|java\/|go-http-client|axios|node-fetch|libwww|scrapy)/i

/** Hash UA → 8 chars hex (giảm memory footprint) */
function hashUA(ua: string | null | undefined): string {
  if (!ua) return "none"
  return crypto.createHash("md5").update(ua).digest("hex").slice(0, 8)
}

/**
 * Tăng refClick cho referrer khi user visit URL có ?aff=<refId>.
 *
 * Anti-fraud:
 *  - Bot UA filter (regex known crawlers)
 *  - Self-click guard (nếu authedUserId === refId)
 *  - Throttle (IP + UA hash + refId) 30 phút
 *  - Status check (status_ref site option)
 *  - Referrer existence + not banned check
 *
 * @param input.refId    Referrer's user ID (24-hex)
 * @param input.ip       Client IP (X-Forwarded-For / X-Real-IP)
 * @param input.userAgent Client User-Agent header
 * @param input.authedUserId Logged-in user ID (nếu có) — chống self-click
 */
export async function trackAffiliateClick(input: {
  refId: string
  ip?: string | null
  userAgent?: string | null
  authedUserId?: string | null
}): Promise<{ ok: boolean; reason?: string }> {
  const { refId, ip, userAgent, authedUserId } = input

  // 1. Validate
  if (!refId || !Types.ObjectId.isValid(refId)) {
    return { ok: false, reason: "invalid_ref_id" }
  }

  // 2. Self-click guard (nếu user đã login)
  if (authedUserId && String(authedUserId) === refId.toLowerCase()) {
    logger.info("trackAffiliateClick blocked — self click", {
      module: "affiliate.trackClick",
      authedUserId,
      refId,
    })
    return { ok: false, reason: "self_click" }
  }

  // 3. Bot UA filter
  if (userAgent && BOT_UA_REGEX.test(userAgent)) {
    logger.info("trackAffiliateClick blocked — bot UA", {
      module: "affiliate.trackClick",
      userAgent: userAgent.slice(0, 100),
      refId,
    })
    return { ok: false, reason: "bot_ua" }
  }

  // 4. Throttle (key = IP + UA hash + refId)
  const uaHash = hashUA(userAgent)
  const key = `${ip || "anon"}:${uaHash}:${refId}`
  const now = Date.now()
  const last = clickThrottle.get(key)
  if (last && now - last < CLICK_THROTTLE_MS) {
    logger.info("trackAffiliateClick throttled", {
      module: "affiliate.trackClick",
      key,
      remainingMs: CLICK_THROTTLE_MS - (now - last),
    })
    return { ok: false, reason: "throttled" }
  }
  clickThrottle.set(key, now)

  // 5. Cleanup map nếu quá to (tránh memory leak)
  if (clickThrottle.size > 10_000) {
    const cutoff = now - CLICK_THROTTLE_MS
    for (const [k, t] of clickThrottle) {
      if (t < cutoff) clickThrottle.delete(k)
    }
  }

  // 6. Check status_ref enabled
  try {
    await connectDB()
    const statusRef = await getSiteOption("status_ref")
    if ((statusRef ?? "1") !== "1") {
      logger.info("trackAffiliateClick skipped — affiliate disabled", {
        module: "affiliate.trackClick",
      })
      return { ok: false, reason: "disabled" }
    }

    // 7. Inc counter (atomic, chống banned)
    const result = await User.updateOne(
      { _id: new Types.ObjectId(refId), banned: { $ne: 1 } },
      { $inc: { refClick: 1 } }
    )
    if (result.modifiedCount === 0) {
      logger.warn("trackAffiliateClick — referrer not found or banned", {
        module: "affiliate.trackClick",
        refId,
      })
      return { ok: false, reason: "referrer_invalid" }
    }
    return { ok: true }
  } catch (err) {
    logger.warn("trackAffiliateClick failed", {
      module: "affiliate.trackClick",
      error: (err as Error).message,
      refId,
    })
    return { ok: false, reason: "error" }
  }
}


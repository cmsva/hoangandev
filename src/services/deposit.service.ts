/**
 * Deposit Controller — Business logic nạp tiền qua ngân hàng.
 *
 * - getActiveBanks: lấy danh sách bank active + VietQR logo
 * - getDepositSettings: bank_min, bank_max
 * - getPromotions: bonus tiers
 * - createInvoice: tạo hóa đơn nạp tiền
 * - cancelInvoice: hủy hóa đơn pending
 * - checkInvoiceStatus: kiểm tra trạng thái
 * - getInvoices: lịch sử hóa đơn
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { Bank, BANK_LIST } from "@/models/bank.model"
import { Invoice } from "@/models/invoice.model"
import { Promotion } from "@/models/promotion.model"
import { getSiteOptions, getSiteOptionInt } from "@/models/setting.model"
import { emitToUser, emitToUserWithAck, emitToAdmins } from "@/lib/realtime/emit"

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCash(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

/** VietQR bank logos cache (TTL 1 giờ — logo giữ ổn định, refresh định kỳ và hit external API). */
let vietqrCache: Record<string, string> | null = null
let vietqrCacheAt = 0
const VIETQR_CACHE_TTL = 60 * 60 * 1000 // 1h

// No DB cache — luôn fresh từ DB. Chỉ giữ inflight de-dupe để chống thundering herd.
let activeBanksInflight: Promise<Awaited<ReturnType<typeof queryActiveBanks>>> | null = null
let depositSettingsInflight: Promise<Awaited<ReturnType<typeof queryDepositSettings>>> | null = null
let promotionsInflight: Promise<Awaited<ReturnType<typeof queryPromotions>>> | null = null
const invoicesInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryInvoices>>>>()

export function invalidateDepositCatalogCache(): void {
  // No-op: không cache nữa. Giữ chữ ký cho caller cũ.
  activeBanksInflight = null
  depositSettingsInflight = null
  promotionsInflight = null
}

function invalidateUserInvoicesCache(userId: Types.ObjectId | string): void {
  const prefix = `${String(userId)}:`
  for (const key of invoicesInflight.keys()) {
    if (key.startsWith(prefix)) invoicesInflight.delete(key)
  }
}

async function getVietQRLogos(): Promise<Record<string, string>> {
  const now = Date.now()
  if (vietqrCache && now - vietqrCacheAt < VIETQR_CACHE_TTL) return vietqrCache
  try {
    const res = await fetch("https://api.vietqr.io/v2/banks", {
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json()
    const map: Record<string, string> = {}
    for (const bank of json.data || []) {
      if (bank.shortName && bank.logo) map[bank.shortName] = bank.logo
      if (bank.short_name && bank.logo) map[bank.short_name] = bank.logo
    }
    vietqrCache = map
    vietqrCacheAt = now
    return map
  } catch {
    // Trả cache cũ nếu có — vẫn hơn là rỗng
    return vietqrCache || {}
  }
}

/**
 * Generate unique transId.
 *
 * type_random:
 *   0 (default) → numbers only (0-9)
 *   1           → uppercase letters only (A-Z)
 *   2           → letters + numbers mix
 *
 * range_random = total length (including prefix). prefix_autobank prepended.
 */
async function generateTransId(): Promise<string> {
  const opts = await getSiteOptions(["prefix_autobank", "range_random", "type_random"])
  const prefix = opts.prefix_autobank || "VK"
  const range = parseInt(opts.range_random || "8", 10)
  const typeRandom = parseInt(opts.type_random || "0", 10)
  const randomLength = Math.max(1, range - prefix.length)

  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const NUMS = "0123456789"

  let transId = ""
  let attempts = 0
  do {
    let randomPart = ""
    if (typeRandom === 1) {
      // Letters only
      for (let i = 0; i < randomLength; i++) {
        randomPart += ALPHA[Math.floor(Math.random() * ALPHA.length)]
      }
    } else if (typeRandom === 2) {
      // Letters + numbers mix (half-half)
      const half = Math.ceil(randomLength / 2)
      for (let i = 0; i < half; i++) {
        randomPart += ALPHA[Math.floor(Math.random() * ALPHA.length)]
      }
      for (let i = half; i < randomLength; i++) {
        randomPart += NUMS[Math.floor(Math.random() * NUMS.length)]
      }
    } else {
      // Numbers only (default)
      for (let i = 0; i < randomLength; i++) {
        randomPart += NUMS[Math.floor(Math.random() * NUMS.length)]
      }
    }
    transId = (prefix + randomPart).toUpperCase()
    const exists = await Invoice.findOne({ transId }).select({ _id: 1 }).lean()
    if (!exists) break
    attempts++
  } while (attempts < 100)

  return transId
}

// ─── Read ──────────────────────────────────────────────────────────────────

async function queryActiveBanks() {
  const banks = await Bank.find({ status: 1 })
    .select("shortName accountNumber accountName")
    .lean()
  const logos = await getVietQRLogos()

  return banks.map((b: any) => ({
    id: b._id.toString(),
    shortName: b.shortName,
    fullName: BANK_LIST[b.shortName] || b.shortName,
    accountNumber: b.accountNumber,
    accountName: b.accountName,
    logo: logos[b.shortName] || null,
  }))
}

export async function getActiveBanks() {
  if (activeBanksInflight) return activeBanksInflight

  activeBanksInflight = queryActiveBanks()
    .finally(() => {
      activeBanksInflight = null
    })
  return activeBanksInflight
}

async function queryDepositSettings() {
  const options = await getSiteOptions(["bank_min", "bank_max"])
  const bankMin = parseInt(options.bank_min || "10000", 10)
  const bankMax = parseInt(options.bank_max || "10000000", 10)
  return {
    bankMin: Number.isNaN(bankMin) ? 10000 : bankMin,
    bankMax: Number.isNaN(bankMax) ? 10000000 : bankMax,
  }
}

export async function getDepositSettings() {
  if (depositSettingsInflight) return depositSettingsInflight

  depositSettingsInflight = queryDepositSettings()
    .finally(() => {
      depositSettingsInflight = null
    })
  return depositSettingsInflight
}

async function queryPromotions() {
  const promos = await Promotion.find({})
    .select("amount discount")
    .sort({ amount: 1 })
    .lean()
  return (promos as any[]).map((p) => ({
    id: p._id.toString(),
    amount: p.amount,
    discount: p.discount,
  }))
}

export async function getPromotions() {
  if (promotionsInflight) return promotionsInflight

  promotionsInflight = queryPromotions()
    .finally(() => {
      promotionsInflight = null
    })
  return promotionsInflight
}

// ─── Create Invoice ────────────────────────────────────────────────────────

export async function createInvoice(
  userId: Types.ObjectId | string,
  bankId: string,
  amount: number
) {
  await connectDB()

  // Validate amount
  const bankMin = await getSiteOptionInt("bank_min", 10000)
  const bankMax = await getSiteOptionInt("bank_max", 10000000)
  if (amount < bankMin || amount > bankMax) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Số tiền không hợp lệ (${formatCash(bankMin)} - ${formatCash(bankMax)})`,
    })
  }

  // Anti-spam: check pending invoices count vs max_pending_invoices
  const { getSecurityConfig } = await import("@/lib/security-config")
  const secCfg = await getSecurityConfig()
  const maxPending = secCfg.maxPendingInvoices

  const pendingCount = await Invoice.countDocuments({ userId, status: 0 })
  if (pendingCount >= maxPending) {
    const oldestPending = await Invoice.findOne({ userId, status: 0 }).sort({ createdAt: 1 }).lean()
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Bạn có ${pendingCount} hóa đơn chưa thanh toán${oldestPending ? ` (${(oldestPending as any).transId})` : ""}. Tối đa ${maxPending}, hủy trước khi tạo mới.`,
    })
  }

  // Get bank
  const bank = await Bank.findOne({ _id: bankId, status: 1 }).lean()
  if (!bank) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ngân hàng không hợp lệ" })
  }

  // Calculate promotion bonus
  const promos = await Promotion.find({}).sort({ amount: -1 }).lean()
  let bonusPercent = 0
  let bonusAmount = 0
  for (const promo of promos as any[]) {
    if (amount >= promo.amount) {
      bonusPercent = promo.discount
      bonusAmount = Math.floor((amount * bonusPercent) / 100)
      break
    }
  }
  const finalAmount = amount + bonusAmount

  // Generate transId
  const transId = await generateTransId()

  // Expiry
  const timeInvoices = await getSiteOptionInt("time_invoices", 86400)
  const now = new Date()
  const expiredAt = new Date(now.getTime() + timeInvoices * 1000)

  // Create
  await Invoice.create({
    userId,
    transId,
    gateway: (bank as any).shortName,
    description: transId,
    amount,
    finalAmount,
    status: 0,
    expiredAt,
  })
  invalidateUserInvoicesCache(userId)

  // Notify admin: hóa đơn mới (best-effort)
  void import("@/services/notify.service").then((m) =>
    m.notifyInvoice({
      userId,
      amount: finalAmount,
      price: amount,
      method: (bank as any).shortName,
    })
  )

  return {
    transId,
    amount,
    finalAmount,
    bonusPercent,
    bonusAmount,
    bankShortName: (bank as any).shortName,
    accountNumber: (bank as any).accountNumber,
    accountName: (bank as any).accountName,
    expiredAt,
  }
}

// ─── Cancel Invoice ────────────────────────────────────────────────────────

export async function cancelInvoice(
  userId: Types.ObjectId | string,
  transId: string
) {
  await connectDB()
  const invoice = await Invoice.findOne({ transId })
  if (!invoice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Hóa đơn không tồn tại" })
  }
  if (String(invoice.userId) !== String(userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không có quyền hủy hóa đơn này" })
  }
  if (invoice.status !== 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể hủy hóa đơn này" })
  }

  await Invoice.updateOne(
    { transId, status: 0 },
    { $set: { status: 2 } }
  )
  invalidateUserInvoicesCache(userId)
  return { success: true }
}

// ─── Check Status ──────────────────────────────────────────────────────────

/**
 * Atomic expire-on-read: chuyển mọi invoice của userId đang `status: 0` và
 * đã quá `expiredAt` sang `status: 2` (hết hạn).
 *
 * Được gọi từ checkInvoiceStatus + getInvoices để đảm bảo UI luôn thấy
 * trạng thái chính xác, không cần đợi cron.
 */
async function expireStaleInvoices(
  userId: Types.ObjectId | string,
  scopeTransId?: string
): Promise<number> {
  const filter: Record<string, unknown> = {
    userId,
    status: 0,
    expiredAt: { $lt: new Date() },
  }
  if (scopeTransId) filter.transId = scopeTransId
  const result = await Invoice.updateMany(filter, { $set: { status: 2 } })
  if ((result.modifiedCount || 0) > 0) {
    invalidateUserInvoicesCache(userId)
  }
  return result.modifiedCount || 0
}


export async function checkInvoiceStatus(
  userId: Types.ObjectId | string,
  transId: string
) {
  await connectDB()
  // Auto-expire trước khi đọc — bảo đảm UI nhận trạng thái chính xác
  await expireStaleInvoices(userId, transId)

  const invoice = await Invoice.findOne({ transId }).lean<any>()
  if (!invoice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Hóa đơn không tồn tại" })
  }
  if (String(invoice.userId) !== String(userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không có quyền xem hóa đơn này" })
  }

  const statusMap: Record<number, string> = {
    0: "Đang chờ thanh toán",
    1: "Đã thanh toán",
    2: "Hết hạn / Đã hủy",
  }

  return {
    status: invoice.status,
    statusText: statusMap[invoice.status] || "Không xác định",
    amount: invoice.amount,
    finalAmount: invoice.finalAmount,
    gateway: invoice.gateway,
    transId: invoice.transId,
    createdAt: invoice.createdAt,
    expiredAt: invoice.expiredAt,
  }
}

// ─── Get Invoices (history) ────────────────────────────────────────────────

async function queryInvoices(
  userId: Types.ObjectId | string,
  limit: number
) {
  const invoices = await Invoice.find({ userId })
    .select("transId gateway amount finalAmount status createdAt expiredAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return (invoices as any[]).map((inv, i) => ({
    id: inv._id.toString(),
    stt: i + 1,
    transId: inv.transId,
    gateway: inv.gateway,
    amount: inv.amount,
    finalAmount: inv.finalAmount,
    status: inv.status,
    createdAt: inv.createdAt,
    expiredAt: inv.expiredAt,
  }))
}

export async function getInvoices(
  userId: Types.ObjectId | string,
  limit = 20
) {
  const key = `${String(userId)}:${limit}`
  const inflight = invoicesInflight.get(key)
  if (inflight) return inflight

  // Auto-expire trước khi query — đảm bảo danh sách trả về phản ánh đúng trạng thái
  await expireStaleInvoices(userId)

  const pending = queryInvoices(userId, limit)
    .finally(() => invoicesInflight.delete(key))
  invoicesInflight.set(key, pending)
  return pending
}

// ─── Mark invoice paid (entry point cho cron bank / payment gateway) ──────

/**
 * Đánh dấu invoice đã thanh toán + cộng tiền user + cộng hoa hồng affiliate.
 *
 * Idempotent: dùng atomic update Invoice {status: 0} → {status: 1}.
 * Nếu modifiedCount = 0 → đã được process trước đó (callback retry).
 *
 * Error isolation:
 *  - plusCredit fail → rollback Invoice status về 0
 *  - AFF commission fail → KHÔNG ảnh hưởng (best-effort, log internal)
 *
 * Caller (cron bank / payment webhook) chỉ cần:
 *   const result = await markInvoicePaid({ transId, paidAmount: 100000 })
 *   if (!result.success) { ... }
 *
 * @returns { success, invoiceId, userId, finalAmount, commission? } | { success: false, reason }
 */
export async function markInvoicePaid(input: {
  /** Mã giao dịch unique (Invoice.transId) */
  transId: string
  /** Số tiền thực tế bank chuyển vào (verify với invoice.finalAmount) */
  paidAmount?: number
  /** Optional gateway-specific txn id để log */
  gatewayRef?: string | null
}): Promise<
  | {
      success: true
      invoiceId: string
      userId: string
      finalAmount: number
      commission: { referrerId: string; commission: number; rate: number } | null
    }
  | { success: false; reason: string }
> {
  const { transId, paidAmount, gatewayRef } = input

  if (!transId || typeof transId !== "string") {
    return { success: false, reason: "Mã giao dịch không hợp lệ" }
  }

  await connectDB()

  // Atomic transition status 0 → 1 (chống double-process callback retry)
  const invoice = (await Invoice.findOneAndUpdate(
    { transId, status: 0 },
    {
      $set: {
        status: 1,
        paidAt: new Date(),
        ...(gatewayRef ? { gatewayRef } : {}),
      },
    },
    { new: true }
  )) as any

  if (!invoice) {
    // Đã được process hoặc không tồn tại
    return { success: false, reason: "Hóa đơn không tồn tại hoặc đã được xử lý" }
  }
  invalidateUserInvoicesCache(invoice.userId)

  // Verify số tiền chuyển khớp (nếu có).
  // So với invoice.amount (số tiền user phải chuyển), KHÔNG phải finalAmount —
  // vì finalAmount = amount + bonus khuyến mãi, user chỉ chuyển đúng amount.
  if (paidAmount !== undefined && paidAmount < invoice.amount) {
    // Rollback status (best-effort)
    await Invoice.updateOne({ _id: invoice._id }, { $set: { status: 0 } }).catch(() => {})
    return { success: false, reason: "Số tiền chuyển không đủ" }
  }

  // Cộng tiền user + LogBalance
  try {
    const { plusCredit } = await import("@/services/log.service")
    await plusCredit({
      userId: invoice.userId,
      amount: invoice.finalAmount,
      content: `Nạp ngân hàng ${invoice.gateway || ""} +${formatCash(invoice.finalAmount)}`,
    })
  } catch (err) {
    // Rollback Invoice status nếu plusCredit fail
    await Invoice.updateOne({ _id: invoice._id }, { $set: { status: 0 } }).catch(() => {})
    throw err
  }

  // Hook AFF commission — best-effort, error-isolated trong service.
  // Tính hoa hồng trên invoice.amount (tiền GỐC user nạp), KHÔNG phải finalAmount —
  // finalAmount đã gồm bonus khuyến mãi, aff chỉ chia trên số nạp thực.
  const { creditAffiliateCommission } = await import("@/services/affiliate.service")
  const commission = await creditAffiliateCommission({
    payerUserId: invoice.userId,
    amount: invoice.amount,
    sourceTransId: invoice.transId,
    sourceLabel: `nạp ngân hàng ${invoice.gateway || ""}`.trim(),
  })

  // Notify deposit success (mail + tele admin + tele user) — best-effort
  void (async () => {
    try {
      const { User } = await import("@/models/user.model")
      const u = await User.findById(invoice.userId).select("money").lean<{ money: number } | null>()
      const { notifyDepositSuccess } = await import("@/services/notify.service")
      await notifyDepositSuccess({
        userId: String(invoice.userId),
        amount: invoice.finalAmount,
        balance: u?.money ?? invoice.finalAmount,
        method: `Ngân hàng ${invoice.gateway || ""}`.trim(),
        transId: invoice.transId,
      })
    } catch (err) {
      console.error("[markInvoicePaid notify]", err)
    }
  })()

  // ─── Real-time: báo client nạp tiền thành công (#8 có ACK + timeout) ───
  emitToUserWithAck(invoice.userId, "deposit:success", {
    transId: invoice.transId,
    amount: invoice.finalAmount,
  })
  emitToUserWithAck(invoice.userId, "invoice:update", { transId: invoice.transId, status: 1 })
  emitToUser(invoice.userId, "balance:update", {})
  emitToAdmins("admin:newDeposit", {
    transId: invoice.transId,
    amount: invoice.finalAmount,
    gateway: invoice.gateway || "",
  })

  return {
    success: true,
    invoiceId: String(invoice._id),
    userId: String(invoice.userId),
    finalAmount: invoice.finalAmount,
    commission,
  }
}

/**
 * Hủy invoice + hoàn hoa hồng nếu đã từng credit.
 *
 * Edge case: invoice đã paid mà sau đó bị admin reverse (charge-back).
 * Caller dùng helper này thay vì update Invoice trực tiếp.
 */
export async function reverseInvoicePaid(input: {
  transId: string
  reason?: string
}): Promise<{ success: boolean; refunded?: number }> {
  const { transId, reason = "Charge-back" } = input

  await connectDB()

  // Chỉ reverse được invoice đang ở status 1
  const invoice = (await Invoice.findOneAndUpdate(
    { transId, status: 1 },
    { $set: { status: 2, reverseReason: reason, reversedAt: new Date() } },
    { new: false }
  )) as any
  if (!invoice) return { success: false }
  invalidateUserInvoicesCache(invoice.userId)

  // Trừ tiền user (best-effort)
  try {
    await Invoice.db.collection("users").updateOne(
      { _id: invoice.userId },
      { $inc: { money: -invoice.finalAmount, totalMoney: -invoice.finalAmount } }
    )
  } catch {
    // ignore
  }

  // Hoàn hoa hồng affiliate (idempotent)
  const { refundAffiliateCommission } = await import("@/services/affiliate.service")
  const result = await refundAffiliateCommission({
    sourceTransId: invoice.transId,
    reason,
  })

  return {
    success: true,
    refunded: result?.refunded || 0,
  }
}

/**
 * Card Controller — Business logic nạp thẻ cào.
 *
 * - getCardSettings: trạng thái + chiết khấu + thông báo
 * - getTelcos: danh sách nhà mạng
 * - getAmountsByTelco: mệnh giá + phí theo nhà mạng
 * - submitCard: validate + gửi API charging
 * - getCardHistory: lịch sử nạp thẻ
 * - processCardCallback: xử lý callback từ API
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import crypto from "node:crypto"
import { connectDB } from "@/lib/db"
import { Card } from "@/models/card.model"
import { Telco } from "@/models/telco.model"
import { getSiteOption, getSiteOptions } from "@/models/setting.model"
import { insertLog } from "@/services/log.service"
import { decryptValue, encryptValue } from "@/lib/encryption"

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCash(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex")
}

function safeDecryptPin(value: string): string {
  if (value.includes(":")) {
    try {
      return decryptValue(value) || ""
    } catch {
      return ""
    }
  }
  return value
}

/** Generate unique card transId */
async function generateCardTransId(): Promise<string> {
  let transId = ""
  let attempts = 0
  do {
    const ts = Date.now().toString(36).toUpperCase()
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    transId = `CARD${ts}${rand}`
    const exists = await Card.findOne({ transId }).select({ _id: 1 }).lean()
    if (!exists) break
    attempts++
  } while (attempts < 100)
  return transId
}

/** Validate serial/pin format by telco */
function checkFormatCard(
  telco: string,
  serial: string,
  pin: string
): { status: boolean; msg: string } {
  const sLen = serial.length
  const pLen = pin.length
  const t = telco.toUpperCase()

  if (t === "VIETTEL") {
    if (sLen !== 11 && sLen !== 14) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 13 && pLen !== 15) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }
  if (t === "MOBIFONE") {
    if (sLen !== 15) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 12) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }
  if (t === "VNMOBI") {
    if (sLen !== 16) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 12) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }
  if (t === "VINAPHONE") {
    if (sLen !== 14) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 14) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }
  if (t === "GARENA") {
    if (sLen !== 9) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 16) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }
  if (t === "ZING") {
    if (sLen !== 12) return { status: false, msg: "Độ dài seri không phù hợp" }
    if (pLen !== 9) return { status: false, msg: "Độ dài mã thẻ không phù hợp" }
  }

  return { status: true, msg: "Success" }
}

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getCardSettings() {
  await connectDB()
  const opts = await getSiteOptions(["card_status", "card_ck", "card_notice"])
  return {
    cardStatus: opts.card_status === "1",
    cardCk: parseFloat(opts.card_ck || "0"),
    cardNotice: opts.card_notice || "",
  }
}

export async function getTelcos() {
  await connectDB()
  const telcos = await Telco.aggregate([
    { $group: { _id: "$telco", img: { $first: "$img" } } },
    { $sort: { _id: 1 } },
  ])
  return telcos.map((t: any) => ({
    name: t._id,
    img: t.img || "",
  }))
}

export async function getAmountsByTelco(telco: string) {
  await connectDB()
  const cardCk = parseFloat((await getSiteOption("card_ck")) || "0")
  const amounts = await Telco.find({ telco }).sort({ value: 1 }).lean()

  return (amounts as any[]).map((a) => ({
    id: a._id.toString(),
    value: a.value,
    apiFee: a.fees,
    totalFee: a.fees + cardCk,
  }))
}

// ─── Submit Card ───────────────────────────────────────────────────────────

export async function submitCard(
  userId: Types.ObjectId | string,
  telco: string,
  amount: number,
  serial: string,
  pin: string
) {
  await connectDB()

  // Check card_status
  const cardStatus = await getSiteOption("card_status")
  if (cardStatus !== "1") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Chức năng nạp thẻ đang tạm tắt" })
  }

  // Validate format
  const formatCheck = checkFormatCard(telco, serial, pin)
  if (!formatCheck.status) {
    throw new TRPCError({ code: "BAD_REQUEST", message: formatCheck.msg })
  }

  // Verify telco + amount
  const telcoEntry = await Telco.findOne({ telco, value: amount }).lean()
  if (!telcoEntry) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mệnh giá không hợp lệ cho nhà mạng này" })
  }

  // Check duplicate
  const duplicate = await Card.findOne({ serial, pin, status: "pending" }).lean()
  if (duplicate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Thẻ này đang được xử lý, vui lòng chờ" })
  }

  // Validate partner config before creating a pending card.
  const opts = await getSiteOptions(["card_partner_id", "card_partner_key", "card_url_api"])
  const partnerId = opts.card_partner_id || ""
  const partnerKey = opts.card_partner_key || ""
  const apiUrl = opts.card_url_api || ""

  if (!apiUrl || !partnerId || !partnerKey) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cấu hình API nạp thẻ chưa được thiết lập" })
  }

  // Generate transId
  const transId = await generateCardTransId()

  // Insert card record only after local/config validation passes.
  await Card.create({
    userId,
    transId,
    telco,
    amount,
    price: 0,
    serial,
    pin: encryptValue(pin),
    status: "pending",
    reason: null,
  })

  /**
   * Build payload theo chuẩn chargingws/v2 (POST form-urlencoded).
   * Sign = md5(partner_key + code + serial).
   */
  const sign = md5(partnerKey + pin + serial)
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/card/callback`

  const payload = new URLSearchParams({
    telco: telco.toUpperCase(),
    code: pin,
    serial,
    amount: String(amount),
    request_id: transId,
    partner_id: partnerId,
    sign,
    command: "charging",
    callback_url: callbackUrl,
  })

  try {
    // Timeout 15s — chống partner hang giữ kết nối quá lâu
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    const apiStatus = Number(data?.status)

    // Status 99 = partner accepted and is verifying. Any other immediate status is not accepted.
    if (!res.ok || apiStatus !== 99) {
      const reason = data?.message || `API trả về trạng thái ${Number.isFinite(apiStatus) ? apiStatus : "không hợp lệ"}`
      await Card.updateOne({ transId }, { $set: { status: "error", reason } })
      throw new TRPCError({ code: "BAD_GATEWAY", message: reason })
    }

    return {
      success: true,
      transId,
      message: data?.message || "Thẻ đang được xử lý",
      apiStatus,
    }
  } catch (err: any) {
    // Update card status to error (kèm reason chi tiết để debug)
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError"
    const reason = isTimeout ? "Timeout khi gọi API" : "Lỗi kết nối API"
    await Card.updateOne(
      { transId },
      { $set: { status: "error", reason } }
    )
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: isTimeout
        ? "Hệ thống nạp thẻ đang chậm, vui lòng thử lại sau ít phút"
        : "Lỗi kết nối đến API nạp thẻ, vui lòng thử lại",
    })
  }
}

// ─── Card Callback (from external API) ──────────────────────────────

/**
 * processCardCallback — xử lý callback từ partner API.
 *
 * Theo postman v2 spec (https://documenter.getpostman.com/view/5740908/TVYJ5Ggr):
 *  - status = 1 → Success, đúng mệnh giá
 *  - status = 2 → Success, sai mệnh giá (value trả về < amount gửi) — áp penalty
 *  - status ∈ {3,4,99,100, ...} → Fail
 *
 * `value` = mệnh giá thực sau khi partner verify (= amount nếu đúng).
 * Idempotent: chỉ xử lý 1 lần (chỉ khi card.status === 'pending').
 */
export async function processCardCallback(params: {
  request_id: string
  status: number
  amount?: number
  value?: number
  message?: string
  /** Sign từ partner = md5(partner_key + code + serial). Verify để chặn callback giả mạo. */
  sign?: string
  /** code = pin (mã thẻ), serial — cần cho verify sign. */
  code?: string
  serial?: string
}) {
  await connectDB()

  const card = await Card.findOne({ transId: params.request_id })
  if (!card) return { success: false, message: "Card not found" }
  if (card.status !== "pending") return { success: false, message: "Already processed" }

  // Verify sign. Reject unsigned callbacks to prevent forged public callbacks.
  const partnerKey = (await getSiteOption("card_partner_key")) || ""
  if (!partnerKey) {
    return { success: false, message: "Partner key chưa cấu hình" }
  }
  if (!params.sign) {
    return { success: false, message: "Missing sign" }
  }
  const code = params.code || safeDecryptPin(card.pin)
  const serial = params.serial || card.serial
  if (!code) {
    return { success: false, message: "Missing card code" }
  }
  const expected = md5(partnerKey + code + serial)
  if (expected !== params.sign) {
    return { success: false, message: "Invalid sign" }
  }

  if (params.status === 99) {
    return { success: true, message: "Card is still pending" }
  }

  const isSuccess = params.status === 1 || params.status === 2
  const isWrongAmount = params.status === 2

  if (isSuccess) {
    // Cộng tiền. value = mệnh giá thực sau verify (nếu wrong, value < amount).
    const realAmount = params.value || params.amount || card.amount
    const cardCk = parseFloat((await getSiteOption("card_ck")) || "0")
    const telcoEntry = await Telco.findOne({ telco: card.telco, value: card.amount }).lean<any>()
    const apiFee = telcoEntry?.fees || 0

    let totalFee = apiFee + cardCk
    if (isWrongAmount) {
      const penalty = telcoEntry?.penalty || 0
      totalFee += penalty
    }

    const price = Math.floor(realAmount * (1 - totalFee / 100))

    // Update card (atomic chặn race)
    const updated = await Card.updateOne(
      { transId: params.request_id, status: "pending" },
      {
        $set: {
          status: "completed",
          price,
          reason: isWrongAmount ? "Sai mệnh giá" : null,
        },
      }
    )
    if (updated.modifiedCount === 0) {
      return { success: false, message: "Already processed" }
    }

    // Cộng tiền user (plusCredit handles User balance + LogBalance)
    const { plusCredit } = await import("@/services/log.service")
    await plusCredit({
      userId: card.userId,
      amount: price,
      content: `Nạp thẻ ${card.telco} - ${formatCash(realAmount)} → +${formatCash(price)}`,
    }).catch(() => { })

    // NOTE: Affiliate commission KHÔNG cộng cho nạp thẻ theo yêu cầu USER
    // (chỉ cộng cho nạp ngân hàng để đơn giản logic). Nếu sau này muốn mở:
    //   import { creditAffiliateCommission } from "@/services/affiliate.service"
    //   creditAffiliateCommission({
    //     payerUserId: card.userId,
    //     amount: price,
    //     sourceTransId: card.transId,
    //     sourceLabel: `nạp thẻ ${card.telco}`,
    //   }).catch(() => {})

    // Notify: admin (admin_card_recharge) + user (deposit_success mail + tele) — best-effort
    void (async () => {
      try {
        const { User } = await import("@/models/user.model")
        const u = await User.findById(card.userId).select("money").lean<{ money: number } | null>()
        const notify = await import("@/services/notify.service")
        await notify.notifyCardRecharge({
          userId: String(card.userId),
          amount: realAmount,
          price,
          method: card.telco,
        })
        await notify.notifyDepositSuccess({
          userId: String(card.userId),
          amount: price,
          balance: u?.money ?? price,
          method: `Thẻ ${card.telco}`,
          transId: card.transId,
        })
      } catch (err) {
        console.error("[processCardCallback notify]", err)
      }
    })()

    return { success: true }
  }

  // Failed (status 3, 4, 99, 100, ...).
  await Card.updateOne(
    { transId: params.request_id, status: "pending" },
    { $set: { status: "error", reason: params.message || "Thẻ lỗi" } }
  )
  return { success: true }
}

// ─── Get Card History ──────────────────────────────────────────────────────

export async function getCardHistory(
  userId: Types.ObjectId | string,
  limit = 20
) {
  await connectDB()
  const cards = await Card.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return (cards as any[]).map((c, i) => ({
    id: c._id.toString(),
    stt: i + 1,
    transId: c.transId,
    telco: c.telco,
    serial: c.serial,
    amount: c.amount,
    price: c.price,
    status: c.status,
    reason: c.reason || "",
    createdAt: c.createdAt,
  }))
}

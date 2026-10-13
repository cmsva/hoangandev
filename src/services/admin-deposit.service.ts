/**
 * Admin Deposit Service — Business logic admin tài chính.
 *
 * Phạm vi:
 *  - Bank invoices (list/stats/approve/reject)
 *  - Bank config (site options)
 *  - Bank entries (CRUD with encryption)
 *  - Card history (list/stats)
 *  - Card config (site options)
 *  - Telco CRUD + bulk delete + sync from API
 *  - Promotion CRUD (deposit bonus tiers)
 *
 * Protocol-agnostic: chỉ throw TRPCError, KHÔNG nhận ctx.
 */
import { TRPCError } from "@trpc/server"
import mongoose, { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { Bank, BANK_LIST, BANK_API_PROVIDERS, type BankApiProvider } from "@/models/bank.model"
import { Invoice } from "@/models/invoice.model"
import { Card } from "@/models/card.model"
import { Telco } from "@/models/telco.model"
import { Promotion } from "@/models/promotion.model"
import { User } from "@/models/user.model"
import { getSiteOptions, setSiteOptions } from "@/models/setting.model"
import { encryptValue, decryptValue, maskCredential, isValidObjectId } from "@/lib/encryption"
import { markInvoicePaid } from "@/services/deposit.service"
import { logger } from "@/lib/logger"

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCash(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return ""
  if (value.includes(":") && value.split(":").length === 3) {
    try {
      return decryptValue(value) || ""
    } catch {
      return ""
    }
  }
  return value
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(): Date {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// ═══════════════════════════════════════════════════════════
//  BANK INVOICES (Admin)
// ═══════════════════════════════════════════════════════════

/**
 * Stats cho dashboard admin: tổng / pending / completed + tổng tiền (all/month/week/today).
 */
export async function getAdminBankStats() {
  await connectDB()
  const todayStart = startOfToday()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  const [total, pending, completed, amountAll, amountMonth, amountWeek, amountToday] =
    await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: 0 }),
      Invoice.countDocuments({ status: 1 }),
      Invoice.aggregate([
        { $match: { status: 1 } },
        { $group: { _id: null, sum: { $sum: "$finalAmount" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Invoice.aggregate([
        { $match: { status: 1, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, sum: { $sum: "$finalAmount" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Invoice.aggregate([
        { $match: { status: 1, createdAt: { $gte: weekStart } } },
        { $group: { _id: null, sum: { $sum: "$finalAmount" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Invoice.aggregate([
        { $match: { status: 1, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, sum: { $sum: "$finalAmount" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
    ])

  return { total, pending, completed, amountAll, amountMonth, amountWeek, amountToday }
}

/**
 * List invoices (limit 500, sort desc).
 * Join user.username + Bank.accountNumber/Name (theo gateway shortName).
 */
export async function listAdminInvoices(limit = 500) {
  await connectDB()

  const invoices = await Invoice.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<any[]>()

  const userIds = [
    ...new Set(invoices.map((i) => String(i.userId)).filter(Boolean)),
  ].map((id) => {
    try {
      return new Types.ObjectId(id)
    } catch {
      return null
    }
  }).filter(Boolean) as Types.ObjectId[]

  const users = await User.find({ _id: { $in: userIds } })
    .select({ username: 1 })
    .lean<{ _id: Types.ObjectId; username: string }[]>()

  const userMap = new Map(users.map((u) => [String(u._id), u.username || "N/A"]))

  // Bank lookup theo shortName để show STK/owner
  const banks = await Bank.find()
    .select({ shortName: 1, accountNumber: 1, accountName: 1 })
    .lean<any[]>()
  const bankMap = new Map<string, { account: string; name: string }>()
  banks.forEach((b) =>
    bankMap.set(b.shortName, { account: b.accountNumber, name: b.accountName })
  )

  return invoices.map((inv, i) => {
    const bankInfo = bankMap.get(inv.gateway)
    return {
      id: String(inv._id),
      stt: i + 1,
      transId: inv.transId,
      gateway: inv.gateway,
      gatewayName: BANK_LIST[inv.gateway] || inv.gateway,
      userId: String(inv.userId),
      username: userMap.get(String(inv.userId)) || "N/A",
      bankAccount: bankInfo?.account || "",
      bankAccountName: bankInfo?.name || "",
      amount: inv.amount,
      finalAmount: inv.finalAmount,
      status: inv.status as 0 | 1 | 2,
      createdAt: inv.createdAt as Date,
      paidAt: inv.paidAt as Date | null,
    }
  })
}

/**
 * Approve (status -> 1) hoặc reject (status -> 2) invoice.
 *
 * Approve: gọi `markInvoicePaid` để cộng tiền + AFF commission + log balance.
 * Reject: chỉ flip status nếu invoice đang pending.
 */
export async function updateInvoiceStatus(input: {
  id: string
  status: 0 | 1 | 2
  adminId: string
  adminName: string
}) {
  await connectDB()

  if (!isValidObjectId(input.id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID hóa đơn không hợp lệ" })
  }
  const invoice = await Invoice.findById(input.id).lean<any>()
  if (!invoice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Hóa đơn không tồn tại" })
  }

  if (invoice.status === input.status) {
    return { success: true, transId: invoice.transId, noop: true }
  }

  // ─── Approve flow ───
  if (input.status === 1) {
    if (invoice.status !== 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Chỉ có thể duyệt hóa đơn đang pending",
      })
    }
    const result = await markInvoicePaid({
      transId: invoice.transId,
      gatewayRef: `manual:admin:${input.adminId}`,
    })
    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.reason || "Không thể duyệt hóa đơn",
      })
    }
    return { success: true, transId: invoice.transId, paid: true }
  }

  // ─── Reject flow ───
  if (input.status === 2) {
    if (invoice.status !== 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Chỉ có thể từ chối hóa đơn đang pending",
      })
    }
    await Invoice.updateOne(
      { _id: input.id, status: 0 },
      { $set: { status: 2, reverseReason: `Admin rejected by ${input.adminName}`, reversedAt: new Date() } }
    )
    return { success: true, transId: invoice.transId, rejected: true }
  }

  // Status 0 = re-open, không hỗ trợ
  throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái không hợp lệ" })
}

// ═══════════════════════════════════════════════════════════
//  BANK CONFIG (site options)
// ═══════════════════════════════════════════════════════════

export async function getAdminBankConfig() {
  await connectDB()
  const opts = await getSiteOptions([
    "bank_status",
    "bank_min",
    "bank_max",
    "prefix_autobank",
    "type_random",
    "range_random",
    "time_invoices",
  ])
  return {
    bankStatus: opts.bank_status === "1",
    bankMin: parseInt(opts.bank_min || "10000", 10),
    bankMax: parseInt(opts.bank_max || "10000000", 10),
    prefix: opts.prefix_autobank || "",
    typeRandom: parseInt(opts.type_random || "0", 10),
    rangeRandom: parseInt(opts.range_random || "8", 10),
    timeInvoices: parseInt(opts.time_invoices || "86400", 10),
  }
}

export async function updateAdminBankConfig(input: {
  bankStatus?: boolean
  bankMin?: number
  bankMax?: number
  prefix?: string
  typeRandom?: number
  rangeRandom?: number
  timeInvoices?: number
}) {
  await connectDB()
  const entries: Record<string, string> = {}
  if (input.bankStatus !== undefined) entries.bank_status = input.bankStatus ? "1" : "0"
  if (input.bankMin !== undefined) entries.bank_min = String(input.bankMin)
  if (input.bankMax !== undefined) entries.bank_max = String(input.bankMax)
  if (input.prefix !== undefined) entries.prefix_autobank = input.prefix
  if (input.typeRandom !== undefined) entries.type_random = String(input.typeRandom)
  if (input.rangeRandom !== undefined) entries.range_random = String(input.rangeRandom)
  if (input.timeInvoices !== undefined) entries.time_invoices = String(input.timeInvoices)
  await setSiteOptions(entries)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════
//  BANK ENTRIES CRUD (deposit/bank/config)
// ═══════════════════════════════════════════════════════════

/**
 * List banks. Mask iBanking creds + apiToken (hiển thị bool "đã có" thay vì raw).
 */
export async function listAdminBanks() {
  await connectDB()
  const banks = await Bank.find()
    .sort({ status: -1, createdAt: -1 })
    .lean<any[]>()
  return banks.map((b) => ({
    id: String(b._id),
    shortName: b.shortName,
    fullName: BANK_LIST[b.shortName] || b.shortName,
    accountNumber: b.accountNumber,
    accountName: b.accountName,
    status: b.status as number,
    apiProvider: (b.apiProvider || "none") as BankApiProvider,
    /** Masked giá trị thực dùng decrypt khi cần edit */
    apiToken: b.apiToken ? maskCredential(safeDecrypt(b.apiToken), 2) : "",
    bankUsername: b.bankUsername ? safeDecrypt(b.bankUsername) : "",
    bankPassword: b.bankPassword ? maskCredential(safeDecrypt(b.bankPassword), 0) : "",
    deviceId: b.deviceId || "",
    lastCheckAt: b.lastCheckAt as Date | null,
    lastError: (b.lastError || "") as string,
    balance: (b.balance ?? null) as number | null,
  }))
}

/**
 * Get full bank entry (decrypted) — chỉ dùng nội bộ admin để pre-fill form edit.
 */
export async function getAdminBankRaw(id: string) {
  await connectDB()
  if (!isValidObjectId(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Bank ID không hợp lệ" })
  }
  const bank = await Bank.findById(id).lean<any>()
  if (!bank) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bank không tồn tại" })
  }
  return {
    id: String(bank._id),
    shortName: bank.shortName,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    status: bank.status,
    apiProvider: bank.apiProvider || "none",
    apiToken: safeDecrypt(bank.apiToken),
    bankUsername: safeDecrypt(bank.bankUsername),
    bankPassword: safeDecrypt(bank.bankPassword),
    deviceId: bank.deviceId || "",
  }
}

interface BankWriteInput {
  shortName: string
  accountNumber: string
  accountName: string
  status: number
  apiProvider?: string | null
  apiToken?: string
  bankUsername?: string
  bankPassword?: string
  deviceId?: string
}

function validateBankInput(input: BankWriteInput) {
  if (!input.shortName?.trim() || !input.accountNumber?.trim() || !input.accountName?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu thông tin ngân hàng" })
  }
  const provider = (input.apiProvider || "none") as BankApiProvider
  if (!BANK_API_PROVIDERS.includes(provider)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provider không hợp lệ" })
  }
  const isDirect = provider === "acb" || provider === "mbbank" || provider === "ocb"
  if (isDirect && (!input.bankUsername?.trim() || !input.bankPassword?.trim())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Direct API yêu cầu username + password",
    })
  }
  return provider
}

export async function addAdminBank(input: BankWriteInput) {
  await connectDB()
  const provider = validateBankInput(input)

  await Bank.create({
    shortName: input.shortName.trim(),
    accountNumber: input.accountNumber.trim(),
    accountName: input.accountName.trim(),
    status: input.status,
    apiProvider: provider,
    apiToken: input.apiToken?.trim() ? encryptValue(input.apiToken.trim()) : null,
    bankUsername: input.bankUsername?.trim() ? encryptValue(input.bankUsername.trim()) : null,
    bankPassword: input.bankPassword?.trim() ? encryptValue(input.bankPassword.trim()) : null,
    deviceId: input.deviceId?.trim() || null,
  })

  return { success: true }
}

export async function updateAdminBank(input: BankWriteInput & { id: string }) {
  await connectDB()
  const provider = validateBankInput(input)

  const update: Record<string, any> = {
    shortName: input.shortName.trim(),
    accountNumber: input.accountNumber.trim(),
    accountName: input.accountName.trim(),
    status: input.status,
    apiProvider: provider,
    deviceId: input.deviceId?.trim() || null,
  }

  // Nếu input có giá trị mới (không rỗng) → encrypt + lưu
  // Nếu input rỗng → giữ nguyên giá trị cũ (không update field)
  // Nếu input là chuỗi mask "•" → coi như không thay đổi
  const isMask = (v?: string) => !!v && /^[•\s]+$/.test(v)

  if (input.apiToken?.trim() && !isMask(input.apiToken)) {
    update.apiToken = encryptValue(input.apiToken.trim())
  }
  if (input.bankUsername?.trim() && !isMask(input.bankUsername)) {
    update.bankUsername = encryptValue(input.bankUsername.trim())
  }
  if (input.bankPassword?.trim() && !isMask(input.bankPassword)) {
    update.bankPassword = encryptValue(input.bankPassword.trim())
  }

  const result = await Bank.updateOne({ _id: input.id }, { $set: update })
  if (result.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bank không tồn tại" })
  }
  return { success: true }
}

export async function deleteAdminBank(id: string) {
  await connectDB()
  const result = await Bank.deleteOne({ _id: id })
  if (result.deletedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bank không tồn tại" })
  }
  return { success: true }
}

// ═══════════════════════════════════════════════════════════
//  CARD INVOICES (Admin)
// ═══════════════════════════════════════════════════════════

export async function getAdminCardStats() {
  await connectDB()
  const todayStart = startOfToday()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  const [total, pending, completed, error, amountAll, amountMonth, amountWeek, amountToday] =
    await Promise.all([
      Card.countDocuments(),
      Card.countDocuments({ status: "pending" }),
      Card.countDocuments({ status: "completed" }),
      Card.countDocuments({ status: "error" }),
      Card.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, sum: { $sum: "$price" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Card.aggregate([
        { $match: { status: "completed", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, sum: { $sum: "$price" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Card.aggregate([
        { $match: { status: "completed", createdAt: { $gte: weekStart } } },
        { $group: { _id: null, sum: { $sum: "$price" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
      Card.aggregate([
        { $match: { status: "completed", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, sum: { $sum: "$price" } } },
      ]).then((r) => (r[0] as any)?.sum || 0),
    ])

  return { total, pending, completed, error, amountAll, amountMonth, amountWeek, amountToday }
}

export async function listAdminCards(limit = 500) {
  await connectDB()
  const cards = await Card.find().sort({ createdAt: -1 }).limit(limit).lean<any[]>()

  const userIds = [...new Set(cards.map((c) => String(c.userId)).filter(Boolean))].map((id) => {
    try {
      return new Types.ObjectId(id)
    } catch {
      return null
    }
  }).filter(Boolean) as Types.ObjectId[]

  const users = await User.find({ _id: { $in: userIds } })
    .select({ username: 1 })
    .lean<{ _id: Types.ObjectId; username: string }[]>()
  const userMap = new Map(users.map((u) => [String(u._id), u.username || "N/A"]))

  return cards.map((c, i) => ({
    id: String(c._id),
    stt: i + 1,
    transId: c.transId,
    telco: c.telco,
    serial: c.serial,
    pin: "********",
    amount: c.amount,
    price: c.price,
    status: c.status,
    reason: c.reason || "",
    username: userMap.get(String(c.userId)) || "N/A",
    createdAt: c.createdAt,
  }))
}

// ═══════════════════════════════════════════════════════════
//  CARD CONFIG (site options)
// ═══════════════════════════════════════════════════════════

export async function getAdminCardConfig() {
  await connectDB()
  const opts = await getSiteOptions([
    "card_status",
    "card_partner_id",
    "card_partner_key",
    "card_ck",
    "card_url_api",
    "card_notice",
  ])
  return {
    cardStatus: opts.card_status === "1",
    partnerId: opts.card_partner_id || "",
    partnerKey: opts.card_partner_key || "",
    cardCk: parseFloat(opts.card_ck || "0"),
    urlApi: opts.card_url_api || "",
    cardNotice: opts.card_notice || "",
  }
}

export async function updateAdminCardConfig(input: {
  cardStatus?: boolean
  partnerId?: string
  partnerKey?: string
  cardCk?: number
  urlApi?: string
  cardNotice?: string
}) {
  await connectDB()
  const entries: Record<string, string> = {}
  if (input.cardStatus !== undefined) entries.card_status = input.cardStatus ? "1" : "0"
  if (input.partnerId !== undefined) entries.card_partner_id = input.partnerId
  if (input.partnerKey !== undefined) entries.card_partner_key = input.partnerKey
  if (input.cardCk !== undefined) entries.card_ck = String(input.cardCk)
  if (input.urlApi !== undefined) entries.card_url_api = input.urlApi
  if (input.cardNotice !== undefined) entries.card_notice = input.cardNotice
  await setSiteOptions(entries)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════
//  TELCO CRUD
// ═══════════════════════════════════════════════════════════

export async function listAdminTelcos() {
  await connectDB()
  const telcos = await Telco.find().sort({ telco: 1, value: 1 }).lean<any[]>()
  return telcos.map((t) => ({
    id: String(t._id),
    telco: t.telco,
    img: t.img || "",
    value: t.value,
    fees: t.fees,
    penalty: t.penalty,
  }))
}

export async function addAdminTelco(input: {
  telco: string
  img: string
  value: number
  fees: number
  penalty: number
}) {
  await connectDB()
  if (!input.telco?.trim() || input.value < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu nhà mạng hoặc mệnh giá" })
  }
  await Telco.create({
    telco: input.telco.trim().toUpperCase(),
    img: input.img.trim() || null,
    value: input.value,
    fees: input.fees,
    penalty: input.penalty,
  })
  return { success: true }
}

export async function updateAdminTelco(input: {
  id: string
  telco?: string
  img?: string
  value?: number
  fees?: number
  penalty?: number
}) {
  await connectDB()
  const update: Record<string, any> = {}
  if (input.telco !== undefined) update.telco = input.telco.trim().toUpperCase()
  if (input.img !== undefined) update.img = input.img.trim() || null
  if (input.value !== undefined) update.value = input.value
  if (input.fees !== undefined) update.fees = input.fees
  if (input.penalty !== undefined) update.penalty = input.penalty

  const result = await Telco.updateOne({ _id: input.id }, { $set: update })
  if (result.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mệnh giá không tồn tại" })
  }
  return { success: true }
}

export async function deleteAdminTelco(id: string) {
  await connectDB()
  const result = await Telco.deleteOne({ _id: id })
  if (result.deletedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mệnh giá không tồn tại" })
  }
  return { success: true }
}

export async function bulkDeleteAdminTelcos(ids: string[]) {
  await connectDB()
  const result = await Telco.deleteMany({ _id: { $in: ids } })
  return { success: true, deleted: result.deletedCount }
}

/**
 * Sync mệnh giá từ partner API (chargingws/v2 getfee endpoint).
 *
 * Yêu cầu USER đã config:
 *   - card_partner_id
 *   - card_url_api (e.g. https://doithe1s.vn/chargingws/v2)
 *
 * API trả về JSON shape: { TELCO_NAME: [{ telco, value, fees, penalty }, ...] }
 * Diff với DB → insert mới hoặc update fees/penalty.
 */
export async function syncTelcosFromApi() {
  await connectDB()
  const opts = await getSiteOptions(["card_partner_id", "card_url_api"])
  const partnerId = opts.card_partner_id
  const baseUrl = opts.card_url_api || ""
  if (!partnerId || !baseUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chưa cấu hình Partner ID hoặc URL API",
    })
  }

  // Derive getfee URL theo chuẩn v2: {base}/chargingws/v2/getfee?partner_id=...
  // QUAN TRỌNG: getfee nằm DƯỚI path v2 (append "/getfee"), KHÔNG phải thay segment
  // cuối. baseUrl = https://site/chargingws/v2 → https://site/chargingws/v2/getfee.
  let getfeeUrl: string
  try {
    const trimmed = baseUrl.trim().replace(/\/+$/, "") // bỏ dấu "/" thừa ở cuối
    new URL(trimmed) // validate là URL hợp lệ
    getfeeUrl = `${trimmed}/getfee?partner_id=${encodeURIComponent(partnerId)}`
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL API không hợp lệ",
    })
  }

  let data: any
  try {
    const res = await fetch(getfeeUrl, { signal: AbortSignal.timeout(15_000) })
    const text = await res.text()
    if (!res.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `API trả về lỗi HTTP ${res.status}`,
      })
    }
    // Partner trả HTML (sai URL / sai partner_id / cần whitelist IP) → text bắt đầu
    // bằng "<". JSON.parse sẽ ném "Unexpected token <". Bắt riêng để báo lỗi rõ ràng.
    try {
      data = JSON.parse(text)
    } catch {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "API không trả về JSON — kiểm tra URL API và Partner ID (server có thể cần whitelist IP)",
      })
    }
  } catch (err: any) {
    if (err instanceof TRPCError) throw err
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: err?.message || "Không kết nối được API partner",
    })
  }

  let inserted = 0
  let updated = 0

  for (const [telcoName, entries] of Object.entries(data)) {
    if (!Array.isArray(entries) || entries.length === 0) continue
    const telcoUpper = telcoName.toUpperCase()
    for (const entry of entries as Array<{
      telco: string
      value: number
      fees: number
      penalty: number
    }>) {
      const existing = await Telco.findOne({ telco: telcoUpper, value: entry.value }).lean<any>()
      if (existing) {
        const changed = existing.fees !== entry.fees || existing.penalty !== entry.penalty
        if (changed) {
          await Telco.updateOne(
            { _id: existing._id },
            { $set: { fees: entry.fees, penalty: entry.penalty } }
          )
          updated++
        }
      } else {
        await Telco.create({
          telco: telcoUpper,
          value: entry.value,
          fees: entry.fees,
          penalty: entry.penalty,
          img: null,
        })
        inserted++
      }
    }
  }

  logger.info("Synced telcos from API", { module: "admin-deposit", inserted, updated })
  return { success: true, inserted, updated }
}

// ═══════════════════════════════════════════════════════════
//  PROMOTION CRUD (deposit bonus tiers)
// ═══════════════════════════════════════════════════════════

export async function listAdminPromotions() {
  await connectDB()
  const promos = await Promotion.find().sort({ amount: 1 }).lean<any[]>()
  return promos.map((p) => ({
    id: String(p._id),
    amount: p.amount,
    discount: p.discount,
    createdAt: p.createdAt as Date | undefined,
    updatedAt: p.updatedAt as Date | undefined,
  }))
}

export async function addAdminPromotion(input: { amount: number; discount: number }) {
  await connectDB()
  if (input.amount < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mức nạp phải lớn hơn 0" })
  }
  if (input.discount < 0 || input.discount > 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "% bonus phải từ 0-100" })
  }
  const exists = await Promotion.findOne({ amount: input.amount }).lean()
  if (exists) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Mức nạp ${formatCash(input.amount)} đã tồn tại`,
    })
  }
  await Promotion.create({ amount: input.amount, discount: input.discount })
  return { success: true }
}

export async function updateAdminPromotion(input: {
  id: string
  amount?: number
  discount?: number
}) {
  await connectDB()
  const update: Record<string, any> = {}
  if (input.amount !== undefined) {
    if (input.amount < 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Mức nạp phải lớn hơn 0" })
    }
    update.amount = input.amount
  }
  if (input.discount !== undefined) {
    if (input.discount < 0 || input.discount > 100) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "% bonus phải từ 0-100" })
    }
    update.discount = input.discount
  }
  const result = await Promotion.updateOne({ _id: input.id }, { $set: update })
  if (result.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Khuyến mãi không tồn tại" })
  }
  return { success: true }
}

export async function deleteAdminPromotion(id: string) {
  await connectDB()
  const result = await Promotion.deleteOne({ _id: id })
  if (result.deletedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Khuyến mãi không tồn tại" })
  }
  return { success: true }
}

// ─── Bulk Delete (Bank) ───
export async function bulkDeleteBanks(ids: string[]) {
  const result = await Bank.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

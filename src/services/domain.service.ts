/**
 * Domain controller — business logic cho đăng ký/gia hạn domain.
 *
 * Phân tách:
 *  - Parsers/validators (pure)
 *  - Repository (DB queries)
 *  - Aggregations (pipelines)
 *  - Order ops (create, lock renew, rollback)
 *  - Provider operations (Spaceship async)
 *  - Cron: poll pending async operations
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import {
  DomainProviderConfig,
  DomainTld,
  OrderDomain,
  ACTIVE_DOMAIN_STATUSES,
  type IDomainTld,
} from "@/models/domain.model"
import { logger } from "@/lib/logger"
import { decryptValue } from "@/lib/encryption"
import { escapeRegex } from "@/lib/sanitize"
import { logBalanceChange, refundBalance } from "@/services/balance.service"
import {
  extractAsyncOperationId,
  spaceshipBuyDomain,
  spaceshipGetAsyncOperation,
  spaceshipRenewDomain,
  spaceshipUpdateNameservers,
  type SpaceshipCredentials,
} from "@/services/spaceship.service"

// ─── Constants ──────────────────────────────────────────────────────────────
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

// ─── Validators (pure) ──────────────────────────────────────────────────────

export interface ParsedDomain {
  sld: string
  tld: string
  full: string
}

/**
 * Parse và validate domain "abc.com" hoặc "abc.co.jp".
 */
export function parseDomain(input: string, knownTlds: string[]): ParsedDomain {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) throw new Error("Tên domain không được để trống")
  if (trimmed.length > 253) throw new Error("Tên domain quá dài (tối đa 253 ký tự)")
  if (trimmed.includes(" ")) throw new Error("Tên domain không được chứa khoảng trắng")
  if (!trimmed.includes(".")) throw new Error("Tên domain phải có TLD (ví dụ: abc.com)")
  if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
    throw new Error("Tên domain không hợp lệ")
  }

  const parts = trimmed.split(".")
  if (parts.length < 2) throw new Error("Tên domain không hợp lệ")

  const sortedTlds = [...knownTlds].sort((a, b) => b.length - a.length)
  let matchedTld: string | null = null
  let sld: string | null = null

  for (const tld of sortedTlds) {
    const suffix = "." + tld
    if (trimmed.endsWith(suffix)) {
      const sldPart = trimmed.slice(0, -suffix.length)
      if (sldPart && !sldPart.includes(".")) {
        matchedTld = tld
        sld = sldPart
        break
      }
    }
  }

  if (!matchedTld || !sld) {
    throw new Error("TLD không được hỗ trợ. Vui lòng chọn TLD trong danh sách.")
  }

  if (!LABEL_REGEX.test(sld)) {
    throw new Error("Tên domain không hợp lệ (chỉ chữ, số, dấu gạch ngang)")
  }

  return { sld, tld: matchedTld, full: trimmed }
}

export function validateNameserver(ns: string): boolean {
  const trimmed = ns.trim().toLowerCase()
  if (!trimmed || trimmed.length > 253) return false
  if (!trimmed.includes(".")) return false
  return trimmed.split(".").every((label) => LABEL_REGEX.test(label))
}

export function buildDomainSearchRegex(keyword: string): RegExp {
  const safe = escapeRegex(keyword.trim().toLowerCase())
  return new RegExp(safe, "i")
}

// ─── Repository ─────────────────────────────────────────────────────────────

export async function findActiveTldById(tldId: string | Types.ObjectId) {
  const tld = (await DomainTld.findById(tldId)
    .select("tld priceSold renewSold isActive provider autoRegisterEnabled autoRenewEnabled")
    .lean()) as Pick<
    IDomainTld,
    "_id" | "tld" | "priceSold" | "renewSold" | "isActive" | "provider" | "autoRegisterEnabled" | "autoRenewEnabled"
  > | null
  if (!tld || !tld.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "TLD không khả dụng" })
  }
  return tld
}

export async function findActiveTldByName(tldName: string) {
  return (await DomainTld.findOne({ tld: tldName.toLowerCase().trim(), isActive: true })
    .select("tld priceSold renewSold")
    .lean()) as Pick<IDomainTld, "_id" | "tld" | "priceSold" | "renewSold"> | null
}

export async function isDomainOccupied(domainName: string): Promise<boolean> {
  const occupied = await OrderDomain.findOne({
    domainName,
    status: { $in: ACTIVE_DOMAIN_STATUSES },
  })
    .select("_id")
    .lean()
  return !!occupied
}

export async function findCompletedOrderForRenew(
  userId: Types.ObjectId | string,
  orderId: string
) {
  const order = (await OrderDomain.findOne({
    _id: orderId,
    userId,
    status: "completed",
  })
    .select("domainName tldId tldName status expiredAt renewCount provider")
    .lean()) as any
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Chỉ gia hạn được domain đã hoàn thành",
    })
  }
  return order
}

export async function checkDomainOwnership(
  userId: Types.ObjectId | string,
  domainName: string
) {
  const order = (await OrderDomain.findOne({
    userId,
    domainName,
    status: { $in: ACTIVE_DOMAIN_STATUSES },
  })
    .select("_id status expiredAt")
    .lean()) as any
  return {
    owned: !!order,
    orderId: order?._id?.toString() ?? null,
    status: order?.status ?? null,
    expiredAt: order?.expiredAt ?? null,
  }
}

// ─── Aggregations ───────────────────────────────────────────────────────────

export interface ListMyDomainOrdersInput {
  userId: Types.ObjectId | string
  page: number
  limit: number
  search?: string
  status?: string
  sortField: "domainName" | "totalAmount" | "createdAt" | "expiredAt"
  sortDir: "asc" | "desc"
}

export async function listMyDomainOrders(input: ListMyDomainOrdersInput) {
  const sortMul = input.sortDir === "asc" ? 1 : -1
  const sortKey = { [input.sortField]: sortMul } as Record<string, 1 | -1>

  const matchUserId =
    typeof input.userId === "string" && Types.ObjectId.isValid(input.userId)
      ? new Types.ObjectId(input.userId)
      : input.userId

  const matchStage: Record<string, any> = { userId: matchUserId }
  if (input.status) matchStage.status = input.status
  if (input.search) {
    matchStage.domainName = {
      $regex: escapeRegex(input.search.trim().toLowerCase()),
      $options: "i",
    }
  }

  const skip = (input.page - 1) * input.limit

  const [result] = await OrderDomain.aggregate([
    { $match: matchStage },
    {
      $facet: {
        data: [
          { $sort: sortKey },
          { $skip: skip },
          { $limit: input.limit },
          {
            $project: {
              _id: 1,
              domainName: 1,
              tldName: 1,
              ns1: 1,
              ns2: 1,
              status: 1,
              provider: 1,
              providerStatus: 1,
              totalAmount: 1,
              renewAmount: 1,
              renewCount: 1,
              expiredAt: 1,
              createdAt: 1,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]).exec()

  const docs = (result?.data ?? []) as any[]
  const total = result?.totalCount?.[0]?.count ?? 0

  return {
    items: docs.map((d) => ({
      id: d._id.toString(),
      domainName: d.domainName,
      tldName: d.tldName,
      ns1: d.ns1,
      ns2: d.ns2,
      status: d.status,
      provider: d.provider ?? "manual",
      providerStatus: d.providerStatus ?? "manual",
      totalAmount: d.totalAmount,
      renewAmount: d.renewAmount ?? null,
      renewCount: d.renewCount ?? 0,
      expiredAt: d.expiredAt,
      createdAt: d.createdAt,
    })),
    total,
  }
}

export async function listRecentDomainOrders(userId: Types.ObjectId | string) {
  const docs = (await OrderDomain.find({ userId })
    .select("domainName tldName status totalAmount expiredAt createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()) as any[]
  return docs.map((d) => ({
    id: d._id.toString(),
    domainName: d.domainName,
    tldName: d.tldName,
    status: d.status,
    totalAmount: d.totalAmount,
    expiredAt: d.expiredAt,
    createdAt: d.createdAt,
  }))
}

export async function getDomainStats(userId: Types.ObjectId | string) {
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Aggregation không auto-cast string → ObjectId (xem note ở order.service).
  const matchUserId =
    typeof userId === "string" && Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId

  const [result] = await OrderDomain.aggregate([
    { $match: { userId: matchUserId } },
    {
      $facet: {
        totalActive: [
          { $match: { status: { $in: ["completed", "renew_pending"] } } },
          { $count: "count" },
        ],
        totalPending: [{ $match: { status: "pending" } }, { $count: "count" }],
        totalSpent: [
          {
            $match: {
              status: { $in: ["completed", "renew_pending", "expired", "suspended"] },
            },
          },
          { $group: { _id: null, sum: { $sum: "$totalAmount" } } },
        ],
        expiringSoon: [
          {
            $match: {
              status: "completed",
              expiredAt: { $gte: now, $lte: in30Days },
            },
          },
          { $count: "count" },
        ],
      },
    },
  ]).exec()

  return {
    totalActive: result?.totalActive?.[0]?.count ?? 0,
    totalPending: result?.totalPending?.[0]?.count ?? 0,
    totalSpent: result?.totalSpent?.[0]?.sum ?? 0,
    expiringSoon: result?.expiringSoon?.[0]?.count ?? 0,
  }
}

export interface ListTldsInput {
  page: number
  limit: number
  search?: string
  activeOnly: boolean
}

export async function listTlds(input: ListTldsInput) {
  const filter: Record<string, any> = {}
  if (input.activeOnly) filter.isActive = true
  if (input.search) {
    const safe = escapeRegex(input.search.trim().toLowerCase())
    filter.tld = { $regex: safe, $options: "i" }
  }

  const skip = (input.page - 1) * input.limit
  const [items, total] = await Promise.all([
    DomainTld.find(filter)
      .select("tld priceSold renewSold isActive")
      .sort({ priceSold: 1, tld: 1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    DomainTld.countDocuments(filter),
  ])

  return {
    items: (items as any[]).map((t) => ({
      id: t._id.toString(),
      tld: t.tld,
      priceSold: t.priceSold,
      renewSold: t.renewSold,
      isActive: t.isActive,
    })),
    total,
  }
}

// ─── Order operations ───────────────────────────────────────────────────────

export interface CreateDomainOrderInput {
  userId: Types.ObjectId | string
  tldId: Types.ObjectId | string
  tldName: string
  domainName: string
  ns1: string
  ns2: string
  totalAmount: number
  provider?: "manual" | "spaceship"
  registrant?: {
    name: string
    address1: string
    address2?: string | null
    province: string
    phone: string
    zipCode: string
  } | null
}

/**
 * Tạo OrderDomain. Throw CONFLICT nếu domain đã tồn tại (E11000).
 */
export async function createDomainOrder(input: CreateDomainOrderInput) {
  try {
    return await OrderDomain.create({
      userId: input.userId,
      tldId: input.tldId,
      tldName: input.tldName,
      domainName: input.domainName,
      ns1: input.ns1,
      ns2: input.ns2,
      status: "pending",
      provider: input.provider ?? "manual",
      providerStatus: input.provider === "spaceship" ? "queued" : "manual",
      totalAmount: input.totalAmount,
      registrant: input.registrant ?? null,
      expiredAt: new Date(Date.now() + ONE_YEAR_MS),
    })
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Domain đã được đăng ký, vui lòng chọn tên khác",
      })
    }
    logger.error("OrderDomain.create failed", err, {
      module: "domain.createDomainOrder",
      userId: String(input.userId),
      domain: input.domainName,
    })
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Tạo đơn hàng thất bại",
    })
  }
}

export async function deleteDomainOrderSafe(orderId: Types.ObjectId | string) {
  await OrderDomain.deleteOne({ _id: orderId }).catch((err) =>
    logger.error("OrderDomain rollback failed", err, {
      module: "domain.deleteDomainOrderSafe",
      orderId: String(orderId),
    })
  )
}

/**
 * Atomic lock cho renew: completed → renew_pending.
 * Trả về null nếu race condition (status đã đổi).
 */
export async function lockOrderForRenew(
  userId: Types.ObjectId | string,
  orderId: string,
  renewAmount: number
) {
  return await OrderDomain.findOneAndUpdate(
    { _id: orderId, userId, status: "completed" },
    { $set: { status: "renew_pending", renewAmount } },
    { new: true, projection: { _id: 1 } }
  )
}

/**
 * Unlock — rollback renew_pending → completed.
 */
export async function unlockRenew(orderId: string | Types.ObjectId) {
  await OrderDomain.updateOne(
    { _id: orderId },
    { $set: { status: "completed" }, $unset: { renewAmount: "" } }
  ).catch((err) =>
    logger.error("renew rollback failed", err, {
      module: "domain.unlockRenew",
      orderId: String(orderId),
    })
  )
}

export async function updateOrderNameservers(
  userId: Types.ObjectId | string,
  orderId: string,
  ns1: string,
  ns2: string
) {
  const updated = await OrderDomain.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      status: { $in: ["pending", "completed", "renew_pending"] },
    },
    { $set: { ns1, ns2 } },
    {
      new: true,
      projection: { domainName: 1, ns1: 1, ns2: 1, provider: 1, providerStatus: 1, status: 1 },
    }
  )

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy đơn hoặc không thể chỉnh sửa",
    })
  }

  // Lỗi #7: trước đây NS chỉ lưu MongoDB, KHÔNG đẩy lên nhà đăng ký → với miền
  // mua qua Spaceship, NS thật không bao giờ đổi. Giờ đồng bộ lên Spaceship.
  // Theo yêu cầu: nếu Spaceship từ chối → throw để user biết đổi NS thất bại.
  const order = updated as any
  if (order.provider === "spaceship" && order.providerStatus === "completed") {
    const config = await getActiveSpaceshipConfig()
    if (!config) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Chưa cấu hình Spaceship để đổi nameserver",
      })
    }
    const credentials = getSpaceshipCredentials(config)
    try {
      await spaceshipUpdateNameservers(credentials, order.domainName, [ns1, ns2])
    } catch (err) {
      logger.error(
        "spaceship nameserver update failed",
        err instanceof Error ? err : { error: String(err) },
        { module: "domain.updateOrderNameservers", orderId: String(orderId), domainName: order.domainName }
      )
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Đổi nameserver tại nhà đăng ký thất bại: ${err instanceof Error ? err.message : "lỗi không xác định"}`,
      })
    }
  }

  return order
}

// ─── Provider operations ───────────────────────────────────────────────────

interface SpaceshipConfigLean {
  apiKeyEnc: string
  apiSecretEnc: string
  contactId: string
  autoRegisterEnabled: boolean
  autoRenewEnabled: boolean
  status: "active" | "disabled"
}

async function getActiveSpaceshipConfig(): Promise<SpaceshipConfigLean | null> {
  return (await DomainProviderConfig.findOne({ provider: "spaceship", status: "active" })
    .select("apiKeyEnc apiSecretEnc contactId autoRegisterEnabled autoRenewEnabled status")
    .lean()) as SpaceshipConfigLean | null
}

function getSpaceshipCredentials(config: SpaceshipConfigLean): SpaceshipCredentials {
  const apiKey = decryptValue(config.apiKeyEnc)
  const apiSecret = decryptValue(config.apiSecretEnc)
  if (!apiKey || !apiSecret) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API Spaceship" })
  }
  return { apiKey, apiSecret }
}

export async function resolveDomainProvider(tld: Pick<IDomainTld, "provider" | "autoRegisterEnabled">): Promise<"manual" | "spaceship"> {
  if (tld.provider !== "spaceship" || !tld.autoRegisterEnabled) return "manual"
  const config = await getActiveSpaceshipConfig()
  if (!config?.autoRegisterEnabled) return "manual"
  return "spaceship"
}

/**
 * Khởi tạo Spaceship registration — gửi request mua domain.
 *
 * Flow (async via cron):
 *  1. Set providerStatus = "processing"
 *  2. Gọi Spaceship API → 202 + async operation ID
 *  3. Lưu providerAsyncOpId vào order
 *  4. Cron job sẽ poll async operation để complete/fail
 *
 * Nếu API call thất bại ngay → refund + error_refund
 */
export async function initiateSpaceshipRegistration(input: {
  orderId: Types.ObjectId | string
  userId: Types.ObjectId | string
  domainName: string
  ns1: string
  ns2: string
  paidAmount: number
}): Promise<void> {
  const config = await getActiveSpaceshipConfig()
  if (!config?.autoRegisterEnabled) {
    // Config tắt → chuyển về manual
    await OrderDomain.updateOne(
      { _id: input.orderId, providerStatus: "queued" },
      {
        $set: {
          providerStatus: "failed",
          status: "pending",
          adminNote: "Spaceship auto đang tắt, chuyển xử lý tay",
        },
      }
    )
    return
  }

  // Set processing
  await OrderDomain.updateOne({ _id: input.orderId }, { $set: { providerStatus: "processing" } })

  try {
    const credentials = getSpaceshipCredentials(config)
    const buyResult = await spaceshipBuyDomain(credentials, {
      domain: input.domainName,
      contactId: config.contactId,
      years: 1,
    })

    // Spaceship trả 202 → async operation
    if (buyResult.status === 202) {
      const asyncOpId = extractAsyncOperationId(buyResult.headers)
      if (!asyncOpId) {
        throw new Error("Spaceship trả 202 nhưng thiếu async operation ID")
      }
      // Lưu asyncOpId để cron poll
      await OrderDomain.updateOne(
        { _id: input.orderId, provider: "spaceship" },
        {
          $set: {
            providerAsyncOpId: asyncOpId,
            providerPayload: { buyStatus: buyResult.status },
            adminNote: "Đang chờ Spaceship xử lý (async)",
          },
        }
      )
      logger.info("spaceship registration initiated", {
        module: "domain.spaceship.register",
        orderId: String(input.orderId),
        asyncOpId,
        domainName: input.domainName,
      })
      return // Cron sẽ poll tiếp
    }

    // 200/201 — đồng bộ thành công (hiếm nhưng có thể xảy ra)
    await onSpaceshipRegistrationSuccess(input, credentials, buyResult)
  } catch (error) {
    await onSpaceshipRegistrationFailed(input, error)
  }
}

/**
 * Callback khi Spaceship registration thành công (sync hoặc cron poll).
 * - Set completed
 * - Best-effort update nameservers
 */
async function onSpaceshipRegistrationSuccess(
  input: {
    orderId: Types.ObjectId | string
    userId: Types.ObjectId | string
    domainName: string
    ns1: string
    ns2: string
    paidAmount: number
  },
  credentials: SpaceshipCredentials,
  buyResult?: { status: number; data: unknown }
) {
  // Best-effort nameserver update — KHÔNG throw nếu fail
  try {
    if (input.ns1 && input.ns2) {
      await spaceshipUpdateNameservers(credentials, input.domainName, [input.ns1, input.ns2])
    }
  } catch (nsError) {
    logger.warn("spaceship nameserver update failed (best-effort)", {
      module: "domain.spaceship.register.ns",
      orderId: String(input.orderId),
      error: nsError instanceof Error ? nsError.message : "Unknown",
    })
  }

  // Mark completed
  const providerOrderId = buyResult
    ? String(
        (buyResult.data as { id?: unknown; orderId?: unknown })?.id ??
          (buyResult.data as { orderId?: unknown })?.orderId ??
          ""
      )
    : ""

  await OrderDomain.updateOne(
    { _id: input.orderId, provider: "spaceship" },
    {
      $set: {
        status: "completed",
        providerStatus: "completed",
        providerAsyncOpId: null, // clear
        providerOrderId,
        providerPayload: buyResult ? { status: buyResult.status } : null,
        expiredAt: new Date(Date.now() + ONE_YEAR_MS),
        adminNote: "Spaceship auto đăng ký thành công",
      },
    }
  )
}

/**
 * Callback khi Spaceship registration thất bại — refund user.
 */
async function onSpaceshipRegistrationFailed(
  input: {
    orderId: Types.ObjectId | string
    userId: Types.ObjectId | string
    domainName: string
    paidAmount: number
  },
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Spaceship đăng ký thất bại"
  await OrderDomain.updateOne(
    { _id: input.orderId, provider: "spaceship" },
    {
      $set: {
        status: "error_refund",
        providerStatus: "failed",
        providerAsyncOpId: null,
        adminNote: `Auto lỗi, đã hoàn tiền: ${message.slice(0, 180)}`,
      },
    }
  )
  const refund = await refundBalance(input.userId, input.paidAmount)
  if (refund) {
    logBalanceChange({
      userId: input.userId,
      moneyBefore: refund.moneyBefore,
      moneyAfter: refund.moneyAfter,
      moneyChange: input.paidAmount,
      content: `Hoàn tiền domain auto lỗi: ${input.domainName}`,
      module: "domain.spaceship.refund",
      orderId: String(input.orderId),
    })
  }
  logger.error(
    "spaceship register failed",
    error instanceof Error ? error : { error: message },
    {
      module: "domain.spaceship.register",
      orderId: String(input.orderId),
      domainName: input.domainName,
    }
  )
}

/**
 * Gia hạn Spaceship — async via cron nếu Spaceship trả 202.
 */
export async function completeSpaceshipRenewal(input: {
  orderId: Types.ObjectId | string
  userId: Types.ObjectId | string
  domainName: string
  currentExpirationDate: Date
  paidAmount: number
}): Promise<void> {
  const config = await getActiveSpaceshipConfig()
  if (!config?.autoRenewEnabled) return
  try {
    const credentials = getSpaceshipCredentials(config)
    const renewResult = await spaceshipRenewDomain(credentials, {
      domain: input.domainName,
      years: 1,
      currentExpirationDate: input.currentExpirationDate,
    })

    // 202 async — lưu opId cho cron
    if (renewResult.status === 202) {
      const asyncOpId = extractAsyncOperationId(renewResult.headers)
      if (asyncOpId) {
        await OrderDomain.updateOne(
          { _id: input.orderId },
          {
            $set: {
              providerAsyncOpId: asyncOpId,
              adminNote: "Đang chờ Spaceship xử lý gia hạn (async)",
            },
          }
        )
        return // Cron poll tiếp
      }
    }

    // Sync success — extend expiredAt
    const newExpiredAt = new Date(input.currentExpirationDate.getTime() + ONE_YEAR_MS)
    await OrderDomain.updateOne(
      { _id: input.orderId, status: "renew_pending" },
      {
        $set: {
          status: "completed",
          expiredAt: newExpiredAt,
          adminNote: "Spaceship auto gia hạn thành công",
        },
        $inc: { renewCount: 1 },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spaceship gia hạn thất bại"
    // Refund + unlock renew
    const refund = await refundBalance(input.userId, input.paidAmount)
    if (refund) {
      logBalanceChange({
        userId: input.userId,
        moneyBefore: refund.moneyBefore,
        moneyAfter: refund.moneyAfter,
        moneyChange: input.paidAmount,
        content: `Hoàn tiền gia hạn domain: ${input.domainName}`,
        module: "domain.spaceship.renew.refund",
        orderId: String(input.orderId),
      })
    }
    await OrderDomain.updateOne(
      { _id: input.orderId },
      {
        $set: {
          adminNote: `Gia hạn auto lỗi, đã hoàn tiền: ${message.slice(0, 180)}`,
        },
      }
    )
    await unlockRenew(input.orderId)
    logger.error(
      "spaceship renew failed",
      error instanceof Error ? error : { error: message },
      {
        module: "domain.spaceship.renew",
        orderId: String(input.orderId),
        domainName: input.domainName,
      }
    )
  }
}

// ─── Cron: poll pending Spaceship async operations ─────────────────────────

/**
 * Cron job: poll tất cả orders đang chờ Spaceship async operation.
 * Gọi từ /cmstdev/cron/domain/check.
 *
 * Giới hạn batch size để tránh spam API.
 */
export async function pollPendingSpaceshipOperations(opts?: {
  limit?: number
}): Promise<{ polled: number; completed: number; failed: number; pending: number }> {
  const batchLimit = opts?.limit ?? 10

  // Tìm orders đang chờ async op
  const pendingOrders = (await OrderDomain.find({
    provider: "spaceship",
    providerStatus: "processing",
    providerAsyncOpId: { $ne: null, $exists: true },
  })
    .select("_id userId domainName ns1 ns2 totalAmount providerAsyncOpId status expiredAt renewAmount")
    .sort({ updatedAt: 1 }) // FIFO — order cũ nhất poll trước
    .limit(batchLimit)
    .lean()) as unknown as { _id: Types.ObjectId; userId: Types.ObjectId; domainName: string; ns1: string; ns2: string; totalAmount: number; providerAsyncOpId: string; status: string; expiredAt: Date | null; renewAmount: number | null }[]

  if (pendingOrders.length === 0) {
    return { polled: 0, completed: 0, failed: 0, pending: 0 }
  }

  // Get Spaceship credentials
  const config = await getActiveSpaceshipConfig()
  if (!config) {
    logger.warn("spaceship cron: no active config, skipping", { module: "domain.cron.spaceship" })
    return { polled: 0, completed: 0, failed: 0, pending: 0 }
  }

  let credentials: SpaceshipCredentials
  try {
    credentials = getSpaceshipCredentials(config)
  } catch {
    logger.error("spaceship cron: invalid credentials", new Error("decrypt failed"), {
      module: "domain.cron.spaceship",
    })
    return { polled: 0, completed: 0, failed: 0, pending: 0 }
  }

  let completed = 0
  let failed = 0
  let pending = 0

  for (const order of pendingOrders) {
    try {
      const opResult = await spaceshipGetAsyncOperation(credentials, order.providerAsyncOpId)

      if (opResult.status === "success") {
        // Registration pending → completed
        if (order.status === "pending") {
          await onSpaceshipRegistrationSuccess(
            {
              orderId: order._id,
              userId: order.userId,
              domainName: order.domainName,
              ns1: order.ns1,
              ns2: order.ns2,
              paidAmount: order.totalAmount,
            },
            credentials
          )
        }
        // Renewal renew_pending → completed
        else if (order.status === "renew_pending") {
          const currentExpired = order.expiredAt ?? new Date()
          const newExpiredAt = new Date(currentExpired.getTime() + ONE_YEAR_MS)
          await OrderDomain.updateOne(
            { _id: order._id },
            {
              $set: {
                status: "completed",
                providerStatus: "completed",
                providerAsyncOpId: null,
                expiredAt: newExpiredAt,
                adminNote: "Spaceship auto gia hạn thành công (cron)",
              },
              $inc: { renewCount: 1 },
            }
          )
        }
        completed++
      } else if (opResult.status === "failed") {
        // Registration failed → refund
        if (order.status === "pending") {
          await onSpaceshipRegistrationFailed(
            {
              orderId: order._id,
              userId: order.userId,
              domainName: order.domainName,
              paidAmount: order.totalAmount,
            },
            new Error(`Spaceship async failed: ${JSON.stringify(opResult.data).slice(0, 200)}`)
          )
        }
        // Renewal failed → refund + unlock
        else if (order.status === "renew_pending") {
          const paidAmount = order.renewAmount ?? 0
          if (paidAmount > 0) {
            const refund = await refundBalance(order.userId, paidAmount)
            if (refund) {
              logBalanceChange({
                userId: order.userId,
                moneyBefore: refund.moneyBefore,
                moneyAfter: refund.moneyAfter,
                moneyChange: paidAmount,
                content: `Hoàn tiền gia hạn domain (cron): ${order.domainName}`,
                module: "domain.cron.renew.refund",
                orderId: String(order._id),
              })
            }
          }
          await OrderDomain.updateOne(
            { _id: order._id },
            {
              $set: {
                providerStatus: "failed",
                providerAsyncOpId: null,
                adminNote: `Gia hạn async lỗi, đã hoàn tiền`,
              },
            }
          )
          await unlockRenew(order._id)
        }
        failed++
      } else {
        pending++ // still pending
      }
    } catch (err) {
      // Poll API error — skip, try next tick
      logger.warn("spaceship cron: poll error", {
        module: "domain.cron.spaceship",
        orderId: String(order._id),
        error: err instanceof Error ? err.message : "Unknown",
      })
      pending++
    }
  }

  return { polled: pendingOrders.length, completed, failed, pending }
}

// ─── (NEW) Public purchase entry — dùng cho agency API ──────────────────────

/**
 * Đăng ký domain end-to-end. Trừ tiền vào số dư user, tạo order, áp coupon (nếu có),
 * và khởi động Spaceship async khi TLD ở chế độ tự động.
 *
 * Khác với router.register: hàm này chỉ nhận `domain` (full) — endpoint API tự
 * tách SLD/TLD theo TLD đã chỉ định trong `tldId` để giảm input.
 */
export interface PurchaseDomainInput {
  userId: Types.ObjectId | string
  /** Domain đầy đủ "myshop.com" — phải kết thúc bằng tld của tldId */
  domain: string
  tldId: string
  couponCode?: string
}

export interface PurchaseDomainResult {
  orderId: string
  domainName: string
  totalAmount: number
  provider: "manual" | "spaceship"
  status: "pending" | "processing"
}

export async function purchaseDomain(
  input: PurchaseDomainInput
): Promise<PurchaseDomainResult> {
  // Lazy-import shared services to avoid circular deps with router-only code
  const [{ ensureUserHasBalance, deductBalanceAtomic }, { validateCouponForUser, commitCouponUsage }] =
    await Promise.all([
      import("@/services/balance.service"),
      import("@/services/coupon.service"),
    ])

  const tldDoc = await findActiveTldById(input.tldId)
  const domainName = input.domain.trim().toLowerCase()
  if (!domainName.endsWith("." + tldDoc.tld)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Domain phải kết thúc bằng .${tldDoc.tld}`,
    })
  }
  if (domainName.length > 253) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tên domain quá dài" })
  }

  // SLD validate
  const sld = domainName.slice(0, domainName.length - tldDoc.tld.length - 1)
  if (sld.length < 4) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tên miền phải có ít nhất 4 ký tự (không tính đuôi). Tên ngắn thường là domain premium giá cao.",
    })
  }
  if (!LABEL_REGEX.test(sld)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tên domain không hợp lệ (chỉ chữ, số, dấu gạch ngang)",
    })
  }

  const totalAmount = Number(tldDoc.priceSold) || 0
  if (totalAmount <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Giá TLD không hợp lệ" })
  }

  // Coupon
  let finalAmount = totalAmount
  let couponId: string | null = null
  if (input.couponCode && totalAmount > 0) {
    const c = await validateCouponForUser(
      input.userId,
      input.couponCode,
      totalAmount,
      "domain"
    )
    finalAmount = c.finalAmount
    couponId = c.couponId
  }

  await ensureUserHasBalance(input.userId, finalAmount)

  // Default NS — Cloudflare placeholder; user có thể đổi sau qua updateNameserver
  const ns1 = "ns1.cloudflare.com"
  const ns2 = "ns2.cloudflare.com"

  const provider = await resolveDomainProvider(tldDoc)
  const newOrder = await createDomainOrder({
    userId: input.userId,
    tldId: tldDoc._id as any,
    tldName: tldDoc.tld,
    domainName,
    ns1,
    ns2,
    totalAmount: finalAmount,
    provider,
  })

  const balance = await deductBalanceAtomic(input.userId, finalAmount)
  if (!balance) {
    await deleteDomainOrderSafe(newOrder._id as any)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Số dư đã thay đổi, vui lòng thử lại",
    })
  }

  logBalanceChange({
    userId: input.userId,
    moneyBefore: balance.moneyBefore,
    moneyAfter: balance.moneyAfter,
    moneyChange: -finalAmount,
    content: `Đăng ký domain: ${domainName}`,
    module: "domain.purchase",
    orderId: String(newOrder._id),
  })
  void import("@/services/rewards.service").then((m) =>
    m.awardRewardForPurchase({
      userId: input.userId,
      vndAmount: finalAmount,
      context: `tên miền ${domainName}`,
      refOrderId: newOrder._id as any,
      refOrderType: "domain",
    })
  )

  if (couponId) {
    await commitCouponUsage(couponId, input.userId, String(newOrder._id))
  }

  // Spaceship auto: fire-and-forget. Service tự handle refund nếu API fail.
  if (provider === "spaceship") {
    initiateSpaceshipRegistration({
      orderId: newOrder._id as any,
      userId: input.userId,
      domainName,
      ns1,
      ns2,
      paidAmount: finalAmount,
    }).catch((err) => {
      logger.error(
        "purchaseDomain: initiateSpaceshipRegistration failed",
        err instanceof Error ? err : { error: String(err) },
        { module: "domain.purchase", orderId: String(newOrder._id) }
      )
    })
  }

  return {
    orderId: String(newOrder._id),
    domainName,
    totalAmount: finalAmount,
    provider,
    status: provider === "spaceship" ? "processing" : "pending",
  }
}


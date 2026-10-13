/**
 * Auto-domain service — Phase 1 refactor.
 *
 * Quản lý lifecycle của order auto-deploy ở giai đoạn TRƯỚC khi vào aaPanel:
 *
 *  - provisionCloudflareZone(orderId)
 *      Gọi NGAY sau khi purchase: pick CF account + ensureZone → trả NS
 *      cho user trỏ. Status chuyển từ cf_pending → ns_pending.
 *
 *  - buyDomainViaSpaceship(orderId)
 *      Khi user chọn "Mua domain mới qua Spaceship". Tạo async operation,
 *      lưu operationId, status = domain_buying. Cron sẽ poll.
 *
 *  - pollSpaceshipDomainBuying()
 *      Cron worker chạy mỗi 60s. Poll mọi order domain_buying:
 *        - success → set NS Cloudflare qua Spaceship → transition cf_pending
 *        - failed  → refund balance, status = domain_failed
 *        - timeout (10 phút) → refund + domain_failed
 *
 *  - checkNsAndDeploy(orderId, userId)
 *      Gọi từ frontend. Check zone status; nếu active → trigger deploy
 *      worker (provisionWebsiteOrder existing). Nếu chưa active → trả
 *      message rõ NS nào đã thấy / đang chờ.
 *
 * Không có cron polling NS — user phải bấm "Kiểm tra" để gating idempotent.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { OrderService, type IOrderService } from "@/models/service.model"
import { CloudflareAccount } from "@/models/website-provisioning.model"
import { getSiteOptions } from "@/models/setting.model"
import { decryptValue } from "@/lib/encryption"
import { logger } from "@/lib/logger"
import { refundBalance, logBalanceChange } from "@/services/balance.service"
import {
  ensureCloudflareZone,
  getCloudflareZoneDetails,
  getRootDomain,
  type CloudflareCredentials,
} from "@/services/cloudflare.service"
import {
  spaceshipBuyDomain,
  spaceshipGetAsyncOperation,
  spaceshipUpdateNameservers,
  extractAsyncOperationId,
  type SpaceshipCredentials,
} from "@/services/spaceship.service"

// ─── Constants ──────────────────────────────────────────────────────────────
const SPACESHIP_POLL_INTERVAL_MS = 60_000 // cron 1 phút/lần
const SPACESHIP_TIMEOUT_MS = 10 * 60_000 // sau 10 phút treo → fail
const SPACESHIP_MAX_ATTEMPTS = 12 // 12 × 60s = 12 phút an toàn

// ─── Helpers ────────────────────────────────────────────────────────────────

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

/** Push 1 step vào provisioning.stepLog, kèm note tùy chọn. */
async function pushStepLog(
  orderId: Types.ObjectId | string,
  step: string,
  status: "pending" | "ok" | "error",
  note?: string
) {
  try {
    await OrderService.updateOne(
      { _id: orderId },
      {
        $push: {
          "provisioning.stepLog": {
            step,
            status,
            at: new Date(),
            ...(note ? { note: note.slice(0, 1000) } : {}),
          },
        },
      }
    )
  } catch (err) {
    logger.warn("pushStepLog failed", {
      module: "autoDomain.pushStepLog",
      orderId: String(orderId),
      error: (err as Error).message,
    })
  }
}

/** Pick Cloudflare account active, round-robin theo createdAt ASC. */
async function pickCloudflareAccount() {
  await connectDB()
  const account = (await CloudflareAccount.findOne({ status: "active" })
    .sort({ createdAt: 1 })
    .lean()) as any
  if (!account) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Hệ thống chưa cấu hình Cloudflare. Vui lòng liên hệ admin",
    })
  }
  const apiToken = decryptValue(account.apiTokenEnc)
  if (!apiToken) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Cloudflare credentials lỗi",
    })
  }
  return {
    account,
    credentials: {
      apiToken,
      accountId: account.accountId,
      authEmail: account.authEmail,
      authMode: account.authMode ?? "globalKey",
    } as CloudflareCredentials,
  }
}

/** Đọc Spaceship credentials + buy enabled từ Settings. */
async function getSpaceshipConfig(): Promise<{
  enabled: boolean
  credentials: SpaceshipCredentials | null
  defaultContactId: string | null
}> {
  const opts = await getSiteOptions([
    "spaceship_buy_enabled",
    "spaceship_api_key",
    "spaceship_api_secret",
    "spaceship_default_contact_id",
  ])
  const enabled = opts.spaceship_buy_enabled === "1"
  const apiKey = (opts.spaceship_api_key || "").trim()
  const apiSecret = (opts.spaceship_api_secret || "").trim()
  const defaultContactId = (opts.spaceship_default_contact_id || "").trim() || null
  if (!enabled || !apiKey || !apiSecret) {
    return { enabled: false, credentials: null, defaultContactId }
  }
  return {
    enabled: true,
    credentials: { apiKey, apiSecret },
    defaultContactId,
  }
}

// ─── (1) Provision Cloudflare zone ─────────────────────────────────────────

/**
 * Tạo (hoặc lấy) Cloudflare zone cho domain của order.
 * Sau khi xong, cập nhật `provisioning.cloudflareNameServers` + status `ns_pending`.
 *
 * Idempotent: gọi nhiều lần không tạo zone trùng (CF tự dedupe theo domain).
 */
export async function provisionCloudflareZone(
  orderId: string | Types.ObjectId
): Promise<{
  nameServers: string[]
  zoneId: string
}> {
  await connectDB()
  const order = (await OrderService.findById(orderId).lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  }
  if (!["pending", "cf_pending", "ns_pending", "processing"].includes(order.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Trạng thái đơn không hợp lệ để tạo zone",
    })
  }

  // Idempotent fast-path: nếu đã có zone + NS thì return luôn, không re-create.
  if (
    order.provisioning?.cloudflareZoneId &&
    Array.isArray(order.provisioning?.cloudflareNameServers) &&
    order.provisioning.cloudflareNameServers.length > 0
  ) {
    // Đảm bảo deploy worker đã khởi động (idempotent — provisionWebsiteOrder tự
    // kiểm tra status). Nếu order còn cf_pending → bump lên processing trước.
    if (order.status === "cf_pending" || order.status === "pending") {
      await OrderService.updateOne(
        { _id: order._id },
        { $set: { status: "processing", adminNote: "Đang triển khai aaPanel song song" } }
      )
    }
    triggerAaPanelDeploy(String(order._id))
    return {
      nameServers: order.provisioning.cloudflareNameServers,
      zoneId: order.provisioning.cloudflareZoneId,
    }
  }

  await OrderService.updateOne(
    { _id: order._id },
    { $set: { status: "cf_pending", adminNote: "Đang tạo Cloudflare zone" } }
  )
  await pushStepLog(order._id, "cloudflare_zone", "pending")

  try {
    const { account, credentials } = await pickCloudflareAccount()
    const rootDomain = getRootDomain(String(order.domainName).toLowerCase())
    const zone = await ensureCloudflareZone(credentials, rootDomain)

    const { getFixedNameservers } = await import("@/services/website-provision.service")
    const fixedNs = await getFixedNameservers()
    if (fixedNs.length < 2) {
      throw new Error("Hệ thống chưa cấu hình NS cố định")
    }

    // Status nhảy thẳng sang `processing` — NS cố định đã có, aaPanel deploy chạy
    // song song. User trỏ domain về NS cố định này là website lên.
    await OrderService.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "processing",
          adminNote: "Đã có NS cố định, đang triển khai aaPanel song song",
          "provisioning.cloudflareAccountId": account._id,
          "provisioning.cloudflareZoneId": zone.zoneId,
          "provisioning.cloudflareNameServers": fixedNs,
          "provisioning.deployStartedAt": new Date(),
        },
      }
    )
    await pushStepLog(
      order._id,
      "cloudflare_zone",
      "ok",
      `zoneId=${zone.zoneId} fixedNS=${fixedNs.join(",")}`
    )

    // Fire-and-forget: chạy aaPanel deploy ngay không cần đợi NS active.
    triggerAaPanelDeploy(String(order._id))

    return { nameServers: fixedNs, zoneId: zone.zoneId }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tạo zone Cloudflare thất bại"
    await OrderService.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "cf_pending",
          "provisioning.lastError": message.slice(0, 500),
          adminNote: `Lỗi tạo zone: ${message.slice(0, 200)}`,
        },
      }
    )
    await pushStepLog(order._id, "cloudflare_zone", "error", message)
    throw err
  }
}

/**
 * Fire-and-forget aaPanel deploy worker.
 * - Không block caller (CF zone creation).
 * - aaPanel call set `requireNsActive: false` vì user có thể chưa kịp trỏ NS.
 * - Nếu thành công → order.status = "active" (do provisionWebsiteOrder set).
 * - Nếu fail → giữ nguyên status `processing` + ghi `lastError` để UI hiện
 *   nút "Thử lại deploy".
 */
function triggerAaPanelDeploy(orderId: string): void {
  setTimeout(() => {
    void import("@/services/admin-website.service")
      .then(async ({ provisionWebsiteOrder }) => {
        await connectDB()
        const order = (await OrderService.findById(orderId)
          .select("status provisioning")
          .lean()) as any
        // Skip nếu đã active (đã deploy xong) hoặc đang re-trigger song song.
        if (!order || order.status === "active") return
        await pushStepLog(orderId, "deploy_aapanel", "pending")
        return provisionWebsiteOrder(orderId, {
          phpVersion: "80",
          proxied: true,
          requireNsActive: false,
          cloudflareAccountId: order.provisioning?.cloudflareAccountId
            ? String(order.provisioning.cloudflareAccountId)
            : undefined,
        })
      })
      .then(async (result) => {
        if (result) {
          await pushStepLog(orderId, "deploy_aapanel", "ok")
        }
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Deploy aaPanel lỗi"
        await connectDB()
        await OrderService.updateOne(
          { _id: orderId },
          {
            $set: {
              "provisioning.lastError": message.slice(0, 500),
              adminNote: `Deploy lỗi: ${message.slice(0, 200)}`,
            },
          }
        )
        await pushStepLog(orderId, "deploy_aapanel", "error", message)
      })
  }, 0)
}

// ─── (2) Buy domain qua Spaceship — 100% PHP createWeb.php ──────────────────

/**
 * Mua domain mới qua Spaceship — port chính xác `createWeb.php` line 190-225.
 *
 * Flow PHP:
 *  1. WHOIS pre-check:
 *     - 'registered' → refund + status failed + throw "domain đã có chủ"
 *     - 'unknown'    → refund + status failed + throw "WHOIS timeout"
 *     - 'free'       → tiếp tục
 *  2. Spaceship buy → bất kỳ 2xx = success (PHP không poll). Non-2xx → refund + fail.
 *  3. Ensure CF zone (optional, PHP không có) + set NS cố định qua Spaceship.
 *  4. Enqueue job vào hàng đợi tạo web (worker chạy bước aaPanel).
 *
 * Throw `TRPCError` cho mọi lỗi nghiệp vụ; refund đã thực hiện trước khi throw.
 */
export async function buyDomainViaSpaceship(
  orderId: string | Types.ObjectId
): Promise<{ ok: true }> {
  await connectDB()
  const order = (await OrderService.findById(orderId).lean()) as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  if (!order.domainNew) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Đơn này không yêu cầu mua domain mới",
    })
  }

  const { enabled, credentials, defaultContactId } = await getSpaceshipConfig()
  if (!enabled || !credentials) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Hệ thống chưa bật mua domain tự động",
    })
  }
  if (!defaultContactId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Hệ thống chưa cấu hình Spaceship contact ID",
    })
  }

  const domain = String(order.domainName).toLowerCase()

  // ─── 1. WHOIS pre-check (PHP createWeb.php line 194-203) ────────────────
  const { ssWhoisCheck } = await import("@/services/spaceship-whois.service")
  const whois = await ssWhoisCheck(domain)
  if (whois === "registered") {
    await markOrderDomainFailed(order, `Domain ${domain} đã có người đăng ký`)
    throw new TRPCError({
      code: "CONFLICT",
      message: `Tên miền ${domain} đã có người đăng ký. Đã hoàn tiền.`,
    })
  }
  if (whois === "unknown") {
    await markOrderDomainFailed(order, "WHOIS timeout — không xác minh được domain")
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Máy chủ WHOIS quá tải, vui lòng thử lại sau. Đã hoàn tiền.",
    })
  }

  // ─── 2. Spaceship buy (PHP coi 2xx = success, không poll) ───────────────
  await OrderService.updateOne(
    { _id: order._id },
    { $set: { status: "domain_buying", adminNote: "Đang đăng ký domain qua Spaceship" } }
  )
  await pushStepLog(order._id, "spaceship_buy", "pending")

  let buyResp: { status: number; data: unknown; headers: Record<string, string> }
  try {
    buyResp = await spaceshipBuyDomain(credentials, {
      domain,
      contactId: defaultContactId,
      years: 1,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Spaceship mua domain thất bại"
    await markOrderDomainFailed(order, message)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Mua tên miền thất bại: ${message}. Đã hoàn tiền.`,
    })
  }

  // PHP: status >= 200 && < 300 → success. Bao gồm 202 (Accepted async).
  if (buyResp.status < 200 || buyResp.status >= 300) {
    const data = buyResp.data as Record<string, unknown> | null
    const apiMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      `HTTP ${buyResp.status}`
    await markOrderDomainFailed(order, `Mua domain thất bại: ${apiMsg}`)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Mua tên miền thất bại: ${apiMsg}. Đã hoàn tiền.`,
    })
  }

  await pushStepLog(order._id, "spaceship_buy", "ok", `domain ${domain} đã đăng ký`)

  // ─── 3. Set NS cố định qua Spaceship + ensure CF zone (best-effort) ─────
  // PHP không dùng CF; ở đây giữ optional để CF dashboard vẫn quản lý nếu admin
  // có cấu hình. Nếu không có CF account active → skip không throw.
  let cfAccountId: Types.ObjectId | null = null
  let cfZoneId: string | null = null
  try {
    const { account, credentials: cfCreds } = await pickCloudflareAccount()
    const rootDomain = getRootDomain(domain)
    const zone = await ensureCloudflareZone(cfCreds, rootDomain)
    cfAccountId = account._id
    cfZoneId = zone.zoneId
  } catch (err) {
    // CF không bắt buộc — log warning là đủ.
    logger.warn("CF zone skip (no active account)", {
      module: "autoDomain.buyDomainViaSpaceship",
      orderId: String(order._id),
      reason: (err as Error).message,
    })
  }

  // NS cố định admin cấu hình (CloudflareAccount.defaultNs1/2). Bắt buộc.
  const { getFixedNameservers } = await import("@/services/website-provision.service")
  const fixedNs = await getFixedNameservers()
  if (fixedNs.length < 2) {
    await markOrderDomainFailed(
      order,
      "Hệ thống chưa cấu hình NS cố định (admin → Cloudflare → defaultNs1/2)"
    )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Hệ thống chưa cấu hình NS cố định. Đã hoàn tiền.",
    })
  }

  try {
    await spaceshipUpdateNameservers(credentials, domain, fixedNs)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Set NS thất bại"
    // Domain đã mua thành công nhưng NS lỗi → KHÔNG refund (đã có domain),
    // chỉ ghi cf_pending để admin xử lý hoặc retry sau.
    await OrderService.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "cf_pending",
          adminNote: `Đã mua domain nhưng set NS lỗi: ${message.slice(0, 200)}`,
          "provisioning.spaceshipBoughtAt": new Date(),
          "provisioning.lastError": message.slice(0, 500),
          ...(cfAccountId ? { "provisioning.cloudflareAccountId": cfAccountId } : {}),
          ...(cfZoneId ? { "provisioning.cloudflareZoneId": cfZoneId } : {}),
        },
      }
    )
    await pushStepLog(order._id, "cloudflare_zone", "error", message)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Đã mua domain nhưng set NS lỗi: ${message.slice(0, 160)}`,
    })
  }

  // ─── 4. Enqueue job tạo web (worker chạy aaPanel) ───────────────────────
  await OrderService.updateOne(
    { _id: order._id },
    {
      $set: {
        status: "processing",
        adminNote: "Đã mua domain + set NS, đang tạo website",
        "provisioning.spaceshipBoughtAt": new Date(),
        "provisioning.cloudflareNameServers": fixedNs,
        ...(cfAccountId ? { "provisioning.cloudflareAccountId": cfAccountId } : {}),
        ...(cfZoneId ? { "provisioning.cloudflareZoneId": cfZoneId } : {}),
        "provisioning.deployStartedAt": new Date(),
      },
    }
  )
  await pushStepLog(order._id, "cloudflare_zone", "ok", `NS=${fixedNs.join(",")}`)

  const { enqueueWebsiteJobForOrder } = await import("@/services/web-job.service")
  await enqueueWebsiteJobForOrder(String(order._id))

  return { ok: true }
}

/**
 * Đánh dấu order là domain_failed + refund số tiền user đã trừ.
 */
async function markOrderDomainFailed(order: any, reason: string): Promise<void> {
  await OrderService.updateOne(
    { _id: order._id },
    {
      $set: {
        status: "domain_failed",
        "provisioning.lastError": reason.slice(0, 500),
        adminNote: `Mua domain thất bại: ${reason.slice(0, 200)}`,
      },
    }
  )
  await pushStepLog(order._id, "spaceship_buy", "error", reason)

  // Refund — best-effort
  try {
    if (order.total > 0) {
      const refunded = await refundBalance(order.userId, order.total)
      if (refunded) {
        logBalanceChange({
          userId: order.userId,
          moneyBefore: refunded.moneyBefore,
          moneyAfter: refunded.moneyAfter,
          moneyChange: order.total,
          content: `Hoàn tiền: mua domain thất bại — ${order.domainName}`,
          module: "autoDomain.refund",
          orderId: String(order._id),
        })
      }
    }
  } catch (err) {
    logger.error("refund failed", err as Error, {
      module: "autoDomain.markOrderDomainFailed",
      orderId: String(order._id),
    })
  }
}

// ─── (3) Cron poll Spaceship operations ─────────────────────────────────────

/**
 * Cron worker — chạy mỗi 60s. Poll mọi order ở status `domain_buying`,
 * cập nhật trạng thái dựa trên Spaceship async operation.
 *
 * Trả số order đã xử lý.
 */
export async function pollSpaceshipDomainBuying(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  await connectDB()
  const cutoff = new Date(Date.now() - SPACESHIP_POLL_INTERVAL_MS)
  const orders = (await OrderService.find({
    status: "domain_buying",
    "provisioning.spaceshipOperationId": { $ne: null },
    $or: [
      { "provisioning.spaceshipPolledAt": null },
      { "provisioning.spaceshipPolledAt": { $lte: cutoff } },
    ],
  })
    .limit(20)
    .lean()) as any[]

  if (orders.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  const { credentials } = await getSpaceshipConfig()
  if (!credentials) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0
  for (const order of orders) {
    try {
      const result = await processOneSpaceshipOrder(order, credentials)
      if (result === "success") succeeded += 1
      else if (result === "failed") failed += 1
    } catch (err) {
      logger.error("pollSpaceship: order error", err as Error, {
        module: "autoDomain.pollSpaceshipDomainBuying",
        orderId: String(order._id),
      })
    }
  }
  return { processed: orders.length, succeeded, failed }
}

async function processOneSpaceshipOrder(
  order: any,
  credentials: SpaceshipCredentials
): Promise<"success" | "failed" | "pending"> {
  const operationId = order.provisioning?.spaceshipOperationId
  const attempts = (order.provisioning?.spaceshipAttempts || 0) + 1

  // Bump polling timestamp + attempts trước khi gọi để tránh duplicate
  await OrderService.updateOne(
    { _id: order._id },
    {
      $set: {
        "provisioning.spaceshipPolledAt": new Date(),
        "provisioning.spaceshipAttempts": attempts,
      },
    }
  )

  // Timeout check
  const buyStartedAt = new Date(order.updatedAt || order.createdAt).getTime()
  if (Date.now() - buyStartedAt > SPACESHIP_TIMEOUT_MS || attempts > SPACESHIP_MAX_ATTEMPTS) {
    await markOrderDomainFailed(order, `Spaceship timeout sau ${attempts} lần thử`)
    return "failed"
  }

  let op
  try {
    op = await spaceshipGetAsyncOperation(credentials, operationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi gọi Spaceship"
    logger.warn("spaceship poll error", {
      module: "autoDomain.processOneSpaceshipOrder",
      orderId: String(order._id),
      error: message,
    })
    return "pending"
  }

  if (op.status === "pending") return "pending"

  if (op.status === "failed") {
    await markOrderDomainFailed(order, "Spaceship reject domain")
    return "failed"
  }

  // success — set NS CỐ ĐỊNH (admin cấu hình ở trang Cloudflare) cho domain qua
  // Spaceship, ensure CF zone để CF quản lý, rồi ĐẨY VÀO HÀNG ĐỢI tạo website.
  try {
    const { account: cfAccount, credentials: cfCreds } = await pickCloudflareAccount()
    const rootDomain = getRootDomain(String(order.domainName).toLowerCase())
    const zone = await ensureCloudflareZone(cfCreds, rootDomain)

    // NS cố định là bắt buộc — không fallback sang NS động của zone.
    const { getFixedNameservers } = await import("@/services/website-provision.service")
    const fixedNs = await getFixedNameservers()
    if (fixedNs.length < 2) throw new Error("Hệ thống chưa cấu hình NS cố định")
    const nsToSet = fixedNs

    await spaceshipUpdateNameservers(
      credentials,
      String(order.domainName).toLowerCase(),
      nsToSet
    )

    await OrderService.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "processing",
          adminNote: "Đã mua domain, NS cố định đã set, đang vào hàng đợi tạo web",
          "provisioning.spaceshipBoughtAt": new Date(),
          "provisioning.cloudflareAccountId": cfAccount._id,
          "provisioning.cloudflareZoneId": zone.zoneId,
          "provisioning.cloudflareNameServers": nsToSet,
          "provisioning.deployStartedAt": new Date(),
        },
      }
    )
    await pushStepLog(order._id, "spaceship_buy", "ok", `domain ${order.domainName} đăng ký thành công`)
    await pushStepLog(order._id, "cloudflare_zone", "ok", `NS=${nsToSet.join(",")}`)

    // Đẩy vào hàng đợi bền vững (retry + refund) thay cho fire-and-forget.
    const { enqueueWebsiteJobForOrder } = await import("@/services/web-job.service")
    await enqueueWebsiteJobForOrder(String(order._id))
    return "success"
  } catch (err) {
    // Domain đã mua thành công, nhưng set NS fail → giữ ở cf_pending để retry.
    const message = err instanceof Error ? err.message : "Set NS thất bại sau khi mua"
    await OrderService.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "cf_pending",
          adminNote: `Đã mua domain nhưng set NS lỗi: ${message.slice(0, 200)}`,
          "provisioning.spaceshipBoughtAt": new Date(),
          "provisioning.lastError": message.slice(0, 500),
        },
      }
    )
    await pushStepLog(order._id, "spaceship_buy", "ok")
    await pushStepLog(order._id, "cloudflare_zone", "error", message)
    return "success"
  }
}

// ─── (4) Check NS + trigger deploy ──────────────────────────────────────────

export interface CheckNsResult {
  status: "ns_active" | "ns_waiting" | "deploying" | "active" | "error"
  domain: string
  nameServers: string[]
  message: string
}

/**
 * Check NS đã trỏ chưa. Nếu rồi → trigger deploy worker (background, return ngay).
 * Idempotent: gọi nhiều lần khi đang processing/active sẽ trả status hiện tại.
 */
export async function checkNsAndDeploy(
  orderId: string,
  userId: Types.ObjectId | string
): Promise<CheckNsResult> {
  await connectDB()
  const order = (await OrderService.findOne({
    _id: toObjectId(orderId),
    userId,
  }).lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  }

  // Đã processing/active → trả status hiện tại, không re-trigger
  if (order.status === "processing") {
    return {
      status: "deploying",
      domain: order.domainName,
      nameServers: order.provisioning?.cloudflareNameServers || [],
      message: "Đang tạo website, vui lòng chờ",
    }
  }
  if (order.status === "active") {
    return {
      status: "active",
      domain: order.domainName,
      nameServers: order.provisioning?.cloudflareNameServers || [],
      message: "Website đã sẵn sàng",
    }
  }

  // ─── Recovery: cf_pending hoặc pending (auto-mode chưa orchestrate xong) ──
  // provisionCloudflareZone idempotent — gọi lại sẽ resume hoặc tạo zone mới.
  if (order.status === "cf_pending" || order.status === "pending") {
    try {
      const result = await provisionCloudflareZone(orderId)
      // Sau khi provisioning thành công, order sẽ ở ns_pending → return ns_waiting
      // để client biết cần trỏ NS rồi check lại.
      return {
        status: "ns_waiting",
        domain: order.domainName,
        nameServers: result.nameServers,
        message: "Đã tạo zone Cloudflare. Vui lòng trỏ NS rồi bấm kiểm tra lại.",
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tạo zone Cloudflare"
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Không tạo được zone: ${message.slice(0, 160)}`,
      })
    }
  }

  if (order.status !== "ns_pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Đơn đang ở trạng thái ${order.status}`,
    })
  }

  const expectedNs = order.provisioning?.cloudflareNameServers || []
  const zoneId = order.provisioning?.cloudflareZoneId
  if (!zoneId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Đơn chưa có zone, vui lòng liên hệ admin",
    })
  }

  const { credentials } = await pickCloudflareAccount()
  const rootDomain = getRootDomain(String(order.domainName).toLowerCase())
  const zoneDetails = await getCloudflareZoneDetails({ ...credentials, rootDomain })

  if (zoneDetails.status !== "active") {
    return {
      status: "ns_waiting",
      domain: order.domainName,
      nameServers: expectedNs,
      message: `NS chưa propagate. Vui lòng đợi 5-30 phút sau khi trỏ NS (status hiện tại: ${zoneDetails.status})`,
    }
  }

  // NS active → trigger deploy worker
  await OrderService.updateOne(
    { _id: order._id },
    {
      $set: {
        status: "processing",
        "provisioning.nsActiveAt": new Date(),
        "provisioning.deployStartedAt": new Date(),
        adminNote: "Đang tạo website tự động",
      },
    }
  )
  await pushStepLog(order._id, "ns_propagation", "ok")
  await pushStepLog(order._id, "deploy_aapanel", "pending")

  // Lazy-import provisionWebsiteOrder để tránh circular dep
  setTimeout(() => {
    void import("@/services/admin-website.service")
      .then(({ provisionWebsiteOrder }) =>
        provisionWebsiteOrder(orderId, {
          phpVersion: "80",
          proxied: true,
          requireNsActive: false, // đã check ở trên
          cloudflareAccountId: order.provisioning?.cloudflareAccountId
            ? String(order.provisioning.cloudflareAccountId)
            : undefined,
        })
      )
      .then(async () => {
        await OrderService.updateOne(
          { _id: order._id },
          { $set: { "provisioning.deployCompletedAt": new Date() } }
        )
        await pushStepLog(order._id, "deploy_aapanel", "ok")
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : "Deploy aaPanel lỗi"
        await connectDB()
        await OrderService.updateOne(
          { _id: order._id, status: "processing" },
          {
            $set: {
              status: "ns_pending",
              "provisioning.lastError": message.slice(0, 500),
              adminNote: `Deploy lỗi: ${message.slice(0, 200)}`,
            },
          }
        )
        await pushStepLog(order._id, "deploy_aapanel", "error", message)
      })
  }, 0)

  return {
    status: "deploying",
    domain: order.domainName,
    nameServers: expectedNs,
    message: "NS đã active, đang tạo website",
  }
}

// ─── (5) Read provisioning state cho UI ─────────────────────────────────────

export interface OrderProvisioningView {
  orderId: string
  domain: string
  status: IOrderService["status"]
  nameServers: string[]
  zoneId: string | null
  spaceshipOperationId: string | null
  spaceshipBoughtAt: Date | null
  nsActiveAt: Date | null
  deployStartedAt: Date | null
  deployCompletedAt: Date | null
  lastError: string | null
  stepLog: Array<{ step: string; status: "pending" | "ok" | "error"; at: Date; note?: string }>
}

export async function getOrderProvisioning(
  orderId: string,
  userId: Types.ObjectId | string
): Promise<OrderProvisioningView> {
  await connectDB()
  const order = (await OrderService.findOne({
    _id: toObjectId(orderId),
    userId,
  })
    .select("domainName status provisioning")
    .lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  }
  return {
    orderId: String(order._id),
    domain: order.domainName,
    status: order.status,
    nameServers: order.provisioning?.cloudflareNameServers || [],
    zoneId: order.provisioning?.cloudflareZoneId || null,
    spaceshipOperationId: order.provisioning?.spaceshipOperationId || null,
    spaceshipBoughtAt: order.provisioning?.spaceshipBoughtAt || null,
    nsActiveAt: order.provisioning?.nsActiveAt || null,
    deployStartedAt: order.provisioning?.deployStartedAt || null,
    deployCompletedAt: order.provisioning?.deployCompletedAt || null,
    lastError: order.provisioning?.lastError || null,
    stepLog: order.provisioning?.stepLog || [],
  }
}

/**
 * website-provision.service — Layer 2 (Service): worker tạo website tự động.
 *
 * Triết lý mới ("đập đi xây lại"):
 *  - purchaseWebsite chỉ tạo order `processing` + fire `startWebsiteAutoDeploy`.
 *  - Worker chạy nền tuần tự các bước (CF zone → aaPanel → source → config →
 *    SQL → SSL → DNS), mỗi bước:
 *      • push vào provisioning.stepLog (DB)
 *      • emit socket `order:provision` (UI cập nhật realtime)
 *      • gửi Telegram admin (báo tiến độ từng bước)
 *  - Xong → status `active`; lỗi → status `failed` (user bấm thử lại).
 *  - NS user trỏ là NS CỐ ĐỊNH (admin cấu hình ở trang Cloudflare), không phải
 *    NS động của từng zone.
 *
 * Protocol-agnostic: KHÔNG nhận tRPC ctx. Fire-and-forget an toàn.
 */
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { OrderService } from "@/models/service.model"
import { CloudflareAccount } from "@/models/website-provisioning.model"
import { emitToUser } from "@/lib/realtime/emit"
import { sendTelegramAdmin } from "@/lib/send-telegram"
import { logger } from "@/lib/logger"

// ─── Step catalog ─────────────────────────────────────────────────────────

export type DeployStepKey =
  | "init"
  | "aapanel_site"
  | "source"
  | "config_db"
  | "sql"
  | "cloudflare"
  | "ssl"
  | "done"

export type DeployStepStatus = "pending" | "ok" | "error"

export const DEPLOY_STEP_LABELS: Record<DeployStepKey, string> = {
  init: "Khởi tạo",
  aapanel_site: "Tạo site & database",
  source: "Tải & giải nén mã nguồn",
  config_db: "Cấu hình kết nối database",
  sql: "Nhập dữ liệu SQL",
  cloudflare: "Cấu hình Cloudflare DNS",
  ssl: "Cài đặt SSL",
  done: "Hoàn tất",
}

const now = () => new Date().toLocaleString("vi-VN")

export interface DeployCtx {
  orderId: string
  userId: Types.ObjectId | string
  username: string
  domainName: string
}

export type OnStepFn = (
  step: DeployStepKey,
  status: DeployStepStatus,
  note?: string
) => Promise<void>

// ─── Fixed nameservers (admin cấu hình ở trang Cloudflare) ──────────────────

/**
 * Lấy 2 NS cố định từ CloudflareAccount active. User trỏ NS về đây; worker dùng
 * để set NS cho domain mua qua Spaceship. Rỗng nếu admin chưa cấu hình.
 */
export async function getFixedNameservers(): Promise<string[]> {
  await connectDB()
  const account = (await CloudflareAccount.findOne({ status: "active" })
    .sort({ createdAt: 1 })
    .select("defaultNs1 defaultNs2")
    .lean()) as { defaultNs1?: string | null; defaultNs2?: string | null } | null
  if (!account) return []
  return [account.defaultNs1, account.defaultNs2]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
}

// ─── Step recorder (DB + socket + telegram) ─────────────────────────────────

/**
 * Ghi 1 bước deploy: stepLog (DB) + emit socket + telegram admin (best-effort).
 * KHÔNG throw — lỗi phụ trợ không được làm hỏng luồng deploy chính.
 */
export async function recordDeployStep(
  ctx: DeployCtx,
  step: DeployStepKey,
  status: DeployStepStatus,
  note?: string
): Promise<void> {
  const label = DEPLOY_STEP_LABELS[step] ?? step

  try {
    await OrderService.updateOne(
      { _id: ctx.orderId },
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
    logger.warn("recordDeployStep: stepLog push failed", {
      module: "websiteProvision.recordDeployStep",
      orderId: ctx.orderId,
      error: (err as Error).message,
    })
  }

  // Realtime: UI lịch sử cập nhật ngay (best-effort).
  emitToUser(ctx.userId, "order:provision", {
    orderId: ctx.orderId,
    type: "website",
    step,
    label,
    status,
    note: note ? note.slice(0, 200) : null,
  })

  // Telegram admin: báo từng bước (chỉ khi ok/error để tránh spam pending).
  if (status !== "pending") {
    void sendTelegramAdmin("admin_deploy_step", {
      username: ctx.username,
      domain_name: ctx.domainName,
      step: label,
      status: status === "ok" ? "✅ Hoàn tất" : "❌ Lỗi",
      time: now(),
    }).catch(() => {})
  }
}

// ─── Worker chính ───────────────────────────────────────────────────────────

/**
 * Chạy toàn bộ deploy cho 1 order (đã ở trạng thái sẵn sàng tạo).
 * Lazy-import provisionWebsiteOrder để tránh circular dependency.
 */
export async function runWebsiteAutoDeploy(orderId: string): Promise<void> {
  await connectDB()
  const order = (await OrderService.findById(orderId)
    .select("userId username domainName status serviceName")
    .lean()) as {
    userId: Types.ObjectId
    username: string
    domainName: string
    status: string
    serviceName?: string
  } | null
  if (!order) {
    logger.warn("runWebsiteAutoDeploy: order not found", {
      module: "websiteProvision.run",
      orderId,
    })
    return
  }

  const ctx: DeployCtx = {
    orderId,
    userId: order.userId,
    username: order.username,
    domainName: order.domainName,
  }

  // Lưu NS cố định + đánh dấu bắt đầu (NS user trỏ luôn là NS cố định này).
  const fixedNs = await getFixedNameservers()
  await OrderService.updateOne(
    { _id: orderId },
    {
      $set: {
        status: "processing",
        adminNote: "Worker đang tạo website tự động",
        "provisioning.cloudflareNameServers": fixedNs,
        "provisioning.deployStartedAt": new Date(),
        "provisioning.lastError": null,
      },
    }
  )
  await recordDeployStep(ctx, "init", "ok", "Bắt đầu tạo website")

  try {
    const { provisionWebsiteOrder } = await import("@/services/admin-website.service")
    const result = await provisionWebsiteOrder(orderId, {
      phpVersion: "80",
      proxied: true,
      requireNsActive: false,
      onStep: (step, status, note) => recordDeployStep(ctx, step, status, note),
    })

    await OrderService.updateOne(
      { _id: orderId },
      { $set: { "provisioning.deployCompletedAt": new Date() } }
    )
    await recordDeployStep(ctx, "done", "ok", "Website đã sẵn sàng")

    // Báo chủ đơn website đã active.
    emitToUser(ctx.userId, "order:update", {
      orderId,
      type: "website",
      status: "active",
    })
    void sendTelegramAdmin("admin_deploy_done", {
      username: ctx.username,
      domain_name: ctx.domainName,
      server: result?.serverName ?? "—",
      time: now(),
    }).catch(() => {})
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deploy website lỗi"
    await OrderService.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "failed",
          "provisioning.lastError": message.slice(0, 500),
          adminNote: `Deploy lỗi: ${message.slice(0, 200)}`,
        },
      }
    )
    await recordDeployStep(ctx, "done", "error", message)

    emitToUser(ctx.userId, "order:update", {
      orderId,
      type: "website",
      status: "failed",
    })
    void sendTelegramAdmin("admin_deploy_failed", {
      username: ctx.username,
      domain_name: ctx.domainName,
      step: "Deploy",
      error: message.slice(0, 200),
      time: now(),
    }).catch(() => {})
  }
}

/**
 * Entry chính: đẩy order vào hàng đợi tạo website bền vững (WebCreateJob).
 *
 * KHÔNG còn chạy fire-and-forget theo vòng đời request — background worker
 * (web-create-worker) sẽ pick & deploy. Nhờ đó khách F5 không phá được phiên:
 * thực thi tách hoàn toàn khỏi request HTTP, DB là nguồn sự thật duy nhất.
 *
 * Giữ signature `(orderId): void` để không vỡ caller cũ; enqueue chạy nền.
 */
export function startWebsiteAutoDeploy(orderId: string): void {
  void import("@/services/web-job.service")
    .then(({ enqueueWebsiteJobForOrder }) => enqueueWebsiteJobForOrder(orderId))
    .catch((err) => {
      logger.error("startWebsiteAutoDeploy enqueue failed", err as Error, {
        module: "websiteProvision.start",
        orderId,
      })
    })
}

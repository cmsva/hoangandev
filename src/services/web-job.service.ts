/**
 * web-job.service — Layer 2 (Service): hàng đợi tạo website bền vững.
 *
 * Kiến trúc "DB là nguồn sự thật duy nhất" — thực thi deploy TÁCH KHỎI request
 * HTTP, do background worker (web-create-worker) xử lý. Nhờ đó:
 *  - Khách F5 (hoặc tab cron F5) KHÔNG thể restart/nhân bản deploy.
 *  - Cron route chỉ "nudge" worker rồi trả về ngay → không bao giờ treo.
 *
 * Cơ chế lease (giữ job):
 *  - claimNextJob: atomic findOneAndUpdate, set running + leaseUntil + workerId.
 *  - extendLease: worker gia hạn lease định kỳ (heartbeat) trong lúc deploy.
 *  - reclaimStuckJobs: job `running` mà leaseUntil < now ⇒ worker chết →
 *    đưa về `retry` (resume), không treo vĩnh viễn.
 *
 * Bất biến quan trọng (giúp "không lỗi ở mọi flow"):
 *  - MỌI nhánh kết thúc đều GIẢI PHÓNG lease (leaseUntil=null, workerId=null).
 *  - MỌI nhánh thất bại cuối cùng đều HOÀN TIỀN (refundBalance) đúng 1 lần.
 *  - Job claim atomic → không 2 worker pick trùng.
 *  - Deploy resume theo checkpoint lastStep (provisionWebsiteOrder idempotent).
 */
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { OrderService } from "@/models/service.model"
import { WebCreateJob, type IWebCreateJob, type IWebCreateJobPayload } from "@/models/web-create-job.model"
import { refundBalance, logBalanceChange } from "@/services/balance.service"
import { emitToUser } from "@/lib/realtime/emit"
import { sendTelegramAdmin } from "@/lib/send-telegram"
import { logger } from "@/lib/logger"
import { recordDeployStep, type DeployCtx } from "@/services/website-provision.service"
import { deployDebug, deployDebugError } from "@/lib/deploy-debug"

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 60_000
/** Thời hạn giữ job 1 lần claim. Worker phải heartbeat trước khi hết hạn. */
export const LEASE_MS = 120_000
const now = () => new Date().toLocaleString("vi-VN")

// ─── Enqueue ────────────────────────────────────────────────────────────────

/**
 * Đẩy 1 job tạo website vào hàng đợi. Idempotent theo orderId: nếu đã có job
 * chưa kết thúc cho order này thì bỏ qua (tránh double-deploy).
 */
export async function enqueueWebsiteJob(
  orderId: Types.ObjectId | string,
  payload: IWebCreateJobPayload
): Promise<void> {
  await connectDB()
  const existing = await WebCreateJob.findOne({
    orderId,
    status: { $in: ["pending", "running", "retry"] },
  })
    .select("_id")
    .lean()
  if (existing) return

  await WebCreateJob.create({
    orderId,
    status: "pending",
    attempt: 0,
    payload,
    runAfter: null,
  })
}


/**
 * Đọc order rồi enqueue job tạo website.
 * Dùng từ purchaseWebsite (domain có sẵn) và từ cron poll domain (sau khi mua
 * domain Spaceship + set NS cố định xong). Job chỉ chạy khi worker pick.
 */
export async function enqueueWebsiteJobForOrder(
  orderId: Types.ObjectId | string
): Promise<void> {
  await connectDB()
  const order = (await OrderService.findById(orderId)
    .select("userId username domainName total")
    .lean()) as {
    _id: Types.ObjectId
    userId: Types.ObjectId
    username: string
    domainName: string
    total: number
  } | null
  if (!order) return

  await enqueueWebsiteJob(String(order._id), {
    orderId: String(order._id),
    orderCode: String(order._id),
    userId: String(order.userId),
    username: order.username,
    domain: order.domainName,
    totalPrice: Number(order.total || 0),
  })
}

/**
 * Thử lại deploy cho 1 đơn (user bấm "Thử lại" khi đơn failed/processing kẹt).
 * Reset job cũ chưa kết thúc → enqueue mới. KHÔNG trừ tiền lại (đã trừ lúc mua).
 * Idempotent: nếu đang có job pending/running thì giữ nguyên.
 */
export async function retryWebsiteDeploy(
  orderId: string,
  userId: Types.ObjectId | string
): Promise<{ status: string; message: string }> {
  await connectDB()
  const order = (await OrderService.findOne({ _id: orderId, userId })
    .select("status domainName")
    .lean()) as { _id: Types.ObjectId; status: string; domainName: string } | null
  if (!order) {
    return { status: "error", message: "Không tìm thấy đơn" }
  }
  if (order.status === "active") {
    return { status: "active", message: "Website đã sẵn sàng" }
  }

  // Reset order về processing + xoá lỗi cũ.
  await OrderService.updateOne(
    { _id: order._id },
    {
      $set: {
        status: "processing",
        adminNote: "Đang thử tạo lại website",
        "provisioning.lastError": null,
      },
    }
  )

  // Đóng job cũ chưa kết thúc để enqueueWebsiteJob không bị chặn idempotent.
  await WebCreateJob.updateMany(
    { orderId: order._id, status: { $in: ["pending", "running", "retry", "failed"] } },
    { $set: { status: "done", error: "superseded by retry", leaseUntil: null, workerId: null } }
  )

  await enqueueWebsiteJobForOrder(String(order._id))
  return { status: "processing", message: "Đã đưa vào hàng đợi tạo lại website" }
}

// ─── Claim / lease / reclaim ─────────────────────────────────────────────────

/**
 * Claim job sẵn sàng kế tiếp: status in (pending|retry), tới hạn runAfter, và
 * lease trống hoặc đã quá hạn. Set running + lease + workerId + startedAt và
 * tăng attempt trong 1 thao tác atomic để chống race giữa nhiều worker/request.
 */
export async function claimNextJob(workerId: string): Promise<IWebCreateJob | null> {
  const nowDate = new Date()
  return WebCreateJob.findOneAndUpdate(
    {
      status: { $in: ["pending", "retry"] },
      $and: [
        { $or: [{ runAfter: null }, { runAfter: { $lte: nowDate } }] },
        { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: nowDate } }] },
      ],
    },
    {
      $set: {
        status: "running",
        leaseUntil: new Date(nowDate.getTime() + LEASE_MS),
        workerId,
        startedAt: nowDate,
      },
      $inc: { attempt: 1 },
    },
    { new: true, sort: { runAfter: 1, _id: 1 } }
  )
}

/**
 * Heartbeat: gia hạn lease của job đang chạy. Chỉ gia hạn nếu CÒN sở hữu
 * (đúng workerId + vẫn running) — nếu đã bị reclaim/đổi chủ thì trả false để
 * worker biết dừng (chống 2 worker cùng deploy 1 job sau reclaim).
 */
export async function extendLease(
  jobId: Types.ObjectId | string,
  workerId: string
): Promise<boolean> {
  const res = await WebCreateJob.updateOne(
    { _id: jobId, workerId, status: "running" },
    { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } }
  )
  return res.matchedCount > 0
}

/**
 * Sweeper: job `running` có leaseUntil < now ⇒ worker giữ nó đã chết.
 * Đưa về `retry` (chạy ngay) để worker khác resume — chống treo vĩnh viễn.
 * Trả về số job đã reclaim.
 */
export async function reclaimStuckJobs(): Promise<number> {
  await connectDB()
  const res = await WebCreateJob.updateMany(
    { status: "running", leaseUntil: { $lt: new Date() } },
    {
      $set: {
        status: "retry",
        runAfter: null,
        leaseUntil: null,
        workerId: null,
        error: "Worker mất kết nối — tự khôi phục (resume)",
      },
    }
  )
  if (res.modifiedCount > 0) {
    logger.warn("reclaimStuckJobs: reclaimed stuck web-create jobs", {
      module: "webJob.reclaim",
      count: res.modifiedCount,
    })
  }
  return res.modifiedCount
}

/** Đếm hàng đợi theo trạng thái — cho cron route trả thống kê nhanh. */
export async function getQueueStats(): Promise<Record<string, number>> {
  await connectDB()
  const rows = (await WebCreateJob.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ])) as Array<{ _id: string; count: number }>
  const stats: Record<string, number> = { pending: 0, running: 0, retry: 0, done: 0, failed: 0 }
  for (const r of rows) stats[r._id] = r.count
  return stats
}

// ─── Process 1 job (worker entry) ─────────────────────────────────────────────

export interface ProcessJobsResult {
  picked: number
  done: number
  retried: number
  failed: number
}

/**
 * Xử lý 1 job ĐÃ được claim (đang `running`, do worker sở hữu).
 * - Chạy heartbeat gia hạn lease trong lúc deploy.
 * - Resume theo checkpoint lastStep (provisionWebsiteOrder bỏ qua bước đã xong).
 * - Kết thúc: done / retry / failed; LUÔN giải phóng lease.
 *
 * Trả về kết quả 1 job để worker cộng dồn thống kê.
 */
export async function processOneJob(
  job: IWebCreateJob,
  workerId: string
): Promise<"done" | "retried" | "failed"> {
  await connectDB()

  const payload = (job.payload || {}) as IWebCreateJobPayload
  const orderId = String(payload.orderId || job.orderId)
  const userId = String(payload.userId || "")

  const ctx: DeployCtx = {
    orderId,
    userId,
    username: String((payload as Record<string, unknown>).username || ""),
    domainName: String(payload.domain || ""),
  }

  // Heartbeat: gia hạn lease mỗi LEASE_MS/3. Nếu mất sở hữu (bị reclaim) → ngừng.
  let lostOwnership = false
  const heartbeat = setInterval(() => {
    void extendLease(job._id, workerId).then((ok) => {
      if (!ok) lostOwnership = true
    })
  }, Math.floor(LEASE_MS / 3))

  try {
    deployDebug("worker", `pick job → bắt đầu deploy`, {
      orderId,
      userId,
      domain: ctx.domainName,
      jobId: String(job._id),
      attempt: job.attempt,
      resumeFrom: job.lastStep || null,
    })
    await recordDeployStep(ctx, "init", "ok", "Worker bắt đầu xử lý")
    await OrderService.updateOne(
      { _id: orderId },
      { $set: { status: "processing", adminNote: "Worker đang tạo website" } }
    ).catch(() => {})

    const { provisionWebsiteOrder } = await import("@/services/admin-website.service")
    await provisionWebsiteOrder(orderId, {
      proxied: true,
      requireNsActive: false,
      // Resume: bỏ qua các bước đã hoàn tất ở attempt trước.
      resumeFromStep: job.lastStep || null,
      // Mỗi bước OK → ghi checkpoint vào job để attempt sau resume đúng chỗ.
      onStep: async (step, status, note) => {
        await recordDeployStep(ctx, step, status, note)
        if (status === "ok") {
          await WebCreateJob.updateOne(
            { _id: job._id },
            { $set: { lastStep: step } }
          ).catch(() => {})
        }
      },
    })

    await recordDeployStep(ctx, "done", "ok", "Website đã sẵn sàng")
    await WebCreateJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "done",
          error: null,
          resultLog: { log: ["Deploy thành công"] },
          leaseUntil: null,
          workerId: null,
        },
      }
    )
    emitToUser(userId, "order:update", { orderId, type: "website", status: "active" })
    return "done"
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deploy website lỗi"
    const attempt = job.attempt // đã tăng khi claim
    deployDebugError("worker", `job deploy lỗi (attempt ${attempt}/${MAX_ATTEMPTS})`, error, {
      orderId,
      domain: ctx.domainName,
      jobId: String(job._id),
      attempt,
      lostOwnership,
    })

    // Mất sở hữu (job đã bị reclaim & worker khác có thể đang chạy) → KHÔNG
    // finalize/refund/đổi trạng thái để tránh tranh chấp. Để worker mới xử lý.
    if (lostOwnership) {
      return "retried"
    }

    if (attempt >= MAX_ATTEMPTS) {
      // Cạn retry → fail hẳn + hoàn tiền 1 lần.
      await finalizeFailure(ctx, payload, message)
      await WebCreateJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            error: message.slice(0, 4000),
            leaseUntil: null,
            workerId: null,
          },
        }
      )
      return "failed"
    }

    // Còn lượt → hẹn chạy lại sau RETRY_DELAY_MS, giải phóng lease.
    await WebCreateJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "retry",
          error: message.slice(0, 4000),
          runAfter: new Date(Date.now() + RETRY_DELAY_MS),
          leaseUntil: null,
          workerId: null,
        },
      }
    )
    await recordDeployStep(ctx, "done", "error", `Lỗi, sẽ thử lại (lần ${attempt}/${MAX_ATTEMPTS}): ${message}`)
    return "retried"
  } finally {
    clearInterval(heartbeat)
  }
}

// ─── Process nhiều job (safety-net cho cron-pull, có time budget) ──────────────

/**
 * Pick & xử lý tối đa `limit` job, KÈM time budget để KHÔNG bao giờ block lâu
 * (dùng làm fallback khi worker in-process bị tắt — vd serverless).
 * Worker chính dùng claimNextJob + processOneJob trực tiếp.
 */
export async function processWebsiteJobs(
  limit = 3,
  workerId = "cron-pull",
  budgetMs = 8_000
): Promise<ProcessJobsResult> {
  await connectDB()
  const result: ProcessJobsResult = { picked: 0, done: 0, retried: 0, failed: 0 }
  const deadline = Date.now() + budgetMs

  for (let i = 0; i < limit; i += 1) {
    if (Date.now() >= deadline) break
    const job = await claimNextJob(workerId)
    if (!job) break
    result.picked += 1
    const outcome = await processOneJob(job, workerId)
    result[outcome] += 1
  }

  return result
}

// ─── Finalize failure: order failed + refund + telegram ──────────────────────

/**
 * Xử lý thất bại cuối cùng: set order=failed, hoàn tiền (1 lần), telegram admin.
 * Best-effort cho các bước phụ; refund là bắt buộc nên log nếu lỗi.
 */
async function finalizeFailure(
  ctx: DeployCtx,
  payload: IWebCreateJobPayload,
  message: string
): Promise<void> {
  await OrderService.updateOne(
    { _id: ctx.orderId },
    {
      $set: {
        status: "failed",
        "provisioning.lastError": message.slice(0, 500),
        adminNote: `Deploy lỗi (đã hoàn tiền): ${message.slice(0, 180)}`,
      },
    }
  ).catch(() => {})

  await recordDeployStep(ctx, "done", "error", `Thất bại sau ${MAX_ATTEMPTS} lần — đã hoàn tiền`)

  // Hoàn tiền đúng 1 lần.
  const total = Number(payload.totalPrice || 0)
  if (total > 0 && ctx.userId) {
    try {
      const bal = await refundBalance(ctx.userId, total)
      if (bal) {
        logBalanceChange({
          userId: ctx.userId,
          moneyBefore: bal.moneyBefore,
          moneyAfter: bal.moneyAfter,
          moneyChange: total,
          content: `Hoàn tiền tạo website thất bại #${payload.orderCode || ""} (${ctx.domainName})`,
          module: "webJob.refund",
          orderId: ctx.orderId,
        })
      }
    } catch (err) {
      logger.error("finalizeFailure refund failed", err as Error, {
        module: "webJob.finalizeFailure",
        orderId: ctx.orderId,
      })
    }
  }

  emitToUser(ctx.userId, "order:update", { orderId: ctx.orderId, type: "website", status: "failed" })
  void sendTelegramAdmin("admin_deploy_failed", {
    username: ctx.username,
    domain_name: ctx.domainName,
    step: "Deploy",
    error: message.slice(0, 200),
    time: now(),
  }).catch(() => {})
}

/**
 * web-create-worker — Background worker thường trú xử lý hàng đợi tạo website.
 *
 * Triết lý: thực thi deploy TÁCH KHỎI request HTTP. DB (WebCreateJob) là nguồn
 * sự thật duy nhất. Nhờ đó khách F5 (hoặc tab cron F5) KHÔNG thể restart hay
 * nhân bản 1 deploy đang chạy — worker này là entry thực thi duy nhất.
 *
 * Đặc điểm (port pattern từ cron-engine.ts):
 *  - Khởi động 1 lần qua instrumentation.register().
 *  - Vòng lặp tick: reclaim job kẹt → claim & chạy job tới khi đầy slot.
 *  - Concurrency cap (mặc định 3) — tạo nhiều web cùng lúc, mỗi job 1 slot.
 *  - Mỗi job chạy độc lập: lease + heartbeat (trong processOneJob) chống treo.
 *  - Bật/tắt qua env WEB_CREATE_WORKER (mặc định true).
 *  - Graceful shutdown: dừng nhận job mới, lease hết hạn sẽ được instance khác
 *    (hoặc chính nó khi restart) reclaim.
 */
import os from "os"
import { connectDB } from "@/lib/db"
import { logger } from "@/lib/logger"
import {
  claimNextJob,
  processOneJob,
  reclaimStuckJobs,
} from "@/services/web-job.service"
import type { IWebCreateJob } from "@/models/web-create-job.model"

// ─── Config (auto từ env, có default an toàn) ────────────────────────────────
const TICK_MS = 5_000
const RECLAIM_EVERY_TICKS = 6 // ~30s/lần quét job kẹt
function getConcurrency(): number {
  const raw = Number(process.env.WEB_CREATE_CONCURRENCY)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 20) return Math.floor(raw)
  return 3
}

// ─── Internal state ───────────────────────────────────────────────────────────
let started = false
let tickHandle: NodeJS.Timeout | null = null
let inFlight = 0
let tickCount = 0
let ticking = false

const workerId = `${os.hostname()}#${process.pid}`
const concurrency = getConcurrency()

export function isWebCreateWorkerEnabled(): boolean {
  const flag = (process.env.WEB_CREATE_WORKER || "true").toLowerCase()
  return flag !== "false" && flag !== "0"
}

/**
 * Lấp đầy các slot rảnh bằng job mới claim được. Mỗi job chạy nền (không await)
 * để nhiều web deploy song song; slot được trả lại khi job xong.
 */
async function fillSlots(): Promise<void> {
  while (inFlight < concurrency) {
    let job: IWebCreateJob | null
    try {
      job = await claimNextJob(workerId)
    } catch (err) {
      logger.error("web-create worker: claim failed", err as Error, {
        module: "webCreate.worker",
      })
      return
    }
    if (!job) return // hết job sẵn sàng
    const claimed: IWebCreateJob = job

    inFlight += 1
    // Chạy nền — KHÔNG await để giải phóng vòng lặp claim slot tiếp theo.
    void processOneJob(claimed, workerId)
      .catch((err) => {
        logger.error("web-create worker: processOneJob crashed", err as Error, {
          module: "webCreate.worker",
          jobId: String(claimed._id),
        })
      })
      .finally(() => {
        inFlight = Math.max(0, inFlight - 1)
        // Có slot trống lại → thử lấp ngay (không chờ tick kế tiếp).
        void fillSlots().catch(() => {})
      })
  }
}

async function tick(): Promise<void> {
  if (ticking) return // tránh chồng tick
  ticking = true
  try {
    tickCount += 1
    // Quét job kẹt định kỳ (worker chết giữa chừng → resume).
    if (tickCount % RECLAIM_EVERY_TICKS === 1) {
      await reclaimStuckJobs().catch(() => {})
    }
    if (inFlight < concurrency) {
      await fillSlots()
    }
  } finally {
    ticking = false
  }
}

export async function startWebCreateWorker(): Promise<void> {
  if (started) return
  if (!isWebCreateWorkerEnabled()) {
    logger.info("web-create worker disabled by env WEB_CREATE_WORKER=false", {
      module: "webCreate.worker",
    })
    return
  }
  started = true

  await connectDB().catch((err) =>
    logger.error("web-create worker: connectDB failed", err as Error, {
      module: "webCreate.worker",
    })
  )

  logger.info("web-create worker starting", {
    module: "webCreate.worker",
    workerId,
    concurrency,
    tickMs: TICK_MS,
  })

  // Reclaim ngay lúc boot (xử lý job kẹt từ lần chạy trước bị crash/restart).
  await reclaimStuckJobs().catch(() => {})

  tickHandle = setInterval(() => {
    tick().catch((err) =>
      logger.error("web-create worker: tick crashed", err as Error, {
        module: "webCreate.worker",
      })
    )
  }, TICK_MS)

  const onExit = () => {
    stopWebCreateWorker()
  }
  process.once("SIGTERM", onExit)
  process.once("SIGINT", onExit)
}

export function stopWebCreateWorker(): void {
  if (tickHandle) clearInterval(tickHandle)
  tickHandle = null
  started = false
  logger.info("web-create worker stopped", { module: "webCreate.worker" })
}

/**
 * Nudge: cho cron route gọi để đảm bảo worker đang chạy + chen 1 tick ngay
 * (không block). An toàn gọi nhiều lần.
 */
export function nudgeWebCreateWorker(): void {
  if (!isWebCreateWorkerEnabled()) return
  if (!started) {
    void startWebCreateWorker().catch(() => {})
    return
  }
  void tick().catch(() => {})
}

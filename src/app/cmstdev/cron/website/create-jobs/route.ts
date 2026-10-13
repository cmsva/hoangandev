/**
 * GET /cmstdev/cron/website/create-jobs?secret=<token>&limit=<n>
 *
 * NON-BLOCKING KICKER cho hàng đợi tạo website.
 *
 * Trước đây route này `await processWebsiteJobs()` → request HTTP bị giữ vài
 * phút mỗi lần deploy (cron treo). Giờ đây thực thi do background worker
 * (web-create-worker) đảm nhiệm. Route này chỉ:
 *  - đảm bảo worker đang chạy + nudge 1 tick (không block),
 *  - reclaim job kẹt nếu có,
 *  - trả về thống kê hàng đợi NGAY.
 *
 * Nhờ vậy cron ngoài (aaPanel/EasyCron) gọi mỗi 60s không bao giờ chồng lấn.
 *
 * Fallback safety-net: nếu worker bị tắt qua env (WEB_CREATE_WORKER=false, vd
 * môi trường serverless không thường trú), route sẽ chạy `processWebsiteJobs`
 * có time-budget ngắn để cron pull vẫn xử lý job mà không treo.
 */
import { NextRequest, NextResponse } from "next/server"
import {
  processWebsiteJobs,
  reclaimStuckJobs,
  getQueueStats,
} from "@/services/web-job.service"
import {
  isWebCreateWorkerEnabled,
  nudgeWebCreateWorker,
} from "@/lib/web-create-worker"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authError = await verifyCronSecret(request, "website-create")
  if (authError) return authError

  const limitParam = request.nextUrl.searchParams.get("limit")
  const parsedLimit = limitParam ? Number(limitParam) : undefined
  const limit = Number.isFinite(parsedLimit) && parsedLimit! > 0 ? parsedLimit! : 3

  const startedAt = Date.now()
  try {
    const reclaimed = await reclaimStuckJobs()

    let result: Record<string, unknown>
    if (isWebCreateWorkerEnabled()) {
      // Worker thường trú đang xử lý — chỉ nudge cho nó tick ngay rồi trả về.
      nudgeWebCreateWorker()
      result = { mode: "worker", reclaimed }
    } else {
      // Fallback cron-pull (serverless/worker tắt). Time-budget ngắn để không treo.
      const r = await processWebsiteJobs(limit, "cron-pull", 8_000)
      result = { mode: "cron-pull", reclaimed, ...r }
    }

    const queue = await getQueueStats()
    await trackCronRun({
      key: "website_create",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify({ ...result, queue }).slice(0, 300),
    })
    return NextResponse.json({ success: true, ...result, queue })
  } catch (err) {
    await trackCronRun({
      key: "website_create",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

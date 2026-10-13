/**
 * GET /cmstdev/cron/campaigns/process?secret=<token>
 *
 * Pick up queued campaigns due (scheduledAt ≤ now) và xử lý batch
 * BATCH_SIZE recipients/lần. Idempotent — nhiều worker đồng thời an toàn
 * nhờ atomic findOneAndUpdate trong service.
 *
 * Khuyến nghị chạy mỗi 30s qua external cron.
 */
import { NextRequest, NextResponse } from "next/server"
import { processDueCampaigns } from "@/services/campaign.service"
import { connectDB } from "@/lib/db"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authError = await verifyCronSecret(request, "campaigns")
  if (authError) return authError

  const startedAt = Date.now()
  try {
    await connectDB()
    const result = await processDueCampaigns()
    await trackCronRun({
      key: "campaigns",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify(result).slice(0, 300),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await trackCronRun({
      key: "campaigns",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

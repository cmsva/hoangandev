/**
 * GET /cmstdev/cron/website/check?secret=<token>&limit=<n>
 *
 * Kiểm tra và stop website auto đã hết hạn.
 */
import { NextRequest, NextResponse } from "next/server"
import { stopExpiredAutoWebsites } from "@/services/admin-website.service"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authError = await verifyCronSecret(request, "website")
  if (authError) return authError

  const limitParam = request.nextUrl.searchParams.get("limit")
  const parsedLimit = limitParam ? Number(limitParam) : undefined

  const startedAt = Date.now()
  try {
    const result = await stopExpiredAutoWebsites({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })
    await trackCronRun({
      key: "website_expire",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify(result).slice(0, 300),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await trackCronRun({
      key: "website_expire",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

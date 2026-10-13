/**
 * GET /cmstdev/cron/domain/check?secret=<token>&limit=<n>
 *
 * Poll pending Spaceship async operations.
 * Chạy mỗi 30s–60s qua external cron.
 * Batch: mỗi lần poll tối đa 10 orders (tránh spam Spaceship API).
 */
import { NextRequest, NextResponse } from "next/server"
import { pollPendingSpaceshipOperations } from "@/services/domain.service"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authError = await verifyCronSecret(request, "domain")
  if (authError) return authError

  const limitParam = request.nextUrl.searchParams.get("limit")
  const parsedLimit = limitParam ? Number(limitParam) : undefined

  const startedAt = Date.now()
  try {
    const result = await pollPendingSpaceshipOperations({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })
    await trackCronRun({
      key: "domain",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify(result).slice(0, 300),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await trackCronRun({
      key: "domain",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

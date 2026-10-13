/**
 * GET /cmstdev/cron/website/check-domain?secret=<token>
 *
 * Poll Spaceship async operations cho ORDER WEBSITE đang ở status `domain_buying`
 * (auto-deploy mode + domainNew=true).
 *
 * Chạy mỗi 60s qua external cron. Batch: tối đa 20 orders/lần.
 *
 * Khác `/cmstdev/cron/domain/check` (poll OrderDomain) — route này poll OrderService.
 */
import { NextRequest, NextResponse } from "next/server"
import { pollSpaceshipDomainBuying } from "@/services/auto-domain.service"
import { verifyCronSecret } from "@/lib/cron-auth"
import { trackCronRun } from "@/services/cron-monitor.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authError = await verifyCronSecret(request, "website")
  if (authError) return authError

  const startedAt = Date.now()
  try {
    const result = await pollSpaceshipDomainBuying()
    await trackCronRun({
      key: "website_domain",
      status: "success",
      durationMs: Date.now() - startedAt,
      message: JSON.stringify(result).slice(0, 300),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await trackCronRun({
      key: "website_domain",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Cron authentication helper — DRY shared auth cho tất cả cron endpoints.
 *
 * Pattern:
 *   const authError = await verifyCronSecret(request)
 *   if (authError) return authError
 */
import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { logger } from "@/lib/logger"
import { getSiteOption } from "@/models/setting.model"

/**
 * Verify cron secret từ query `?secret=`.
 * - Null nếu OK (caller tiếp tục)
 * - NextResponse nếu lỗi (caller return ngay)
 *
 * Auto connectDB trước khi check.
 */
export async function verifyCronSecret(
  request: NextRequest,
  module: string
): Promise<NextResponse | null> {
  const secret = request.nextUrl.searchParams.get("secret")

  if (!secret) {
    return NextResponse.json({ error: "Missing ?secret=" }, { status: 401 })
  }

  await connectDB()
  const expectedSecret = await getSiteOption("cron_secret")

  if (!expectedSecret || expectedSecret.length < 8) {
    return NextResponse.json(
      { error: "cron_secret chưa được cấu hình hoặc quá yếu" },
      { status: 503 }
    )
  }

  if (secret !== expectedSecret) {
    logger.warn(`cron ${module}: invalid secret`, {
      module: `cron.${module}`,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
    })
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 })
  }

  return null // auth OK
}

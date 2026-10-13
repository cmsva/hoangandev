/**
 * GET /reffer?aff=<refId>
 *
 * Route handler — không phải page. Chạy server-side với runtime nodejs:
 *  1. Validate refId (24 hex)
 *  2. Track click (anti-fraud: bot UA, self-click, throttle)
 *  3. Set cookie aff_ref 30 ngày
 *  4. Redirect:
 *     - Đã login → /dashboard
 *     - Chưa login → /authentication/register (cookie tự pickup)
 */
import { NextRequest, NextResponse } from "next/server"
import { trackAffiliateClick } from "@/services/affiliate.service"
import { verifyToken } from "@/services/auth.service"
import { buildAbsoluteUrl } from "@/lib/url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const refId = request.nextUrl.searchParams.get("aff")?.trim() || ""
  const isValid = /^[a-f0-9]{24}$/i.test(refId)
  const token = request.cookies.get("token")?.value
  const isAuthed = !!token

  // Lookup authed userId (best-effort) để chống self-click
  let authedUserId: string | null = null
  if (isAuthed && token) {
    try {
      const payload = verifyToken(token)
      authedUserId = payload?.sub ?? null
    } catch {
      authedUserId = null
    }
  }

  // Click track — phải AWAIT (route handler trả response xong sẽ kill async)
  if (isValid) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null
    const userAgent = request.headers.get("user-agent")
    try {
      await trackAffiliateClick({
        refId: refId.toLowerCase(),
        ip,
        userAgent,
        authedUserId,
      })
    } catch {
      // ignore — track click best-effort
    }
  }

  // Build redirect target — KHÔNG kèm ?aff= trên URL (cookie đã đủ).
  // Dùng buildAbsoluteUrl để lấy origin thật sau reverse proxy
  // (request.url của Next.js có thể trả 0.0.0.0:3000).
  const target = buildAbsoluteUrl(
    request,
    isAuthed ? "/dashboard" : "/authentication/register"
  )

  const res = NextResponse.redirect(target)

  // Set cookie aff_ref 30 ngày (sameSite=lax, không httpOnly để client đọc)
  if (isValid && !request.cookies.get("aff_ref")?.value) {
    res.cookies.set("aff_ref", refId.toLowerCase(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    })
  }

  return res
}

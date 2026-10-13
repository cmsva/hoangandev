import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = [
  "/authentication",
  "/api/trpc",
  "/api/card",
  "/api/internal",
  "/cmstdev/cron",
  "/_next",
  "/favicon.ico",
  "/uploads",
  "/maintenance",
  "/reffer",
  "/setup",
]

// Routes vẫn BẮT BUỘC đăng nhập (dữ liệu cá nhân / thao tác nhạy cảm).
const PROTECTED_PATHS = [
  "/dashboard",
  "/domain",
  "/customer",
  "/ticket",
  "/faq",
  "/contact",
  "/adminPanel",
]

// ─── Guest-viewable pages (HARD-CODED) ──────────────────────────────────────
// Các trang catalog/marketing cho phép XEM mà không cần đăng nhập. Backend
// (tRPC) vẫn bọc: read = baseProcedure, mọi mutation (mua/thuê/tải) =
// protectedProcedure. UI sẽ chặn hành động mua bằng modal đăng nhập.
//   - /source-code     : chi tiết mã nguồn
//   - /create-website  : mẫu website + chi tiết
//   - /create-logo     : logo mẫu
//   - /cronjob         : danh mục máy chủ cron
//   - /blogs           : bài viết
//   - /document-api    : tài liệu API
// → Không nằm trong PROTECTED_PATHS nên tự động rơi vào nhánh "cho qua".
const GUEST_VIEWABLE_PATHS = [
  "/source-code",
  "/create-website",
  "/create-logo",
  "/cronjob",
  "/blogs",
  "/document-api",
]

/** Routes cần quyền admin (admin claim trong JWT) */
const ADMIN_PATHS = ["/adminPanel"]

// ═══ DEFENSE LAYER: scan paths + DDoS ═══════════════════════════════════════

/**
 * Common reconnaissance paths attackers probe — phpmyadmin, env files, wp-admin,
 * git, .DS_Store, .vscode, etc. Hit nào trong này = +1 scan score.
 */
const SCAN_PATTERNS = [
  /\/wp-(admin|login|content|includes|json)/i,
  /\/phpmyadmin/i,
  /\/pma/i,
  /\/\.env/i,
  /\/\.git/i,
  /\/\.svn/i,
  /\/\.aws/i,
  /\/\.ssh/i,
  /\/\.htaccess/i,
  /\/\.DS_Store/i,
  /\/\.vscode/i,
  /\/config(\.php|\.json|\.yml)/i,
  /\/(backup|backups|dump|sql)\.(zip|tar|gz|sql|bak)/i,
  /\/admin\.(php|asp|aspx|jsp)/i,
  /\/cgi-bin/i,
  /\/server-(status|info)/i,
  /\/xmlrpc\.php/i,
  /\/web\.config/i,
  /\/\.well-known\/(security|acme).*\.\./i, // path traversal
  /\/(shell|c99|r57|backdoor|webshell)\.(php|asp|jsp)/i,
  /\.\.\/\.\./i, // basic ../../ traversal
  /\/(actuator|jolokia|swagger|api-docs)\b/i,
]

const SCAN_THRESHOLD = 3 // 3 lần scan = block 24h
const SCAN_WINDOW_MS = 60_000 * 5 // trong 5 phút

const DDOS_THRESHOLD = 240 // > 240 req/phút = block 1h
const DDOS_WINDOW_MS = 60_000

// Module-level state — shared across requests within the same Edge instance.
// Keyed by IP. Map cleanup khi process restart hoặc khi entry hết hạn.
const ipStats = new Map<
  string,
  { reqCount: number; reqWindowStart: number; scanHits: number; scanWindowStart: number; lastBlockSentAt: number }
>()

// Cached blocklist — refresh từ /api/internal/blocked-ips
let blockedSet = new Set<string>()
let blockedAt = 0
const BLOCK_REFRESH_MS = 30_000

// IP blocking + anti-DDoS chỉ chạy ở production. Local dev: compile errors,
// HMR reload bursts dễ trip DDoS threshold và tự block IP của chính dev.
const IS_PROD = process.env.NODE_ENV === "production"

// ═══ Helpers ════════════════════════════════════════════════════════════════

function getClientIP(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") || ""
  const first = fwd.split(",")[0]?.trim()
  if (first) return first.replace(/^::ffff:/, "")
  const real = req.headers.get("x-real-ip") || ""
  if (real) return real.replace(/^::ffff:/, "")
  return ""
}

function isScanPath(pathname: string): boolean {
  return SCAN_PATTERNS.some((re) => re.test(pathname))
}

/** Async refresh blocklist (background, không await trong hot path). */
async function refreshBlockedSet(origin: string, secret: string) {
  try {
    const res = await fetch(`${origin}/api/internal/blocked-ips`, {
      headers: { "x-internal-secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { ips: string[] }
      blockedSet = new Set(data.ips || [])
      blockedAt = Date.now()
    }
  } catch {
    // ignore — giữ cache cũ
  }
}

/** Async POST tới internal API để add block (best effort). */
async function autoBlockIP(
  origin: string,
  secret: string,
  ip: string,
  reason: string,
  ttlMs: number
) {
  try {
    await fetch(`${origin}/api/internal/blocked-ips`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ ip, reason, ttlMs, source: "auto" }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    })
    // Optimistic local cache update
    blockedSet.add(ip.replace(/^::ffff:/, "").toLowerCase())
  } catch {
    // ignore — sẽ retry trên scan/DDoS lần sau
  }
}

function getInternalSecret(): string {
  return process.env.JWT_SECRET || ""
}

/** Apply security headers (defaults — admin có thể override qua Settings) */
function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  // Set x-pathname để server layout có thể đọc được
  if (pathname) {
    response.headers.set("x-pathname", pathname)
  }
  // HSTS — chỉ áp dụng khi production (HTTPS)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  }
  // X-Frame-Options — chống clickjacking
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  // Referrer-Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // X-Content-Type-Options — chống MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")
  // Permissions-Policy — disable các API nhạy cảm
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  )
  return response
}

/**
 * Trả về:
 *   - "scan"     nếu IP vừa hit scan path nhiều lần
 *   - "ddos"     nếu IP vượt request/min
 *   - null       nếu OK
 *
 * Side-effect: cập nhật ipStats counters.
 */
function detectThreat(ip: string, pathname: string): "scan" | "ddos" | null {
  const now = Date.now()
  let entry = ipStats.get(ip)
  if (!entry) {
    entry = { reqCount: 0, reqWindowStart: now, scanHits: 0, scanWindowStart: now, lastBlockSentAt: 0 }
    ipStats.set(ip, entry)
  }

  // Reset request window
  if (now - entry.reqWindowStart > DDOS_WINDOW_MS) {
    entry.reqCount = 0
    entry.reqWindowStart = now
  }
  entry.reqCount++

  // Reset scan window
  if (now - entry.scanWindowStart > SCAN_WINDOW_MS) {
    entry.scanHits = 0
    entry.scanWindowStart = now
  }

  if (isScanPath(pathname)) {
    entry.scanHits++
    if (entry.scanHits >= SCAN_THRESHOLD) {
      return "scan"
    }
  }

  if (entry.reqCount > DDOS_THRESHOLD) {
    return "ddos"
  }

  return null
}

function blockResponse(reason: string): NextResponse {
  return NextResponse.json(
    { error: "Forbidden", reason },
    {
      status: 403,
      headers: {
        "x-blocked-reason": reason,
      },
    }
  )
}

// ═══ Middleware ═════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl
  const ip = getClientIP(request)

  // Forward pathname via header để server components đọc
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)

  // ─── Internal routes: bỏ qua mọi check (tự bảo vệ bằng x-internal-secret) ──
  if (pathname.startsWith("/api/internal")) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname
    )
  }

  // ─── Refresh blocklist async nếu quá hạn (production only) ──
  const secret = getInternalSecret()
  if (IS_PROD && secret && Date.now() - blockedAt > BLOCK_REFRESH_MS) {
    // Fire-and-forget — không block request
    refreshBlockedSet(origin, secret)
  }

  // ─── Block enforcement + threat detection (production only) ──
  // Local dev bỏ qua hoàn toàn để tránh tự block khi compile lỗi / HMR spam.
  if (IS_PROD && ip) {
    const normalized = ip.toLowerCase().replace(/^::ffff:/, "")
    if (blockedSet.has(normalized)) {
      return blockResponse("ip_blocked")
    }

    // ─── Threat detection ──
    const threat = detectThreat(normalized, pathname)
    if (threat) {
      const entry = ipStats.get(normalized)
      // Tránh spam DB nếu đã trigger trong 60s — chỉ block 1 lần / phút
      if (entry && Date.now() - entry.lastBlockSentAt > 60_000 && secret) {
        entry.lastBlockSentAt = Date.now()
        const ttlMs = threat === "scan" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
        const reason =
          threat === "scan"
            ? `Scan path bot — ${entry.scanHits} hit (last: ${pathname.slice(0, 80)})`
            : `DDoS — ${entry.reqCount} req/phút`
        autoBlockIP(origin, secret, normalized, reason, ttlMs)
      }
      return blockResponse(threat === "scan" ? "scan_detected" : "ddos_detected")
    }
  }

  // ─── Affiliate ref capture (any path, before auth check) ──
  let setAffCookie: string | null = null
  const affParam = searchParams.get("aff")
  if (
    affParam &&
    /^[a-f0-9]{24}$/i.test(affParam) &&
    !request.cookies.get("aff_ref")?.value
  ) {
    setAffCookie = affParam.toLowerCase()
  }

  // ─── Auth hint cookie (non-httpOnly) ──
  // Cookie `token` là httpOnly → JS không đọc được. Hint `auth=1` báo client đã
  // login để mở socket. Set Ở ĐÂY để TỰ HEAL session đã đăng nhập từ trước
  // (không bắt login lại). Token thật vẫn httpOnly; hint chỉ là cờ.
  const authToken = request.cookies.get("token")?.value
  const authHint = request.cookies.get("auth")?.value
  const setAuthHint = !!authToken && authHint !== "1"
  const clearAuthHint = !authToken && !!authHint

  // ─── Allow public paths ──
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    const res = applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname
    )
    if (setAffCookie) attachAffCookie(res, setAffCookie)
    attachAuthHint(res, setAuthHint, clearAuthHint)
    return res
  }

  // ─── Guest-viewable pages: cho XEM không cần auth ──
  // Backend (tRPC) tự bọc: read = baseProcedure, mutation = protectedProcedure.
  if (GUEST_VIEWABLE_PATHS.some((path) => pathname.startsWith(path))) {
    const res = applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname
    )
    if (setAffCookie) attachAffCookie(res, setAffCookie)
    attachAuthHint(res, setAuthHint, clearAuthHint)
    return res
  }

  // ─── Only protect dashboard and service routes ──
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (!isProtected) {
    const res = applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname
    )
    if (setAffCookie) attachAffCookie(res, setAffCookie)
    attachAuthHint(res, setAuthHint, clearAuthHint)
    return res
  }

  // ─── Check for auth token ──
  const token = request.cookies.get("token")?.value

  if (!token) {
    const loginUrl = new URL("/authentication/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    const res = applySecurityHeaders(NextResponse.redirect(loginUrl), pathname)
    if (setAffCookie) attachAffCookie(res, setAffCookie)
    attachAuthHint(res, setAuthHint, clearAuthHint)
    return res
  }

  // ─── Admin guard — cần claim admin=1 trong JWT payload ──
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isAdminClaim(token)) {
      const fallback = new URL("/dashboard", request.url)
      const res = applySecurityHeaders(NextResponse.redirect(fallback), pathname)
      if (setAffCookie) attachAffCookie(res, setAffCookie)
      return res
    }
  }

  const res = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname
  )
  if (setAffCookie) attachAffCookie(res, setAffCookie)
  attachAuthHint(res, setAuthHint, clearAuthHint)
  return res
}

/**
 * Decode JWT payload trong middleware (Edge runtime safe).
 *
 * KHÔNG verify signature — chỉ dùng để first-line defense (UI guard).
 * tRPC adminProcedure server-side mới là source of truth (verify full).
 *
 * Tradeoff: nếu user tự forge token, middleware có thể cho qua nhưng sẽ bị
 * tRPC chặn ngay khi gọi API — không có dữ liệu rò rỉ.
 */
function isAdminClaim(token: string): boolean {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    // base64url decode payload
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded)
    const claims = JSON.parse(decoded)
    return claims?.admin === 1
  } catch {
    return false
  }
}

/** Set aff_ref cookie 30 ngày */
function attachAffCookie(res: NextResponse, refId: string) {
  res.cookies.set("aff_ref", refId, {
    httpOnly: false, // Client có thể đọc để fire trackClick endpoint
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })
}

/** Set/clear auth hint cookie (non-httpOnly) để client biết đã login → mở socket. */
function attachAuthHint(res: NextResponse, set: boolean, clear: boolean) {
  if (set) {
    res.cookies.set("auth", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    })
  } else if (clear) {
    res.cookies.delete("auth")
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}

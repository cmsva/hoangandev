/**
 * Internal blocklist API — chỉ middleware (cùng process) gọi.
 * Auth: header `x-internal-secret` phải khớp với env (auto-derive từ JWT_SECRET).
 *
 * GET  → trả mảng IP đang bị block
 * POST → thêm IP vào blocklist (body: {ip, reason, ttlMs, source})
 */
import { NextRequest, NextResponse } from "next/server"
import { addBlock, getActiveBlockedIPs } from "@/services/blocked-ip.service"
import { BLOCK_SOURCES } from "@/models/blocked-ip.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getInternalSecret(): string {
  // Re-use JWT_SECRET — luôn ≥ 32 chars, đã có ở mọi process. Không cần env mới.
  return process.env.JWT_SECRET || ""
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function checkAuth(req: NextRequest): boolean {
  const expected = getInternalSecret()
  if (!expected) return false
  const got = req.headers.get("x-internal-secret") || ""
  if (got.length !== expected.length) return false
  // Constant-time-ish: same length + char compare
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i)
  }
  return diff === 0
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized()
  try {
    const ips = await getActiveBlockedIPs()
    return NextResponse.json({ ips, timestamp: Date.now() })
  } catch (err) {
    console.error("blocked-ips GET", err)
    return NextResponse.json({ error: "fail" }, { status: 500 })
  }
}

// IPv4 anchored regex (0-255 mỗi octet) hoặc IPv6 loị hình đơn giản.
const IPV4_RE = /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
const IPV6_RE = /^[a-f0-9:]+$/i
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function isValidIP(ip: string): boolean {
  if (ip.length > 64) return false
  return IPV4_RE.test(ip) || (IPV6_RE.test(ip) && ip.includes(":"))
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized()
  try {
    const body = await req.json().catch(() => ({}))
    const ip = String(body.ip || "").trim().replace(/^::ffff:/, "")
    const reason = body.reason ? String(body.reason).slice(0, 500) : null
    const source = BLOCK_SOURCES.includes(body.source) ? body.source : "auto"
    const ttlRaw = typeof body.ttlMs === "number" && body.ttlMs > 0 ? body.ttlMs : null
    const ttlMs = ttlRaw ? Math.min(ttlRaw, MAX_TTL_MS) : null

    if (!ip) return NextResponse.json({ error: "ip required" }, { status: 400 })
    if (!isValidIP(ip)) return NextResponse.json({ error: "ip invalid" }, { status: 400 })

    const item = await addBlock({ ip, reason, source, ttlMs })
    return NextResponse.json({ ok: true, item })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "fail" }, { status: 400 })
  }
}

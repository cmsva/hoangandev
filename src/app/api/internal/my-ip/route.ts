/**
 * GET /api/internal/my-ip
 *
 * Trả IP hiện tại của caller (đã đi qua proxy chain CF/Vercel).
 * Dùng cho UI ở /document-api để user 1-click thêm IP vào whitelist.
 *
 * Public — không cần auth, nhưng cũng không expose thông tin nhạy cảm.
 */
import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for")
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    fwd?.split(",")[0]?.trim() ||
    "unknown"
  return NextResponse.json({ ip })
}

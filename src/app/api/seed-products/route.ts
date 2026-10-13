/**
 * Seed endpoint — DESTRUCTIVE: deletes all Products + Categories.
 *
 * Lock behind:
 *   1. NODE_ENV !== "production" (chặn hoàn toàn ở production)
 *   2. JWT cookie có claim admin=1 (verify trong tRPC adminProcedure standard)
 *   3. Header `x-internal-secret` match `process.env.JWT_SECRET`
 *
 * Cả 3 điều kiện phải pass.
 */
import { NextRequest, NextResponse } from "next/server"
import { seedProducts } from "@/lib/seed-products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 })
  }

  const secret = req.headers.get("x-internal-secret")
  if (!secret || secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await seedProducts()
    return NextResponse.json({ success: true, message: "Seed completed" })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

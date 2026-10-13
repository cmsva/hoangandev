/**
 * GET /api/agency/websites/:slug
 *
 * Chi tiết 1 mẫu website + bảng giá theo durationMonths.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { findServiceBySlug, serializeServiceDetail } from "@/services/website.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const slug = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!slug) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu slug" })
    }
    const detail = await findServiceBySlug(slug)
    const data = serializeServiceDetail(detail)
    if (!data) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Mẫu website không tồn tại" })
    }
    return apiSuccess(data, { requestId: ctx.requestId })
  },
  { scope: "websites:read" }
)

/**
 * GET /api/agency/logos/:slug
 *
 * Chi tiết 1 logo.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { findLogoBySlug, serializeLogoDetail } from "@/services/logo.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const slug = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!slug) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu slug" })
    }
    const logo = await findLogoBySlug(slug)
    const data = serializeLogoDetail(logo)
    if (!data) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Logo không tồn tại" })
    }
    return apiSuccess(data, { requestId: ctx.requestId })
  },
  { scope: "logos:read" }
)

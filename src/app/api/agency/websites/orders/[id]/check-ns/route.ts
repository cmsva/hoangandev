/**
 * POST /api/agency/websites/orders/:id/check-ns
 *
 * Trigger check NS + deploy. Idempotent — gọi nhiều lần không re-trigger
 * khi đang processing/active.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { checkNsAndDeploy } from "@/services/auto-domain.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withApiAuth(
  async (req: NextRequest, ctx) => {
    const segments = req.nextUrl.pathname.split("/")
    const id = decodeURIComponent(segments[segments.length - 2] || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const result = await checkNsAndDeploy(id, ctx.userId)
    return apiSuccess(result, { requestId: ctx.requestId })
  },
  { scope: "websites:write" }
)

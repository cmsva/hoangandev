/**
 * GET /api/agency/logos/orders/:id
 *
 * Chi tiết 1 đơn logo — kèm download URL nếu đã giao.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { findCompletedLogoOrder } from "@/services/logo.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const id = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const order = await findCompletedLogoOrder(ctx.userId, id)
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn logo" })
    }
    return apiSuccess(order, { requestId: ctx.requestId })
  },
  { scope: "logos:read" }
)

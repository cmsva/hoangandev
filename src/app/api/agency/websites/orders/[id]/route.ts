/**
 * GET /api/agency/websites/orders/:id
 *
 * Chi tiết 1 đơn website + provisioning state (NS, zone, step log).
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { getMyOrderWithCredentials } from "@/services/website.service"
import { getOrderProvisioning } from "@/services/auto-domain.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const id = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const [order, provisioning] = await Promise.all([
      getMyOrderWithCredentials(ctx.userId, id),
      getOrderProvisioning(id, ctx.userId).catch(() => null),
    ])
    return apiSuccess({ ...order, provisioning }, { requestId: ctx.requestId })
  },
  { scope: "websites:read" }
)

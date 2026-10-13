/**
 * GET /api/agency/domains/orders/:id
 *
 * Chi tiết 1 đơn mua domain — kèm DNS records hiện tại + status.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { OrderDomain } from "@/models/domain.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const id = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const order = (await OrderDomain.findOne({ _id: id, userId: ctx.userId }).lean()) as any
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
    }
    return apiSuccess(
      {
        id: String(order._id),
        domainName: order.domainName,
        tldName: order.tldName,
        status: order.status,
        years: order.years,
        totalPrice: order.totalPrice,
        spaceshipOperationId: order.spaceshipOperationId ?? null,
        nameservers: order.nameservers ?? [],
        createdAt: order.createdAt,
        expiredAt: order.expiredAt,
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "domains:read" }
)

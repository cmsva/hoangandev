/**
 * GET /api/agency/products/orders/:id
 *
 * Chi tiết 1 đơn mua mã nguồn của user — kèm downloadUrl + creds (nếu có).
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { Order } from "@/models/order-product.model"
import { Product } from "@/models/product.model"
import { Types } from "mongoose"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const id = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const order = (await Order.findOne({ _id: id, userId: ctx.userId })
      .lean()) as any
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
    }
    const product = (await Product.findById(order.productId)
      .select("title slug thumbnail fileUrl description")
      .lean()) as any
    return apiSuccess(
      {
        id: String(order._id),
        productId: String(order.productId),
        product: product
          ? {
              title: product.title,
              slug: product.slug,
              thumbnail: product.thumbnail,
              description: product.description,
            }
          : null,
        totalPrice: order.totalPrice,
        orderDate: order.orderDate,
        downloadUrl: product?.fileUrl ?? null,
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "products:read" }
)

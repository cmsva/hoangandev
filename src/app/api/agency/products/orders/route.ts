/**
 * GET /api/agency/products/orders
 *
 * Lịch sử mua mã nguồn. Trả thêm `downloadUrl` cho từng order — link tải
 * source code (server-signed URL) để partner có thể giao file cho khách hàng.
 *
 * Query: page, limit, search, sortField, sortDir
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listMyOrders } from "@/services/order.service"
import { Order } from "@/models/order-product.model"
import { Product } from "@/models/product.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  sortField: z.enum(["productTitle", "totalPrice", "orderDate"]).default("orderDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
})

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      sortField: url.searchParams.get("sortField") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const { page, limit, search, sortField, sortDir } = parsed.data
    const list = await listMyOrders({ userId: ctx.userId, page, limit, search, sortField, sortDir })

    // Bổ sung downloadUrl bằng cách fetch fileUrl từ product mapping (1 round-trip)
    const productIds = list.items.map((o: any) => o.productId)
    const products = (await Product.find({ _id: { $in: productIds } })
      .select("fileUrl")
      .lean()) as any[]
    const fileMap = new Map(products.map((p) => [String(p._id), p.fileUrl as string | null]))

    return apiSuccess(
      {
        items: list.items.map((o: any) => ({
          ...o,
          downloadUrl: fileMap.get(o.productId) ?? null,
        })),
        pagination: {
          page,
          limit,
          total: list.total,
          totalPages: Math.max(1, Math.ceil(list.total / limit)),
        },
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "products:read" }
)

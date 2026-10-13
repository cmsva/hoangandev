/**
 * GET /api/agency/products/:slug
 *
 * Chi tiết 1 mã nguồn theo slug.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import {
  findProductBySlug,
  serializeProductDetail,
  findRelatedProducts,
} from "@/services/product.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (_req: NextRequest, ctx) => {
    // params.slug from dynamic route
    const slug = decodeURIComponent(
      _req.nextUrl.pathname.split("/").pop() || ""
    )
    if (!slug) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu slug" })
    }
    const product = await findProductBySlug(slug)
    const detail = serializeProductDetail(product)
    if (!detail) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Sản phẩm không tồn tại" })
    }
    const related = await findRelatedProducts(slug, detail.categoryId)
    return apiSuccess(
      {
        ...detail,
        related: (related as any[]).map((p) => ({
          id: String(p._id),
          title: p.title,
          slug: p.slug,
          price: p.price,
          salePrice: p.salePrice,
          thumbnail: p.thumbnail,
        })),
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "products:read" }
)

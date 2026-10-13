/**
 * POST /api/agency/products/buy
 *
 * Mua mã nguồn. Body: { productId, couponCode? }
 *
 * Trừ tiền từ balance của user đăng ký api-key.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { purchaseSourceCode } from "@/services/order.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  productId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "productId không hợp lệ"),
  couponCode: z.string().trim().min(1).max(64).optional(),
})

export const POST = withApiAuth(
  async (req: NextRequest, ctx) => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Body phải là JSON" })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Body không hợp lệ",
      })
    }
    const result = await purchaseSourceCode({
      userId: ctx.userId,
      productId: parsed.data.productId,
      couponCode: parsed.data.couponCode,
    })
    return apiSuccess(
      {
        orderId: result.orderId,
        productTitle: result.productTitle,
        totalPrice: result.totalPrice,
        couponCode: result.couponCode,
      },
      { message: "Mua mã nguồn thành công", requestId: ctx.requestId }
    )
  },
  { scope: "products:write" }
)

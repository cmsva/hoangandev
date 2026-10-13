/**
 * POST /api/agency/logos/buy
 *
 * Đặt thiết kế logo cho khách của đối tác. Trừ tiền vào số dư của tài khoản API.
 *
 * Body:
 *   {
 *     logoId: string,              // ID gói logo
 *     shopName: string (2-200 ký tự), // Tên shop khách hàng cuối
 *     customNote?: string,         // Ghi chú thiết kế tùy chỉnh (≤ 1000)
 *   }
 *
 * Lưu ý: gói logo của hệ thống không hỗ trợ coupon — không có field `couponCode`.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { purchaseLogo } from "@/services/logo.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    logoId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "logoId không hợp lệ"),
    shopName: z.string().trim().min(2).max(200),
    customNote: z.string().trim().max(1000).optional(),
  })
  .strict()

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
    const result = await purchaseLogo({ userId: ctx.userId, ...parsed.data })
    return apiSuccess(result, {
      message: "Đặt logo thành công",
      requestId: ctx.requestId,
    })
  },
  { scope: "logos:write" }
)

/**
 * POST /api/agency/domains/buy
 *
 * Đăng ký tên miền mới cho đối tác. Trừ tiền vào số dư của tài khoản API.
 *
 * Khi TLD ở chế độ tự động, hệ thống sẽ trả về `status=processing` và đăng ký
 * domain ngầm — đối tác cần poll `GET /api/agency/domains/orders/{id}` để biết
 * khi nào hoàn tất.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { purchaseDomain } from "@/services/domain.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    domain: z.string().trim().toLowerCase().min(3).max(253),
    tldId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "tldId không hợp lệ"),
    couponCode: z.string().trim().min(1).max(64).optional(),
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
    const result = await purchaseDomain({
      userId: ctx.userId,
      ...parsed.data,
    })
    return apiSuccess(result, {
      message: "Đã khởi tạo đăng ký tên miền",
      requestId: ctx.requestId,
    })
  },
  { scope: "domains:write" }
)

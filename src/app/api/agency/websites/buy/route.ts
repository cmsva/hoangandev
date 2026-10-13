/**
 * POST /api/agency/websites/buy
 *
 * Thuê 1 website mẫu. Body:
 *   { serviceId, durationMonths, domainName, domainNew?, domainTldId?, shopAccount?, shopPassword?, couponCode? }
 *
 * Trừ tiền từ user của api-key. Nếu service ở chế độ auto deploy + domainNew=true,
 * hệ thống sẽ thực hiện luôn flow Cloudflare/Spaceship background — caller cần
 * poll `GET /api/agency/websites/orders/:id/status` để biết tiến trình.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { purchaseWebsite } from "@/services/website.service"
import { User } from "@/models/user.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const objectIdRegex = /^[a-f0-9]{24}$/i

const bodySchema = z
  .object({
    serviceId: z.string().trim().regex(objectIdRegex, "serviceId không hợp lệ"),
    durationMonths: z.number().int().min(1).max(36),
    domainName: z.string().trim().toLowerCase().min(3).max(253),
    domainNew: z.boolean().default(false),
    domainTldId: z.string().trim().regex(objectIdRegex).optional(),
    shopAccount: z.string().trim().max(200).default(""),
    shopPassword: z.string().max(500).default(""),
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

    // Need username from User doc for snapshot
    const user = (await User.findById(ctx.userId).select("username").lean()) as any
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Tài khoản không tồn tại" })
    }

    const result = await purchaseWebsite({
      userId: ctx.userId,
      username: user.username,
      ...parsed.data,
    })
    return apiSuccess(
      {
        orderId: result.orderId,
        serviceName: result.serviceName,
        domainName: result.domainName,
        domainTldName: result.domainTldName,
        couponCode: result.couponCode,
        total: result.total,
      },
      { message: "Tạo đơn thuê website thành công", requestId: ctx.requestId }
    )
  },
  { scope: "websites:write" }
)

/**
 * GET /api/agency/account/balance
 *
 * Trả số dư + recent log balance changes.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { User } from "@/models/user.model"
import { LogBalance } from "@/models/log.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const user = (await User.findById(ctx.userId).select("money").lean()) as any
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })

    const logs = (await LogBalance.find({ userId: ctx.userId })
      .sort({ createdAt: -1 })
      .limit(parsed.data.limit)
      .select("moneyBefore moneyChange moneyAfter content createdAt")
      .lean()) as any[]

    return apiSuccess(
      {
        balance: user.money,
        currency: "VND",
        recent: logs.map((l) => ({
          before: l.moneyBefore,
          change: l.moneyChange,
          after: l.moneyAfter,
          content: l.content,
          at: l.createdAt,
        })),
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "account:read" }
)

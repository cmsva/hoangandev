/**
 * GET /api/agency/account/me
 *
 * Trả thông tin tài khoản: id, username, email, balance, tier (nếu có).
 * Không cần scope cụ thể — chỉ cần auth.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { User } from "@/models/user.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (_req: NextRequest, ctx) => {
    const user = (await User.findById(ctx.userId)
      .select("username email money admin createdAt")
      .lean()) as any
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    }
    return apiSuccess(
      {
        id: String(user._id),
        username: user.username,
        email: user.email,
        balance: user.money,
        admin: !!user.admin,
        createdAt: user.createdAt,
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "account:read" }
)

/**
 * GET /api/agency/cronjobs/:id
 *
 * Chi tiết 1 cronjob của user.
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { findUserCronjob } from "@/services/cronjob.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const id = decodeURIComponent(req.nextUrl.pathname.split("/").pop() || "")
    if (!Types.ObjectId.isValid(id)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
    }
    const job = await findUserCronjob(ctx.userId, id)
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cronjob" })
    return apiSuccess(job, { requestId: ctx.requestId })
  },
  { scope: "cronjobs:read" }
)

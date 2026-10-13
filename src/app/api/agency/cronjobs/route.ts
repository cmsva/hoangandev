/**
 * GET /api/agency/cronjobs
 *
 * Lịch sử cronjob + status.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listMyCronjobs } from "@/services/cronjob.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  sortField: z.enum(["createdAt", "url", "intervalSeconds", "status"]).default("createdAt"),
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
    const { page, limit } = parsed.data
    const result = await listMyCronjobs({ userId: ctx.userId, ...parsed.data } as any)
    return apiSuccess(
      {
        items: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / limit)),
        },
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "cronjobs:read" }
)

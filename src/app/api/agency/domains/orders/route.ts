/**
 * GET /api/agency/domains/orders
 *
 * Lịch sử mua domain + status.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listMyDomainOrders } from "@/services/domain.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  status: z.string().trim().min(0).max(40).optional(),
  sortField: z.enum(["createdAt", "expiredAt", "domainName", "totalPrice"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
})

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      sortField: url.searchParams.get("sortField") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const { page, limit } = parsed.data
    const result = await listMyDomainOrders({ userId: ctx.userId, ...parsed.data } as any)
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
  { scope: "domains:read" }
)

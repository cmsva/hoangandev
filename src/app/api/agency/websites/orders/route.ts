/**
 * GET /api/agency/websites/orders
 *
 * List đơn website của user. Trả kèm shopAccount/shopPassword đã decrypt
 * + provisioning info (NS, status step) để partner ship cho khách hàng.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listMyServiceOrders } from "@/services/website.service"
import { ORDER_SERVICE_STATUSES } from "@/models/service.model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  status: z.enum(ORDER_SERVICE_STATUSES).optional(),
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
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const { page, limit, search, status, sortDir } = parsed.data
    const list = await listMyServiceOrders({
      userId: ctx.userId,
      page,
      limit,
      search,
      status,
      sortDir,
    })
    return apiSuccess(
      {
        items: list.items,
        pagination: {
          page,
          limit,
          total: list.total,
          totalPages: Math.max(1, Math.ceil(list.total / limit)),
        },
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "websites:read" }
)

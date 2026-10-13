/**
 * GET /api/agency/logos
 *
 * List logo + filter category.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listLogos, listActiveLogoCategories } from "@/services/logo.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  categoryId: z.string().trim().min(0).max(64).optional(),
  withCategories: z.coerce.boolean().optional(),
})

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      withCategories: url.searchParams.get("withCategories") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const { page, limit, withCategories, ...rest } = parsed.data
    const [list, categories] = await Promise.all([
      listLogos({ page, limit, ...rest } as any),
      withCategories ? listActiveLogoCategories() : Promise.resolve(null),
    ])
    return apiSuccess(
      {
        items: list.items,
        pagination: {
          page,
          limit,
          total: list.total,
          totalPages: Math.max(1, Math.ceil(list.total / limit)),
        },
        ...(categories
          ? {
              categories: (categories as any[]).map((c) => ({
                id: String(c._id),
                name: c.name,
                slug: c.slug,
              })),
            }
          : {}),
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "logos:read" }
)

/**
 * GET /api/agency/websites
 *
 * List mẫu website (template) reseller có thể bán lại.
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { listServices, listActiveCategories, listActiveTlds } from "@/services/website.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(0).max(200).optional(),
  categoryId: z.string().trim().min(0).max(64).optional(),
  sortField: z.enum(["stt", "salesCount", "view", "createdAt"]).default("stt"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  withMeta: z.coerce.boolean().optional(),
})

export const GET = withApiAuth(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      sortField: url.searchParams.get("sortField") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
      withMeta: url.searchParams.get("withMeta") ?? undefined,
    })
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tham số không hợp lệ" })
    }
    const { page, limit, withMeta, ...rest } = parsed.data
    const list = await listServices({ page, limit, ...rest })
    const meta = withMeta
      ? await Promise.all([listActiveCategories(), listActiveTlds()])
      : null
    return apiSuccess(
      {
        items: list.items,
        pagination: {
          page,
          limit,
          total: list.total,
          totalPages: Math.max(1, Math.ceil(list.total / limit)),
        },
        ...(meta
          ? {
              categories: meta[0].map((c) => ({
                id: String(c._id),
                name: c.name,
                slug: c.slug,
              })),
              tlds: meta[1].map((t) => ({
                id: String(t._id),
                tld: t.tld,
                priceSold: t.priceSold,
                renewSold: t.renewSold,
              })),
            }
          : {}),
      },
      { requestId: ctx.requestId }
    )
  },
  { scope: "websites:read" }
)

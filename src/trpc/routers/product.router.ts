/**
 * Product router — thin tRPC layer cho catalog mã nguồn (browse).
 *
 * Order ops (mua) ở @/trpc/routers/order.router.ts.
 */
import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import {
  findProductBySlug,
  findRelatedProducts,
  incProductView,
  listActiveProductCategories,
  listProducts,
  serializeProductDetail,
  shouldCountProductView,
} from "@/services/product.service"

export const productRouter = createTRPCRouter({
  // ─── List ────────────────────────────────────────────────────────────────
  list: baseProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          categoryId: objectIdSchema.optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("product.list", ctx.ip), "product.list")
      await connectDB()

      const { page, limit } = input
      const { items, total } = await listProducts(input)

      return {
        products: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }),

  // ─── Categories ──────────────────────────────────────────────────────────
  categories: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("product.categories", ctx.ip), "categories")
    await connectDB()

    const categories = await listActiveProductCategories()
    return categories.map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      thumbnail: c.thumbnail,
    }))
  }),

  // ─── Detail by slug ──────────────────────────────────────────────────────
  detail: baseProcedure
    .input(z.object({ slug: z.string().min(1).max(200) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("product.detail", ctx.ip), "detail")
      await connectDB()

      const product = await findProductBySlug(input.slug)
      if (!product) return null

      const viewKey = `${input.slug}:${ctx.userId || ctx.ip}`
      if (shouldCountProductView(viewKey)) incProductView(product._id)

      return serializeProductDetail(product)
    }),

  // ─── Related ─────────────────────────────────────────────────────────────
  related: baseProcedure
    .input(
      z
        .object({
          slug: z.string().min(1).max(200),
          categoryId: objectIdSchema.optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("product.related", ctx.ip), "related")
      await connectDB()

      const products = await findRelatedProducts(input.slug, input.categoryId)
      return products.map((p: any, index: number) => ({
        id: p._id.toString(),
        title: p.title,
        slug: p.slug,
        price: p.price,
        salePrice: p.salePrice,
        discountPercentage: p.discountPercentage,
        thumbnail: p.thumbnail,
        isFree: p.isFree,
        salesCount: p.salesCount,
        tags: p.tags ?? [],
        category: p.categoryId
          ? { name: (p.categoryId as any).name, slug: (p.categoryId as any).slug }
          : null,
        rank: index + 1,
      }))
    }),
})

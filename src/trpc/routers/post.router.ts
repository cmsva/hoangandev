import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import {
  findPostBySlug,
  findRelatedPosts,
  incPostView,
  listActivePostCategories,
  listPosts,
  serializePostDetail,
  shouldCountPostView,
} from "@/services/post.service"

export const postRouter = createTRPCRouter({
  list: baseProcedure
    .input(paginationSchema(50).extend({ search: searchSchema, categoryId: objectIdSchema.optional() }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("post.list", ctx.ip), "post.list")
      await connectDB()
      const { items, total } = await listPosts(input)
      return {
        posts: items,
        pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
      }
    }),
  categories: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("post.categories", ctx.ip), "post.categories")
    await connectDB()
    const categories = await listActivePostCategories()
    return categories.map((category: any) => ({ id: String(category._id), name: category.name, slug: category.slug }))
  }),
  detail: baseProcedure.input(z.object({ slug: z.string().trim().min(1).max(200) }).strict()).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("post.detail", ctx.ip), "post.detail")
    await connectDB()
    const post = await findPostBySlug(input.slug)
    if (!post) return null
    const viewKey = `${input.slug}:${ctx.userId || ctx.ip}`
    if (shouldCountPostView(viewKey)) incPostView(post._id)
    return serializePostDetail(post)
  }),
  related: baseProcedure.input(z.object({ slug: z.string().trim().min(1).max(200), categoryId: objectIdSchema.optional() }).strict()).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("post.related", ctx.ip), "post.related")
    await connectDB()
    const posts = await findRelatedPosts(input.slug, input.categoryId)
    return posts.map((post: any) => ({
      id: String(post._id),
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      thumbnail: post.thumbnail,
      createdAt: post.createdAt,
      category: post.categoryId ? { name: post.categoryId.name, slug: post.categoryId.slug } : null,
    }))
  }),
})

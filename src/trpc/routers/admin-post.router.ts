import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  createPost,
  createPostCategory,
  deletePost,
  bulkDeletePostCategories,
  bulkDeletePosts,
  deletePostCategory,
  getAdminPost,
  listAdminPostCategories,
  listAdminPosts,
  listPostCategoriesForSelect,
  updatePost,
  updatePostCategory,
} from "@/services/admin-post.service"

const listCategoriesInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
}).strict()

const categoryUpsertInput = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  status: z.number().int().min(0).max(1).optional(),
}).strict()

const listPostsInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  categoryId: zObjectId.optional(),
  status: z.number().int().min(0).max(1).optional(),
}).strict()

const postUpsertInput = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  content: z.string().min(1).max(300_000),
  thumbnail: z.string().max(500).nullable().optional(),
  categoryId: zObjectId,
  status: z.number().int().min(0).max(1).optional(),
  featured: z.boolean().optional(),
  metaTitle: z.string().trim().max(200).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
  metaKeywords: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
}).strict()
export const adminPostRouter = createTRPCRouter({
  listCategories: adminProcedure.input(listCategoriesInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminPostCategories(input)
  }),
  categoriesForSelect: adminProcedure.query(async () => {
    await connectDB()
    return await listPostCategoriesForSelect()
  }),
  createCategory: adminProcedure.input(categoryUpsertInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.cat.create", String(ctx.user._id)), "createPostCategory")
    await connectDB()
    const result = await createPostCategory(input)
    insertLog({ userId: ctx.user._id, action: `Tạo chuyên mục "${input.name}" (${result.id})`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updateCategory: adminProcedure.input(z.object({ id: zObjectId, data: categoryUpsertInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.cat.update", String(ctx.user._id)), "updatePostCategory")
    await connectDB()
    await updatePostCategory(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật chuyên mục "${input.data.name}" (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deleteCategory: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.cat.del", String(ctx.user._id)), "deletePostCategory")
    await connectDB()
    await deletePostCategory(input.id)
    insertLog({ userId: ctx.user._id, action: `Xóa chuyên mục bài viết (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  listPosts: adminProcedure.input(listPostsInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminPosts(input)
  }),
  getPost: adminProcedure.input(z.object({ id: zObjectId }).strict()).query(async ({ input }) => {
    await connectDB()
    return await getAdminPost(input.id)
  }),
  createPost: adminProcedure.input(postUpsertInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.create", String(ctx.user._id)), "createPost")
    await connectDB()
    const result = await createPost(input)
    insertLog({ userId: ctx.user._id, action: `Tạo bài viết "${input.title}" (${result.id})`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updatePost: adminProcedure.input(z.object({ id: zObjectId, data: postUpsertInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.update", String(ctx.user._id)), "updatePost")
    await connectDB()
    await updatePost(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật bài viết "${input.data.title}" (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deletePost: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.post.del", String(ctx.user._id)), "deletePost")
    await connectDB()
    await deletePost(input.id)
    insertLog({ userId: ctx.user._id, action: `Xóa bài viết (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),

  bulkDeleteCategories: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.post.cat.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeletePostCategories(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} danh mục bài viết`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeletePosts: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.post.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeletePosts(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} bài viết`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

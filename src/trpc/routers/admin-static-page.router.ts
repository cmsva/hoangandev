import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  listAdminStaticPages,
  getAdminStaticPage,
  createStaticPage,
  updateStaticPage,
  deleteStaticPage,
  bulkDeleteStaticPages,
} from "@/services/admin-static-page.service"

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  status: z.number().int().min(0).max(1).optional(),
}).strict()

const upsertInput = z.object({
  slug: z.string().trim().max(200).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  content: z.string().max(300_000).optional(),
  requireLogin: z.boolean().optional(),
  status: z.number().int().min(0).max(1).optional(),
}).strict()

const idInput = z.object({ id: zObjectId }).strict()

export const adminStaticPageRouter = createTRPCRouter({
  list: adminProcedure.input(listInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminStaticPages(input)
  }),

  get: adminProcedure.input(idInput).query(async ({ input }) => {
    await connectDB()
    return await getAdminStaticPage(input.id)
  }),

  create: adminProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.staticpage.create", String(ctx.user._id)), "createStaticPage")
    await connectDB()
    const result = await createStaticPage(input)
    insertLog({ userId: ctx.user._id, action: `Tạo trang tĩnh "${input.title}" (/${result.slug})`, ip: ctx.ip }).catch(() => {})
    return result
  }),

  update: adminProcedure.input(z.object({ id: zObjectId, data: upsertInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.staticpage.update", String(ctx.user._id)), "updateStaticPage")
    await connectDB()
    await updateStaticPage(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật trang tĩnh "${input.data.title}" (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),

  delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.staticpage.del", String(ctx.user._id)), "deleteStaticPage")
    await connectDB()
    await deleteStaticPage(input.id)
    insertLog({ userId: ctx.user._id, action: `Xóa trang tĩnh (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.staticpage.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteStaticPages(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} trang tĩnh`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

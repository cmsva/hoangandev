import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import { CRONJOB_STATUSES, HTTP_METHODS } from "@/models/cronjob.model"
import {
  listAdminServers,
  createServer,
  getServer,
  updateServer,
  deleteServer,
  bulkDeleteCronjobServers,
  bulkDeleteCronjobOrders,
  listAdminCronjobs,
  getAdminCronjob,
  updateAdminCronjob,
  deleteAdminCronjob,
} from "@/services/admin-cronjob.service"

const listInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const serverUpsertInput = z
  .object({
    name: z.string().trim().min(1).max(255),
    price: z.number().min(0).max(1_000_000_000),
    usageLimit: z.number().int().min(0).max(1_000_000),
    timeloop: z.number().int().min(1).max(3600),
    discountPercent: z.number().min(0).max(100).optional(),
    discountValidUntil: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : v === null ? null : undefined)),
    isActive: z.boolean(),
  })
  .strict()

const orderListInput = listInput.extend({
  status: z.enum(CRONJOB_STATUSES).optional(),
})

const orderUpdateInput = z
  .object({
    status: z.enum(CRONJOB_STATUSES),
    url: z.string().trim().max(2048).optional(),
    method: z.enum(HTTP_METHODS).optional(),
    intervalSeconds: z.number().int().min(1).max(31_536_000).optional(),
    headers: z.string().max(8192).nullable().optional(),
    body: z.string().max(16384).nullable().optional(),
    payment: z.number().min(0).max(1_000_000_000).optional(),
    expiresAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
  })
  .strict()

export const adminCronjobRouter = createTRPCRouter({
  // Servers
  listServers: adminProcedure.input(listInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminServers(input)
  }),

  getServer: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getServer(input.id)
    }),

  createServer: adminProcedure
    .input(serverUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.server.create", String(ctx.user._id)), "createServer")
      await connectDB()
      const result = await createServer(input as any)
      insertLog({ userId: ctx.user._id, action: `Tạo máy chủ cronjob "${input.name}" (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateServer: adminProcedure
    .input(z.object({ id: zObjectId, data: serverUpsertInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.server.update", String(ctx.user._id)), "updateServer")
      await connectDB()
      await updateServer(input.id, input.data as any)
      insertLog({ userId: ctx.user._id, action: `Cập nhật máy chủ cronjob "${input.data.name}" (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteServer: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.server.del", String(ctx.user._id)), "deleteServer")
      await connectDB()
      await deleteServer(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa máy chủ cronjob (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  // Cronjobs (orders)
  listOrders: adminProcedure.input(orderListInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminCronjobs(input)
  }),

  getOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getAdminCronjob(input.id)
    }),

  updateOrder: adminProcedure
    .input(z.object({ id: zObjectId, data: orderUpdateInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.order.update", String(ctx.user._id)), "updateCronjob")
      await connectDB()
      await updateAdminCronjob(input.id, input.data as any)
      insertLog({ userId: ctx.user._id, action: `Cập nhật cronjob (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.order.del", String(ctx.user._id)), "deleteCronjob")
      await connectDB()
      await deleteAdminCronjob(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa cronjob (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  bulkDeleteServers: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.server.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteCronjobServers(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} server cronjob`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteOrders: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.cron.order.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteCronjobOrders(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} đơn cronjob`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

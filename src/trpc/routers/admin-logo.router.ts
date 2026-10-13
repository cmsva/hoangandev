import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import { LOGO_ORDER_STATUSES } from "@/models/logo.model"
import {
  listAdminLogoCategories,
  createLogoCategory,
  getLogoCategory,
  updateLogoCategory,
  deleteLogoCategory,
  bulkDeleteLogoCategories,
  bulkDeleteLogos,
  bulkDeleteLogoOrders,
  listAllLogoCategoriesForSelect,
  listAdminLogos,
  createLogo,
  getAdminLogo,
  updateLogo,
  deleteLogo,
  listAdminLogoOrders,
  getLogoOrder,
  updateLogoOrder,
  deleteLogoOrder,
} from "@/services/admin-logo.service"

const listInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const categoryUpsertInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    status: z.number().int().min(0).max(1).optional(),
  })
  .strict()

const logoListInput = listInput.extend({
  categoryId: z.string().optional(),
  status: z.number().int().optional(),
})

const logoUpsertInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).optional(),
    image: z.string().max(500).nullable().optional(),
    categoryId: z.string().min(1).max(48),
    content: z.string().max(200_000).nullable().optional(),
    price: z.number().min(0).max(1_000_000_000),
    status: z.number().int().min(0).max(1).optional(),
    stt: z.number().int().min(0).max(100_000).optional(),
  })
  .strict()

const orderListInput = listInput.extend({
  status: z.enum(LOGO_ORDER_STATUSES).optional(),
})

const orderUpdateInput = z
  .object({
    status: z.enum(LOGO_ORDER_STATUSES),
    shopName: z.string().trim().max(200).optional(),
    customNote: z.string().max(1000).nullable().optional(),
    price: z.number().min(0).max(1_000_000_000).optional(),
    deliveryUrl: z.string().trim().max(2000).nullable().optional(),
    deliveryNote: z.string().max(1000).nullable().optional(),
  })
  .strict()

export const adminLogoRouter = createTRPCRouter({
  // Categories
  listCategories: adminProcedure.input(listInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminLogoCategories(input)
  }),

  categoriesForSelect: adminProcedure.query(async () => {
    await connectDB()
    return await listAllLogoCategoriesForSelect()
  }),

  getCategory: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getLogoCategory(input.id)
    }),

  createCategory: adminProcedure
    .input(categoryUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.cat.create", String(ctx.user._id)), "createLogoCategory")
      await connectDB()
      const result = await createLogoCategory(input)
      insertLog({ userId: ctx.user._id, action: `Tạo danh mục logo "${input.name}" (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateCategory: adminProcedure
    .input(z.object({ id: zObjectId, data: categoryUpsertInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.cat.update", String(ctx.user._id)), "updateLogoCategory")
      await connectDB()
      await updateLogoCategory(input.id, input.data)
      insertLog({ userId: ctx.user._id, action: `Cập nhật danh mục logo "${input.data.name}" (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.cat.del", String(ctx.user._id)), "deleteLogoCategory")
      await connectDB()
      await deleteLogoCategory(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa danh mục logo (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  // Logos
  listLogos: adminProcedure.input(logoListInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminLogos(input)
  }),

  getLogo: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getAdminLogo(input.id)
    }),

  createLogo: adminProcedure
    .input(logoUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.create", String(ctx.user._id)), "createLogo")
      await connectDB()
      const result = await createLogo(input)
      insertLog({ userId: ctx.user._id, action: `Tạo logo "${input.title}" (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateLogo: adminProcedure
    .input(z.object({ id: zObjectId, data: logoUpsertInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.update", String(ctx.user._id)), "updateLogo")
      await connectDB()
      await updateLogo(input.id, input.data)
      insertLog({ userId: ctx.user._id, action: `Cập nhật logo "${input.data.title}" (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteLogo: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.del", String(ctx.user._id)), "deleteLogo")
      await connectDB()
      await deleteLogo(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa logo (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  // Orders
  listOrders: adminProcedure.input(orderListInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminLogoOrders(input)
  }),

  getOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getLogoOrder(input.id)
    }),

  updateOrder: adminProcedure
    .input(z.object({ id: zObjectId, data: orderUpdateInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.order.update", String(ctx.user._id)), "updateLogoOrder")
      await connectDB()
      const res = await updateLogoOrder(input.id, input.data as any)
      insertLog({ userId: ctx.user._id, action: `Cập nhật đơn logo (${input.id})`, ip: ctx.ip }).catch(() => {})

      // Notify customer khi status đổi (mail + tele user) — best-effort
      if (res.ownerId && res.statusChanged) {
        void import("@/services/notify.service").then((m) =>
          m.notifyOrderStatus({
            userId: res.ownerId!,
            orderType: "Logo",
            orderName: res.logoTitle,
            status: res.status,
          })
        )
      }

      return { success: true }
    }),

  deleteOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.order.del", String(ctx.user._id)), "deleteLogoOrder")
      await connectDB()
      await deleteLogoOrder(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa đơn logo (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  bulkDeleteCategories: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.cat.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteLogoCategories(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} danh mục logo`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteLogos: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteLogos(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} logo`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteOrders: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.logo.order.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteLogoOrders(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} đơn logo`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

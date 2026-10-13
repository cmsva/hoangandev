import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  listAdminCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  listAdminProducts,
  listAllCategoriesForSelect,
  createProduct,
  getAdminProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProductCategories,
  bulkDeleteProducts,
  bulkDeleteProductOrders,
  listAdminOrders,
  getProductOrder,
  updateProductOrder,
  deleteProductOrder,
} from "@/services/admin-product.service"

// ─── Input schemas ──────────────────────────────────────────────────────────

const listCategoriesInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const categoryUpsertInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).optional(),
    thumbnail: z.string().url().nullable().optional().or(z.string().startsWith("/").nullable().optional()),
    status: z.number().int().min(0).max(1).optional(),
  })
  .strict()

const listProductsInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
    categoryId: z.string().optional(),
    status: z.number().int().optional(),
  })
  .strict()

const productUpsertInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    detail: z.string().max(200_000).nullable().optional(), // CKEditor HTML — cap 200KB
    price: z.number().min(0).max(1_000_000_000),
    salePrice: z.number().min(0).max(1_000_000_000).nullable().optional(),
    discountPercentage: z.number().min(0).max(100).nullable().optional(),
    categoryId: z.string().min(1).max(48),
    thumbnail: z.string().max(500).nullable().optional(),
    images: z.array(z.string().max(500)).max(20).default([]),
    fileUrl: z.string().trim().min(1).max(2000),
    status: z.number().int().min(0).max(1).optional(),
    isFree: z.boolean().optional(),
    approved: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  })
  .strict()

const listOrdersInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const orderUpdateInput = z
  .object({
    totalPrice: z.number().min(0).max(1_000_000_000).optional(),
    orderDate: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
  })
  .strict()

// ─── Router ─────────────────────────────────────────────────────────────────

export const adminProductRouter = createTRPCRouter({
  // ─── Categories ─────────────────────────────────────────────────────────
  listCategories: adminProcedure
    .input(listCategoriesInput)
    .query(async ({ input }) => {
      await connectDB()
      return await listAdminCategories(input)
    }),

  categoriesForSelect: adminProcedure.query(async () => {
    await connectDB()
    return await listAllCategoriesForSelect()
  }),

  getCategory: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getCategory(input.id)
    }),

  createCategory: adminProcedure
    .input(categoryUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.cat.create", String(ctx.user._id)), "createCategory")
      await connectDB()
      const result = await createCategory(input)
      insertLog({ userId: ctx.user._id, action: `Tạo danh mục mã nguồn "${input.name}" (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateCategory: adminProcedure
    .input(
      z
        .object({
          id: zObjectId,
          data: categoryUpsertInput,
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.cat.update", String(ctx.user._id)), "updateCategory")
      await connectDB()
      await updateCategory(input.id, input.data)
      insertLog({ userId: ctx.user._id, action: `Cập nhật danh mục mã nguồn "${input.data.name}" (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.cat.del", String(ctx.user._id)), "deleteCategory")
      await connectDB()
      await deleteCategory(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa danh mục mã nguồn (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  // ─── Products ───────────────────────────────────────────────────────────
  listProducts: adminProcedure
    .input(listProductsInput)
    .query(async ({ input }) => {
      await connectDB()
      return await listAdminProducts(input)
    }),

  getProduct: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getAdminProduct(input.id)
    }),

  createProduct: adminProcedure
    .input(productUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.create", String(ctx.user._id)), "createProduct")
      await connectDB()
      const result = await createProduct(input)
      insertLog({ userId: ctx.user._id, action: `Tạo mã nguồn "${input.title}" (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateProduct: adminProcedure
    .input(
      z
        .object({
          id: zObjectId,
          data: productUpsertInput,
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.update", String(ctx.user._id)), "updateProduct")
      await connectDB()
      await updateProduct(input.id, input.data)
      insertLog({ userId: ctx.user._id, action: `Cập nhật mã nguồn "${input.data.title}" (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.del", String(ctx.user._id)), "deleteProduct")
      await connectDB()
      await deleteProduct(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa mã nguồn (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  // ─── Orders ─────────────────────────────────────────────────────────────
  listOrders: adminProcedure
    .input(listOrdersInput)
    .query(async ({ input }) => {
      await connectDB()
      return await listAdminOrders(input)
    }),

  getOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getProductOrder(input.id)
    }),

  updateOrder: adminProcedure
    .input(z.object({ id: zObjectId, data: orderUpdateInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.order.update", String(ctx.user._id)), "updateProductOrder")
      await connectDB()
      await updateProductOrder(input.id, input.data as any)
      insertLog({ userId: ctx.user._id, action: `Cập nhật đơn mã nguồn (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.order.del", String(ctx.user._id)), "deleteProductOrder")
      await connectDB()
      await deleteProductOrder(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa đơn mã nguồn (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  bulkDeleteCategories: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.cat.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteProductCategories(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} danh mục`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteProducts: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteProducts(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} sản phẩm`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteOrders: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.product.order.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteProductOrders(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} đơn hàng`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

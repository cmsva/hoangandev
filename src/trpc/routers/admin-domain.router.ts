import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import { ORDER_DOMAIN_STATUSES } from "@/models/domain.model"
import {
  listAdminTlds,
  createTld,
  getTld,
  updateTld,
  deleteTld,
  bulkDeleteTlds,
  bulkDeleteDomainOrders,
  listAdminDomainOrders,
  getDomainOrder,
  getSpaceshipConfig,
  testSpaceshipConfig,
  updateDomainOrder,
  upsertSpaceshipConfig,
  deleteDomainOrder,
} from "@/services/admin-domain.service"
import { syncSpaceshipTlds } from "@/services/spaceship-pricing.service"

// ─── Schemas ────────────────────────────────────────────────────────────────

const listInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const tldUpsertInput = z
  .object({
    tld: z.string().trim().min(1).max(64),
    priceCost: z.number().min(0).max(1_000_000_000),
    renewCost: z.number().min(0).max(1_000_000_000),
    priceSold: z.number().min(0).max(1_000_000_000),
    renewSold: z.number().min(0).max(1_000_000_000),
    provider: z.enum(["manual", "spaceship"]).default("manual"),
    providerTld: z.string().trim().max(64).nullable().optional(),
    autoRegisterEnabled: z.boolean().default(false),
    autoRenewEnabled: z.boolean().default(false),
    markupType: z.enum(["fixed", "percent"]).nullable().optional(),
    markupValue: z.number().min(0).max(1_000_000_000).default(0),
    isActive: z.boolean(),
  })
  .strict()

const orderListInput = listInput.extend({
  status: z.enum(ORDER_DOMAIN_STATUSES).optional(),
})

const spaceshipConfigInput = z.object({
  name: z.string().trim().min(1).max(191).default("Spaceship"),
  apiKey: z.string().trim().max(512).optional(),
  apiSecret: z.string().trim().max(512).optional(),
  contactId: z.string().trim().min(1).max(191),
  autoRegisterEnabled: z.boolean().default(false),
  autoRenewEnabled: z.boolean().default(false),
  markupType: z.enum(["fixed", "percent"]).default("fixed"),
  markupValue: z.number().min(0).max(1_000_000_000).default(0),
  usdToVndRate: z.number().min(1).max(10_000_000).default(26000),
  syncSlugs: z.array(z.string().trim().max(64)).max(500).default([]),
  status: z.enum(["active", "disabled"]).default("disabled"),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict()

const orderUpdateInput = z
  .object({
    status: z.enum(ORDER_DOMAIN_STATUSES),
    ns1: z.string().max(253).optional(),
    ns2: z.string().max(253).optional(),
    totalAmount: z.number().min(0).max(1_000_000_000).optional(),
    renewAmount: z.number().min(0).max(1_000_000_000).nullable().optional(),
    expiredAt: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : v === null ? null : undefined)),
    adminNote: z.string().max(5000).nullable().optional(),
  })
  .strict()

// ─── Router ─────────────────────────────────────────────────────────────────

export const adminDomainRouter = createTRPCRouter({
  // ─── TLD pricing ────────────────────────────────────────────────────────
  listTlds: adminProcedure.input(listInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminTlds(input)
  }),

  getTld: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getTld(input.id)
    }),

  createTld: adminProcedure
    .input(tldUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.tld.create", String(ctx.user._id)), "createTld")
      await connectDB()
      const result = await createTld(input)
      insertLog({ userId: ctx.user._id, action: `Tạo TLD .${input.tld} (${result.id})`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateTld: adminProcedure
    .input(z.object({ id: zObjectId, data: tldUpsertInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.tld.update", String(ctx.user._id)), "updateTld")
      await connectDB()
      await updateTld(input.id, input.data)
      insertLog({ userId: ctx.user._id, action: `Cập nhật TLD .${input.data.tld} (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  deleteTld: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.tld.del", String(ctx.user._id)), "deleteTld")
      await connectDB()
      await deleteTld(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa TLD (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  getSpaceshipConfig: adminProcedure.query(async () => {
    await connectDB()
    return getSpaceshipConfig()
  }),

  upsertSpaceshipConfig: adminProcedure
    .input(spaceshipConfigInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.spaceship.config", String(ctx.user._id)), "spaceshipConfig")
      await connectDB()
      const result = await upsertSpaceshipConfig(input)
      insertLog({ userId: ctx.user._id, action: "Cập nhật cấu hình Spaceship", ip: ctx.ip }).catch(() => {})
      return result
    }),

  testSpaceshipConfig: adminProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.domain.spaceship.test", String(ctx.user._id)), "spaceshipTest")
    await connectDB()
    return testSpaceshipConfig()
  }),

  syncTldsFromSpaceship: adminProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.domain.spaceship.sync", String(ctx.user._id)), "spaceshipSync")
    await connectDB()
    const result = await syncSpaceshipTlds()
    insertLog({
      userId: ctx.user._id,
      action: `Đồng bộ giá Spaceship: +${result.inserted} mới, ${result.updated} cập nhật, ${result.skipped} bỏ qua`,
      ip: ctx.ip,
    }).catch(() => {})
    return result
  }),

  // ─── Orders ─────────────────────────────────────────────────────────────
  listOrders: adminProcedure.input(orderListInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminDomainOrders(input)
  }),

  getOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ input }) => {
      await connectDB()
      return await getDomainOrder(input.id)
    }),

  updateOrder: adminProcedure
    .input(z.object({ id: zObjectId, data: orderUpdateInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.order.update", String(ctx.user._id)), "updateDomainOrder")
      await connectDB()
      const res = await updateDomainOrder(input.id, input.data as any)
      insertLog({ userId: ctx.user._id, action: `Cập nhật đơn domain (${input.id})`, ip: ctx.ip }).catch(() => {})

      // Notify customer khi status đổi (mail + tele user) — best-effort
      if (res.ownerId && res.statusChanged) {
        void import("@/services/notify.service").then((m) =>
          m.notifyOrderStatus({
            userId: res.ownerId!,
            orderType: "Domain",
            orderName: res.orderName,
            status: res.status,
          })
        )
      }

      return { success: true }
    }),

  deleteOrder: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.order.del", String(ctx.user._id)), "deleteDomainOrder")
      await connectDB()
      await deleteDomainOrder(input.id)
      insertLog({ userId: ctx.user._id, action: `Xóa đơn domain (${input.id})`, ip: ctx.ip }).catch(() => {})
      return { success: true }
    }),

  bulkDeleteTlds: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.tld.bulkDel", String(ctx.user._id)), "admin.domain.tld.bulkDel")
      await connectDB()
      const result = await bulkDeleteTlds(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} TLD`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteOrders: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.domain.order.bulkDel", String(ctx.user._id)), "admin.domain.order.bulkDel")
      await connectDB()
      const result = await bulkDeleteDomainOrders(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} đơn domain`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

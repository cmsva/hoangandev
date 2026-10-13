/**
 * Admin Deposit Router — Thin tRPC layer for admin tài chính.
 *
 * Procedures:
 *   - Bank invoices: getAdminBankStats, getAdminInvoices, updateInvoiceStatus
 *   - Bank config:   getAdminBankConfig, updateAdminBankConfig
 *   - Bank entries:  getAdminBanks, getAdminBankRaw, addAdminBank, updateAdminBank, deleteAdminBank
 *   - Card history:  getAdminCardStats, getAdminCards
 *   - Card config:   getAdminCardConfig, updateAdminCardConfig
 *   - Telco CRUD:    getAdminTelcos, addAdminTelco, updateAdminTelco, deleteAdminTelco,
 *                    bulkDeleteAdminTelcos, syncTelcosFromApi
 *   - Promotions:    getAdminPromotions, addAdminPromotion, updateAdminPromotion,
 *                    deleteAdminPromotion
 */
import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  // Bank invoices
  getAdminBankStats,
  listAdminInvoices,
  updateInvoiceStatus,
  // Bank config
  getAdminBankConfig,
  updateAdminBankConfig,
  // Bank entries
  listAdminBanks,
  getAdminBankRaw,
  addAdminBank,
  updateAdminBank,
  deleteAdminBank,
  // Card invoices
  getAdminCardStats,
  listAdminCards,
  // Card config
  getAdminCardConfig,
  updateAdminCardConfig,
  // Telco CRUD
  listAdminTelcos,
  addAdminTelco,
  updateAdminTelco,
  deleteAdminTelco,
  bulkDeleteAdminTelcos,
  syncTelcosFromApi,
  // Promotions
  listAdminPromotions,
  addAdminPromotion,
  updateAdminPromotion,
  deleteAdminPromotion,
  bulkDeleteBanks,
} from "@/services/admin-deposit.service"

const bankWriteInput = z.object({
  shortName: z.string().min(1).max(50),
  accountNumber: z.string().min(1).max(50),
  accountName: z.string().min(1).max(100),
  status: z.number().min(0).max(1),
  apiProvider: z.string().nullable().optional(),
  apiToken: z.string().max(2000).optional(),
  bankUsername: z.string().max(200).optional(),
  bankPassword: z.string().max(200).optional(),
  deviceId: z.string().max(100).optional(),
})

const telcoWriteInput = z.object({
  telco: z.string().min(1).max(20),
  img: z.string().max(500).default(""),
  value: z.number().int().min(1),
  fees: z.number().min(0).max(100).default(0),
  penalty: z.number().min(0).max(100).default(0),
})

export const adminDepositRouter = createTRPCRouter({
  // ═══════════════════════════════════════════════════════════
  //  BANK INVOICES
  // ═══════════════════════════════════════════════════════════
  getAdminBankStats: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.bank.stats", String(ctx.user._id)), "admin.bank.stats")
    await connectDB()
    return await getAdminBankStats()
  }),

  getAdminInvoices: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(1000).default(500) }).strict().optional())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("admin.invoices", String(ctx.user._id)), "admin.invoices")
      await connectDB()
      return await listAdminInvoices(input?.limit ?? 500)
    }),

  updateInvoiceStatus: adminProcedure
    .input(z.object({ id: zObjectId, status: z.number().int().min(0).max(2) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.invoice.status", String(ctx.user._id)), "admin.invoice.status")
      await connectDB()
      const result = await updateInvoiceStatus({
        id: input.id,
        status: input.status as 0 | 1 | 2,
        adminId: String(ctx.user._id),
        adminName: ctx.user.username || "admin",
      })
      insertLog({
        userId: ctx.user._id,
        action: `Admin ${input.status === 1 ? "duyệt" : "từ chối"} hóa đơn ${result.transId}`,
        ip: ctx.ip,
      }).catch(() => {})
      return result
    }),

  // ═══════════════════════════════════════════════════════════
  //  BANK CONFIG
  // ═══════════════════════════════════════════════════════════
  getAdminBankConfig: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.bank.config", String(ctx.user._id)), "admin.bank.config")
    await connectDB()
    return await getAdminBankConfig()
  }),

  updateAdminBankConfig: adminProcedure
    .input(
      z.object({
        bankStatus: z.boolean().optional(),
        bankMin: z.number().int().min(0).optional(),
        bankMax: z.number().int().min(0).optional(),
        prefix: z.string().max(10).optional(),
        typeRandom: z.number().int().min(0).max(2).optional(),
        rangeRandom: z.number().int().min(4).max(20).optional(),
        timeInvoices: z.number().int().min(60).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.bank.config.write", String(ctx.user._id)), "admin.bank.config")
      await connectDB()
      const result = await updateAdminBankConfig(input)
      insertLog({ userId: ctx.user._id, action: "Admin cập nhật cấu hình ngân hàng", ip: ctx.ip }).catch(() => {})
      return result
    }),

  // ═══════════════════════════════════════════════════════════
  //  BANK ENTRIES
  // ═══════════════════════════════════════════════════════════
  getAdminBanks: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.banks", String(ctx.user._id)), "admin.banks")
    await connectDB()
    return await listAdminBanks()
  }),

  getAdminBankRaw: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("admin.bank.raw", String(ctx.user._id)), "admin.bank.raw")
      await connectDB()
      return await getAdminBankRaw(input.id)
    }),

  addAdminBank: adminProcedure
    .input(bankWriteInput.strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.bank.add", String(ctx.user._id)), "admin.bank.add")
      await connectDB()
      const result = await addAdminBank(input)
      insertLog({ userId: ctx.user._id, action: `Admin thêm ngân hàng ${input.shortName} - ${input.accountNumber}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateAdminBank: adminProcedure
    .input(bankWriteInput.extend({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.bank.update", String(ctx.user._id)), "admin.bank.update")
      await connectDB()
      const result = await updateAdminBank(input)
      insertLog({ userId: ctx.user._id, action: `Admin cập nhật ngân hàng ${input.shortName}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  deleteAdminBank: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.bank.delete", String(ctx.user._id)), "admin.bank.delete")
      await connectDB()
      const result = await deleteAdminBank(input.id)
      insertLog({ userId: ctx.user._id, action: `Admin xóa ngân hàng ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  // ═══════════════════════════════════════════════════════════
  //  CARD INVOICES
  // ═══════════════════════════════════════════════════════════
  getAdminCardStats: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.card.stats", String(ctx.user._id)), "admin.card.stats")
    await connectDB()
    return await getAdminCardStats()
  }),

  getAdminCards: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(1000).default(500) }).strict().optional())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("admin.cards", String(ctx.user._id)), "admin.cards")
      await connectDB()
      return await listAdminCards(input?.limit ?? 500)
    }),

  // ═══════════════════════════════════════════════════════════
  //  CARD CONFIG
  // ═══════════════════════════════════════════════════════════
  getAdminCardConfig: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.card.config", String(ctx.user._id)), "admin.card.config")
    await connectDB()
    return await getAdminCardConfig()
  }),

  updateAdminCardConfig: adminProcedure
    .input(
      z.object({
        cardStatus: z.boolean().optional(),
        partnerId: z.string().max(100).optional(),
        partnerKey: z.string().max(200).optional(),
        cardCk: z.number().min(0).max(100).optional(),
        urlApi: z.string().max(500).optional(),
        cardNotice: z.string().max(2000).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.card.config.write", String(ctx.user._id)), "admin.card.config")
      await connectDB()
      const result = await updateAdminCardConfig(input)
      insertLog({ userId: ctx.user._id, action: "Admin cập nhật cấu hình thẻ cào", ip: ctx.ip }).catch(() => {})
      return result
    }),

  // ═══════════════════════════════════════════════════════════
  //  TELCO CRUD
  // ═══════════════════════════════════════════════════════════
  getAdminTelcos: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.telcos", String(ctx.user._id)), "admin.telcos")
    await connectDB()
    return await listAdminTelcos()
  }),

  addAdminTelco: adminProcedure
    .input(telcoWriteInput.strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.telco.add", String(ctx.user._id)), "admin.telco.add")
      await connectDB()
      const result = await addAdminTelco(input)
      insertLog({ userId: ctx.user._id, action: `Admin thêm mệnh giá ${input.telco} ${input.value}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  updateAdminTelco: adminProcedure
    .input(
      z.object({
        id: zObjectId,
        telco: z.string().min(1).max(20).optional(),
        img: z.string().max(500).optional(),
        value: z.number().int().min(1).optional(),
        fees: z.number().min(0).max(100).optional(),
        penalty: z.number().min(0).max(100).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.telco.update", String(ctx.user._id)), "admin.telco.update")
      await connectDB()
      const result = await updateAdminTelco(input)
      insertLog({ userId: ctx.user._id, action: `Admin cập nhật telco ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  deleteAdminTelco: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.telco.delete", String(ctx.user._id)), "admin.telco.delete")
      await connectDB()
      const result = await deleteAdminTelco(input.id)
      insertLog({ userId: ctx.user._id, action: `Admin xóa telco ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteAdminTelcos: adminProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.telco.bulk", String(ctx.user._id)), "admin.telco.bulk")
      await connectDB()
      const result = await bulkDeleteAdminTelcos(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin xóa hàng loạt ${result.deleted} telco`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  syncTelcosFromApi: adminProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.telco.sync", String(ctx.user._id)), "admin.telco.sync")
    await connectDB()
    const result = await syncTelcosFromApi()
    insertLog({
      userId: ctx.user._id,
      action: `Đồng bộ telco từ API: thêm ${result.inserted}, cập nhật ${result.updated}`,
      ip: ctx.ip,
    }).catch(() => {})
    return result
  }),

  // ═══════════════════════════════════════════════════════════
  //  PROMOTIONS
  // ═══════════════════════════════════════════════════════════
  getAdminPromotions: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.promotions", String(ctx.user._id)), "admin.promotions")
    await connectDB()
    return await listAdminPromotions()
  }),

  addAdminPromotion: adminProcedure
    .input(z.object({ amount: z.number().int().min(1), discount: z.number().min(0).max(100) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.promo.add", String(ctx.user._id)), "admin.promo.add")
      await connectDB()
      const result = await addAdminPromotion(input)
      insertLog({
        userId: ctx.user._id,
        action: `Admin thêm khuyến mãi nạp: ${input.amount.toLocaleString("vi-VN")}đ +${input.discount}%`,
        ip: ctx.ip,
      }).catch(() => {})
      return result
    }),

  updateAdminPromotion: adminProcedure
    .input(
      z.object({
        id: zObjectId,
        amount: z.number().int().min(1).optional(),
        discount: z.number().min(0).max(100).optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.promo.update", String(ctx.user._id)), "admin.promo.update")
      await connectDB()
      const result = await updateAdminPromotion(input)
      insertLog({ userId: ctx.user._id, action: `Admin cập nhật khuyến mãi ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  deleteAdminPromotion: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.promo.delete", String(ctx.user._id)), "admin.promo.delete")
      await connectDB()
      const result = await deleteAdminPromotion(input.id)
      insertLog({ userId: ctx.user._id, action: `Admin xóa khuyến mãi ${input.id}`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteBanks: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.deposit.bank.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteBanks(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} ngân hàng`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})

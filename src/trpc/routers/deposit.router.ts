/**
 * Deposit Router — Thin tRPC layer cho nạp tiền ngân hàng.
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, mutationLimiter, strictLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getActiveBanks,
  getDepositSettings,
  getPromotions,
  createInvoice,
  cancelInvoice,
  checkInvoiceStatus,
  getInvoices,
} from "@/services/deposit.service"

export const depositRouter = createTRPCRouter({
  getBanks: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("deposit.banks", String(ctx.user._id)), "deposit.banks")
    await connectDB()
    return await getActiveBanks()
  }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("deposit.settings", String(ctx.user._id)), "deposit.settings")
    await connectDB()
    return await getDepositSettings()
  }),

  getPromotions: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("deposit.promos", String(ctx.user._id)), "deposit.promos")
    await connectDB()
    return await getPromotions()
  }),

  createInvoice: protectedProcedure
    .input(z.object({ bankId: z.string().min(1), amount: z.number().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("deposit.create", String(ctx.user._id)), "deposit.create")
      await connectDB()
      const result = await createInvoice(ctx.user._id, input.bankId, input.amount)
      insertLog({
        userId: ctx.user._id,
        action: `Tạo hóa đơn nạp tiền - ${result.transId} - ${result.bankShortName}`,
        ip: ctx.ip,
      }).catch(() => {})
      return result
    }),

  cancelInvoice: protectedProcedure
    .input(z.object({ transId: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("deposit.cancel", String(ctx.user._id)), "deposit.cancel")
      await connectDB()
      const result = await cancelInvoice(ctx.user._id, input.transId)
      insertLog({
        userId: ctx.user._id,
        action: `Hủy hóa đơn - ${input.transId}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { ...result, message: "Hủy hóa đơn thành công" }
    }),

  checkStatus: protectedProcedure
    .input(z.object({ transId: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("deposit.status", String(ctx.user._id)), "deposit.status")
      await connectDB()
      return await checkInvoiceStatus(ctx.user._id, input.transId)
    }),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("deposit.invoices", String(ctx.user._id)), "deposit.invoices")
    await connectDB()
    return await getInvoices(ctx.user._id)
  }),
})

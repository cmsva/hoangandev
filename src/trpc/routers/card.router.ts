/**
 * Card Router — Thin tRPC layer cho nạp thẻ cào.
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, mutationLimiter, strictLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getCardSettings,
  getTelcos,
  getAmountsByTelco,
  submitCard,
  getCardHistory,
} from "@/services/card.service"

export const cardRouter = createTRPCRouter({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("card.settings", String(ctx.user._id)), "card.settings")
    await connectDB()
    return await getCardSettings()
  }),

  getTelcos: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("card.telcos", String(ctx.user._id)), "card.telcos")
    await connectDB()
    return await getTelcos()
  }),

  getAmounts: protectedProcedure
    .input(z.object({ telco: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("card.amounts", String(ctx.user._id)), "card.amounts")
      await connectDB()
      return await getAmountsByTelco(input.telco)
    }),

  submit: protectedProcedure
    .input(
      z.object({
        telco: z.string().min(1),
        amount: z.number().min(1),
        serial: z.string().min(1).max(20),
        pin: z.string().min(1).max(20),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("card.submit", String(ctx.user._id)), "card.submit")
      await connectDB()
      const result = await submitCard(ctx.user._id, input.telco, input.amount, input.serial, input.pin)
      insertLog({
        userId: ctx.user._id,
        action: `Nạp thẻ ${input.telco} - ${input.amount}đ - Serial: ${input.serial}`,
        ip: ctx.ip,
      }).catch(() => {})
      return result
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("card.history", String(ctx.user._id)), "card.history")
    await connectDB()
    return await getCardHistory(ctx.user._id)
  }),
})

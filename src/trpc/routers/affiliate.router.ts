/**
 * Affiliate Router — Thin tRPC layer cho chương trình giới thiệu.
 *
 * Mỗi procedure: rate-limit → connectDB → delegate to service → audit log.
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getAffiliateConfig,
  getAffiliateStats,
  getCommissionHistory,
  getWithdrawHistory,
  withdrawToBalance,
  withdrawToBank,
} from "@/services/affiliate.service"

// ─── Schemas ───────────────────────────────────────────────────────────────

const paginateSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  })
  .strict()
  .optional()

const withdrawBalanceSchema = z
  .object({
    amount: z.number().int().min(1).max(10_000_000_000),
  })
  .strict()

const withdrawBankSchema = z
  .object({
    amount: z.number().int().min(1).max(10_000_000_000),
    bank: z.string().trim().min(1).max(20),
    stk: z.string().trim().min(4).max(30).regex(/^[0-9]+$/, "STK chỉ chứa số"),
    name: z.string().trim().min(2).max(80),
  })
  .strict()

// ─── Router ────────────────────────────────────────────────────────────────

export const affiliateRouter = createTRPCRouter({
  /** Cấu hình affiliate (status enabled, min/max, methods enabled). */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("aff.config", String(ctx.user._id)),
      "aff.config"
    )
    await connectDB()
    return await getAffiliateConfig()
  }),

  /** Stats hoa hồng + memberCount + tổng đã rút. */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("aff.stats", String(ctx.user._id)),
      "aff.stats"
    )
    await connectDB()
    return await getAffiliateStats(ctx.user._id)
  }),

  /** Lịch sử hoa hồng (paginate server-side). */
  getHistory: protectedProcedure.input(paginateSchema).query(async ({ ctx, input }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("aff.history", String(ctx.user._id)),
      "aff.history"
    )
    await connectDB()
    return await getCommissionHistory(ctx.user._id, input)
  }),

  /** Lịch sử rút tiền (paginate server-side). */
  getWithdrawHistory: protectedProcedure
    .input(paginateSchema)
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("aff.wd-history", String(ctx.user._id)),
        "aff.wd-history"
      )
      await connectDB()
      return await getWithdrawHistory(ctx.user._id, input)
    }),

  /** Rút về số dư chính (auto-approved). */
  withdrawToBalance: protectedProcedure
    .input(withdrawBalanceSchema)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("aff.wd-balance", String(ctx.user._id)),
        "aff.wd-balance"
      )
      await connectDB()

      const result = await withdrawToBalance(ctx.user._id, input.amount)

      // Audit log (best-effort — không throw)
      insertLog({
        userId: ctx.user._id,
        action: `Rút hoa hồng về số dư ${input.amount}đ — transId ${result.transId}`,
        ip: ctx.ip,
      }).catch(() => {})

      return result
    }),

  /** Rút về tài khoản ngân hàng (chờ admin duyệt). */
  withdrawToBank: protectedProcedure
    .input(withdrawBankSchema)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("aff.wd-bank", String(ctx.user._id)),
        "aff.wd-bank"
      )
      await connectDB()

      const result = await withdrawToBank(ctx.user._id, input)

      insertLog({
        userId: ctx.user._id,
        action: `Yêu cầu rút hoa hồng ${input.amount}đ về ${input.bank} (${input.stk}) — transId ${result.transId}`,
        ip: ctx.ip,
      }).catch(() => {})

      return result
    }),
})

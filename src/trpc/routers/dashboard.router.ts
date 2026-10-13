/**
 * Dashboard router — thin tRPC layer.
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import {
  getBalanceChartData,
  getDashboardStats,
  getRecentActivity,
  getRecentTransactions,
  getActivityLogsPaginated,
  getTransactionsPaginated,
} from "@/services/dashboard.service"

const paginatedInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(10),
    search: z.string().max(100).optional(),
  })
  .strict()

export const dashboardRouter = createTRPCRouter({
  stats: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("dashboard.stats", String(ctx.user._id)), "stats")
    await connectDB()

    const stats = await getDashboardStats(ctx.user._id as any)
    return {
      balance: ctx.user.money ?? 0,
      totalDeposit: ctx.user.totalMoney ?? 0,
      ...stats,
    }
  }),

  recentTransactions: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("dashboard.recentTx", String(ctx.user._id)), "recentTx")
    await connectDB()
    return await getRecentTransactions(ctx.user._id as any)
  }),

  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("dashboard.recentAct", String(ctx.user._id)), "recentAct")
    await connectDB()
    return await getRecentActivity(ctx.user._id as any)
  }),

  chartData: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("dashboard.chart", String(ctx.user._id)), "chart")
    await connectDB()
    return await getBalanceChartData(ctx.user._id as any)
  }),

  myLogs: protectedProcedure
    .input(paginatedInput)
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("dashboard.myLogs", String(ctx.user._id)), "myLogs")
      await connectDB()
      return await getActivityLogsPaginated(ctx.user._id as any, input)
    }),

  myTransactions: protectedProcedure
    .input(paginatedInput)
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("dashboard.myTx", String(ctx.user._id)), "myTx")
      await connectDB()
      return await getTransactionsPaginated(ctx.user._id as any, input)
    }),
})

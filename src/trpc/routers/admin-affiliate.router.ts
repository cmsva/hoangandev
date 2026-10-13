import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { composeKey, consumeRateLimit, mutationLimiter, readLimiter } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getAdminAffiliateConfig,
  getAdminAffiliateStats,
  listAdminAffiliateLogs,
  listAdminAffiliateWithdraws,
  updateAdminAffiliateConfig,
  updateAdminAffiliateWithdrawStatus,
} from "@/services/admin-affiliate.service"

const listInput = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().trim().max(100).optional(),
  })
  .strict()

const withdrawListInput = listInput.extend({
  status: z.number().int().min(0).max(2).optional(),
})

const withdrawStatusInput = z
  .object({
    id: zObjectId,
    status: z.union([z.literal(1), z.literal(2)]),
    reason: z.string().trim().max(200).optional(),
  })
  .strict()

const configInput = z
  .object({
    enabled: z.boolean(),
    rate: z.number().min(0).max(100),
    minWithdraw: z.number().int().min(0).max(10_000_000_000),
    maxWithdraw: z.number().int().min(0).max(10_000_000_000),
    minDeposit: z.number().int().min(0).max(10_000_000_000),
    maxDeposit: z.number().int().min(0).max(10_000_000_000),
    balanceEnabled: z.boolean(),
    bankEnabled: z.boolean(),
  })
  .strict()
export const adminAffiliateRouter = createTRPCRouter({
  getStats: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.aff.stats", String(ctx.user._id)), "admin.aff.stats")
    await connectDB()
    return await getAdminAffiliateStats()
  }),

  listLogs: adminProcedure.input(listInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.aff.logs", String(ctx.user._id)), "admin.aff.logs")
    await connectDB()
    return await listAdminAffiliateLogs(input)
  }),

  listWithdraws: adminProcedure.input(withdrawListInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.aff.withdraw", String(ctx.user._id)), "admin.aff.withdraw")
    await connectDB()
    return await listAdminAffiliateWithdraws(input)
  }),

  updateWithdrawStatus: adminProcedure.input(withdrawStatusInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(
      mutationLimiter,
      composeKey("admin.aff.withdraw.write", String(ctx.user._id)),
      "admin.aff.withdraw.write"
    )
    await connectDB()
    const result = await updateAdminAffiliateWithdrawStatus(input)
    insertLog({
      userId: ctx.user._id,
      action: `Admin ${input.status === 1 ? "duyệt" : "từ chối"} rút affiliate ${input.id}`,
      ip: ctx.ip,
    }).catch(() => {})
    return result
  }),

  getConfig: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.aff.config", String(ctx.user._id)), "admin.aff.config")
    await connectDB()
    return await getAdminAffiliateConfig()
  }),

  updateConfig: adminProcedure.input(configInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(
      mutationLimiter,
      composeKey("admin.aff.config.write", String(ctx.user._id)),
      "admin.aff.config.write"
    )
    await connectDB()
    const result = await updateAdminAffiliateConfig(input)
    insertLog({ userId: ctx.user._id, action: "Admin cập nhật cấu hình affiliate", ip: ctx.ip }).catch(() => {})
    return result
  }),
})

/**
 * Admin Rewards router — chỉnh tỉ lệ quy đổi điểm thưởng.
 */
import { z } from "zod"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getRewardConfig,
  saveRewardConfig,
} from "@/services/rewards.service"

export const adminRewardsRouter = createTRPCRouter({
  /** Đọc cấu hình rewards (cho admin tab) */
  getConfig: adminProcedure.query(async () => {
    await connectDB()
    return getRewardConfig()
  }),

  /** Cập nhật cấu hình */
  saveConfig: adminProcedure
    .input(
      z
        .object({
          earnVndPerPoint: z.number().int().min(1).max(10_000_000).optional(),
          redeemVndPerPoint: z.number().int().min(1).max(10_000_000).optional(),
          redeemMinPoints: z.number().int().min(1).max(10_000_000).optional(),
          enabled: z.boolean().optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.rewards.save", String(ctx.user._id)),
        "admin.rewards.save"
      )
      await connectDB()
      await saveRewardConfig(input)
      insertLog({
        userId: ctx.user._id,
        action: `Cập nhật cấu hình điểm thưởng: ${JSON.stringify(input)}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true, message: "Đã lưu cấu hình" }
    }),
})

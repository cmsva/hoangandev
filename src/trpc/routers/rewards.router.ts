/**
 * Rewards router — thin tRPC layer cho user (rewards page).
 *
 * Pattern: auth → rate-limit → connect → delegate vào service.
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
  getRewardConfig,
  getRewardSummary,
  listRewardHistory,
  redeemPointsToBalance,
} from "@/services/rewards.service"
import { REWARD_LOG_TYPES } from "@/models/reward-log.model"

export const rewardsRouter = createTRPCRouter({
  /** Cấu hình quy đổi (public cho user — chỉ tỉ lệ, không nhạy cảm) */
  config: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("rewards.config", String(ctx.user._id)),
      "rewards.config"
    )
    await connectDB()
    return getRewardConfig()
  }),

  /** Số điểm + tổng đã nhận / đã đổi */
  summary: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("rewards.summary", String(ctx.user._id)),
      "rewards.summary"
    )
    await connectDB()
    return getRewardSummary(ctx.user._id)
  }),

  /** Lịch sử điểm thưởng phân trang */
  history: protectedProcedure
    .input(
      z
        .object({
          type: z.enum([...REWARD_LOG_TYPES, "all"] as const).default("all"),
          search: z.string().trim().max(200).optional(),
          page: z.number().int().min(1).max(10000).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("rewards.history", String(ctx.user._id)),
        "rewards.history"
      )
      await connectDB()
      return listRewardHistory(ctx.user._id, input)
    }),

  /** Đổi điểm sang số dư */
  redeem: protectedProcedure
    .input(
      z
        .object({
          points: z.number().int().min(1).max(10_000_000),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("rewards.redeem", String(ctx.user._id)),
        "rewards.redeem"
      )
      await connectDB()
      const result = await redeemPointsToBalance(ctx.user._id, input.points)
      insertLog({
        userId: ctx.user._id,
        action: `Đổi ${input.points} điểm thưởng = ${result.vndAdded.toLocaleString("vi-VN")}đ`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})
      return {
        ...result,
        message: `Đã đổi ${input.points} điểm thành ${result.vndAdded.toLocaleString("vi-VN")}đ`,
      }
    }),
})

/**
 * Profile Link Router — endpoints cho /customer/profile xác minh email + liên kết Telegram.
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
  requestEmailVerifyOtp,
  confirmEmailVerify,
  requestTelegramLinkCode,
  unlinkTelegram,
  getTelegramLinkStatus,
} from "@/services/profile-link.service"

const otpCodeSchema = z.string().regex(/^\d{6}$/, "Mã xác minh phải gồm 6 chữ số")

export const profileLinkRouter = createTRPCRouter({
  // ─── Email verify ────────────────────────────────────────────────────────
  requestEmailOtp: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      strictLimiter,
      composeKey("profile.email.otp", String(ctx.user._id)),
      "profile.email.otp"
    )
    await connectDB()
    const result = await requestEmailVerifyOtp(ctx.user._id)
    insertLog({
      userId: ctx.user._id,
      action: "Yêu cầu OTP xác minh email",
      ip: ctx.ip,
    }).catch(() => {})
    return result
  }),

  verifyEmailOtp: protectedProcedure
    .input(z.object({ code: otpCodeSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("profile.email.verify", String(ctx.user._id)),
        "profile.email.verify"
      )
      await connectDB()
      const result = await confirmEmailVerify(ctx.user._id, input.code)
      insertLog({
        userId: ctx.user._id,
        action: "Xác minh email thành công",
        ip: ctx.ip,
      }).catch(() => {})
      return result
    }),

  // ─── Telegram link ───────────────────────────────────────────────────────
  requestTelegramLink: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      strictLimiter,
      composeKey("profile.tele.req", String(ctx.user._id)),
      "profile.tele.req"
    )
    await connectDB()
    return await requestTelegramLinkCode(ctx.user._id)
  }),

  getTelegramStatus: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("profile.tele.status", String(ctx.user._id)),
      "profile.tele.status"
    )
    await connectDB()
    return await getTelegramLinkStatus(ctx.user._id)
  }),

  unlinkTelegram: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      strictLimiter,
      composeKey("profile.tele.unlink", String(ctx.user._id)),
      "profile.tele.unlink"
    )
    await connectDB()
    const result = await unlinkTelegram(ctx.user._id)
    insertLog({
      userId: ctx.user._id,
      action: "Hủy liên kết Telegram",
      ip: ctx.ip,
    }).catch(() => {})
    return result
  }),
})

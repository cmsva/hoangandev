/**
 * Profile Router — Thin tRPC layer cho /customer/profile
 *
 * Mỗi procedure:
 *  - Rate-limit
 *  - Validate input (Zod)
 *  - Connect DB
 *  - Delegate → profile.controller
 *  - Audit log
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  getProfile,
  getRecentLogs,
  changePassword,
  updateFullname,
  updateEmail,
  updateAvatar,
  get2FASetup,
  regenerate2FASecret,
  enable2FA,
  disable2FA,
} from "@/services/profile.service"

const totpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Mã xác minh phải gồm 6 chữ số")

export const profileRouter = createTRPCRouter({
  // ─── Read ────────────────────────────────────────────────────────────────
  get: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("profile.get", String(ctx.user._id)), "profile.get")
    await connectDB()
    return await getProfile(ctx.user._id)
  }),

  get2FASetup: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("profile.2fa.setup", String(ctx.user._id)), "profile.2fa.setup")
    await connectDB()
    return await get2FASetup(ctx.user._id)
  }),

  recentLogs: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("profile.logs", String(ctx.user._id)), "profile.logs")
    await connectDB()
    return await getRecentLogs(ctx.user._id, 5)
  }),

  // ─── Mutations ───────────────────────────────────────────────────────────
  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string().min(1).max(128),
        newPassword: z.string().min(6).max(128),
      })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("profile.changePassword", String(ctx.user._id)),
        "profile.changePassword"
      )
      await connectDB()
      const result = await changePassword(ctx.user._id, input.oldPassword, input.newPassword)
      insertLog({
        userId: ctx.user._id,
        action: "Đổi mật khẩu",
        ip: ctx.ip,
      }).catch(() => {})

      // Notify mail (best-effort)
      void import("@/services/notify.service").then((m) =>
        m.notifyChangePassword({
          userId: ctx.user._id as any,
          ip: ctx.ip,
          device: ctx.headers.get("user-agent"),
        })
      )

      return { ...result, message: "Đổi mật khẩu thành công" }
    }),

  updateFullname: protectedProcedure
    .input(z.object({ fullname: z.string().min(2).max(100) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("profile.updateFullname", String(ctx.user._id)),
        "profile.updateFullname"
      )
      await connectDB()
      const result = await updateFullname(ctx.user._id, input.fullname)
      insertLog({
        userId: ctx.user._id,
        action: `Cập nhật họ tên: ${result.fullname}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { ...result, message: "Cập nhật họ tên thành công" }
    }),

  updateEmail: protectedProcedure
    .input(z.object({ email: z.string().email().max(255) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("profile.updateEmail", String(ctx.user._id)),
        "profile.updateEmail"
      )
      await connectDB()
      const result = await updateEmail(ctx.user._id, input.email)
      insertLog({
        userId: ctx.user._id,
        action: `Đổi email: ${result.email}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { ...result, message: "Đổi email thành công" }
    }),

  updateAvatar: protectedProcedure
    .input(z.object({ avatar: z.string().max(500) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("profile.updateAvatar", String(ctx.user._id)),
        "profile.updateAvatar"
      )
      await connectDB()
      const result = await updateAvatar(ctx.user._id, input.avatar)
      return { ...result, message: "Cập nhật ảnh đại diện thành công" }
    }),

  regenerate2FA: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      strictLimiter,
      composeKey("profile.regen2fa", String(ctx.user._id)),
      "profile.regen2fa"
    )
    await connectDB()
    const result = await regenerate2FASecret(ctx.user._id)
    return { ...result, message: "Đã tạo lại khóa 2FA" }
  }),

  enable2FA: protectedProcedure
    .input(z.object({ code: totpCodeSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("profile.enable2fa", String(ctx.user._id)),
        "profile.enable2fa"
      )
      await connectDB()
      const result = await enable2FA(ctx.user._id, input.code)
      insertLog({
        userId: ctx.user._id,
        action: "Bật 2FA",
        ip: ctx.ip,
      }).catch(() => {})
      return { ...result, message: "Bật 2FA thành công" }
    }),

  disable2FA: protectedProcedure
    .input(z.object({ code: totpCodeSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("profile.disable2fa", String(ctx.user._id)),
        "profile.disable2fa"
      )
      await connectDB()
      const result = await disable2FA(ctx.user._id, input.code)
      insertLog({
        userId: ctx.user._id,
        action: "Tắt 2FA",
        ip: ctx.ip,
      }).catch(() => {})
      return { ...result, message: "Tắt 2FA thành công" }
    }),
})

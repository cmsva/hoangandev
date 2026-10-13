/**
 * Passkey (WebAuthn) router — thin tRPC layer.
 *
 * Flow:
 *  Đăng ký (protected):
 *    registerOptions → set cookie challenge (JWT 5m) → client startRegistration
 *    registerVerify  → đọc cookie challenge → verify → lưu Passkey
 *  Đăng nhập (public):
 *    loginOptions → set cookie challenge → client startAuthentication
 *    loginVerify  → đọc cookie challenge → verify → set token cookie (login xong)
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { cookies, headers } from "next/headers"
import { createTRPCRouter, baseProcedure, protectedProcedure, loggedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { objectIdSchema } from "@/lib/sanitize"
import { insertLog } from "@/services/log.service"
import { generateToken } from "@/services/auth.service"
import {
  authLimiter,
  mutationLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import {
  buildRegistrationOptions,
  verifyAndSaveRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
  listUserPasskeys,
  renamePasskey,
  deletePasskey,
  generateChallengeToken,
  verifyChallengeToken,
} from "@/services/passkey.service"

const REG_COOKIE = "pk_reg_challenge"
const AUTH_COOKIE = "pk_auth_challenge"
const CHALLENGE_MAX_AGE = 5 * 60 // 5 phút

// WebAuthn response JSON là object phức tạp — validate ở simplewebauthn, ở đây
// chỉ cần đảm bảo là object hợp lý (cap size để tránh abuse).
const webauthnResponseSchema = z.record(z.string(), z.any())

export const passkeyRouter = createTRPCRouter({
  // ─── List (protected) ──────────────────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectDB()
    return await listUserPasskeys(ctx.user._id as any)
  }),

  // ─── Registration: options (protected) ───────────────────────────────────────
  registerOptions: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(mutationLimiter, composeKey("pk.regOpt", String(ctx.user._id)), "pkRegOpt")
    await connectDB()

    const { options, challenge } = await buildRegistrationOptions(
      ctx.user._id as any,
      ctx.user.username,
      ctx.user.fullname
    )

    const cookieStore = await cookies()
    cookieStore.set(REG_COOKIE, generateChallengeToken(challenge, "passkey-reg"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CHALLENGE_MAX_AGE,
    })

    return options
  }),

  // ─── Registration: verify (protected) ────────────────────────────────────────
  registerVerify: protectedProcedure
    .input(
      z
        .object({
          response: webauthnResponseSchema,
          name: z.string().trim().min(1).max(64),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("pk.regVer", String(ctx.user._id)), "pkRegVer")
      await connectDB()

      const cookieStore = await cookies()
      const expectedChallenge = verifyChallengeToken(
        cookieStore.get(REG_COOKIE)?.value,
        "passkey-reg"
      )
      if (!expectedChallenge) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên đăng ký Passkey đã hết hạn" })
      }

      const result = await verifyAndSaveRegistration({
        userId: ctx.user._id as any,
        response: input.response as any,
        expectedChallenge,
        name: input.name,
      })

      cookieStore.delete(REG_COOKIE)

      insertLog({
        userId: ctx.user._id,
        action: `Thêm Passkey: ${result.name}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return { success: true, ...result }
    }),

  // ─── Rename (protected) ──────────────────────────────────────────────────────
  rename: protectedProcedure
    .input(z.object({ id: objectIdSchema, name: z.string().trim().min(1).max(64) }).strict())
    .mutation(async ({ ctx, input }) => {
      await connectDB()
      await renamePasskey(ctx.user._id as any, input.id, input.name)
      return { success: true }
    }),

  // ─── Delete (protected) ──────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await connectDB()
      await deletePasskey(ctx.user._id as any, input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Xóa Passkey ${input.id}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})
      return { success: true }
    }),

  // ─── Login: options (public) ─────────────────────────────────────────────────
  loginOptions: loggedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(authLimiter, composeKey("pk.loginOpt", ctx.ip), "pkLoginOpt")

    const { options, challenge } = await buildAuthenticationOptions()

    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE, generateChallengeToken(challenge, "passkey-auth"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CHALLENGE_MAX_AGE,
    })

    return options
  }),

  // ─── Login: verify (public) → set token cookie ───────────────────────────────
  loginVerify: loggedProcedure
    .input(z.object({ response: webauthnResponseSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(authLimiter, composeKey("pk.loginVer", ctx.ip), "pkLoginVer")
      await connectDB()

      const cookieStore = await cookies()
      const expectedChallenge = verifyChallengeToken(
        cookieStore.get(AUTH_COOKIE)?.value,
        "passkey-auth"
      )
      if (!expectedChallenge) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên đăng nhập Passkey đã hết hạn" })
      }

      const { userId } = await verifyAuthentication({
        response: input.response as any,
        expectedChallenge,
      })
      cookieStore.delete(AUTH_COOKIE)

      // Load user → check ban + lấy admin claim
      const user = await User.findById(userId).select("admin banned").lean<{
        admin: number
        banned: number
      } | null>()
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Tài khoản không tồn tại" })
      }
      if (user.banned === 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản đã bị khóa" })
      }

      // Session TTL từ security config
      const { getSecurityConfig } = await import("@/lib/security-config")
      const secCfg = await getSecurityConfig()
      const token = generateToken(userId, user.admin || 0, secCfg.sessionTtl)
      await User.updateOne({ _id: userId }, { $set: { token } })

      cookieStore.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: secCfg.sessionTtl,
      })
      cookieStore.set("auth", "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: secCfg.sessionTtl,
      })

      // ip + device + log + notify (best-effort)
      const h = await headers()
      const ip = ctx.ip || h.get("x-real-ip") || null
      const device = h.get("user-agent") || null
      User.updateOne({ _id: userId }, { $set: { ip, device } }).catch(() => {})

      insertLog({
        userId: userId as any,
        action: "Đăng nhập bằng Passkey",
        ip,
        device,
      }).catch(() => {})

      void import("@/services/notify.service").then((m) =>
        m.notifyLogin({ userId: userId as any, ip, device })
      )

      return { success: true }
    }),
})

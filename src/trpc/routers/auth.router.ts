import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { TRPCError } from "@trpc/server"
import { baseProcedure, protectedProcedure, createTRPCRouter, loggedProcedure } from "../init"
import { registerUser, loginUser, logoutUser } from "@/services/auth.service"
import { User } from "@/models/user.model"
import { insertLog } from "@/services/log.service"
import { cookies, headers } from "next/headers"
import { authLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { consumeAuthLimit } from "@/lib/auth-rate-limit"
import { logger } from "@/lib/logger"

const registerInput = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username chỉ chứa chữ, số và dấu _"),
  fullname: z.string().min(2).max(100).trim(),
  email: z.string().email("Email không hợp lệ").max(255),
  password: z.string().min(6).max(128),
  confirmPassword: z.string().min(6).max(128),
  refId: z.string().max(50).optional(),
  captchaToken: z.string().max(2000).optional(),
})

const loginInput = z.object({
  identifier: z.string().min(1).max(255).trim(),
  password: z.string().min(1).max(128),
  captchaToken: z.string().max(2000).optional(),
})

export const authRouter = createTRPCRouter({
  register: loggedProcedure
    .input(registerInput)
    .mutation(async ({ input, ctx }) => {
      // Check register_enabled từ DB
      const { getSecurityConfig } = await import("@/lib/security-config")
      const secCfg = await getSecurityConfig()
      if (!secCfg.registerEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Đăng ký tài khoản hiện đang tạm đóng" })
      }

      // Rate-limit theo IP — chống brute-force tạo tài khoản (admin cấu hình)
      await consumeAuthLimit("register", composeKey("register", ctx.ip))

      // Verify captcha (nếu admin bật)
      const { verifyCaptcha } = await import("@/lib/captcha")
      const captchaOk = await verifyCaptcha(input.captchaToken, "register", ctx.ip || undefined)
      if (!captchaOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Xác minh captcha thất bại" })
      }

      if (input.password !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu xác nhận không khớp" })
      }

      // ─── Affiliate ref auto-pickup từ cookie nếu form không gửi ────────────
      const cookieStore = await cookies()
      let refIdFinal: string | null = input.refId?.trim() || null
      if (!refIdFinal) {
        const cookie = cookieStore.get("aff_ref")?.value
        if (cookie && /^[a-f0-9]{24}$/i.test(cookie)) {
          refIdFinal = cookie.toLowerCase()
        }
      }
      // Validate format nếu form gửi (zod chỉ check max length)
      if (refIdFinal && !/^[a-f0-9]{24}$/i.test(refIdFinal)) {
        refIdFinal = null
      }

      try {
        const user = await registerUser({
          username: input.username,
          fullname: input.fullname,
          email: input.email,
          password: input.password,
          refId: refIdFinal,
        })

        // Clear aff cookie sau register — ngăn cookie cũ leak qua user khác
        cookieStore.delete("aff_ref")

        // Lưu ip + device vào user (best effort)
        const h = await headers()
        const ip = ctx.ip || h.get("x-real-ip") || null
        const device = h.get("user-agent") || null
        User.updateOne({ _id: user._id }, { $set: { ip, device } }).catch(() => {})

        // Log activity (best effort)
        await insertLog({
          userId: user._id,
          action: "Đăng ký tài khoản mới",
          ip,
          device,
        }).catch((err) => logger.error("insertLog failed", err, { module: "auth.register" }))

        // Notify admin (best-effort)
        void import("@/services/notify.service").then((m) =>
          m.notifyRegister({
            userId: user._id as any,
            ip,
            device,
            ref: refIdFinal,
          })
        )

        return { success: true, user }
      } catch (error: any) {
        if (error.message === "USERNAME_EXISTS") {
          throw new TRPCError({ code: "CONFLICT", message: "Tên đăng nhập đã tồn tại" })
        }
        if (error.message === "EMAIL_EXISTS") {
          throw new TRPCError({ code: "CONFLICT", message: "Email đã được sử dụng" })
        }
        logger.error("register failed", error, { module: "auth.register" })
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Đã xảy ra lỗi" })
      }
    }),

  login: loggedProcedure
    .input(loginInput)
    .mutation(async ({ input, ctx }) => {
      // Load security config 1 lần — quyết định session TTL
      const { getSecurityConfig } = await import("@/lib/security-config")
      const secCfg = await getSecurityConfig()

      // Rate-limit STRICT (admin cấu hình): theo IP + theo identifier (chống credential stuffing)
      const ipKey = composeKey("login:ip", ctx.ip)
      const idKey = composeKey("login:id", input.identifier.toLowerCase())
      await consumeAuthLimit("login", ipKey)
      await consumeAuthLimit("login", idKey)

      // Verify captcha (nếu admin bật)
      const { verifyCaptcha } = await import("@/lib/captcha")
      const captchaOk = await verifyCaptcha(input.captchaToken, "login", ctx.ip || undefined)
      if (!captchaOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Xác minh captcha thất bại" })
      }

      try {
        const { user, token } = await loginUser(input.identifier, input.password, secCfg.sessionTtl)

        // Nếu user bật 2FA → trả tempToken, yêu cầu verify OTP
        if (user.status2fa === 1) {
          const { generateTempToken } = await import("@/services/auth.service")
          const tempToken = generateTempToken(String(user._id))
          return { success: true, requires2FA: true, tempToken, user: null }
        }

        const cookieStore = await cookies()
        cookieStore.set("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: secCfg.sessionTtl,
        })
        // Hint cookie (non-httpOnly) → client biết đã login để mở socket.
        // Token thật vẫn httpOnly; hint chỉ là cờ "1", không chứa dữ liệu nhạy cảm.
        cookieStore.set("auth", "1", {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: secCfg.sessionTtl,
        })

        // Lưu ip + device vào user
        const h = await headers()
        const ip = ctx.ip || h.get("x-real-ip") || null
        const device = h.get("user-agent") || null
        User.updateOne({ _id: user._id }, { $set: { ip, device } }).catch(() => {})

        // Log activity
        await insertLog({
          userId: user._id,
          action: "Đăng nhập vào hệ thống",
          ip,
          device,
        }).catch((err) => logger.error("insertLog failed", err, { module: "auth.login" }))

        // Notify login (mail + tele user) — best-effort
        void import("@/services/notify.service").then((m) =>
          m.notifyLogin({ userId: user._id as any, ip, device })
        )

        return { success: true, requires2FA: false, tempToken: null, user }
      } catch (error: any) {
        if (error.message === "INVALID_CREDENTIALS") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Tên đăng nhập hoặc mật khẩu không đúng" })
        }
        if (error.message === "ACCOUNT_BANNED") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản đã bị khóa" })
        }
        logger.error("login failed", error, { module: "auth.login" })
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Đã xảy ra lỗi" })
      }
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieStore = await cookies()
    cookieStore.delete("token")
    cookieStore.delete("auth")
    // Invalidate server-side token to prevent stolen-token reuse
    await logoutUser(ctx.user._id.toString()).catch((err) =>
      logger.warn("logoutUser failed", { module: "auth.logout", error: (err as Error).message })
    )
    return { success: true }
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user
  }),

  verify2FA: loggedProcedure
    .input(
      z.object({
        tempToken: z.string().min(1),
        code: z.string().regex(/^\d{6}$/, "Mã xác minh phải gồm 6 chữ số"),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      await consumeRateLimit(authLimiter, composeKey("verify2fa", ctx.ip), "verify2fa")

      const { verifyTempToken, generateToken } = await import("@/services/auth.service")
      const userId = verifyTempToken(input.tempToken)
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Phiên xác thực đã hết hạn" })
      }

      // Verify TOTP
      const { connectDB } = await import("@/lib/db")
      await connectDB()
      const user = await User.findById(userId)
      if (!user || !user.secretKey2fa) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tài khoản không tồn tại" })
      }

      // Import verifyTotp helper
      const { authenticator } = await import("otplib")
      authenticator.options = { window: 1, step: 30, digits: 6 }

      // hex → base32
      const hexToBase32 = (hex: string) => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
        let bits = ""
        for (const byte of bytes) bits += byte.toString(2).padStart(8, "0")
        let result = ""
        for (let i = 0; i < bits.length; i += 5) {
          const chunk = bits.slice(i, i + 5).padEnd(5, "0")
          result += alphabet[parseInt(chunk, 2)]
        }
        return result
      }

      const base32 = hexToBase32(user.secretKey2fa)
      const valid = authenticator.verify({ token: input.code, secret: base32 })
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mã xác minh không đúng" })
      }

      // Set cookie — login hoàn tất (session TTL từ security config)
      const { getSecurityConfig: _gsc2 } = await import("@/lib/security-config")
      const secCfg2 = await _gsc2()
      const token = generateToken(userId, user.admin || 0, secCfg2.sessionTtl)
      await User.updateOne({ _id: userId }, { $set: { token } })

      const cookieStore = await cookies()
      cookieStore.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: secCfg2.sessionTtl,
      })
      // Hint cookie (non-httpOnly) → client mở socket sau khi verify 2FA.
      cookieStore.set("auth", "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: secCfg2.sessionTtl,
      })

      // Lưu ip + device
      const h = await headers()
      const ip = ctx.ip || h.get("x-real-ip") || null
      const device = h.get("user-agent") || null
      User.updateOne({ _id: userId }, { $set: { ip, device } }).catch(() => {})

      // Log
      insertLog({
        userId: user._id,
        action: "Đăng nhập (2FA verified)",
        ip,
        device,
      }).catch(() => {})

      // Notify login (mail + tele user) — best-effort
      void import("@/services/notify.service").then((m) =>
        m.notifyLogin({ userId: user._id as any, ip, device })
      )

      return { success: true }
    }),

  // ─── Forgot / Reset password (link-based) ──────────────────────────────────
  forgotPassword: loggedProcedure
    .input(
      z.object({
        email: z.string().email("Email không hợp lệ").max(255),
        captchaToken: z.string().max(2000).optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      // Rate-limit theo IP (admin cấu hình)
      await consumeAuthLimit("forgot", composeKey("forgot", ctx.ip))

      // Verify captcha (nếu admin bật)
      const { verifyCaptcha } = await import("@/lib/captcha")
      const captchaOk = await verifyCaptcha(input.captchaToken, "forgot_password", ctx.ip || undefined)
      if (!captchaOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Xác minh captcha thất bại" })
      }

      const { requestPasswordReset } = await import("@/services/password-reset.service")
      await requestPasswordReset(input.email)

      // Luôn trả message giống nhau — không lộ email tồn tại
      return { success: true, message: "Nếu email tồn tại, link đặt lại đã được gửi" }
    }),

  resetPassword: loggedProcedure
    .input(
      z.object({
        uid: zObjectId,
        token: z.string().min(16).max(200),
        newPassword: z.string().min(6).max(128),
        captchaToken: z.string().max(2000).optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      await consumeRateLimit(authLimiter, composeKey("resetpw", ctx.ip), "resetpw")

      const { verifyCaptcha } = await import("@/lib/captcha")
      const captchaOk = await verifyCaptcha(input.captchaToken, "forgot_password", ctx.ip || undefined)
      if (!captchaOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Xác minh captcha thất bại" })
      }

      const { resetPassword } = await import("@/services/password-reset.service")
      const result = await resetPassword({
        uid: input.uid,
        token: input.token,
        newPassword: input.newPassword,
      })

      // Log + notify đổi mật khẩu (best-effort)
      const h = await headers()
      const ip = ctx.ip || h.get("x-real-ip") || null
      const device = h.get("user-agent") || null
      insertLog({
        userId: result.userId,
        action: "Đặt lại mật khẩu qua email",
        ip,
        device,
      }).catch(() => {})
      void import("@/services/notify.service").then((m) =>
        m.notifyChangePassword({ userId: result.userId, ip, device })
      )

      return { success: true, message: "Đặt lại mật khẩu thành công" }
    }),
})

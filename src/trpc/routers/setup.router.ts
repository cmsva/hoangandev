/**
 * Setup Router — public, không auth (chính xác là chưa thể auth vì chưa có admin).
 *
 * Endpoints:
 *   - status: public query — returns { completed }
 *   - complete: public mutation — chỉ chạy 1 lần khi chưa có admin
 *
 * Rate-limit cứng: strictLimiter trên IP. Không thể flood tạo admin user.
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, baseProcedure } from "../init"
import { strictLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { isSetupComplete, runSetup } from "@/services/setup.service"

const setupSchema = z
  .object({
    // SEO
    siteTitle: z.string().trim().min(1, "Tên website bắt buộc").max(200),
    siteDescription: z.string().trim().max(500).default(""),
    siteKeywords: z.string().trim().max(500).default(""),
    siteAuthor: z.string().trim().max(100).default(""),
    // SMTP
    smtpEnabled: z.boolean(),
    smtpHost: z.string().trim().max(200).default(""),
    smtpPort: z.string().trim().max(10).default("587"),
    smtpSecure: z.boolean(),
    smtpUser: z.string().trim().max(200).default(""),
    smtpPass: z.string().max(500).default(""),
    smtpFrom: z.string().trim().max(200).default(""),
    // Telegram
    telegramEnabled: z.boolean(),
    telegramToken: z.string().trim().max(200).default(""),
    telegramChatId: z.string().trim().max(100).default(""),
    // Contact
    adminEmail: z.string().trim().max(200).default(""),
    adminHotline: z.string().trim().max(50).default(""),
    adminFanpage: z.string().trim().max(300).default(""),
    adminZalo: z.string().trim().max(50).default(""),
    adminTelegram: z.string().trim().max(100).default(""),
    adminName: z.string().trim().max(100).default(""),
    // Admin account
    username: z
      .string()
      .trim()
      .min(3, "Tài khoản tối thiểu 3 ký tự")
      .max(30, "Tài khoản tối đa 30 ký tự")
      .regex(/^[a-z0-9_]+$/i, "Chỉ cho phép a-z, 0-9, _"),
    fullname: z.string().trim().min(1, "Họ tên bắt buộc").max(100),
    email: z.string().trim().email("Email không hợp lệ").max(200),
    password: z
      .string()
      .min(8, "Mật khẩu tối thiểu 8 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
  })
  .strict()

export const setupRouter = createTRPCRouter({
  status: baseProcedure.query(async () => {
    const completed = await isSetupComplete()
    return { completed }
  }),

  complete: baseProcedure.input(setupSchema).mutation(async ({ ctx, input }) => {
    // Rate-limit theo IP (chống flood mỗi IP 5 lần/phút)
    await consumeRateLimit(
      strictLimiter,
      composeKey("setup.complete", ctx.ip || "unknown"),
      "setup.complete"
    )

    try {
      const result = await runSetup(input)
      return { success: true, userId: result.userId }
    } catch (err: any) {
      const msg = err?.message || ""
      if (msg === "SETUP_ALREADY_COMPLETED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hệ thống đã được cài đặt. Không thể chạy lại setup.",
        })
      }
      if (msg === "USERNAME_OR_EMAIL_EXISTS") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Tên tài khoản hoặc email đã tồn tại.",
        })
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: msg || "Không thể hoàn tất setup. Vui lòng thử lại.",
      })
    }
  }),
})

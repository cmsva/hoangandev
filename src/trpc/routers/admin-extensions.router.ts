/**
 * Admin Extensions Router — quản lý OAuth config, Captcha, Mail/Telegram channels,
 * và mail/telegram templates.
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { strictLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { getSiteOptions, setSiteOption, setSiteOptions } from "@/models/setting.model"
import { invalidateMailConfigCache } from "@/lib/send-mail"
import { invalidateTelegramConfigCache } from "@/lib/send-telegram"
import {
  MAIL_TEMPLATE_KEYS,
  getAllMailTemplates,
  saveMailTemplate,
} from "@/lib/mail-template"
import {
  TELEGRAM_TEMPLATE_KEYS,
  getAllTelegramTemplates,
  saveTelegramTemplate,
} from "@/lib/telegram-template"
import {
  getCaptchaConfig,
  saveCaptchaConfig,
  invalidateCaptchaCache,
  type CaptchaProvider,
} from "@/lib/captcha"

// ─── OAuth providers ───────────────────────────────────────────────────────

const OAUTH_PROVIDERS = ["google", "github", "discord", "zalo", "telegram"] as const
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

const OAUTH_KEYS_FOR: Record<OAuthProvider, [string, string]> = {
  google: ["oauth_google_client_id", "oauth_google_client_secret"],
  github: ["oauth_github_client_id", "oauth_github_client_secret"],
  discord: ["oauth_discord_client_id", "oauth_discord_client_secret"],
  zalo: ["oauth_zalo_client_id", "oauth_zalo_client_secret"],
  // Telegram dùng bot_username + bot_token thay cho client_id + client_secret
  telegram: ["oauth_telegram_bot_username", "oauth_telegram_bot_token"],
}

// ─── Mail notify flags ─────────────────────────────────────────────────────

const MAIL_NOTIFY_KEYS = Object.keys(MAIL_TEMPLATE_KEYS) // login, otp, ...

// ═══ Router ════════════════════════════════════════════════════════════════

export const adminExtensionsRouter = createTRPCRouter({
  // ─── OAuth ───────────────────────────────────────────────────────────────
  getOAuthConfig: adminProcedure.query(async () => {
    await connectDB()
    const keys: string[] = []
    for (const provider of OAUTH_PROVIDERS) {
      keys.push(...OAUTH_KEYS_FOR[provider])
    }
    const opts = await getSiteOptions(keys)
    const result: Record<OAuthProvider, { clientId: string; clientSecret: string }> = {
      google: { clientId: "", clientSecret: "" },
      github: { clientId: "", clientSecret: "" },
      discord: { clientId: "", clientSecret: "" },
      zalo: { clientId: "", clientSecret: "" },
      telegram: { clientId: "", clientSecret: "" },
    }
    for (const provider of OAUTH_PROVIDERS) {
      const [idKey, secretKey] = OAUTH_KEYS_FOR[provider]
      result[provider] = {
        clientId: opts[idKey] || "",
        clientSecret: opts[secretKey] || "",
      }
    }
    return result
  }),

  updateOAuthConfig: adminProcedure
    .input(
      z
        .object({
          provider: z.enum(OAUTH_PROVIDERS),
          clientId: z.string().max(500),
          clientSecret: z.string().max(500),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.oauth", String(ctx.user._id)),
        "ext.oauth"
      )
      await connectDB()
      const [idKey, secretKey] = OAUTH_KEYS_FOR[input.provider]
      await setSiteOptions({
        [idKey]: input.clientId.trim(),
        [secretKey]: input.clientSecret.trim(),
      })
      return { success: true }
    }),

  // ─── Notification config (Mail SMTP + Telegram Admin) ────────────────────
  getNotificationConfig: adminProcedure.query(async () => {
    await connectDB()
    const keys = [
      // SMTP core
      "smtp_status",
      "smtp_host",
      "smtp_port",
      "smtp_secure",
      "smtp_user",
      "smtp_pass",
      "smtp_from",
      // SMTP per-template flags
      ...MAIL_NOTIFY_KEYS.map((k) => `smtp_notify_${k}`),
      // Telegram admin
      "telegram_status",
      "telegram_token",
      "telegram_chat_id",
      "telegram_user_status",
      "telegram_webhook_url",
      "oauth_telegram_bot_username",
    ]
    const opts = await getSiteOptions(keys)

    const smtpFlags: Record<string, string> = {}
    for (const k of MAIL_NOTIFY_KEYS) {
      smtpFlags[k] = opts[`smtp_notify_${k}`] || "0"
    }

    return {
      smtp: {
        status: opts.smtp_status || "0",
        host: opts.smtp_host || "",
        port: opts.smtp_port || "587",
        secure: opts.smtp_secure || "0",
        user: opts.smtp_user || "",
        pass: opts.smtp_pass || "",
        from: opts.smtp_from || "",
        flags: smtpFlags,
      },
      telegram: {
        status: opts.telegram_status || "0",
        token: opts.telegram_token || "",
        chatId: opts.telegram_chat_id || "",
        userStatus: opts.telegram_user_status || "0",
        webhookUrl: opts.telegram_webhook_url || "",
        botUsername: opts.oauth_telegram_bot_username || "",
      },
    }
  }),

  updateNotificationConfig: adminProcedure
    .input(
      z
        .object({
          provider: z.enum(["smtp", "telegram"]),
          config: z.record(z.string(), z.string()),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.notif", String(ctx.user._id)),
        "ext.notif"
      )
      await connectDB()
      const entries: Record<string, string> = {}
      const c = input.config

      if (input.provider === "smtp") {
        if (c.status !== undefined) entries.smtp_status = c.status
        if (c.host !== undefined) entries.smtp_host = c.host.trim()
        if (c.port !== undefined) entries.smtp_port = c.port.trim()
        if (c.secure !== undefined) entries.smtp_secure = c.secure
        if (c.user !== undefined) entries.smtp_user = c.user.trim()
        if (c.pass !== undefined) entries.smtp_pass = c.pass
        if (c.from !== undefined) entries.smtp_from = c.from.trim()
        for (const k of MAIL_NOTIFY_KEYS) {
          if (c[k] !== undefined) entries[`smtp_notify_${k}`] = c[k]
        }
        invalidateMailConfigCache()
      } else if (input.provider === "telegram") {
        if (c.status !== undefined) entries.telegram_status = c.status
        if (c.token !== undefined) entries.telegram_token = c.token.trim()
        if (c.chatId !== undefined) entries.telegram_chat_id = c.chatId.trim()
        if (c.userStatus !== undefined) entries.telegram_user_status = c.userStatus
        if (c.webhookUrl !== undefined) entries.telegram_webhook_url = c.webhookUrl.trim()
        if (c.botUsername !== undefined) entries.oauth_telegram_bot_username = c.botUsername.trim().replace(/^@/, "")
        invalidateTelegramConfigCache()
      }

      await setSiteOptions(entries)
      return { success: true }
    }),

  /** Test gửi mail tới admin (verify SMTP). */
  testSmtp: adminProcedure
    .input(z.object({ to: z.string().email().max(200) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.testmail", String(ctx.user._id)),
        "ext.testmail"
      )
      const { sendRawMail } = await import("@/lib/send-mail")
      const res = await sendRawMail(
        input.to,
        "[Test] Cấu hình SMTP",
        `<p>Email test từ hệ thống. Thời gian: ${new Date().toLocaleString("vi-VN")}</p>`
      )
      if (!res.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error || "Gửi mail thất bại",
        })
      }
      return { success: true }
    }),

  /** Test gửi telegram (verify bot config). */
  testTelegram: adminProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      strictLimiter,
      composeKey("admin.ext.testtele", String(ctx.user._id)),
      "ext.testtele"
    )
    const { sendTelegramRaw } = await import("@/lib/send-telegram")
    const res = await sendTelegramRaw(
      `🧪 <b>Test Telegram</b>\nCấu hình hoạt động bình thường.\n🕐 ${new Date().toLocaleString("vi-VN")}`
    )
    if (!res.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: res.error || "Gửi Telegram thất bại",
      })
    }
    return { success: true }
  }),

  /** Đăng ký webhook URL với Telegram (cần để user link account hoạt động). */
  setTelegramWebhook: adminProcedure
    .input(z.object({ webhookUrl: z.string().url().max(500) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.tele.webhook", String(ctx.user._id)),
        "ext.tele.webhook"
      )
      await connectDB()
      const { setTelegramWebhook } = await import("@/lib/send-telegram")
      const { TELEGRAM_WEBHOOK_SECRET } = await import("@/lib/telegram-webhook-constants")
      const res = await setTelegramWebhook(input.webhookUrl, TELEGRAM_WEBHOOK_SECRET)
      if (!res.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error || "Đăng ký webhook thất bại",
        })
      }
      await setSiteOptions({ telegram_webhook_url: input.webhookUrl })
      return { success: true, description: res.description || "Webhook đã đăng ký" }
    }),

  // ─── Captcha ─────────────────────────────────────────────────────────────
  getCaptchaConfig: adminProcedure.query(async () => {
    await connectDB()
    return await getCaptchaConfig()
  }),

  saveCaptchaConfig: adminProcedure
    .input(
      z
        .object({
          provider: z.enum(["none", "recaptcha_v2", "turnstile", "hcaptcha"]),
          siteKey: z.string().max(500),
          secretKey: z.string().max(500),
          functions: z.array(
            z.enum(["register", "login", "forgot_password", "create_ticket", "verify_2fa"])
          ),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.captcha", String(ctx.user._id)),
        "ext.captcha"
      )
      await connectDB()
      await saveCaptchaConfig({
        provider: input.provider as CaptchaProvider,
        siteKey: input.siteKey.trim(),
        secretKey: input.secretKey.trim(),
        functions: input.functions,
      })
      invalidateCaptchaCache()
      return { success: true }
    }),

  // ─── Mail templates ──────────────────────────────────────────────────────
  getMailTemplates: adminProcedure.query(async () => {
    await connectDB()
    return await getAllMailTemplates()
  }),

  saveMailTemplate: adminProcedure
    .input(
      z
        .object({
          key: z.string().min(1).max(100),
          emailTitle: z.string().min(1).max(500),
          emailBody: z.string().min(1).max(100_000),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.tplmail", String(ctx.user._id)),
        "ext.tplmail"
      )
      const validKeys = Object.keys(MAIL_TEMPLATE_KEYS)
      if (!validKeys.includes(input.key)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Template key không hợp lệ" })
      }
      await connectDB()
      await saveMailTemplate(input.key as any, input.emailTitle, input.emailBody)
      return { success: true }
    }),

  // ─── Telegram templates ──────────────────────────────────────────────────
  getTelegramTemplates: adminProcedure.query(async () => {
    await connectDB()
    return await getAllTelegramTemplates()
  }),

  saveTelegramTemplate: adminProcedure
    .input(
      z
        .object({
          key: z.string().min(1).max(100),
          content: z.string().min(1).max(10_000),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.ext.tpltele", String(ctx.user._id)),
        "ext.tpltele"
      )
      const validKeys = Object.keys(TELEGRAM_TEMPLATE_KEYS)
      if (!validKeys.includes(input.key)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Template key không hợp lệ" })
      }
      await connectDB()
      await saveTelegramTemplate(input.key as any, input.content)
      return { success: true }
    }),
})

// Avoid `unused` on setSiteOption for IDE — used internally above is via setSiteOptions
void setSiteOption
